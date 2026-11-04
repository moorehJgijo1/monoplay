// 北边的机场：跑道（标线、编号、跑道灯）、滑行道、停机坪、航站楼（玻璃幕墙 + 波浪屋顶 + 廊桥）、塔台、机库、风向袋，
// 一架停在廊桥边，一架在机库里，一架沿航线起降。飞机按客机的比例建模（机身曲线、后掠翼、发动机、起落架）。
// 用 modeling.js 的零件箱建，会动的（飞行、雷达、风向袋、信标）单独放。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

const slabTex = canvasTex(256, 256, (c, w, h) => {      // 混凝土停机坪：一块块板，缝里有点深色
  c.fillStyle = '#d4cfc4'; c.fillRect(0, 0, w, h);
  let t = 5; const r = () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; };
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const v = 204 + Math.floor(r() * 14); c.fillStyle = `rgb(${v},${v - 4},${v - 12})`; c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); }
  c.globalAlpha = 0.15; for (let i = 0; i < 400; i++) { c.fillStyle = r() > 0.5 ? '#8a8578' : '#fff'; c.fillRect(r() * w, r() * h, 2, 2); } c.globalAlpha = 1;
});
const signTex = canvasTex(512, 96, (c, w, h) => {
  c.fillStyle = '#1c5fb0'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffffff'; c.font = `bold 58px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢乐城国际机场', w / 2, h / 2 + 4);
});
const sockTex = canvasTex(128, 32, (c, w, h) => { for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff6b00'; c.fillRect(i * w / 5, 0, w / 5 + 1, h); } });
const numTex = txt => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#f4f1e8'; c.font = `bold 84px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 6); });

const M = {
  asphalt: mat('#4a5058', { map: TEX.asphalt, tile: 2, roughness: 0.9 }),
  apron: mat('#ffffff', { map: slabTex, tile: 1.6, roughness: 0.85 }),
  line: mat('#f4f1e8', { roughness: 0.7 }),
  yellow: mat('#ffd43b', { roughness: 0.6 }),
  white: mat('#f7f8fa', { roughness: 0.4 }),
  whiteD: mat('#f7f8fa', { roughness: 0.4, side: THREE.DoubleSide }),
  grey: mat('#aeb4bb', { metalness: 0.4, roughness: 0.45 }),
  greyD: mat('#6c737c', { metalness: 0.4, roughness: 0.5 }),
  dark: mat('#2b3442', { roughness: 0.4, metalness: 0.2 }),
  glass: mat('#ffffff', { map: TEX.curtain, tile: [1, 1.2], roughness: 0.1, metalness: 0.4, envMapIntensity: 1.3 }),
  glassC: mat('#bfe6ff', { glass: true, transparent: true, opacity: 0.55 }),
  sign: mat('#ffffff', { map: signTex, roughness: 0.4 }),
  blue: mat('#1c7ed6', { roughness: 0.35 }),
  edge: mat('#fff3b0', { emissive: '#ffd43b', emissiveIntensity: 0.9, roughness: 0.4 }),
  endG: mat('#b2f2bb', { emissive: '#40c057', emissiveIntensity: 0.9 }),
  endR: mat('#ffa8a8', { emissive: '#fa5252', emissiveIntensity: 0.9 }),
  hangar: mat('#ced4da', { metalness: 0.5, roughness: 0.35 }),
  tyre: mat('#2a2d33', { roughness: 0.8 }),
  stripe: mat('#ffffff', { map: sockTex, roughness: 0.7, side: THREE.DoubleSide }),
};

// ───── 客机：机头朝 +z ─────
export function makePlane(livery = '#1c7ed6') {
  const g = new THREE.Group(), k = mkit(g), lv = mat(livery, { roughness: 0.35 });
  // 机身：机头圆润、机尾收细的旋转体
  k.geo(new THREE.LatheGeometry([[0.001, 0.66], [0.035, 0.645], [0.085, 0.58], [0.115, 0.45], [0.125, 0.3], [0.127, 0.0], [0.122, -0.25], [0.095, -0.45], [0.055, -0.58], [0.02, -0.66], [0.001, -0.68]].reverse().map(([a, b]) => new THREE.Vector2(a, b)), 24), M.white, 0, 0, 0, [Math.PI / 2, 0, 0]);
  k.geo(new THREE.CylinderGeometry(0.1285, 0.1285, 0.5, 24, 1, true), lv, 0, -0.045, 0.02, [Math.PI / 2, 0, 0], [1, 0.4, 1]);   // 腰线
  k.box(0.17, 0.035, 0.07, M.dark, 0, 0.05, 0.46, 0);                                    // 驾驶舱风挡
  for (let i = 0; i < 11; i++) for (const s of [-1, 1]) k.box(0.006, 0.022, 0.03, M.dark, s * 0.126, 0.035, 0.34 - i * 0.075, 0);   // 舷窗
  // 机翼：后掠翼，两侧对称，薄板有厚度
  for (const s of [-1, 1]) {
    const mirror = pts => (s > 0 ? pts : pts.map(([x, y]) => [-x, y]).reverse());
    const sh = new THREE.Shape(mirror([[0.09, -0.12], [0.78, 0.18], [0.78, 0.29], [0.09, 0.1]]).map(([x, y]) => new THREE.Vector2(x, y)));
    const w = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false });
    w.rotateX(-Math.PI / 2);
    k.geo(w, M.white, 0, -0.045, 0.0, [0, 0, s * 0.06]);
    k.box(0.03, 0.06, 0.1, lv, s * 0.78, -0.03, -0.2, 0.01);                              // 翼梢小翼
    // 发动机：吊舱 + 进气口环
    k.cyl(0.042, 0.036, 0.26, M.grey, s * 0.3, -0.115, 0.06, 14, [Math.PI / 2, 0, 0]);
    k.cyl(0.046, 0.046, 0.02, M.greyD, s * 0.3, -0.115, 0.2, 14, [Math.PI / 2, 0, 0]);
    k.cyl(0.03, 0.03, 0.012, M.dark, s * 0.3, -0.115, 0.205, 12, [Math.PI / 2, 0, 0]);
    // 平尾
    const tl = new THREE.Shape(mirror([[0.02, -0.04], [0.3, 0.06], [0.3, 0.12], [0.02, 0.06]]).map(([x, y]) => new THREE.Vector2(x, y)));
    const tg = new THREE.ExtrudeGeometry(tl, { depth: 0.014, bevelEnabled: false }); tg.rotateX(-Math.PI / 2);
    k.geo(tg, M.white, 0, 0.045, -0.52);
  }
  // 垂尾：后掠，涂装色
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.22, 0); fin.lineTo(0.12, 0.3); fin.lineTo(0.02, 0.3); fin.closePath();
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.024, bevelEnabled: false }); fg.translate(-0.12, 0, -0.012); fg.rotateY(-Math.PI / 2);
  k.geo(fg, lv, 0, 0.06, -0.4);
  // 起落架：前一后二，带轮子
  for (const [x, z, s] of [[0, 0.38, 0.8], [0.1, -0.02, 1], [-0.1, -0.02, 1]]) {
    k.cyl(0.008, 0.008, 0.13 * s + 0.02, M.greyD, x, -0.2 + 0.0, z, 6);
    for (const dx of s === 1 ? [-0.022, 0.022] : [0]) k.cyl(0.028, 0.028, 0.018, M.tyre, x + dx, -0.2, z, 12, [0, 0, Math.PI / 2]);
  }
  k.finish();
  return g;
}

export function buildAirport(root, { rz, rx0, rx1, IW, ID, ticks }) {
  const k = mkit(root);
  const rl = rx1 - rx0, rcx = (rx0 + rx1) / 2;

  // ───── 跑道 ─────
  k.box(rl + 0.3, 0.05, 1.2, M.asphalt, rcx, 0, rz, 0.01);
  for (let x = rx0 + 1.4; x < rx1 - 1.2; x += 0.8) k.box(0.4, 0.008, 0.05, M.line, x, 0.05, rz, 0);
  for (const sz of [-1, 1]) k.box(rl, 0.008, 0.03, M.line, rcx, 0.05, rz + sz * 0.52, 0);
  for (const xe of [rx0 + 0.3, rx1 - 0.3]) for (let i = -4; i <= 4; i++) if (i) k.box(0.4, 0.008, 0.05, M.line, xe, 0.05, rz + i * 0.11, 0);   // 入口标线
  for (const [x0, dir] of [[rx0, 1], [rx1, -1]]) for (const d of [1.6, 2.5]) for (const sz of [-1, 1]) k.box(0.3, 0.008, 0.06, M.line, x0 + dir * d, 0.05, rz + sz * 0.3, 0);   // 接地区
  const num = (txt, x, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: numTex(txt), transparent: true, roughness: 0.8 })); m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.056, rz); root.add(m); };
  num('09', rx0 + 0.85, -Math.PI / 2); num('27', rx1 - 0.85, Math.PI / 2);
  for (let x = rx0; x <= rx1 + 0.01; x += 0.7) for (const sz of [-1, 1]) k.cyl(0.028, 0.032, 0.04, M.edge, x, 0.02, rz + sz * 0.64, 8);
  for (let i = -3; i <= 3; i++) { k.cyl(0.026, 0.03, 0.04, M.endG, rx0 - 0.18, 0.02, rz + i * 0.15, 8); k.cyl(0.026, 0.03, 0.04, M.endR, rx1 + 0.18, 0.02, rz + i * 0.15, 8); }

  // ───── 滑行道 + 停机坪（航站楼在跑道和停机坪之间，飞机停在楼前，朝向镜头）─────
  const tz = rz + 1.3, apronZ = rz + 2.65, ax = rx0 + 4.4;
  k.box(0.6, 0.04, 2.7, M.asphalt, rx0 + 7.9, 0, rz + 1.95, 0.01);
  k.box(0.04, 0.008, 2.7, M.yellow, rx0 + 7.9, 0.04, rz + 1.95, 0);
  k.box(7.8, 0.04, 1.4, M.apron, ax, 0, apronZ, 0.012);
  k.box(7.2, 0.008, 0.04, M.yellow, ax, 0.04, apronZ + 0.5, 0);
  for (let i = 0; i < 3; i++) { k.box(0.04, 0.008, 0.6, M.yellow, ax - 2.4 + i * 2.4, 0.04, apronZ - 0.1, 0); }

  // ───── 航站楼 ─────
  {
    k.push(ax, 0, tz, 0);
    k.box(5.7, 0.1, 1.25, M.apron, 0, 0, 0, 0.02);
    k.box(5.2, 0.4, 0.92, M.glass, 0, 0.1, 0, 0.012);
    for (let i = 0; i <= 13; i++) k.box(0.04, 0.4, 0.96, M.white, -2.6 + i * 0.4, 0.1, 0, 0.006);       // 竖向窗框
    // 波浪形屋顶（挤出，有厚度），底下一排白色立柱
    const wave = new THREE.Shape();
    wave.moveTo(-0.7, 0); wave.quadraticCurveTo(0, 0.26, 0.7, 0); wave.lineTo(0.7, 0.05); wave.quadraticCurveTo(0, 0.33, -0.7, 0.05); wave.closePath();
    const wg = new THREE.ExtrudeGeometry(wave, { depth: 5.9, bevelEnabled: false, curveSegments: 20 });
    wg.translate(0, 0, -2.95); wg.rotateY(Math.PI / 2);
    k.geo(wg, M.white, 0, 0.46, 0);
    for (let i = 0; i < 8; i++) for (const sz of [-1, 1]) k.cyl(0.022, 0.022, 0.36, M.white, -2.55 + i * 0.73, 0.1, sz * 0.5, 10);
    // 入口雨篷
    k.box(1.4, 0.04, 0.36, M.white, 0, 0.36, 0.62, 0.01);
    for (const sx of [-1, 1]) k.cyl(0.02, 0.02, 0.26, M.grey, sx * 0.6, 0.1, 0.78, 8);
    for (const sx of [-0.4, 0, 0.4]) k.box(0.3, 0.24, 0.02, M.dark, sx, 0.1, 0.47, 0);                    // 玻璃门
    k.box(1.7, 0.18, 0.03, M.sign, 0, 0.62, 0.5, 0.004);
    // 廊桥：圆形接口 + 可伸缩的两节廊 + 活动支腿，从楼里伸向南面的飞机
    for (const bx of [-1.2, 1.2]) {
      k.cyl(0.13, 0.13, 0.2, M.grey, bx, 0.2, 0.55, 18);
      k.box(0.2, 0.18, 0.4, M.white, bx, 0.22, 0.75, 0.02);
      k.box(0.17, 0.15, 0.36, M.grey, bx, 0.235, 1.05, 0.02);
      k.box(0.26, 0.24, 0.2, M.white, bx, 0.2, 1.3, 0.03);
      k.cyl(0.02, 0.02, 0.3, M.greyD, bx, 0, 1.0, 8);
      k.cyl(0.04, 0.04, 0.03, M.tyre, bx, 0, 1.0, 10, [0, 0, Math.PI / 2]);
    }
    k.pop();
  }

  // ───── 塔台 ─────
  {
    const tx = rx0 + 9.0, tzz = rz + 1.25;
    k.push(tx, 0, tzz, 0);
    k.cyl(0.3, 0.32, 0.1, M.apron, 0, 0, 0, 16);
    k.lathe([[0.001, 0.1], [0.24, 0.1], [0.18, 0.6], [0.15, 1.6], [0.19, 1.74], [0.001, 1.74]], M.white, 0, 0, 0, 20);   // 渐细的塔身
    for (let i = 0; i < 6; i++) k.torus(0.17 - i * 0.003, 0.008, M.grey, 0, 0.35 + i * 0.22, 0, [Math.PI / 2, 0, 0]);
    k.cyl(0.3, 0.46, 0.22, M.dark, 0, 1.74, 0, 20);                      // 灯室下部
    k.cyl(0.46, 0.5, 0.34, M.glassC, 0, 1.96, 0, 20);                    // 斜面玻璃
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.box(0.02, 0.34, 0.02, M.dark, Math.cos(a) * 0.48, 1.96, Math.sin(a) * 0.48, 0); }
    k.cyl(0.56, 0.52, 0.05, M.white, 0, 2.3, 0, 20);
    k.cyl(0.4, 0.2, 0.1, M.dark, 0, 2.35, 0, 20);
    k.cyl(0.012, 0.012, 0.5, M.grey, 0, 2.45, 0, 6);
    k.box(0.14, 0.14, 0.14, M.grey, 0.1, 2.35, 0.1, 0.01);
    k.pop();
    const radar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.025), M.white); radar.position.set(tx, 2.9, tzz); radar.castShadow = true; root.add(radar);
    const rpole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6), M.grey); rpole.position.set(tx, 2.84, tzz); root.add(rpole);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff3b3b' })); beacon.position.set(tx, 2.98, tzz); root.add(beacon);
    ticks.push((t, dt) => { beacon.visible = Math.sin(t * 5) > 0; radar.rotation.y += dt * 2; });
  }

  // ───── 机库：拱形薄壳，大门朝南（朝镜头），里面停着一架小飞机 ─────
  const hx = rx1 - 1.0, hz = rz + 2.3;
  {
    const outer = new THREE.Shape();
    outer.moveTo(-0.85, 0); outer.lineTo(-0.85, 0.35); outer.absarc(0, 0.35, 0.85, Math.PI, 0, true); outer.lineTo(0.85, 0);
    const hole = new THREE.Path(); hole.moveTo(-0.78, 0); hole.lineTo(-0.78, 0.35); hole.absarc(0, 0.35, 0.78, Math.PI, 0, true); hole.lineTo(0.78, 0); outer.holes.push(hole);
    k.geo(new THREE.ExtrudeGeometry(outer, { depth: 1.6, bevelEnabled: false, curveSegments: 20 }), M.hangar, hx, 0, hz - 0.8);
    for (let i = 0; i <= 6; i++) { const ring = new THREE.TorusGeometry(0.82, 0.014, 6, 24, Math.PI); k.geo(ring, M.greyD, hx, 0.35, hz - 0.78 + i * 0.26); }
    k.box(1.6, 0.012, 1.6, M.apron, hx, 0, hz, 0);
    k.box(1.7, 1.2, 0.03, M.hangar, hx, 0, hz - 0.8, 0.005);                 // 后墙
    for (const s of [-1, 1]) k.box(0.45, 0.68, 0.04, M.hangar, hx + s * 0.62, 0, hz + 0.82, 0.01);   // 半开的大门
    k.box(1.8, 0.03, 0.05, M.blue, hx, 1.2, hz + 0.84, 0.008);
    const p = makePlane('#1c7ed6'); p.scale.setScalar(0.55); p.position.set(hx, 0.115, hz); p.rotation.y = 0; root.add(p);   // 机头朝南
  }

  // ───── 风向袋 ─────
  {
    const wx = rx1 + 0.7, wz = rz + 0.95;
    k.cyl(0.03, 0.03, 0.04, M.grey, wx, 0, wz, 8);
    k.cyl(0.011, 0.011, 0.72, M.grey, wx, 0.04, wz, 6);
    k.torus(0.07, 0.006, M.greyD, wx + 0.0, 0.76, wz, [0, Math.PI / 2, 0]);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.4, 12, 1, true), M.stripe);
    sock.geometry.translate(0, -0.2, 0); sock.geometry.rotateZ(Math.PI / 2);
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.76, wz); pivot.add(sock); root.add(pivot);
    ticks.push(t => { pivot.rotation.y = Math.sin(t * 0.7) * 0.5; pivot.rotation.z = -0.08 + Math.sin(t * 3) * 0.05; });
  }

  // ───── 飞机：一架停廊桥、一架飞行 ─────
  const parked = makePlane('#e03131'); parked.position.set(ax - 1.2, 0.2, rz + 2.9); parked.rotation.y = Math.PI; root.add(parked);
  const parked2 = makePlane('#2f9e44'); parked2.position.set(ax + 1.2, 0.2, rz + 2.9); parked2.rotation.y = Math.PI; root.add(parked2);
  const fy = 0.25;
  const route = new THREE.CatmullRomCurve3([
    [rx0 + 0.8, fy, rz], [rx0 + 4, fy, rz], [rx0 + 8, fy + 0.05, rz], [rx1, 1.2, rz], [rx1 + 6, 3.5, rz - 3],
    [rx1 + 8, 6, -ID - 12], [0, 8, -ID - 20], [-IW - 6, 7, -ID - 10], [-IW + 2, 4, rz - 6], [rx0 - 6, 1.6, rz - 0.8], [rx0 - 2, 0.5, rz],
  ].map(a => new THREE.Vector3(...a)), true, 'centripetal');
  const flyer = makePlane('#1c7ed6'); flyer.scale.setScalar(1.3); root.add(flyer);
  let fu = 0;
  ticks.push((t, dt) => {
    const p = route.getPointAt(fu);
    fu = (fu + dt * (p.y < 0.4 ? 0.006 : 0.016)) % 1;
    const q = route.getPointAt(fu), ahead = route.getPointAt((fu + 0.004) % 1);
    flyer.position.copy(q);
    flyer.lookAt(ahead);
    flyer.rotateZ(Math.sin(fu * Math.PI * 2) * 0.25 * Math.min(1, q.y / 3));
  });

  k.finish();
  return { x0: rx0 - 0.4, z0: rz - 0.75, x1: rx1 + 1.0, z1: rz + 3.5 };
}
