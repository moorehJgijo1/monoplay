// 郊区：棋盘外面、岛上的一圈景观（参考《大富翁 11》和 Monopoly Plus 那种“活的城市”：
// 棋盘外有农田村庄、机场、港口、体育场，车在环岛路上跑、飞机起降、船在海上开）。
// 按四个片区分风格：西北古城→稻田、农家院、水车、茶园、小山；东北金融区→机场、住宅区、体育场；
// 西边海滨→渔村、栈桥、港口；东边游乐园→露营地、热气球、加油站、海上风车。
// 镜头在南边（+z），南边一圈只放矮的东西（沙滩、欢迎花坛、游乐场、停车场、水上乐园），免得挡住棋盘。
// 只是装饰，不影响规则。不会动的小零件都先攒起来，最后按材质合并成少量网格，细节多也不卡。
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { kit, roofCN, makeBuilding, palmTree, FONT } from './buildings.js';
import { makeTree, makeHill, makeRock, rockGeo, blobGeo } from './nature.js';
import { buildAirport } from './sub-airport.js';
import { buildStadium } from './sub-stadium.js';
import { buildHarbor } from './sub-harbor.js';
import { buildSouth } from './sub-south.js';
import { buildPaddies, buildHillPavilion, buildTurbines } from './sub-scenery.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// 一组会动或要单独控制的物体：放在 (x, z)，朝向 ry，返回 [group, kit]
function spot(parent, x, z, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return [g, kit(g)];
}

// IW/ID：岛的半宽/半深；BW/BD：棋盘（含地块）的半宽/半深；rng：可复现的随机数
export function buildSuburbs(scene, { IW, ID, BW, BD, rng }) {
  const root = new THREE.Group();
  scene.add(root);
  const ticks = [];
  const rects = []; // 已经占用的区域，岛上种树时避开
  const reserve = (x0, z0, x1, z1) => rects.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });

  // ---------- 静态零件合批 ----------
  // at(x, z, ry, y) 返回一个局部坐标系，里面的 box/cyl/cone/ball 和 kit 的用法一样，但不单独建网格
  const batches = new Map();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function push(geo, mat, frame, x, y, z, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv2');
    tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0);
    tmpQ.setFromEuler(tmpE);
    tmpS.set(o.sx || 1, o.sy || 1, o.sz || 1);
    tmpP.set(x, y, z);
    tmpM.compose(tmpP, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    g.applyMatrix4(frame);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(g);
  }
  function at(x, z, ry = 0, y = 0) {
    const frame = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    return {
      geo: (geo, mat, x, y, z, o) => push(geo, mat, frame, x, y, z, o),
      box: (w, h, d, mat, x, y, z, o) => push(new THREE.BoxGeometry(w, h, d), mat, frame, x, y + h / 2, z, o),
      cyl: (r1, r2, h, mat, x, y, z, seg = 10, o) => push(new THREE.CylinderGeometry(r1, r2, h, seg), mat, frame, x, y + h / 2, z, o),
      cone: (r, h, mat, x, y, z, seg = 10, o) => push(new THREE.ConeGeometry(r, h, seg), mat, frame, x, y + h / 2, z, o),
      ball: (r, mat, x, y, z, o) => push(new THREE.SphereGeometry(r, 10, 8), mat, frame, x, y, z, o),
    };
  }
  const W0 = at(0, 0); // 世界坐标

  const M = {
    asphalt: std('#4d5866', { roughness: 0.9 }), line: std('#fff6d8'), yellow: std('#ffd43b'), concrete: std('#cfcac0'), white: std('#ffffff'),
    grey: std('#9aa0a6'), dark: std('#36414f'), wood: std('#8a5a2b'), plank: std('#b98a55'), water: std('#4cc0e0', { roughness: 0.12, metalness: 0.1 }),
    sand: std('#f1dca6', { roughness: 1 }), red: std('#e03131'), glass: std('#8fd0ff', { metalness: 0.3, roughness: 0.2 }),
    leaf: std('#4caf50', { roughness: 0.85 }), leaf2: std('#6bcf63', { roughness: 0.85 }), stoneS: std('#a9a499', { roughness: 0.95 }), hay: std('#e8c35a', { flatShading: true }),
    soil: std('#9c7a52'), path: std('#d9c7a0', { roughness: 1 }), stone: std('#b5b0a5', { flatShading: true }), tire: std('#25262b'),
    lampGlow: std('#fff7d6', { emissive: '#ffd56b', emissiveIntensity: 0.5 }), redLight: new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
    green: std('#2f9e44'), orange: std('#ff922b'), blue: std('#1c7ed6'),
  };
  const colorMats = new Map();
  const C = c => { if (!colorMats.has(c)) colorMats.set(c, std(c)); return colorMats.get(c); };
  const CAR_COLORS = ['#e03131', '#1c7ed6', '#f59f00', '#ffffff', '#2f9e44', '#7048e8', '#e64980', '#495057'];

  // ---------- 常用小零件 ----------
  // 路灯：灯杆 + 弯臂 + 灯罩；朝向 ry 那一侧伸出
  function lamp(x, z, ry = 0, h = 0.95) {
    const L = at(x, z, ry);
    L.cyl(0.022, 0.032, h, M.dark, 0, 0, 0, 6);
    L.box(0.2, 0.025, 0.03, M.dark, 0.09, h - 0.02, 0);
    L.box(0.1, 0.04, 0.07, M.dark, 0.18, h - 0.06, 0);
    L.box(0.08, 0.015, 0.05, M.lampGlow, 0.18, h - 0.075, 0);
  }
  function bench(x, z, ry = 0) {
    const B = at(x, z, ry);
    B.box(0.42, 0.03, 0.13, M.plank, 0, 0.12, 0);
    B.box(0.42, 0.1, 0.02, M.plank, 0, 0.17, -0.06);
    for (const sx of [-0.17, 0.17]) B.box(0.03, 0.12, 0.12, M.dark, sx, 0, 0);
  }
  function bush(x, z, s = 1, mat = M.leaf) { const v = Math.floor(rng() * 4); W0.geo(blobGeo(v), mat, x, 0.15 * s, z, { sx: 0.25 * s, sy: 0.2 * s, sz: 0.25 * s, ry: rng() * 6 }); }
  function flowerBed(x, z, w, d, colors) {
    W0.box(w, 0.08, d, M.soil, x, 0, z);
    const n = Math.max(2, Math.round(w / 0.16)), m = Math.max(1, Math.round(d / 0.16));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      W0.geo(new THREE.IcosahedronGeometry(0.06, 0), C(colors[(i + j) % colors.length]), x - w / 2 + (i + 0.5) * w / n, 0.12, z - d / 2 + (j + 0.5) * d / m);
    }
  }
  // 木栅栏：从 (x0,z0) 到 (x1,z1)
  function fence(x0, z0, x1, z1, mat = M.plank, h = 0.22) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
    const F = at((x0 + x1) / 2, (z0 + z1) / 2, ry);
    const n = Math.max(1, Math.round(len / 0.3));
    for (let i = 0; i <= n; i++) F.box(0.04, h, 0.04, mat, -len / 2 + i * len / n, 0, 0);
    F.box(len, 0.03, 0.02, mat, 0, h * 0.45, 0);
    F.box(len, 0.03, 0.02, mat, 0, h * 0.85, 0);
  }
  function rock(x, z, s = 1) { const k = 0.24 * s; W0.geo(rockGeo(Math.floor(rng() * 6), { colors: false }), M.stoneS, x, 0.05 * s, z, { sx: k, sy: k, sz: k, ry: rng() * 6 }); }
  // 停着的小车（静态）
  function parkedCar(x, z, ry, color) {
    const P = at(x, z, ry);
    P.box(0.5, 0.14, 0.26, C(color), 0, 0.05, 0);
    P.box(0.26, 0.12, 0.22, M.glass, -0.04, 0.19, 0);
    for (const [wx, wz] of [[0.15, 0.13], [-0.15, 0.13], [0.15, -0.13], [-0.15, -0.13]]) P.cyl(0.055, 0.055, 0.04, M.tire, wx, 0.015, wz, 8, { rx: Math.PI / 2 });
  }

  // ---------- 环岛路：路沿、白边线、中间虚线、路灯、斑马线；两条车道上车来回跑 ----------
  const RI = 1.4, RR = 3.8, RW = 0.95;
  const rw = IW - RI, rd = ID - RI;
  const shape = new THREE.Shape();
  shape.moveTo(-rw + RR, -rd);
  shape.lineTo(rw - RR, -rd); shape.absarc(rw - RR, -rd + RR, RR, -Math.PI / 2, 0, false);
  shape.lineTo(rw, rd - RR); shape.absarc(rw - RR, rd - RR, RR, 0, Math.PI / 2, false);
  shape.lineTo(-rw + RR, rd); shape.absarc(-rw + RR, rd - RR, RR, Math.PI / 2, Math.PI, false);
  shape.lineTo(-rw, -rd + RR); shape.absarc(-rw + RR, -rd + RR, RR, Math.PI, Math.PI * 1.5, false);
  const pts = shape.getSpacedPoints(480).slice(0, -1).map(p => new THREE.Vector3(p.x, 0, p.y));
  const ring = new THREE.CatmullRomCurve3(pts, true);
  const n = pts.length;
  const sideOf = i => { const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], t = b.clone().sub(a).normalize(); return [t, new THREE.Vector3(-t.z, 0, t.x)]; };
  // 一条沿环路的带子：offset 是离中线的距离，width 宽，y 高度
  function ribbon(offset, width, y, mat) {
    const pos = [], idx = [];
    pts.forEach((p, i) => {
      const [, nn] = sideOf(i);
      const a = offset - width / 2, b = offset + width / 2;
      pos.push(p.x + nn.x * a, y, p.z + nn.z * a, p.x + nn.x * b, y, p.z + nn.z * b);
      const k = i * 2, k2 = ((i + 1) % n) * 2;
      idx.push(k, k2, k + 1, k + 1, k2, k2 + 1);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (geo.attributes.normal.array[1] < 0) { idx.reverse(); geo.setIndex(idx); geo.computeVertexNormals(); }
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    root.add(m);
  }
  ribbon(0, RW + 0.24, 0.025, std('#e4ddcf'));       // 两边的人行道/路沿
  ribbon(0, RW, 0.035, M.asphalt);                    // 路面
  ribbon(RW / 2 - 0.05, 0.03, 0.04, M.line);          // 白边线
  ribbon(-RW / 2 + 0.05, 0.03, 0.04, M.line);
  for (let i = 0; i < n; i += 6) {
    const [t] = sideOf(i);
    W0.box(0.28, 0.01, 0.04, M.yellow, pts[i].x, 0.037, pts[i].z, { ry: -Math.atan2(t.z, t.x) });
  }
  // 路灯：装在路的内侧，灯臂伸向路面
  for (let i = 0; i < n; i += 20) {
    const [t, nn] = sideOf(i), sgn = Math.sign(pts[i].x * nn.x + pts[i].z * nn.z) || 1; // nn 指向岛外时 sgn>0
    const x = pts[i].x - nn.x * sgn * (RW / 2 + 0.2), z = pts[i].z - nn.z * sgn * (RW / 2 + 0.2);
    lamp(x, z, Math.atan2(nn.z * sgn, -nn.x * sgn) + Math.PI);
  }
  // 斑马线：每条直边中间一条
  for (const [x, z, horiz] of [[0, -rd, true], [0, rd, true], [-rw, 0, false], [rw, 0, false]]) {
    for (let k = -3; k <= 3; k++) W0.box(horiz ? 0.08 : RW * 0.85, 0.01, horiz ? RW * 0.85 : 0.08, M.white, x + (horiz ? k * 0.16 : 0), 0.038, z + (horiz ? 0 : k * 0.16));
  }
  function car(color, kind = 0) {
    const [g, K] = spot(root, 0, 0);
    if (kind === 1) {
      // 公交车
      K.box(0.95, 0.3, 0.3, std('#ffd43b', { roughness: 0.4 }), 0, 0.05, 0);
      K.box(0.9, 0.1, 0.31, M.glass, 0, 0.2, 0);
      K.box(0.95, 0.03, 0.3, M.white, 0, 0.35, 0);
    } else {
      K.box(0.5, 0.14, 0.26, std(color, { roughness: 0.4 }), 0, 0.05, 0);
      K.box(0.26, 0.12, 0.22, M.glass, -0.04, 0.19, 0);
      K.box(0.04, 0.04, 0.2, M.lampGlow, 0.25, 0.1, 0);
    }
    const L = kind === 1 ? 0.33 : 0.15;
    for (const [x, z] of [[L, 0.13], [-L, 0.13], [L, -0.13], [-L, -0.13]]) K.cyl(0.055, 0.055, 0.04, M.tire, x, 0.035, z, 8).rotation.x = Math.PI / 2;
    return g;
  }
  const cars = [];
  for (let k = 0; k < 12; k++) cars.push({ g: car(CAR_COLORS[k % CAR_COLORS.length], k === 3 || k === 8 ? 1 : 0), u: k / 12 + rng() * 0.03, dir: k % 2 ? 1 : -1, v: 0.011 + rng() * 0.005 });
  ticks.push((t, dt) => cars.forEach(c => {
    c.u = (c.u + c.dir * c.v * dt + 1) % 1;
    const p = ring.getPointAt(c.u), tg = ring.getTangentAt(c.u).multiplyScalar(c.dir);
    c.g.position.set(p.x - tg.z * 0.22, 0.02, p.z + tg.x * 0.22); // 靠右行驶
    c.g.rotation.y = Math.atan2(-tg.z, tg.x);
  }));

  // 内侧的郊区带：棋盘外缘 → 环岛路内侧
  const IN_W = BW + 0.4, IN_D = BD + 0.4, OUT_W = IW - RI - RW / 2 - 0.4, OUT_D = ID - RI - RW / 2 - 0.4;
  const midN = -(IN_D + OUT_D) / 2, midS = (IN_D + OUT_D) / 2, midW = -(IN_W + OUT_W) / 2, midE = (IN_W + OUT_W) / 2;
  const bandD = OUT_D - IN_D;

  // ---------- 西北：稻田和小山凉亭 ----------
  {
    // 稻田：田埂围着一块块水田，水面反光，秧苗一丛丛；田间有土路和稻草人
    const x0 = -IN_W + 0.3, x1 = -9.2, z0 = -OUT_D + 0.1, z1 = -IN_D - 0.1;
    buildPaddies(root, { x0, x1, z0, z1 });        // 稻田和稻草人：sub-scenery.js
    reserve(x0, z0, x1, z1);

    // 西北角的小山：山上有石阶通到亭子，山脚有石头和松树
    const hx = -OUT_W + 2.2, hz = -OUT_D + 2.0;
    buildHillPavilion(root, { hx, hz, rng });       // 小山和凉亭：sub-scenery.js
    reserve(-OUT_W, -OUT_D, -OUT_W + 4.6, -OUT_D + 4.2);

  }

  // ---------- 北边和东北：机场、体育场 ----------
  {
    const rz = -OUT_D + 0.7, rx0 = 3.0, rx1 = OUT_W - 2.6;
    const ar = buildAirport(root, { rz, rx0, rx1, IW, ID, ticks });      // 机场：sub-airport.js
    reserve(ar.x0, ar.z0, ar.x1, ar.z1);

    // 东边北段：体育场（sub-stadium.js）
    const st = buildStadium(root, { x: midE, z: -4.9 });
    reserve(st.x0, st.z0, st.x1, st.z1);
  }

  // ---------- 西边：海上的港口和货轮 ----------
  {
    buildHarbor(root, { IW, ID, ticks });          // 港口和货轮：sub-harbor.js
  }

  // ---------- 东边：海上风车 ----------
  {
    buildTurbines(root, { IW, ticks });             // 海上风车：sub-scenery.js
  }

  // ---------- 南边（镜头这一侧）：全是矮的 ----------
  {
    const z = midS;
    buildSouth(root, { z, bandD, ID, ticks });      // 沙滩、欢迎花坛、水上乐园、游艇码头：sub-south.js
    reserve(-9.6 - 3.5, z - bandD / 2, -9.6 + 3.5, z + bandD / 2);
    reserve(-1.7, z - 1.6, 1.7, z + 1.5);
    reserve(9.6 - 3.5, z - bandD / 2, 9.6 + 3.5, z + bandD / 2);
    [[-13.6, z - 1.0], [-6.1, z + 1.2]].forEach(([x, zz]) => { const p = palmTree(0.9); p.position.set(x, 0, zz); root.add(p); });
  }

  // ---------- 合并所有静态零件 ----------
  for (const [mat, geos] of batches) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  batches.clear();

  return {
    tick(t, dt) { for (const f of ticks) f(t, dt); },
    // 这个位置是否已经被郊区景观或环岛路占用（种树时避开）
    blocked(x, z, pad = 0.5) {
      if (rects.some(r => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad)) return true;
      const ox = Math.max(0, Math.abs(x) - (rw - RR)), oz = Math.max(0, Math.abs(z) - (rd - RR));
      const d = Math.abs(x) > rw - RR && Math.abs(z) > rd - RR ? Math.hypot(ox, oz) - RR : Math.max(Math.abs(x) - rw, Math.abs(z) - rd);
      return Math.abs(d) < RW / 2 + 0.3 + pad;
    },
  };
}
