// 郊区：棋盘外面、岛上的一圈景观（参考《大富翁 11》和 Monopoly Plus 那种“活的城市”：
// 棋盘外有农田村庄、机场、港口、体育场，车在环岛路上跑、飞机起降、船在海上开）。
// 按四个片区分风格：西北古城→稻田、农家院、水车、茶园、小山；东北金融区→机场、住宅区、体育场；
// 西边海滨→渔村、栈桥、港口；东边游乐园→露营地、热气球、加油站、海上风车。
// 镜头在南边（+z），南边一圈只放矮的东西（沙滩、欢迎花坛、游乐场、停车场、水上乐园），免得挡住棋盘。
// 只是装饰，不影响规则。不会动的小零件都先攒起来，最后按材质合并成少量网格，细节多也不卡。
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { kit, roofCN, makeBuilding, palmTree, FONT } from './buildings.js';

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
    leaf: std('#4caf50', { flatShading: true }), leaf2: std('#6bcf63', { flatShading: true }), hay: std('#e8c35a', { flatShading: true }),
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
  function bush(x, z, s = 1, mat = M.leaf) { W0.geo(new THREE.IcosahedronGeometry(0.22 * s, 0), mat, x, 0.16 * s, z, { sy: 0.8 }); }
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
  function rock(x, z, s = 1) { W0.geo(new THREE.DodecahedronGeometry(0.2 * s, 0), M.stone, x, 0.08 * s, z, { sy: 0.6, ry: rng() * 3 }); }
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

  // ---------- 西北：稻田、农家院、水车、温室、茶园、小山 ----------
  {
    // 稻田：田埂围着一块块水田，水面反光，秧苗一丛丛；田间有土路和稻草人
    const x0 = -IN_W + 0.3, x1 = -9.2, z0 = -OUT_D + 0.1, z1 = -IN_D - 0.1;
    const waters = ['#9fd8c8', '#a9dcb4', '#b9e0a0', '#cfe39a'].map(c => std(c, { roughness: 0.2, metalness: 0.05 }));
    const tuft = [std('#5aa845', { flatShading: true }), std('#7cc35a', { flatShading: true }), std('#c9b84a', { flatShading: true })];
    const cw = 1.45, cd = 1.2, gap = 0.14;
    let fi = 0;
    for (let x = x0; x + cw <= x1 + 0.01; x += cw + gap) for (let z = z0; z + cd <= z1 + 0.01; z += cd + gap) {
      const cx = x + cw / 2, cz = z + cd / 2, kind = fi++ % 4;
      W0.box(cw + gap, 0.07, cd + gap, M.soil, cx, 0, cz);
      W0.box(cw - 0.06, 0.02, cd - 0.06, waters[kind], cx, 0.07, cz);
      if (kind !== 3) for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        W0.cone(0.05, 0.16 + (kind === 2 ? 0.06 : 0), tuft[kind], cx - cw / 2 + 0.17 + i * (cw - 0.34) / 5, 0.08, cz - cd / 2 + 0.17 + j * (cd - 0.34) / 3, 5);
      }
    }
    // 田间土路
    W0.box(0.24, 0.075, z1 - z0, M.path, x0 + 2 * (cw + gap) - gap / 2, 0, (z0 + z1) / 2);
    // 稻草人
    const S = at(x0 + 2.1, z0 + 0.7);
    S.box(0.04, 0.55, 0.04, M.wood, 0, 0.08, 0);
    S.box(0.4, 0.03, 0.03, M.wood, 0, 0.45, 0);
    S.box(0.18, 0.2, 0.08, C('#c0392b'), 0, 0.33, 0);
    S.ball(0.08, C('#f1d9a7'), 0, 0.62, 0);
    S.cone(0.14, 0.08, M.hay, 0, 0.67, 0, 10);
    reserve(x0, z0, x1, z1);

    // 农家院：正房 + 厢房 + 院墙门楼 + 草垛 + 水井 + 菜地 + 几只鸡
    const roofTile = std('#3e4b5e', { roughness: 0.6 }), wall = std('#f3ece0'), redDoor = std('#b8382a');
    function farmyard(x, z) {
      const [, K] = spot(root, x, z);
      K.box(1.0, 0.45, 0.62, wall, 0, 0, -0.55);
      K.box(0.2, 0.3, 0.02, redDoor, 0, 0, -0.23);
      K.box(0.18, 0.12, 0.02, std('#6b3a1a'), -0.3, 0.2, -0.23);
      K.box(0.18, 0.12, 0.02, std('#6b3a1a'), 0.3, 0.2, -0.23);
      roofCN(K, 1.0, 0.62, 0.26, roofTile, 0.45);
      const side = new THREE.Group();
      K.add(side, -0.62, 0, 0.05).rotation.y = Math.PI / 2;
      const SK = kit(side);
      SK.box(0.6, 0.36, 0.4, wall, 0, 0, 0);
      roofCN(SK, 0.6, 0.4, 0.2, roofTile, 0.36, { finial: false });
      const Y = at(x, z);
      Y.box(1.5, 0.02, 1.5, M.path, 0, 0, 0);
      // 院墙：前面留门
      Y.box(0.87, 0.22, 0.06, wall, -0.315, 0, 0.74);
      Y.box(0.27, 0.22, 0.06, wall, 0.615, 0, 0.74);
      for (const sx of [-1, 1]) Y.box(0.06, 0.22, 1.5, wall, sx * 0.75, 0, 0);
      Y.box(1.56, 0.03, 0.1, roofTile, 0, 0.22, 0.74);
      // 院门：两根柱子 + 小门楼
      Y.box(0.36, 0.06, 0.12, roofTile, 0.3, 0.32, 0.74);
      Y.box(0.05, 0.32, 0.05, redDoor, 0.15, 0, 0.74);
      Y.box(0.05, 0.32, 0.05, redDoor, 0.45, 0, 0.74);
      // 草垛、水井、菜地、鸡
      Y.cone(0.18, 0.32, M.hay, 0.5, 0.02, -0.05, 8);
      Y.cyl(0.18, 0.18, 0.08, M.hay, 0.5, 0.02, -0.05, 8);
      Y.cyl(0.1, 0.1, 0.12, M.stone, 0.05, 0.02, 0.1, 10);
      Y.box(0.02, 0.2, 0.02, M.wood, -0.03, 0.14, 0.1);
      Y.box(0.02, 0.2, 0.02, M.wood, 0.13, 0.14, 0.1);
      Y.box(0.2, 0.02, 0.02, M.wood, 0.05, 0.33, 0.1);
      for (let r = 0; r < 3; r++) Y.box(0.5, 0.05, 0.08, M.soil, -0.35, 0.02, 0.28 + r * 0.14);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) Y.ball(0.035, M.leaf2, -0.55 + c * 0.13, 0.09, 0.28 + r * 0.14);
      for (let k = 0; k < 3; k++) { Y.ball(0.04, M.white, 0.2 + k * 0.12, 0.06, 0.45 - k * 0.07); Y.ball(0.015, M.red, 0.22 + k * 0.12, 0.1, 0.45 - k * 0.07); }
    }
    farmyard(-7.6, midN - 0.4);
    farmyard(-5.6, midN + 0.8);
    // 水车：引水槽 + 池塘 + 小溪
    const [wg, Wk] = spot(root, -4.2, midN - 1.0);
    const pond = Wk.add(new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), M.water), 0, 0.045, 0.3);
    pond.rotation.x = -Math.PI / 2;
    pond.castShadow = false;
    const PW = at(-4.2, midN - 1.0);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; PW.geo(new THREE.DodecahedronGeometry(0.12, 0), M.stone, Math.cos(a) * 0.8, 0.05, 0.3 + Math.sin(a) * 0.8, { sy: 0.6 }); }
    PW.box(0.12, 0.85, 0.12, M.wood, -0.28, 0, -0.3);
    PW.box(0.12, 0.85, 0.12, M.wood, 0.28, 0, -0.3);
    PW.box(0.16, 0.08, 1.2, M.plank, 0, 1.25, -0.9);
    PW.box(0.04, 0.4, 0.04, M.wood, 0, 0.85, -1.4);
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.7, -0.3);
    wg.add(wheel);
    const WK = kit(wheel);
    for (const sx of [-0.12, 0.12]) WK.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 24), M.wood), sx, 0, 0).rotation.y = Math.PI / 2;
    WK.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), M.wood), 0, 0, 0).rotation.z = Math.PI / 2;
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2;
      if (k % 2 === 0) WK.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), M.wood), 0, 0, 0).rotation.x = a;
      WK.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.15), M.plank), 0, Math.cos(a) * 0.6, Math.sin(a) * 0.6).rotation.x = a;
    }
    ticks.push((t, dt) => { wheel.rotation.x -= dt * 0.8; });
    reserve(-9.2, z0, -3.2, z1);

    // 北边中间：一排白色拱棚温室
    for (let k = 0; k < 4; k++) {
      const gx = -2.2 + k * 1.05;
      const arch = new THREE.Shape();
      arch.moveTo(-0.4, 0); arch.absarc(0, 0, 0.4, 0, Math.PI, false); arch.lineTo(-0.4, 0);
      const geo = new THREE.ExtrudeGeometry(arch, { depth: 2.6, bevelEnabled: false, curveSegments: 10 });
      geo.translate(0, 0, -1.3);
      W0.geo(geo, std('#eef6f8', { transparent: true, opacity: 0.85, roughness: 0.2 }), gx, 0, midN - 0.2, { sy: 0.85 });
      for (let r = 0; r < 5; r++) W0.box(0.5, 0.06, 0.12, M.leaf2, gx, 0, midN - 1.25 + r * 0.5);
    }
    W0.box(4.6, 0.02, 0.35, M.path, -0.6, 0, midN + 1.35);
    reserve(-2.8, midN - 1.6, 1.6, midN + 1.6);

    // 西北角的小山：山上有石阶通到亭子，山脚有石头和松树
    const hx = -OUT_W + 2.2, hz = -OUT_D + 2.0;
    const [, H] = spot(root, hx, hz);
    const hill = H.add(new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), std('#6fae5a', { flatShading: true })), 0, 0, 0);
    hill.scale.set(1, 0.75, 0.9);
    const cliff = H.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), std('#9c968a', { flatShading: true })), 0.9, 0.6, 0.6);
    cliff.scale.set(1, 0.7, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) H.cyl(0.03, 0.03, 0.4, std('#b8382a'), sx * 0.22, 1.55, sz * 0.22, 6);
    roofCN(H, 0.5, 0.5, 0.3, std('#3e4b5e'), 1.95);
    const HB = at(hx, hz);
    for (let k = 0; k < 9; k++) {
      const a = -0.4 + k * 0.17, r = 2.0 - k * 0.2;
      HB.box(0.3, 0.05, 0.16, M.stone, Math.sin(a) * r * 0.5 - 0.2, Math.max(0, 1.65 - r * 0.78), Math.cos(a) * r * 0.9, { ry: a });
    }
    const pine = std('#2f6b3e', { flatShading: true });
    [[-1.2, 0.2, 0.8], [-0.6, -1.1, 0.9], [1.0, -0.8, 0.7], [-1.4, -0.6, 0.6], [0.4, 1.2, 0.6]].forEach(([x, z, s]) => {
      const y = Math.max(0, 1.6 - Math.hypot(x, z) * 0.62);
      HB.cyl(0.04 * s, 0.05 * s, 0.25 * s, M.wood, x, y, z, 5);
      HB.cone(0.35 * s, 0.6 * s, pine, x, y + 0.2 * s, z, 7);
      HB.cone(0.26 * s, 0.5 * s, pine, x, y + 0.5 * s, z, 7);
    });
    for (let k = 0; k < 6; k++) rock(hx + Math.cos(k) * 2.4, hz + Math.sin(k) * 2.0, 0.8 + rng());
    reserve(-OUT_W, -OUT_D, -OUT_W + 4.6, -OUT_D + 4.2);

    // 西边北段：茶园梯田，顶上一座茶亭，采茶小路
    const tx = midW, tz = -6.4;
    const T = at(tx, tz);
    const tea = std('#4f9d3c', { flatShading: true }), soil = std('#a07a4d');
    for (let k = 0; k < 3; k++) {
      const w = 3.6 - k * 0.9, d = 4.8 - k * 1.2;
      T.box(w, 0.32, d, soil, 0, k * 0.32, 0);
      for (let r = 0; r < Math.floor(d / 0.36); r++) for (let c = 0; c < Math.floor((w - 0.3) / 0.3); c++) {
        T.geo(new THREE.IcosahedronGeometry(0.11, 0), tea, -w / 2 + 0.3 + c * 0.3, k * 0.32 + 0.36, -d / 2 + 0.22 + r * 0.36, { sy: 0.7 });
      }
    }
    for (let k = 0; k < 3; k++) T.box(0.3, 0.06, 0.4, M.stone, 1.0 - k * 0.45, k * 0.32, 1.9 - k * 0.6);
    const [, TP] = spot(root, tx, tz, 0, 0.96);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) TP.cyl(0.025, 0.025, 0.35, std('#b8382a'), sx * 0.18, 0, sz * 0.18, 6);
    roofCN(TP, 0.42, 0.42, 0.24, std('#3e4b5e'), 0.35);
    reserve(midW - 1.9, tz - 2.5, midW + 1.9, tz + 2.5);
  }

  // ---------- 东北：机场、住宅区、体育场 ----------
  {
    const rz = -OUT_D + 0.7, rx0 = 3.0, rx1 = OUT_W - 2.6, rl = rx1 - rx0;
    // 跑道：沥青、白色中线、两头的入口标记和编号、两边一排跑道灯
    W0.box(rl, 0.04, 1.1, M.asphalt, (rx0 + rx1) / 2, 0.01, rz);
    for (let x = rx0 + 1.4; x < rx1 - 1.2; x += 0.8) W0.box(0.4, 0.01, 0.05, M.line, x, 0.05, rz);
    for (const sx of [-1, 1]) W0.box(rl, 0.01, 0.03, M.line, (rx0 + rx1) / 2, 0.05, rz + sx * 0.5);
    for (const xe of [rx0 + 0.3, rx1 - 0.3]) for (let k = -3; k <= 3; k++) if (k) W0.box(0.36, 0.01, 0.06, M.line, xe, 0.05, rz + k * 0.12);
    const num = txt => new THREE.MeshStandardMaterial({ transparent: true, map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.font = `bold 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2); }) });
    const n09 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), num('09'));
    n09.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    n09.position.set(rx0 + 0.8, 0.052, rz);
    const n27 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), num('27'));
    n27.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    n27.position.set(rx1 - 0.8, 0.052, rz);
    root.add(n09, n27);
    const edgeLight = std('#fff3b0', { emissive: '#ffd43b', emissiveIntensity: 0.8 }), endLight = std('#b2f2bb', { emissive: '#40c057', emissiveIntensity: 0.8 });
    for (let x = rx0; x <= rx1 + 0.01; x += 0.7) for (const sx of [-1, 1]) W0.cyl(0.025, 0.025, 0.05, edgeLight, x, 0.01, rz + sx * 0.62, 6);
    for (let k = -3; k <= 3; k++) { W0.cyl(0.025, 0.025, 0.05, endLight, rx0 - 0.15, 0.01, rz + k * 0.14, 6); W0.cyl(0.025, 0.025, 0.05, M.redLight, rx1 + 0.15, 0.01, rz + k * 0.14, 6); }
    // 滑行道（黄色中线）连接跑道和停机坪
    const apronZ = rz + 1.65, ax = rx0 + 4.4;
    W0.box(0.55, 0.035, 1.1, M.asphalt, rx0 + 7.9, 0.01, rz + 0.95);
    W0.box(0.04, 0.01, 1.1, M.yellow, rx0 + 7.9, 0.045, rz + 0.95);
    W0.box(7.6, 0.035, 1.5, M.concrete, ax, 0.01, apronZ);
    W0.box(7.0, 0.01, 0.04, M.yellow, ax, 0.046, apronZ - 0.35);
    for (let k = 0; k < 3; k++) { W0.box(0.04, 0.01, 0.7, M.yellow, ax - 1.5 + k * 1.5, 0.046, apronZ + 0.05); W0.box(0.3, 0.01, 0.04, M.yellow, ax - 1.5 + k * 1.5, 0.046, apronZ + 0.4); }
    // 航站楼：玻璃幕墙 + 波浪形白色屋顶 + 两条登机廊桥
    const tz = apronZ + 1.25;
    const A = at(ax, tz);
    A.box(5.0, 0.12, 1.0, M.concrete, 0, 0, 0);
    A.box(4.8, 0.5, 0.8, M.glass, 0, 0.12, 0);
    for (let k = 0; k < 13; k++) A.box(0.03, 0.5, 0.82, M.white, -2.4 + k * 0.4, 0.12, 0);
    const wave = new THREE.Shape();
    wave.moveTo(-0.62, 0); wave.quadraticCurveTo(0, 0.42, 0.62, 0); wave.lineTo(0.62, 0.05); wave.quadraticCurveTo(0, 0.48, -0.62, 0.05); wave.closePath();
    const wg2 = new THREE.ExtrudeGeometry(wave, { depth: 5.3, bevelEnabled: false, curveSegments: 12 });
    wg2.translate(0, 0, -2.65);
    A.geo(wg2, M.white, 0, 0.62, 0, { ry: Math.PI / 2 });
    for (const bx of [-1.2, 1.2]) {
      A.box(0.16, 0.16, 0.75, std('#dee2e6'), bx, 0.3, -0.75);
      A.box(0.2, 0.22, 0.2, std('#dee2e6'), bx, 0.25, -1.15);
      A.cyl(0.03, 0.03, 0.3, M.grey, bx, 0, -1.05, 6);
    }
    const sign = canvasTex(256, 48, (c, w, h) => { c.fillStyle = '#1c7ed6'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✈ 欢乐城机场', w / 2, h / 2 + 2); });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshStandardMaterial({ map: sign }));
    sg.position.set(ax, 0.92, tz + 0.52);
    root.add(sg);
    // 塔台
    const [, Ct] = spot(root, rx0 + 9.0, tz - 0.1);
    Ct.cyl(0.16, 0.24, 1.7, M.white, 0, 0, 0, 12);
    Ct.cyl(0.26, 0.26, 0.06, M.dark, 0, 1.7, 0, 12);
    Ct.cyl(0.42, 0.3, 0.35, M.glass, 0, 1.76, 0, 12);
    Ct.cyl(0.46, 0.46, 0.06, M.dark, 0, 2.11, 0, 12);
    Ct.box(0.2, 0.06, 0.2, M.grey, 0, 2.17, 0);
    Ct.cyl(0.012, 0.012, 0.45, M.grey, 0, 2.23, 0, 4);
    const radar = Ct.box(0.3, 0.08, 0.03, M.white, 0, 2.3, 0);
    const beacon = Ct.ball(0.045, M.redLight, 0, 2.7, 0);
    ticks.push((t, dt) => { beacon.visible = Math.sin(t * 5) > 0; radar.rotation.y += dt * 2; });
    // 机库：拱形顶，门口能看到里面一架小飞机
    const hx = rx1 - 1.0, hz = apronZ + 0.95;
    const hang = new THREE.Shape();
    hang.moveTo(-0.8, 0); hang.absarc(0, 0, 0.8, 0, Math.PI, false); hang.closePath();
    const hg = new THREE.ExtrudeGeometry(hang, { depth: 1.5, bevelEnabled: false, curveSegments: 12 });
    hg.translate(0, 0, -0.75);
    W0.geo(hg, std('#ced4da', { metalness: 0.4, roughness: 0.4 }), hx, 0, hz, { sy: 0.8 });
    W0.box(1.2, 0.5, 0.02, std('#495057'), hx, 0, hz - 0.76);
    for (let k = -3; k <= 3; k++) W0.box(0.02, 0.02, 1.5, M.grey, hx + k * 0.22, 0.62 - Math.abs(k) * 0.06, hz, {});
    // 风向袋
    const WS = at(rx1 + 0.7, rz + 0.95);
    WS.cyl(0.015, 0.015, 0.7, M.grey, 0, 0, 0, 4);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.35, 8, 1, true), std('#ff6b00', { side: THREE.DoubleSide }));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(rx1 + 0.88, 0.66, rz + 0.95);
    root.add(sock);
    ticks.push(t => { sock.rotation.y = Math.sin(t * 0.7) * 0.4; sock.rotation.z = Math.PI / 2 - 0.1 + Math.sin(t * 3) * 0.05; });
    // 地勤车：行李拖车、加油车
    const G = at(ax - 2.5, apronZ + 0.25);
    G.box(0.3, 0.12, 0.18, M.yellow, 0, 0.03, 0);
    for (let k = 1; k <= 3; k++) { G.box(0.24, 0.1, 0.16, M.grey, -k * 0.3, 0.03, 0); G.box(0.2, 0.08, 0.14, C(['#e03131', '#1c7ed6', '#2f9e44'][k - 1]), -k * 0.3, 0.13, 0); }
    const Fu = at(ax + 2.6, apronZ + 0.3, 0.3);
    Fu.box(0.2, 0.16, 0.22, M.white, 0.3, 0.03, 0);
    Fu.cyl(0.11, 0.11, 0.48, M.white, -0.05, 0.14, 0, 12, { rz: Math.PI / 2 });
    Fu.box(0.5, 0.02, 0.06, M.red, -0.05, 0.25, 0.1);
    reserve(rx0 - 0.4, rz - 0.75, rx1 + 1.0, tz + 0.6);

    // 飞机：机头朝 +z（方便 lookAt），白色机身、蓝色尾翼和腰线
    function plane(scale = 1) {
      const p = new THREE.Group();
      const K = kit(p);
      K.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.9, 4, 12), M.white), 0, 0, 0).rotation.x = Math.PI / 2;
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.7, 12, 1, true), std('#1c7ed6')), 0, -0.02, 0.05).scale.set(1, 1, 0.25);
      const wing = new THREE.Shape();
      wing.moveTo(0, 0.12); wing.lineTo(0.68, -0.12); wing.lineTo(0.68, -0.22); wing.lineTo(0, -0.1); wing.lineTo(-0.68, -0.22); wing.lineTo(-0.68, -0.12); wing.closePath();
      K.add(new THREE.Mesh(new THREE.ExtrudeGeometry(wing, { depth: 0.025, bevelEnabled: false }), M.white), 0, -0.04, 0.05).rotation.x = Math.PI / 2;
      K.box(0.46, 0.02, 0.12, M.white, 0, 0.03, -0.5);
      K.box(0.022, 0.26, 0.22, std('#1c7ed6'), 0, 0.06, -0.52);
      for (const sx of [-1, 1]) K.cyl(0.045, 0.045, 0.18, M.grey, sx * 0.3, -0.12, 0.05, 8).rotation.x = Math.PI / 2;
      K.box(0.14, 0.04, 0.02, M.dark, 0, 0.06, 0.52);
      for (let k = 0; k < 6; k++) for (const sx of [-1, 1]) K.box(0.01, 0.03, 0.03, M.dark, sx * 0.12, 0.04, 0.35 - k * 0.12);
      p.scale.setScalar(scale);
      root.add(p);
      return p;
    }
    const parked = plane(1.1);
    parked.position.set(ax - 1.2, 0.22, apronZ - 0.1);
    parked.rotation.y = Math.PI;
    const inHangar = plane(0.6);
    inHangar.position.set(hx, 0.13, hz);
    inHangar.rotation.y = Math.PI;
    // 飞的一架：沿着一条闭合的三维航线，地面滑行慢、空中快
    const fy = 0.22;
    const route = new THREE.CatmullRomCurve3([
      [rx0 + 0.8, fy, rz], [rx0 + 4, fy, rz], [rx0 + 8, fy + 0.05, rz], [rx1, 1.2, rz], [rx1 + 6, 3.5, rz - 3],
      [rx1 + 8, 6, -ID - 12], [0, 8, -ID - 20], [-IW - 6, 7, -ID - 10], [-IW + 2, 4, rz - 6], [rx0 - 6, 1.6, rz - 0.8], [rx0 - 2, 0.5, rz],
    ].map(a => new THREE.Vector3(...a)), true, 'centripetal');
    const flyer = plane(1.2);
    let fu = 0;
    ticks.push((t, dt) => {
      const p = route.getPointAt(fu);
      fu = (fu + dt * (p.y < 0.4 ? 0.006 : 0.016)) % 1;
      const q = route.getPointAt(fu), ahead = route.getPointAt((fu + 0.004) % 1);
      flyer.position.copy(q);
      flyer.lookAt(ahead);
      flyer.rotateZ(Math.sin(fu * Math.PI * 2) * 0.25 * Math.min(1, q.y / 3));
    });

    // 住宅区：每户一块草坪、白栅栏、车道和一辆车
    const roofs = ['#e03131', '#1c7ed6', '#f59f00', '#2f9e44', '#7048e8', '#e64980'];
    let k = 0;
    for (const z of [-IN_D - 0.05, -IN_D + 1.75]) for (const x of [midE - 1.05, midE + 1.05]) {
      const Lw = at(x, z);
      Lw.box(1.9, 0.03, 1.6, C('#9ad97a'), 0, 0, 0);
      Lw.box(0.35, 0.035, 0.8, M.concrete, 0.7, 0, 0.4);
      fence(x - 0.95, z + 0.8, x + 0.5, z + 0.8, M.white, 0.16);
      parkedCar(x + 0.7, z + 0.45, Math.PI / 2, CAR_COLORS[(k * 3) % CAR_COLORS.length]);
      bush(x - 0.75, z + 0.55, 0.8);
      bush(x - 0.45, z + 0.6, 0.7, M.leaf2);
      const b = makeBuilding('cbd', 1 + (k % 2), roofs[k % roofs.length]);
      b.children.slice(-2).forEach(m => b.remove(m)); // 去掉地主小旗子
      b.position.set(x - 0.2, 0.03, z - 0.15);
      b.scale.setScalar(0.85);
      root.add(b);
      k++;
    }
    W0.box(0.3, 0.02, 3.6, M.concrete, midE, 0, -IN_D + 0.85);
    reserve(midE - 2.0, -IN_D - 0.9, midE + 2.0, -IN_D + 2.6);

    // 东边北段：体育场——三层看台（蓝白相间）、顶棚、球场、记分牌、灯架，门口一个小停车场
    const sx0 = midE, sz0 = -4.9;
    const S = at(sx0, sz0);
    const ell = (r, h, y, mat, open = true) => S.geo(new THREE.CylinderGeometry(r, r * 0.97, h, 36, 1, open), mat, 0, y + h / 2, 0, { sx: 1.0, sz: 1.42 });
    const seatA = std('#1c7ed6', { side: THREE.DoubleSide }), seatB = std('#e9ecef', { side: THREE.DoubleSide });
    ell(1.55, 0.18, 0, seatB, false);
    ell(1.62, 0.22, 0.18, seatA);
    ell(1.72, 0.22, 0.4, seatB);
    ell(1.82, 0.22, 0.62, seatA);
    ell(1.86, 0.06, 0.84, M.white);
    S.geo(new THREE.TorusGeometry(1.7, 0.18, 4, 36), std('#f8f9fa', { side: THREE.DoubleSide }), 0, 0.95, 0, { rx: Math.PI / 2, sy: 1.42, sz: 0.3 });
    const field = canvasTex(64, 96, (c, w, h) => {
      c.fillStyle = '#4caf50'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#43a047'; for (let y = 0; y < h; y += 12) c.fillRect(0, y, w, 6);
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(5, 5, w - 10, h - 10);
      c.beginPath(); c.moveTo(5, h / 2); c.lineTo(w - 5, h / 2); c.stroke();
      c.beginPath(); c.arc(w / 2, h / 2, 8, 0, Math.PI * 2); c.stroke();
      c.strokeRect(w / 2 - 12, 5, 24, 12); c.strokeRect(w / 2 - 12, h - 17, 24, 12);
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.2), new THREE.MeshStandardMaterial({ map: field }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.set(sx0, 0.19, sz0);
    pitch.scale.set(0.95, 0.95, 1);
    root.add(pitch);
    for (const [x, z] of [[-1.5, -1.9], [1.5, -1.9], [-1.5, 1.9], [1.5, 1.9]]) {
      S.cyl(0.03, 0.04, 1.6, M.grey, x, 0, z, 6);
      S.box(0.36, 0.2, 0.05, std('#fff8d6', { emissive: '#fff3b0', emissiveIntensity: 0.6 }), x, 1.58, z, { ry: Math.atan2(-x, -z) });
    }
    const board = canvasTex(128, 48, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd43b'; c.font = 'bold 30px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('2 : 1', w / 2, h / 2 + 2); });
    S.box(0.06, 0.4, 0.06, M.dark, -0.3, 0.8, -2.45);
    S.box(0.06, 0.4, 0.06, M.dark, 0.3, 0.8, -2.45);
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: board }));
    sb.position.set(sx0, 1.35, sz0 - 2.42);
    root.add(sb);
    reserve(sx0 - 2.0, sz0 - 2.8, sx0 + 2.0, sz0 + 2.8);
  }

  // ---------- 西边：渔村 + 晾鱼架 + 渔船栈桥，海上的港口和货轮 ----------
  {
    const roofs = ['#1c7ed6', '#22b8cf', '#f59f00', '#e64980', '#2f9e44'];
    W0.box(0.35, 0.02, 7.6, M.path, midW + 1.6, 0, 3.4);
    [[0.3, 0], [2.2, 1], [4.1, 2], [6.0, 1]].forEach(([z, lv], k) => {
      const b = makeBuilding('beach', lv, roofs[k]);
      b.children.slice(-2).forEach(m => b.remove(m));
      b.position.set(midW + 0.55, 0, z);
      b.rotation.y = Math.PI / 2;
      root.add(b);
      const palm = palmTree(0.9);
      palm.position.set(midW - 1.25, 0, z + 0.85);
      palm.rotation.y = k * 1.7;
      root.add(palm);
      // 门口的晾鱼架或渔网
      const R = at(midW - 0.7, z - 0.25);
      if (k % 2 === 0) {
        R.box(0.03, 0.35, 0.03, M.wood, -0.25, 0, 0); R.box(0.03, 0.35, 0.03, M.wood, 0.25, 0, 0);
        R.box(0.55, 0.02, 0.02, M.wood, 0, 0.33, 0);
        for (let i = 0; i < 5; i++) R.box(0.04, 0.12, 0.015, C('#adb5bd'), -0.2 + i * 0.1, 0.2, 0);
      } else {
        R.geo(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C('#b58b5a'), 0, 0, 0, { sy: 0.4 });
        R.cyl(0.08, 0.08, 0.12, C('#4dabf7'), 0.3, 0, 0.1, 10);
      }
    });
    reserve(midW - 2, -0.6, midW + 2, 7.6);
    // 渔船栈桥（南边一点），几条小渔船随浪晃
    const jz = 9.6;
    W0.box(3.6, 0.06, 0.4, M.plank, -IW - 1.2, -0.1, jz);
    for (let x = -IW + 0.4; x > -IW - 3; x -= 0.6) for (const s of [-1, 1]) W0.cyl(0.03, 0.03, 0.7, M.wood, x, -0.7, jz + s * 0.18, 5);
    const boats = [];
    [[-IW - 0.8, jz + 0.55, '#e03131'], [-IW - 2.0, jz - 0.55, '#1c7ed6'], [-IW - 2.6, jz + 0.6, '#f59f00']].forEach(([x, z, c], k) => {
      const [g, K] = spot(root, x, z, Math.PI / 2 + k * 0.2, -0.62);
      const hull = new THREE.Shape();
      hull.moveTo(-0.35, 0.05); hull.lineTo(0.3, 0.05); hull.lineTo(0.42, 0.14); hull.lineTo(-0.38, 0.14); hull.closePath();
      K.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hull, { depth: 0.24, bevelEnabled: false }), std(c)), 0, 0, -0.12);
      K.box(0.7, 0.02, 0.2, M.plank, 0, 0.14, 0);
      K.box(0.18, 0.14, 0.16, M.white, -0.15, 0.14, 0);
      K.cyl(0.01, 0.01, 0.4, M.wood, 0.1, 0.14, 0, 4);
      boats.push({ g, ph: k * 1.7 });
    });
    ticks.push(t => boats.forEach(({ g, ph }) => { g.position.y = -0.62 + Math.sin(t * 1.5 + ph) * 0.03; g.rotation.z = Math.sin(t * 1.2 + ph) * 0.05; }));

    // 港口：海里的码头平台
    const qx0 = -IW - 0.2, qx1 = -IW - 4.2, qz0 = -1.5, qz1 = 8.2;
    const qcx = (qx0 + qx1) / 2, qcz = (qz0 + qz1) / 2, qw = Math.abs(qx1 - qx0), qd = qz1 - qz0;
    const Q = at(qcx, qcz);
    Q.box(qw, 0.3, qd, M.concrete, 0, -0.3, 0);
    Q.box(qw, 0.06, qd, std('#8d8a83'), 0, -0.36, 0);
    for (let z = -qd / 2 + 0.3; z < qd / 2; z += 0.9) Q.cyl(0.08, 0.08, 0.6, M.grey, -qw / 2 + 0.15, -0.9, z, 6);
    // 码头边：黄线、系缆桩、轮胎护舷
    Q.box(0.04, 0.005, qd - 0.2, M.yellow, -qw / 2 + 0.35, 0, 0);
    for (let z = -qd / 2 + 0.5; z < qd / 2; z += 0.8) { Q.cyl(0.04, 0.05, 0.1, M.dark, -qw / 2 + 0.15, 0, z, 8); Q.geo(new THREE.TorusGeometry(0.08, 0.03, 6, 10), M.tire, -qw / 2 - 0.01, -0.15, z + 0.4, { ry: Math.PI / 2 }); }
    // 栈桥连到岛上
    const B = at(-IW + 0.4, 3.4);
    B.box(2.4, 0.08, 1.0, M.concrete, -0.6, -0.08, 0);
    for (const s of [-1, 1]) B.box(2.4, 0.1, 0.03, M.grey, -0.6, 0, s * 0.48);
    // 集装箱堆（带竖条纹）
    const boxColors = ['#e03131', '#1c7ed6', '#f59f00', '#2f9e44', '#868e96', '#7048e8'];
    const stripes = boxColors.map(c => new THREE.MeshStandardMaterial({ roughness: 0.7, map: canvasTex(32, 16, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h); }) }));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) for (let h = 0; h < 1 + ((i * 7 + j * 3) % 3); h++) {
      Q.box(0.6, 0.25, 0.25, stripes[(i * 5 + j + h) % stripes.length], 0.45 + i * 0.64 - 1.3, h * 0.26, -qd / 2 + 3.0 + j * 0.28);
    }
    // 仓库：屋顶有一道道棱，墙上写“港口”
    const wx = 0.5, wz = qd / 2 - 1.3;
    Q.box(1.8, 0.65, 1.6, std('#adb5bd'), wx, 0, wz);
    for (let k = 0; k < 7; k++) Q.box(0.12, 0.06, 1.66, std('#e03131'), wx - 0.84 + k * 0.28, 0.65, wz);
    Q.box(0.6, 0.45, 0.02, M.dark, wx, 0, wz - 0.81);
    const ps = canvasTex(128, 48, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c7ed6'; c.font = `bold 32px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢乐港', w / 2, h / 2 + 2); });
    const psm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25), new THREE.MeshStandardMaterial({ map: ps }));
    psm.position.set(qcx + wx, 0.5, qcz + wz + 0.815);
    root.add(psm);
    // 门式起重机：四条腿、横梁伸到海面上、小车和吊钩
    for (const cz of [-qd / 2 + 1.0, -qd / 2 + 2.3]) {
      const crane = std('#f59f00');
      for (const sz of [-0.32, 0.32]) for (const sx of [-0.5, 0.5]) Q.box(0.07, 1.9, 0.07, crane, -qw / 2 + 1.0 + sx, 0, cz + sz);
      for (const sx of [-0.5, 0.5]) Q.box(0.06, 0.06, 0.7, crane, -qw / 2 + 1.0 + sx, 0.9, cz);
      Q.box(3.0, 0.12, 0.1, crane, -qw / 2 + 0.2, 1.9, cz - 0.32);
      Q.box(3.0, 0.12, 0.1, crane, -qw / 2 + 0.2, 1.9, cz + 0.32);
      Q.box(0.3, 0.22, 0.7, M.white, -qw / 2 + 1.25, 2.02, cz);
      Q.box(0.22, 0.12, 0.5, M.dark, -qw / 2 - 0.7, 1.78, cz);
      Q.box(0.01, 0.75, 0.01, M.dark, -qw / 2 - 0.7, 1.03, cz);
      Q.box(0.16, 0.06, 0.12, M.yellow, -qw / 2 - 0.7, 0.98, cz);
    }
    // 集卡
    const Tr = at(qcx + 1.2, qcz - 0.2, Math.PI / 2);
    Tr.box(0.3, 0.26, 0.28, M.blue, 0.55, 0, 0);
    Tr.box(0.9, 0.06, 0.26, M.dark, -0.1, 0.06, 0);
    Tr.box(0.8, 0.25, 0.26, stripes[0], -0.1, 0.12, 0);
    // 货轮
    function ship(len, color) {
      const s = new THREE.Group();
      const K = kit(s);
      const hull = new THREE.Shape();
      hull.moveTo(-len / 2, -0.35); hull.lineTo(len / 2 - 0.4, -0.35); hull.lineTo(len / 2, 0.05); hull.lineTo(-len / 2, 0.05); hull.closePath();
      K.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hull, { depth: 0.7, bevelEnabled: false }), std(color)), 0, 0, -0.35);
      K.box(len * 0.98, 0.04, 0.72, std('#7f2a2a'), -0.02, -0.33, 0);
      K.box(0.6, 0.6, 0.62, M.white, -len / 2 + 0.45, 0.05, 0);
      for (let i = 0; i < 3; i++) K.box(0.62, 0.04, 0.64, M.glass, -len / 2 + 0.45, 0.2 + i * 0.15, 0);
      K.box(0.14, 0.3, 0.14, std('#212529'), -len / 2 + 0.35, 0.65, 0);
      K.box(0.15, 0.06, 0.15, M.red, -len / 2 + 0.35, 0.9, 0);
      for (let i = 0; i < Math.floor((len - 1.4) / 0.62); i++) for (let h = 0; h < 2; h++) {
        K.box(0.58, 0.24, 0.6, stripes[(i + h) % stripes.length], -len / 2 + 1.15 + i * 0.62, 0.05 + h * 0.25, 0);
      }
      root.add(s);
      return s;
    }
    const docked = ship(4.4, '#2b3442');
    docked.position.set(qx1 - 0.6, -0.55, 3.3);
    docked.rotation.y = Math.PI / 2;
    const sail = ship(5, '#1864ab');
    const sea = new THREE.CatmullRomCurve3([
      [-IW - 12, 0, -2], [-IW - 8, 0, ID + 9], [0, 0, ID + 12], [IW + 10, 0, ID + 6], [IW + 13, 0, -6], [IW + 4, 0, -ID - 11], [-6, 0, -ID - 13], [-IW - 10, 0, -ID - 4],
    ].map(a => new THREE.Vector3(...a)), true);
    let su = 0;
    // 船尾的白色浪花
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-3.2, -0.18, 0);
    sail.add(wake);
    ticks.push((t, dt) => {
      su = (su + dt * 0.0035) % 1;
      const p = sea.getPointAt(su), tg = sea.getTangentAt(su);
      sail.position.set(p.x, -0.55 + Math.sin(t * 1.3) * 0.03, p.z);
      sail.rotation.set(0, Math.atan2(-tg.z, tg.x), Math.sin(t * 1.1) * 0.03);
      wake.material.opacity = 0.4 + Math.sin(t * 4) * 0.1;
    });
  }

  // ---------- 东边：加油站、露营地、热气球、海上风车 ----------
  {
    // 加油站（东边中段，靠着环岛路）
    const gx = midE + 0.3, gz = -0.2;
    const Gs = at(gx, gz);
    Gs.box(3.2, 0.03, 2.2, M.concrete, 0, 0, 0);
    Gs.box(2.0, 0.12, 1.2, M.white, -0.1, 0.9, 0.1);
    Gs.box(2.02, 0.05, 1.22, M.red, -0.1, 0.92, 0.1);
    for (const [x, z] of [[-0.9, -0.35], [0.7, -0.35], [-0.9, 0.55], [0.7, 0.55]]) Gs.box(0.07, 0.9, 0.07, M.white, x, 0, z);
    for (const x of [-0.5, 0.3]) { Gs.box(0.3, 0.06, 0.2, M.concrete, x, 0.03, 0.1); Gs.box(0.14, 0.32, 0.12, M.white, x, 0.09, 0.1); Gs.box(0.1, 0.08, 0.01, M.green, x, 0.3, 0.165); }
    Gs.box(0.9, 0.5, 0.6, std('#fff4e6'), -0.95, 0, -0.75);
    Gs.box(0.8, 0.25, 0.02, M.glass, -0.95, 0.08, -0.44);
    Gs.box(0.95, 0.06, 0.65, M.red, -0.95, 0.5, -0.75);
    Gs.box(0.06, 1.1, 0.06, M.dark, 1.3, 0, -0.85);
    Gs.box(0.4, 0.4, 0.06, M.red, 1.3, 1.1, -0.85);
    parkedCar(gx + 0.1, gz + 0.1, 0, '#2f9e44');
    reserve(gx - 1.7, gz - 1.2, gx + 1.7, gz + 1.2);

    // 露营地：木栅栏围着的草地、碎石小路、人字帐篷、野餐桌、房车、篝火圈
    const cx = midE, cz = 4.3;
    const F = at(cx, cz);
    F.box(3.6, 0.025, 3.6, C('#a3dc7f'), 0, 0, 0);
    F.box(0.35, 0.03, 3.6, M.path, -0.2, 0, 0);
    fence(cx - 1.8, cz - 1.8, cx + 1.8, cz - 1.8);
    fence(cx - 1.8, cz + 1.8, cx + 1.8, cz + 1.8);
    fence(cx - 1.8, cz - 1.8, cx - 1.8, cz + 1.8);
    const tentShape = new THREE.Shape();
    tentShape.moveTo(-0.25, 0); tentShape.lineTo(0.25, 0); tentShape.lineTo(0, 0.38); tentShape.closePath();
    ['#ff922b', '#4dabf7', '#ff6b6b', '#51cf66'].forEach((c, k) => {
      const tg = new THREE.ExtrudeGeometry(tentShape, { depth: 0.55, bevelEnabled: false });
      tg.translate(0, 0, -0.275);
      const tx = k < 2 ? -1.1 : 0.8, tz = (k % 2 ? 0.9 : -0.9) - 0.2;
      F.geo(tg, std(c, { flatShading: true }), tx, 0.02, tz, { ry: Math.PI / 2 });
      F.geo(new THREE.PlaneGeometry(0.2, 0.25), M.dark, tx + 0.28, 0.13, tz, { ry: Math.PI / 2 });
    });
    // 野餐桌
    F.box(0.5, 0.04, 0.24, M.plank, 0.85, 0.22, 0.15);
    for (const s of [-1, 1]) { F.box(0.5, 0.03, 0.1, M.plank, 0.85, 0.12, 0.15 + s * 0.22); F.box(0.04, 0.22, 0.2, M.wood, 0.85 + s * 0.2, 0, 0.15); }
    // 房车
    F.box(0.9, 0.42, 0.42, M.white, -1.0, 0.08, 1.35);
    F.box(0.9, 0.08, 0.43, C('#20c997'), -1.0, 0.2, 1.35);
    F.box(0.5, 0.12, 0.44, M.glass, -0.95, 0.34, 1.35);
    for (const x of [-1.3, -0.7]) for (const s of [-1, 1]) F.cyl(0.07, 0.07, 0.04, M.tire, x, 0.07, 1.35 + s * 0.21, 8, { rx: Math.PI / 2 });
    // 篝火圈
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; F.geo(new THREE.DodecahedronGeometry(0.06, 0), M.stone, -0.2 + Math.cos(a) * 0.2, 0.04, -0.1 + Math.sin(a) * 0.2); }
    for (let k = 0; k < 3; k++) { const a = k * 2.1; F.box(0.24, 0.04, 0.04, M.wood, -0.2, 0.08, -0.1, { ry: a, rz: 0.4 }); }
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.8; F.box(0.3, 0.07, 0.07, M.wood, -0.2 + Math.cos(a) * 0.55, 0.03, -0.1 + Math.sin(a) * 0.55, { ry: -a + Math.PI / 2 }); }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), new THREE.MeshBasicMaterial({ color: '#ff7a1a' }));
    fire.position.set(cx - 0.2, 0.2, cz - 0.1);
    const fire2 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), new THREE.MeshBasicMaterial({ color: '#ffd43b' }));
    fire2.position.set(cx - 0.2, 0.16, cz - 0.1);
    root.add(fire, fire2);
    ticks.push(t => { fire.scale.y = 0.8 + Math.sin(t * 13) * 0.2; fire2.scale.y = 0.8 + Math.sin(t * 17 + 1) * 0.25; });
    reserve(cx - 1.9, cz - 1.9, cx + 1.9, cz + 1.9);

    // 热气球：三只在营地上空慢慢上下飘，篮子里有人
    const balloons = [];
    [['#ff6b6b', '#ffd34d'], ['#4dabf7', '#ffffff'], ['#51cf66', '#ff922b']].forEach(([c1, c2], k) => {
      const tex = canvasTex(128, 16, (c, w) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? c1 : c2; c.fillRect(i * w / 12, 0, w / 12, 16); } });
      const b = new THREE.Group();
      const K = kit(b);
      const env = new THREE.LatheGeometry([[0.12, -0.45], [0.35, -0.2], [0.55, 0.2], [0.58, 0.55], [0.48, 0.85], [0.25, 1.02], [0, 1.06]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
      K.add(new THREE.Mesh(env, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })), 0, 0.1, 0);
      K.box(0.2, 0.15, 0.2, std('#8a5a2b'), 0, -0.6, 0);
      K.ball(0.04, C('#f1d9a7'), 0.04, -0.4, 0);
      for (const [x, z] of [[0.09, 0.09], [-0.09, 0.09], [0.09, -0.09], [-0.09, -0.09]]) K.cyl(0.004, 0.004, 0.3, M.dark, x, -0.45, z, 3);
      b.position.set(midE - 1.0 + k * 1.1, 0, 3.0 - k * 1.1);
      root.add(b);
      balloons.push({ b, ph: k * 2.1, h: 4.3 + k * 1.1 });
    });
    ticks.push(t => balloons.forEach(({ b, ph, h }) => { b.position.y = h + Math.sin(t * 0.4 + ph) * 0.6; b.rotation.y = t * 0.1 + ph; }));
    // 海上风车
    const turbines = [];
    [-9, -1, 7].forEach((z, k) => {
      const [, Tk] = spot(root, IW + 5 + (k % 2) * 2, z);
      Tk.cyl(0.3, 0.35, 0.5, M.concrete, 0, -0.8, 0, 10);
      Tk.cyl(0.32, 0.32, 0.06, M.yellow, 0, -0.32, 0, 10);
      Tk.cyl(0.05, 0.1, 4.4, M.white, 0, -0.2, 0, 8);
      Tk.box(0.2, 0.18, 0.45, M.white, 0, 4.12, -0.05);
      const rotor = new THREE.Group();
      Tk.add(rotor, 0, 4.21, 0.22);
      kit(rotor).ball(0.07, M.white, 0, 0, 0);
      for (let b = 0; b < 3; b++) {
        const arm = new THREE.Group();
        arm.rotation.z = b / 3 * Math.PI * 2;
        rotor.add(arm);
        const blade = new THREE.Shape();
        blade.moveTo(-0.03, 0); blade.lineTo(0.06, 0.15); blade.lineTo(0.02, 1.6); blade.lineTo(-0.02, 1.6); blade.closePath();
        kit(arm).add(new THREE.Mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.02, bevelEnabled: false }), M.white), 0, 0, 0);
      }
      turbines.push(rotor);
    });
    ticks.push((t, dt) => turbines.forEach((r, k) => { r.rotation.z += dt * (1.2 + k * 0.15); }));
  }

  // ---------- 南边（镜头这一侧）：全是矮的 ----------
  {
    const z = midS;
    // 西段：沙滩——排球场、遮阳伞和躺椅、浴巾、沙堡、救生椅、椰子树
    const bx = -9.6;
    const sandTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#f1dca6'; c.fillRect(0, 0, w, h); for (let k = 0; k < 160; k++) { c.fillStyle = k % 2 ? '#e4cb8f' : '#fbecc4'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [4, 2]);
    const sand = new THREE.Mesh(new THREE.BoxGeometry(7, 0.04, bandD - 0.2), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
    sand.position.set(bx, 0.02, z);
    sand.receiveShadow = true;
    root.add(sand);
    const S = at(bx, z);
    // 排球场
    S.box(1.9, 0.005, 1.1, std('#e8c97d'), -2.2, 0.04, 0);
    for (const [w, d, x, zz] of [[1.9, 0.03, -2.2, -0.55], [1.9, 0.03, -2.2, 0.55], [0.03, 1.1, -3.15, 0], [0.03, 1.1, -1.25, 0]]) S.box(w, 0.006, d, M.white, x, 0.045, zz);
    S.cyl(0.02, 0.02, 0.5, M.white, -2.2, 0.04, -0.62, 4);
    S.cyl(0.02, 0.02, 0.5, M.white, -2.2, 0.04, 0.62, 4);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.16), new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide, map: canvasTex(64, 16, (c, w, h) => { c.strokeStyle = '#fff'; c.lineWidth = 1; for (let x = 0; x < w; x += 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.fillStyle = '#fff'; c.fillRect(0, 0, w, 2); }) }));
    net.position.set(bx - 2.2, 0.44, z);
    net.rotation.y = Math.PI / 2;
    root.add(net);
    S.ball(0.06, C('#ffd43b'), -2.6, 0.1, 0.2);
    // 伞和躺椅，前面是浴巾
    ['#ff6b6b', '#4dabf7', '#ffd34d', '#51cf66'].forEach((c, k) => {
      const x = -0.3 + k * 0.9;
      const tex = canvasTex(64, 8, (g, w) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c : '#ffffff'; g.fillRect(i * w / 8, 0, w / 8, 8); } });
      S.cyl(0.015, 0.015, 0.62, M.white, x, 0.04, -0.6, 4);
      S.geo(new THREE.ConeGeometry(0.34, 0.14, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }), x, 0.65, -0.6);
      for (const s of [-1, 1]) {
        S.box(0.15, 0.025, 0.36, M.white, x + s * 0.17, 0.09, -0.15);
        S.box(0.15, 0.025, 0.16, M.white, x + s * 0.17, 0.14, -0.38, { rx: 0.7 });
      }
      S.box(0.22, 0.005, 0.42, C(['#e64980', '#20c997', '#fab005', '#7048e8'][k]), x, 0.045, 0.45);
    });
    // 沙堡
    S.box(0.36, 0.1, 0.3, std('#e4c88a'), 2.9, 0.04, 0.6);
    for (const [x, zz] of [[2.75, 0.47], [3.05, 0.47], [2.75, 0.73], [3.05, 0.73]]) { S.cyl(0.05, 0.06, 0.18, std('#e4c88a'), x, 0.04, zz, 8); S.cone(0.06, 0.08, std('#e4c88a'), x, 0.22, zz, 8); }
    S.cyl(0.04, 0.03, 0.08, M.red, 2.55, 0.04, 0.75, 8);
    // 救生椅
    for (const [x, zz] of [[3.0, -0.4], [3.3, -0.4], [3.0, -0.1], [3.3, -0.1]]) S.box(0.03, 0.55, 0.03, M.white, x, 0.04, zz);
    S.box(0.38, 0.03, 0.38, M.white, 3.15, 0.59, -0.25);
    S.box(0.38, 0.22, 0.03, M.red, 3.15, 0.62, -0.42);
    reserve(bx - 3.5, z - bandD / 2, bx + 3.5, z + bandD / 2);
    [[-13.6, z - 1.0], [-6.1, z + 1.2]].forEach(([x, zz]) => { const p = palmTree(0.9); p.position.set(x, 0, zz); root.add(p); });

    // 西段与中间之间：儿童游乐场（滑梯、秋千、跷跷板、沙坑）
    const px = -4.2;
    const Pg = at(px, z);
    Pg.box(2.6, 0.03, 2.4, C('#ffd8a8'), 0, 0, 0);
    Pg.box(0.7, 0.04, 0.7, M.sand, 0.75, 0.03, 0.6);
    Pg.box(0.8, 0.06, 0.06, M.wood, 0.75, 0.03, 0.25); Pg.box(0.8, 0.06, 0.06, M.wood, 0.75, 0.03, 0.95);
    for (const x of [-1.0, -0.2]) for (const zz of [-0.65, -0.35]) Pg.box(0.04, 0.6, 0.04, M.blue, x, 0, zz);
    Pg.box(0.85, 0.04, 0.04, M.blue, -0.6, 0.6, -0.5);
    for (const x of [-0.8, -0.4]) { Pg.box(0.01, 0.38, 0.01, M.grey, x, 0.2, -0.5); Pg.box(0.16, 0.02, 0.1, M.red, x, 0.18, -0.5); }
    Pg.box(0.3, 0.45, 0.3, M.yellow, 0.7, 0, -0.6);
    Pg.box(0.34, 0.04, 0.34, M.red, 0.7, 0.45, -0.6);
    Pg.box(0.18, 0.03, 0.7, M.green, 0.7, 0.24, -0.15, { rx: 0.62 });
    Pg.box(0.6, 0.03, 0.08, M.orange, -0.6, 0.12, 0.6, { rz: 0.2 });
    Pg.box(0.06, 0.1, 0.06, M.dark, -0.6, 0.03, 0.6);
    fence(px - 1.3, z - 1.2, px + 1.3, z - 1.2, M.white, 0.15);
    bench(px - 1.0, z + 0.95);
    reserve(px - 1.4, z - 1.3, px + 1.4, z + 1.3);

    // 中间：欢迎花坛——一圈圈花环、小喷泉，后面是欢迎牌
    const Wl = at(0, z);
    Wl.cyl(1.25, 1.3, 0.08, M.white, 0, 0, 0.1, 32);
    const ringColors = ['#ff7aa2', '#ffd43b', '#c084fc', '#ffffff'];
    for (let r = 0; r < 4; r++) {
      const rr = 1.15 - r * 0.25, cnt = Math.round(rr * 22);
      for (let k = 0; k < cnt; k++) { const a = k / cnt * Math.PI * 2; Wl.geo(new THREE.IcosahedronGeometry(0.07, 0), C(ringColors[r]), Math.cos(a) * rr, 0.13, 0.1 + Math.sin(a) * rr * 0.8, {}); }
    }
    Wl.cyl(0.32, 0.36, 0.12, M.white, 0, 0.08, 0.1, 20);
    Wl.cyl(0.05, 0.06, 0.2, M.white, 0, 0.2, 0.1, 8);
    const tex = canvasTex(512, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#ffa94d');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#fff'; c.font = `bold 72px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢迎来到 欢乐城', w / 2, h / 2 + 4);
    });
    const [, Sg] = spot(root, 0, z - 1.25);
    Sg.box(3.2, 0.75, 0.08, new THREE.MeshStandardMaterial({ map: tex }), 0, 0.3, 0);
    Sg.box(3.3, 0.06, 0.12, M.white, 0, 1.05, 0);
    Sg.box(0.14, 0.32, 0.14, M.stone, -1.45, 0, 0);
    Sg.box(0.14, 0.32, 0.14, M.stone, 1.45, 0, 0);
    const water = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#bff0ff', transparent: true, opacity: 0.7 }));
    water.position.set(0, 0.6, z + 0.1);
    root.add(water);
    ticks.push(t => { water.scale.y = 1 + Math.sin(t * 5) * 0.15; });
    reserve(-1.7, z - 1.6, 1.7, z + 1.5);

    // 中间与东段之间：停车场（白色车位线、几辆车、路灯）
    const kx = 4.2;
    W0.box(2.8, 0.035, 2.4, M.asphalt, kx, 0, z);
    for (let k = 0; k <= 5; k++) for (const s of [-1, 1]) W0.box(0.03, 0.01, 0.7, M.white, kx - 1.25 + k * 0.5, 0.04, z + s * 0.75);
    [[0, -1, '#e03131'], [1, -1, '#1c7ed6'], [3, -1, '#ffffff'], [1, 1, '#f59f00'], [2, 1, '#495057'], [4, 1, '#20c997']].forEach(([i, s, c]) => parkedCar(kx - 1.0 + i * 0.5, z + s * 0.75, Math.PI / 2, c));
    lamp(kx - 1.35, z, 0);
    lamp(kx + 1.35, z, Math.PI);
    reserve(kx - 1.5, z - 1.3, kx + 1.5, z + 1.3);

    // 东段：水上乐园——瓷砖泳池、分道线、螺旋滑梯、懒人河、躺椅、凉亭、围栏
    const wx = 9.6;
    const tile = canvasTex(32, 32, (c, w, h) => { c.fillStyle = '#e9e3d6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d6cfc0'; c.strokeRect(0, 0, w, h); }, [14, 7]);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, bandD - 0.2), new THREE.MeshStandardMaterial({ map: tile }));
    deck.position.set(wx, 0.025, z);
    deck.receiveShadow = true;
    root.add(deck);
    const P = at(wx, z);
    const pool = (x, zz, w, d) => { P.box(w + 0.16, 0.08, d + 0.16, M.white, x, 0, zz); P.box(w, 0.02, d, std('#3bc9db', { roughness: 0.1, metalness: 0.1 }), x, 0.075, zz); };
    pool(-2.0, -0.3, 2.2, 1.5);
    for (let k = 1; k < 4; k++) for (let i = 0; i < 10; i++) P.ball(0.025, i % 2 ? M.red : M.white, -3.0 + i * 0.22, 0.1, -0.3 - 0.75 + k * 0.375);
    pool(0.8, 0.4, 1.4, 1.0);
    P.geo(new THREE.TorusGeometry(0.7, 0.2, 6, 28), M.white, 2.55, 0.03, -0.1, { rx: -Math.PI / 2, sz: 0.25 });
    P.geo(new THREE.TorusGeometry(0.7, 0.14, 6, 28), std('#3bc9db', { roughness: 0.1 }), 2.55, 0.06, -0.1, { rx: -Math.PI / 2, sz: 0.2 });
    // 螺旋滑梯：塔 + 螺旋管
    const [, Tw] = spot(root, wx - 0.3, z - 1.3);
    Tw.box(0.4, 1.0, 0.4, M.yellow, 0, 0, 0);
    Tw.box(0.5, 0.06, 0.5, M.red, 0, 1.0, 0);
    Tw.cone(0.36, 0.3, M.red, 0, 1.06, 0, 4).rotation.y = Math.PI / 4;
    const helix = [];
    for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 3; helix.push(new THREE.Vector3(Math.cos(a) * 0.45, 0.95 - k / 40 * 0.85, Math.sin(a) * 0.45)); }
    helix.push(new THREE.Vector3(-0.2, 0.08, 0.7));
    Tw.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 60, 0.07, 8), std('#ff6b8a', { roughness: 0.4 })), 0.2, 0, 0.2);
    // 躺椅和遮阳伞、凉亭
    ['#ff922b', '#22b8cf', '#e64980'].forEach((c, k) => {
      const x = 0.0 + k * 0.85;
      P.cyl(0.015, 0.015, 0.55, M.white, x, 0.05, 1.25, 4);
      P.cone(0.3, 0.12, C(c), x, 0.55, 1.25, 10);
      P.box(0.15, 0.025, 0.34, M.white, x - 0.18, 0.1, 1.2);
      P.box(0.15, 0.025, 0.34, M.white, x + 0.18, 0.1, 1.2);
    });
    P.box(0.9, 0.04, 0.7, M.plank, 3.0, 0.05, 1.1);
    for (const [x, zz] of [[2.6, 0.8], [3.4, 0.8], [2.6, 1.4], [3.4, 1.4]]) P.box(0.04, 0.5, 0.04, M.white, x, 0.05, zz);
    P.cone(0.65, 0.25, std('#c5a46d', { flatShading: true }), 3.0, 0.55, 1.1, 4, { ry: Math.PI / 4 });
    fence(wx - 3.5, z - bandD / 2 + 0.1, wx + 3.5, z - bandD / 2 + 0.1, M.white, 0.18);
    reserve(wx - 3.5, z - bandD / 2, wx + 3.5, z + bandD / 2);

    // 海上的游艇码头：浮桥、带桅杆的帆船、小快艇
    const yx = -9, yz = ID + 0.3;
    W0.box(0.45, 0.06, 3.4, M.plank, yx, -0.12, yz + 1.5);
    for (let k = 0; k < 6; k++) W0.box(1.1, 0.05, 0.22, M.plank, yx + (k % 2 ? 0.75 : -0.75), -0.12, yz + 0.5 + Math.floor(k / 2) * 1.1);
    const yachts = [];
    [[-1.3, 0.9, 1], [1.3, 0.9, 0], [-1.3, 2.0, 0], [1.3, 2.0, 1], [-1.3, 3.1, 1]].forEach(([x, zz, mast], k) => {
      const [g, Bt] = spot(root, yx + x, yz + zz, 0, -0.62);
      const hull = new THREE.Shape();
      hull.moveTo(-0.45, 0.05); hull.lineTo(0.3, 0.05); hull.lineTo(0.5, 0.18); hull.lineTo(-0.48, 0.18); hull.closePath();
      Bt.add(new THREE.Mesh(new THREE.ExtrudeGeometry(hull, { depth: 0.3, bevelEnabled: false }), M.white), 0, 0, -0.15);
      Bt.box(0.9, 0.02, 0.28, M.plank, -0.02, 0.18, 0);
      Bt.box(0.35, 0.13, 0.22, M.glass, -0.1, 0.2, 0);
      Bt.box(0.9, 0.03, 0.31, C(['#1c7ed6', '#e03131', '#20c997'][k % 3]), 0, 0.1, 0);
      if (mast) {
        Bt.cyl(0.012, 0.012, 1.3, M.grey, 0.05, 0.2, 0, 4);
        const sailS = new THREE.Shape();
        sailS.moveTo(0, 0); sailS.lineTo(0.42, 0); sailS.lineTo(0, 1.05); sailS.closePath();
        const sl = Bt.add(new THREE.Mesh(new THREE.ShapeGeometry(sailS), std('#ffffff', { side: THREE.DoubleSide })), 0.07, 0.35, 0);
        sl.castShadow = true;
      }
      yachts.push({ g, ph: k * 1.3 });
    });
    ticks.push(t => yachts.forEach(({ g, ph }) => { g.position.y = -0.62 + Math.sin(t * 1.4 + ph) * 0.025; g.rotation.x = Math.sin(t * 1.1 + ph) * 0.04; }));
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
