// 郊区：棋盘外面、岛上的一圈景观（参考《大富翁 11》和 Monopoly Plus 那种“活的城市”：
// 棋盘外有农田村庄、机场、港口、体育场，车在环岛路上跑、飞机起降、船在海上开）。
// 按四个片区分风格：西北古城→梯田村庄和山；东北金融区→机场、住宅区、体育场；
// 西南海滨→渔村、港口、码头；东南游乐园→热气球营地、水上乐园、海上风车。
// 镜头在南边（+z），南边一圈只放矮的东西，免得挡住棋盘。只是装饰，不影响规则。
import * as THREE from 'three';
import { kit, roofCN, makeBuilding, palmTree, FONT } from './buildings.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// 一组物体：放在 (x, z)，朝向 ry，返回 [group, kit]
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

  const M = {
    asphalt: std('#4d5866', { roughness: 0.9 }), line: std('#fff6d8'), concrete: std('#cfcac0'), white: std('#ffffff'),
    grey: std('#9aa0a6'), dark: std('#36414f'), wood: std('#8a5a2b'), water: std('#4cc0e0', { roughness: 0.15 }),
    grass: std('#7cc35a'), sand: std('#f1dca6'), red: std('#e03131'), glass: std('#8fd0ff', { metalness: 0.3, roughness: 0.2 }),
  };
  const CAR_COLORS = ['#e03131', '#1c7ed6', '#f59f00', '#ffffff', '#2f9e44', '#7048e8', '#e64980', '#495057'];

  // ---------- 环岛路：沿着岛边一圈，两条车道，车子来回跑 ----------
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
  {
    const pos = [], idx = [];
    const n = pts.length;
    pts.forEach((p, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const t = b.clone().sub(a).normalize(), nx = -t.z, nz = t.x;
      pos.push(p.x + nx * RW / 2, 0.03, p.z + nz * RW / 2, p.x - nx * RW / 2, 0.03, p.z - nz * RW / 2);
      const k = i * 2, k2 = ((i + 1) % n) * 2;
      idx.push(k, k + 1, k2, k + 1, k2 + 1, k2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, M.asphalt);
    road.receiveShadow = true;
    root.add(road);
    // 中间的车道虚线
    for (let i = 0; i < n; i += 6) {
      const a = pts[i], b = pts[(i + 1) % n];
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.05), M.line);
      d.position.set(a.x, 0.04, a.z);
      d.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      root.add(d);
    }
  }
  function car(color) {
    const [g, K] = spot(root, 0, 0);
    K.box(0.5, 0.14, 0.26, std(color, { roughness: 0.4 }), 0, 0.05, 0);
    K.box(0.26, 0.12, 0.22, M.glass, -0.04, 0.19, 0);
    for (const [x, z] of [[0.15, 0.13], [-0.15, 0.13], [0.15, -0.13], [-0.15, -0.13]]) {
      K.cyl(0.055, 0.055, 0.04, M.dark, x, 0.035, z, 8).rotation.x = Math.PI / 2;
    }
    return g;
  }
  const cars = [];
  for (let k = 0; k < 10; k++) cars.push({ g: car(CAR_COLORS[k % CAR_COLORS.length]), u: k / 10 + rng() * 0.05, dir: k % 2 ? 1 : -1, v: 0.012 + rng() * 0.006 });
  ticks.push((t, dt) => cars.forEach(c => {
    c.u = (c.u + c.dir * c.v * dt + 1) % 1;
    const p = ring.getPointAt(c.u), tg = ring.getTangentAt(c.u).multiplyScalar(c.dir);
    // 靠右行驶：往前进方向的右边偏一点
    c.g.position.set(p.x - tg.z * 0.22, 0, p.z + tg.x * 0.22);
    c.g.rotation.y = Math.atan2(-tg.z, tg.x);
  }));

  // 内侧的郊区带：棋盘外缘 → 环岛路内侧
  const IN_W = BW + 0.4, IN_D = BD + 0.4, OUT_W = IW - RI - RW / 2 - 0.3, OUT_D = ID - RI - RW / 2 - 0.3;
  const midN = -(IN_D + OUT_D) / 2, midS = (IN_D + OUT_D) / 2, midW = -(IN_W + OUT_W) / 2, midE = (IN_W + OUT_W) / 2;

  // ---------- 西北：梯田、村庄、水车、茶山、带亭子的小山 ----------
  {
    // 稻田：一块块水田，颜色深浅不一，中间有田埂
    const x0 = -IN_W + 0.6, x1 = -4.5, z0 = -OUT_D + 0.2, z1 = -IN_D - 0.2;
    const fieldMats = ['#8fd16a', '#a6dc6f', '#79c25a', '#c9d96a', '#8fcfa8'].map(c => std(c, { roughness: 0.5 }));
    const cw = 1.55, cd = 1.15;
    const rowGeo = new THREE.BoxGeometry(cw - 0.2, 0.05, 0.05), rowMat = std('#5aa845');
    for (let x = x0; x + cw <= x1; x += cw + 0.12) for (let z = z0; z + cd <= z1; z += cd + 0.12) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.06, cd), fieldMats[Math.floor(rng() * fieldMats.length)]);
      f.position.set(x + cw / 2, 0.03, z + cd / 2);
      f.receiveShadow = true;
      root.add(f);
      // 一排排秧苗
      if (rng() < 0.7) for (let r = 0; r < 4; r++) {
        const row = new THREE.Mesh(rowGeo, rowMat);
        row.position.set(x + cw / 2, 0.08, z + 0.2 + r * (cd - 0.4) / 3);
        root.add(row);
      }
    }
    reserve(x0, z0, x1, z1);
    // 村庄：几户青瓦白墙的农家
    const roofTile = std('#3e4b5e', { roughness: 0.6 }), wall = std('#f3ece0');
    [[-8.8, z1 + 0.05], [-7.0, z1 - 0.1], [-11.6, z1 + 0.0]].forEach(([x, z], k) => {
      const [, K] = spot(root, x, z - 0.6, 0);
      K.box(1.0, 0.45, 0.65, wall, 0, 0, 0);
      K.box(0.2, 0.3, 0.02, std('#b8382a'), 0, 0, 0.33);
      roofCN(K, 1.0, 0.65, 0.28, roofTile, 0.45, { finial: k === 0 });
    });
    // 水车：小池塘边上慢慢转
    const [wg, W] = spot(root, -4.0, midN, 0);
    const pond = W.add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), M.water), 0, 0.04, 0);
    pond.rotation.x = -Math.PI / 2;
    pond.castShadow = false;
    W.box(0.1, 0.9, 0.1, M.wood, -0.25, 0, 0.6);
    W.box(0.1, 0.9, 0.1, M.wood, 0.25, 0, 0.6);
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.75, 0.6);
    wg.add(wheel);
    const WK = kit(wheel);
    WK.add(new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 20), M.wood), 0, 0, 0).rotation.y = Math.PI / 2;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const spoke = WK.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.04), M.wood), 0, 0, 0);
      spoke.rotation.x = a;
      const pad = WK.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.16), M.wood), 0, Math.cos(a) * 0.6, Math.sin(a) * 0.6);
      pad.rotation.x = a;
    }
    ticks.push((t, dt) => { wheel.rotation.x -= dt * 0.8; });
    reserve(-5.2, midN - 1.2, -2.8, midN + 1.2);

    // 西北角的小山：山顶一座亭子
    const [, H] = spot(root, -OUT_W + 2.3, -OUT_D + 2.0);
    const hill = H.add(new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), std('#6fae5a', { flatShading: true })), 0, 0, 0);
    hill.scale.set(1, 0.75, 0.9);
    const rock = H.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), std('#9c968a', { flatShading: true })), 0.9, 0.6, 0.6);
    rock.scale.set(1, 0.7, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) H.cyl(0.03, 0.03, 0.4, std('#b8382a'), sx * 0.22, 1.55, sz * 0.22, 6);
    roofCN(H, 0.5, 0.5, 0.3, std('#3e4b5e'), 1.95);
    const pine = std('#2f6b3e', { flatShading: true });
    [[-1.2, 0.2, 0.8], [-0.6, -1.1, 0.9], [1.0, -0.8, 0.7], [-1.4, -0.6, 0.6]].forEach(([x, z, s]) => {
      H.cone(0.35 * s, 0.9 * s, pine, x, 1.6 - Math.hypot(x, z) * 0.55, z, 7);
    });
    reserve(-OUT_W, -OUT_D, -OUT_W + 4.6, -OUT_D + 4.2);

    // 西边北段：一层层的茶园梯田
    const [, T] = spot(root, midW, -6.2);
    const tea = std('#4f9d3c', { flatShading: true }), soil = std('#a07a4d');
    for (let k = 0; k < 3; k++) {
      const w = 3.6 - k * 0.9, d = 4.8 - k * 1.2;
      T.box(w, 0.32, d, soil, 0, k * 0.32, 0);
      for (let r = 0; r < Math.floor(d / 0.4); r++) T.box(w - 0.25, 0.1, 0.18, tea, 0, k * 0.32 + 0.32, -d / 2 + 0.25 + r * 0.4);
    }
    reserve(midW - 1.9, -8.8, midW + 1.9, -3.6);
  }

  // ---------- 东北：机场（飞机会起飞、绕一圈、降落）、住宅区、体育场 ----------
  {
    const rz = -OUT_D + 0.75, rx0 = 3.0, rx1 = OUT_W - 2.6;
    // 跑道：沥青 + 白色中线 + 两头的斑马线
    const runway = new THREE.Mesh(new THREE.BoxGeometry(rx1 - rx0, 0.04, 1.1), M.asphalt);
    runway.position.set((rx0 + rx1) / 2, 0.03, rz);
    runway.receiveShadow = true;
    root.add(runway);
    for (let x = rx0 + 1.2; x < rx1 - 1; x += 0.8) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.01, 0.05), M.line);
      l.position.set(x, 0.055, rz);
      root.add(l);
    }
    for (const xe of [rx0 + 0.35, rx1 - 0.35]) for (let k = -3; k <= 3; k++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.01, 0.06), M.line);
      l.position.set(xe, 0.055, rz + k * 0.13);
      root.add(l);
    }
    // 停机坪和航站楼
    const apronZ = rz + 1.6;
    const apron = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.035, 1.6), M.concrete);
    apron.position.set(rx0 + 4.4, 0.025, apronZ);
    apron.receiveShadow = true;
    root.add(apron);
    const [, A] = spot(root, rx0 + 4.4, apronZ + 1.35);
    A.box(5.0, 0.55, 0.9, M.glass, 0, 0, 0);
    A.box(5.2, 0.08, 1.1, M.white, 0, 0.55, 0);
    const arcRoof = A.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 5.2, 16, 1, false, 0, Math.PI), M.white), 0, 0.6, 0);
    arcRoof.rotation.set(0, 0, Math.PI / 2);
    arcRoof.scale.set(0.4, 1, 1);
    arcRoof.rotation.x = -Math.PI / 2;
    const sign = canvasTex(256, 48, (c, w, h) => { c.fillStyle = '#1c7ed6'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✈ 欢乐城机场', w / 2, h / 2 + 2); });
    A.box(1.6, 0.25, 0.02, new THREE.MeshStandardMaterial({ map: sign }), 0, 0.15, 0.46);
    // 塔台
    const [, C] = spot(root, rx0 + 8.2, apronZ + 1.2);
    C.cyl(0.18, 0.24, 1.6, M.white, 0, 0, 0, 12);
    C.cyl(0.4, 0.3, 0.35, M.glass, 0, 1.6, 0, 12);
    C.cyl(0.44, 0.44, 0.06, M.dark, 0, 1.95, 0, 12);
    C.cyl(0.015, 0.015, 0.4, M.grey, 0, 2.0, 0, 4);
    const beacon = C.ball(0.05, new THREE.MeshBasicMaterial({ color: '#ff3b3b' }), 0, 2.42, 0);
    ticks.push(t => { beacon.visible = Math.sin(t * 5) > 0; });
    reserve(rx0 - 0.3, rz - 0.7, rx1 + 0.3, apronZ + 1.9);

    // 飞机：机头朝 +z（方便 lookAt），机身白色、蓝色尾翼
    function plane(scale = 1) {
      const p = new THREE.Group();
      const K = kit(p);
      const body = K.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.9, 4, 10), M.white), 0, 0, 0);
      body.rotation.x = Math.PI / 2;
      K.box(1.3, 0.03, 0.28, M.white, 0, -0.03, 0.02);
      K.box(0.5, 0.025, 0.14, M.white, 0, 0.02, -0.5);
      K.box(0.025, 0.26, 0.2, std('#1c7ed6'), 0, 0.08, -0.52);
      for (const sx of [-1, 1]) K.cyl(0.045, 0.045, 0.18, M.grey, sx * 0.32, -0.1, 0.08, 8).rotation.x = Math.PI / 2;
      K.box(0.2, 0.02, 0.02, std('#1c7ed6'), 0, 0.03, 0.47);
      p.scale.setScalar(scale);
      root.add(p);
      return p;
    }
    // 停着的一架
    const parked = plane(1.1);
    parked.position.set(rx0 + 2.4, 0.2, apronZ);
    parked.rotation.y = Math.PI * 0.85;
    // 飞的一架：沿着一条闭合的三维航线，地面滑行慢、空中快
    const fy = 0.2;
    const route = new THREE.CatmullRomCurve3([
      [rx0 + 0.8, fy, rz], [rx0 + 4, fy, rz], [rx0 + 8, fy + 0.1, rz], [rx1, 1.2, rz], [rx1 + 6, 3.5, rz - 3],
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

    // 住宅区：东边最北头一片现代小楼（金融区风格）
    const roofs = ['#e03131', '#1c7ed6', '#f59f00', '#2f9e44', '#7048e8', '#e64980'];
    let k = 0;
    for (const x of [midE - 1.0, midE + 1.0]) for (const z of [-IN_D + 0.3, -IN_D + 2.0]) {
      const b = makeBuilding('cbd', 1 + (k % 3), roofs[k % roofs.length]);
      b.children.slice(-2).forEach(m => b.remove(m)); // 去掉地主小旗子
      b.position.set(x, 0, z);
      b.rotation.y = -Math.PI / 2;
      b.scale.setScalar(0.85);
      root.add(b);
      k++;
    }
    reserve(midE - 1.8, -IN_D - 0.5, midE + 1.8, -IN_D + 2.8);

    // 东边北段：体育场
    const [, S] = spot(root, midE, -5.0);
    const bowl = S.add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 0.7, 28, 1, true), std('#e9ecef', { side: THREE.DoubleSide })), 0, 0.35, 0);
    bowl.scale.set(1.75, 1, 2.5);
    const rim = S.add(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 6, 28), std('#1c7ed6')), 0, 0.7, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.75, 2.5, 1);
    const field = canvasTex(64, 96, (c, w, h) => {
      c.fillStyle = '#4caf50'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#43a047'; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 8);
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(4, 4, w - 8, h - 8);
      c.beginPath(); c.moveTo(4, h / 2); c.lineTo(w - 4, h / 2); c.stroke();
      c.beginPath(); c.arc(w / 2, h / 2, 9, 0, Math.PI * 2); c.stroke();
    });
    const pitch = S.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), new THREE.MeshStandardMaterial({ map: field })), 0, 0.06, 0);
    pitch.rotation.x = -Math.PI / 2;
    for (const [x, z] of [[-1.7, -2.3], [1.7, -2.3], [-1.7, 2.3], [1.7, 2.3]]) {
      S.cyl(0.03, 0.04, 1.5, M.grey, x, 0, z, 6);
      S.box(0.35, 0.18, 0.06, std('#fff8d6', { emissive: '#fff3b0', emissiveIntensity: 0.5 }), x, 1.5, z).lookAt(0, 0, 0);
    }
    reserve(midE - 2.0, -7.8, midE + 2.0, -2.2);
  }

  // ---------- 西南：渔村（海滨小屋）+ 海上的港口和货轮 ----------
  {
    const roofs = ['#1c7ed6', '#22b8cf', '#f59f00', '#e64980', '#2f9e44'];
    [[0.5, 0], [2.4, 1], [4.3, 2], [6.2, 1]].forEach(([z, lv], k) => {
      const b = makeBuilding('beach', lv, roofs[k]);
      b.children.slice(-2).forEach(m => b.remove(m));
      b.position.set(midW + 0.6, 0, z);
      b.rotation.y = Math.PI / 2;
      root.add(b);
      const palm = palmTree(1.0);
      palm.position.set(midW - 1.0, 0, z + 0.8);
      root.add(palm);
    });
    reserve(midW - 2, -0.6, midW + 2, 7.8);
    // 港口：建在海里的码头平台，两台门式起重机、一堆集装箱、仓库
    const qx0 = -IW - 0.2, qx1 = -IW - 4.2, qz0 = -1.5, qz1 = 8.5;
    const [, Q] = spot(root, (qx0 + qx1) / 2, (qz0 + qz1) / 2);
    const qw = Math.abs(qx1 - qx0), qd = qz1 - qz0;
    Q.box(qw, 0.25, qd, M.concrete, 0, -0.25, 0);
    for (let z = -qd / 2 + 0.4; z < qd / 2; z += 1.2) Q.cyl(0.08, 0.08, 0.8, M.grey, -qw / 2 + 0.15, -1.0, z, 6);
    // 连到岛上的栈桥
    const [, B] = spot(root, -IW + 0.5, 3.5);
    B.box(2.4, 0.08, 1.0, M.concrete, -0.6, -0.08, 0);
    const boxColors = ['#e03131', '#1c7ed6', '#f59f00', '#2f9e44', '#868e96', '#7048e8'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) for (let h = 0; h < 1 + ((i * 7 + j * 3) % 3); h++) {
      Q.box(0.62, 0.26, 0.26, std(boxColors[(i * 5 + j + h) % boxColors.length]), 0.5 + i * 0.66 - 1.4, h * 0.27, -qd / 2 + 3.4 + j * 0.3);
    }
    Q.box(1.6, 0.7, 1.6, std('#adb5bd'), 0.6, 0, qd / 2 - 1.2);
    Q.box(1.7, 0.08, 1.7, std('#e03131'), 0.6, 0.7, qd / 2 - 1.2);
    for (const cz of [-qd / 2 + 1.2, -qd / 2 + 2.5]) {
      const crane = std('#f59f00');
      for (const sz of [-0.35, 0.35]) for (const sx of [-0.5, 0.5]) Q.box(0.08, 1.9, 0.08, crane, -qw / 2 + 1.0 + sx, 0, cz + sz);
      Q.box(2.8, 0.14, 0.12, crane, -qw / 2 + 0.3, 1.9, cz - 0.35);
      Q.box(2.8, 0.14, 0.12, crane, -qw / 2 + 0.3, 1.9, cz + 0.35);
      Q.box(0.3, 0.25, 0.8, M.white, -qw / 2 + 1.0, 2.04, cz);
    }
    // 靠港的货轮
    function ship(len, color) {
      const s = new THREE.Group();
      const K = kit(s);
      K.box(len, 0.35, 0.7, std(color), 0, -0.2, 0);
      K.box(len * 0.92, 0.06, 0.62, std('#7f2a2a'), 0, -0.26, 0);
      K.box(0.55, 0.55, 0.6, M.white, -len / 2 + 0.4, 0.15, 0);
      K.box(0.12, 0.3, 0.12, std('#212529'), -len / 2 + 0.4, 0.7, 0);
      for (let i = 0; i < Math.floor((len - 1.2) / 0.66); i++) for (let h = 0; h < 2; h++) {
        K.box(0.6, 0.24, 0.6, std(boxColors[(i + h) % boxColors.length]), -len / 2 + 1.1 + i * 0.66, 0.15 + h * 0.25, 0);
      }
      root.add(s);
      return s;
    }
    const docked = ship(4.2, '#2b3442');
    docked.position.set(qx1 - 0.6, -0.55, 3.5);
    docked.rotation.y = Math.PI / 2;
    // 在海上绕岛航行的一艘
    const sail = ship(5, '#1864ab');
    const sea = new THREE.CatmullRomCurve3([
      [-IW - 12, 0, -2], [-IW - 8, 0, ID + 9], [0, 0, ID + 12], [IW + 10, 0, ID + 6], [IW + 13, 0, -6], [IW + 4, 0, -ID - 11], [-6, 0, -ID - 13], [-IW - 10, 0, -ID - 4],
    ].map(a => new THREE.Vector3(...a)), true);
    let su = 0;
    ticks.push((t, dt) => {
      su = (su + dt * 0.0035) % 1;
      const p = sea.getPointAt(su), tg = sea.getTangentAt(su);
      sail.position.set(p.x, -0.55 + Math.sin(t * 1.3) * 0.03, p.z);
      sail.rotation.set(0, Math.atan2(-tg.z, tg.x), Math.sin(t * 1.1) * 0.03);
    });
  }

  // ---------- 东南 + 东边南段：热气球营地、露营地、海上风车 ----------
  {
    const [, F] = spot(root, midE, 4.0);
    F.box(3.6, 0.03, 4.0, std('#9ad97a'), 0, 0, 0);
    // 帐篷和篝火
    ['#ff922b', '#4dabf7', '#ff6b6b'].forEach((c, k) => {
      const tent = F.cone(0.4, 0.55, std(c, { flatShading: true }), -1.0 + k * 0.85, 0, 1.3, 4);
      tent.rotation.y = Math.PI / 4;
    });
    F.cyl(0.15, 0.18, 0.06, std('#6b4423'), 0.1, 0, 0.4, 8);
    const fire = F.cone(0.1, 0.25, new THREE.MeshBasicMaterial({ color: '#ff7a1a' }), 0.1, 0.06, 0.4, 6);
    ticks.push(t => { fire.scale.y = 0.8 + Math.sin(t * 13) * 0.2; });
    // 热气球：三只在营地上空慢慢上下飘
    const balloons = [];
    [['#ff6b6b', '#ffd34d'], ['#4dabf7', '#ffffff'], ['#51cf66', '#ff922b']].forEach(([c1, c2], k) => {
      const tex = canvasTex(128, 16, (c, w) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? c1 : c2; c.fillRect(i * w / 8, 0, w / 8, 16); } });
      const b = new THREE.Group();
      const K = kit(b);
      K.ball(0.55, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 0.75, 0).scale.set(1, 1.15, 1);
      K.cone(0.3, 0.4, new THREE.MeshStandardMaterial({ map: tex }), 0, -0.05, 0, 12).rotation.x = Math.PI;
      K.box(0.22, 0.16, 0.22, std('#8a5a2b'), 0, -0.55, 0);
      for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]]) K.cyl(0.005, 0.005, 0.35, M.dark, x, -0.4, z, 3);
      b.position.set(midE - 1.0 + k * 1.1, 0, 3.0 - k * 0.9);
      root.add(b);
      balloons.push({ b, ph: k * 2.1, h: 3.4 + k * 1.1 });
    });
    ticks.push(t => balloons.forEach(({ b, ph, h }) => { b.position.y = h + Math.sin(t * 0.4 + ph) * 0.6; b.rotation.y = t * 0.1 + ph; }));
    reserve(midE - 2, 1.8, midE + 2, 6.2);
    // 海上风车
    const turbines = [];
    [-9, -1, 7].forEach((z, k) => {
      const [, Tk] = spot(root, IW + 5 + (k % 2) * 2, z);
      Tk.cyl(0.25, 0.3, 0.6, M.concrete, 0, -0.8, 0, 10);
      Tk.cyl(0.06, 0.1, 4.4, M.white, 0, -0.2, 0, 8);
      Tk.box(0.22, 0.18, 0.4, M.white, 0, 4.15, 0);
      const rotor = new THREE.Group();
      rotor.position.set(0, 4.24, 0.24);
      Tk.add(rotor, 0, 4.24, 0.24);
      const RK = kit(rotor);
      RK.ball(0.07, M.white, 0, 0, 0);
      for (let b = 0; b < 3; b++) {
        const arm = new THREE.Group();
        arm.rotation.z = b / 3 * Math.PI * 2;
        rotor.add(arm);
        kit(arm).box(0.09, 1.6, 0.03, M.white, 0, 0, 0);
      }
      turbines.push(rotor);
    });
    ticks.push((t, dt) => turbines.forEach((r, k) => { r.rotation.z += dt * (1.2 + k * 0.15); }));
  }

  // ---------- 南边（镜头这一侧）：全是矮的——沙滩排球、欢迎牌、水上乐园、海上的游艇码头 ----------
  {
    const z = midS;
    // 西段：沙滩 + 排球场 + 躺椅和伞
    const [, S] = spot(root, -9.5, z);
    S.box(7, 0.03, 3.6, M.sand, 0, 0, 0);
    S.box(1.8, 0.01, 1.0, std('#e8c97d'), -1.8, 0.03, 0);
    S.cyl(0.02, 0.02, 0.5, M.white, -1.8, 0, -0.5, 4);
    S.cyl(0.02, 0.02, 0.5, M.white, -1.8, 0, 0.5, 4);
    S.box(0.02, 0.18, 1.0, std('#f8f9fa', { transparent: true, opacity: 0.8 }), -1.8, 0.3, 0);
    ['#ff6b6b', '#4dabf7', '#ffd34d', '#51cf66'].forEach((c, k) => {
      const x = 0.6 + k * 0.85;
      S.cyl(0.015, 0.015, 0.6, M.white, x, 0, -0.5, 4);
      S.cone(0.32, 0.14, std(c), x, 0.55, -0.5, 12);
      S.box(0.18, 0.03, 0.42, M.white, x + 0.05, 0.05, 0.3);
    });
    reserve(-13, z - 1.8, -6, z + 1.8);
    // 中间：欢乐城欢迎牌 + 花坛
    const [, Wl] = spot(root, 0, z + 0.3);
    const tex = canvasTex(512, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#ffa94d');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#fff'; c.font = `bold 72px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢迎来到 欢乐城', w / 2, h / 2 + 4);
    });
    Wl.box(3.2, 0.8, 0.08, new THREE.MeshStandardMaterial({ map: tex }), 0, 0.25, 0);
    Wl.box(0.1, 0.3, 0.1, M.wood, -1.4, 0, 0);
    Wl.box(0.1, 0.3, 0.1, M.wood, 1.4, 0, 0);
    const flowers = ['#ff7aa2', '#ffd43b', '#ffffff', '#c084fc'].map(c => std(c));
    for (let k = 0; k < 40; k++) Wl.ball(0.07, flowers[k % 4], -1.7 + (k % 20) * 0.18, 0.08, 0.35 + Math.floor(k / 20) * 0.18);
    reserve(-2, z - 1, 2, z + 1.2);
    // 东段：水上乐园（几个泳池、一条小滑梯、遮阳伞）
    const [, P] = spot(root, 9.5, z);
    P.box(7, 0.04, 3.6, std('#e9e3d6'), 0, 0, 0);
    const pool = (x, zz, w, d) => { P.box(w + 0.16, 0.08, d + 0.16, M.white, x, 0, zz); P.box(w, 0.02, d, M.water, x, 0.07, zz); };
    pool(-2, -0.4, 2.2, 1.6);
    pool(0.8, 0.3, 1.6, 1.0);
    const lazy = P.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.18, 6, 24), M.water), 2.6, 0.05, -0.2);
    lazy.rotation.x = -Math.PI / 2;
    lazy.scale.z = 0.2;
    P.box(0.3, 0.9, 0.3, std('#ffd34d'), -0.8, 0, -1.3);
    const slide = P.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 1.4), std('#ff6b8a')), -1.1, 0.5, -0.8);
    slide.rotation.x = 0.55;
    slide.rotation.y = 0.6;
    ['#ff922b', '#22b8cf', '#e64980'].forEach((c, k) => { P.cyl(0.015, 0.015, 0.55, M.white, 0.2 + k * 0.9, 0, 1.2, 4); P.cone(0.28, 0.12, std(c), 0.2 + k * 0.9, 0.52, 1.2, 10); });
    reserve(6, z - 1.8, 13, z + 1.8);
    // 海上的游艇码头
    const [, Y] = spot(root, -9, ID + 0.4);
    Y.box(0.5, 0.06, 3.2, std('#b98a55'), 0, -0.1, 1.4);
    for (let k = 0; k < 4; k++) Y.box(1.2, 0.06, 0.25, std('#b98a55'), (k % 2 ? 1 : -1) * 0.8, -0.1, 0.6 + Math.floor(k / 2) * 1.3);
    [[-1.2, 0.95, '#ffffff'], [1.2, 0.95, '#e7f5ff'], [-1.2, 2.25, '#fff4e6'], [1.2, 2.25, '#ffffff']].forEach(([x, zz, c], k) => {
      const [, Bt] = spot(root, -9 + x, ID + 0.4 + zz, 0, -0.6);
      Bt.box(0.9, 0.2, 0.32, std(c), 0, 0, 0);
      Bt.box(0.4, 0.15, 0.24, M.glass, -0.05, 0.2, 0);
      if (k % 2 === 0) { Bt.cyl(0.012, 0.012, 1.2, M.grey, 0.1, 0.2, 0, 4); }
    });
  }

  return {
    tick(t, dt) { for (const f of ticks) f(t, dt); },
    // 这个位置是否已经被郊区景观或环岛路占用（种树时避开）
    blocked(x, z, pad = 0.5) {
      if (rects.some(r => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad)) return true;
      const ox = Math.max(0, Math.abs(x) - (rw - RR)), oz = Math.max(0, Math.abs(z) - (rd - RR));
      const d = Math.abs(x) > rw - RR && Math.abs(z) > rd - RR ? Math.hypot(ox, oz) - RR : Math.max(Math.abs(x) - rw, Math.abs(z) - rd);
      return Math.abs(d) < RW / 2 + pad;
    },
  };
}
