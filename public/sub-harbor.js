// 西边海上的港口：混凝土码头（黄线、系缆桩、轮胎护舷、桩基）、集装箱堆、岸桥（小车会来回走）、仓库、集卡，
// 一艘靠岸的货轮和一艘在海上绕岛航行的货轮（尖船头、收窄的船底、驾驶楼、烟囱、集装箱）。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const BOX_COLORS = ['#e03131', '#1c7ed6', '#f59f00', '#2f9e44', '#868e96', '#7048e8', '#e8590c'];

// 集装箱的波纹贴图：底色 + 竖向的棱
const ribTex = canvasTex(64, 32, (c, w, h) => {
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 6) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, 0, 2, h); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 2, 0, 1, h); }
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, w, 2); c.fillRect(0, h - 2, w, 2);
});
const containerMats = BOX_COLORS.map(c => mat(c, { map: ribTex, tile: [0.6, 0.25], roughness: 0.6, metalness: 0.15 }));
const portTex = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#f4f6f8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c7ed6'; c.fillRect(0, 0, w, 12); c.fillStyle = '#1c7ed6'; c.font = `bold 52px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢乐港', w / 2, h / 2 + 10); });

const M = {
  deck: mat('#cfcac0', { map: TEX.plaster, tile: 1.2, roughness: 0.9 }),
  deckD: mat('#8d8a83', { roughness: 0.9 }),
  pile: mat('#6e6a62', { roughness: 0.9 }),
  yellow: mat('#ffd43b', { roughness: 0.6 }),
  dark: mat('#2b3442', { roughness: 0.5, metalness: 0.2 }),
  steel: mat('#9aa3ad', { metalness: 0.5, roughness: 0.4 }),
  crane: mat('#f59f00', { roughness: 0.45, metalness: 0.2 }),
  craneW: mat('#fafafa', { roughness: 0.45 }),
  white: mat('#f7f8fa', { roughness: 0.45 }),
  wh: mat('#b9c1c9', { roughness: 0.55, metalness: 0.25 }),
  red: mat('#e03131', { roughness: 0.5 }),
  glass: mat('#2e4a6a', { roughness: 0.15, metalness: 0.3 }),
  tyre: mat('#25262b', { roughness: 0.85 }),
  hullDark: mat('#2b3442', { roughness: 0.55 }),
  hullRed: mat('#7f2a2a', { roughness: 0.6 }),
  sign: mat('#ffffff', { map: portTex, roughness: 0.5 }),
  rope: mat('#2b3442', { roughness: 0.9 }),
};

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 货轮：len 长，hullMat 船体色。船头在 +x
function makeShip(len, hullColor) {
  const g = new THREE.Group(), k = mkit(g), hm = mat(hullColor, { roughness: 0.55 });
  // 船体：细分的盒子，按位置压缩成尖船头、窄船底、微翘的船首
  const hull = new THREE.BoxGeometry(len, 0.4, 0.74, 36, 4, 10);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = (x + len / 2) / len, v = (y + 0.2) / 0.4;
    const bow = sstep(0.76, 1.0, u), stern = 1 - sstep(0.0, 0.07, u);
    z *= (1 - 0.94 * Math.pow(bow, 1.5)) * (0.72 + 0.28 * v) * (1 - 0.25 * stern * (1 - v));
    x += bow * 0.28 * v;
    p.setXYZ(i, x, y - 0.15, z);
  }
  hull.computeVertexNormals();
  k.geo(hull, hm, 0, 0, 0);
  k.geo(new THREE.BoxGeometry(len * 0.97, 0.05, 0.75, 24, 1, 4), M.hullRed, -0.02, -0.3, 0);    // 水线下的红色船底漆（略宽一圈）
  // 甲板
  k.box(len * 0.82, 0.03, 0.6, M.deckD, -len * 0.06, 0.05, 0, 0);
  // 驾驶楼（船尾）：多层白色 + 窗带 + 烟囱 + 桅杆
  const bx = -len / 2 + 0.5;
  k.box(0.55, 0.55, 0.62, M.white, bx, 0.07, 0, 0.012);
  for (let i = 0; i < 4; i++) k.box(0.56, 0.05, 0.63, M.glass, bx, 0.18 + i * 0.12, 0, 0);
  k.box(0.38, 0.1, 0.7, M.white, bx + 0.05, 0.62, 0, 0.01);
  k.box(0.2, 0.06, 0.74, M.glass, bx + 0.12, 0.64, 0, 0);
  k.cyl(0.07, 0.065, 0.3, mat('#212529'), bx - 0.12, 0.62, 0, 14);
  k.cyl(0.072, 0.072, 0.05, M.red, bx - 0.12, 0.82, 0, 14);
  k.cyl(0.01, 0.01, 0.4, M.steel, bx + 0.1, 0.72, 0, 6);
  // 船头：锚机、桅杆
  k.cyl(0.05, 0.05, 0.06, M.steel, len / 2 - 0.45, 0.08, 0, 10);
  k.cyl(0.008, 0.008, 0.25, M.steel, len / 2 - 0.6, 0.08, 0, 5);
  // 集装箱：两层，前后留空
  const n = Math.floor((len - 1.5) / 0.62);
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) for (let h = 0; h < 2; h++) {
    k.box(0.58, 0.24, 0.26, containerMats[(i * 3 + j + h * 2) % containerMats.length], -len / 2 + 1.15 + i * 0.62, 0.08 + h * 0.245, (j - 0.5) * 0.28, 0.003);
  }
  k.finish();
  return g;
}

// 岸桥：A 形支腿、横撑、桁架大臂（伸到海面上）、机房、司机室；小车 + 吊具另做成会动的一组
function crane(k, g, ticks, x, z, phase) {
  const ch = 1.9, span = 0.78, leg = 0.07;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    k.box(leg, ch, leg, M.crane, x + sx * span / 2 + 0.2, 0, z + sz * 0.34, 0.006);
    k.box(leg * 0.8, 0.5, leg * 0.8, M.dark, x + sx * span / 2 + 0.2, 0, z + sz * 0.34, 0);         // 行走台车
  }
  for (const sx of [-1, 1]) { k.box(0.05, 0.05, 0.74, M.crane, x + sx * span / 2 + 0.2, 0.7, z, 0); k.box(0.05, 0.05, 0.74, M.crane, x + sx * span / 2 + 0.2, 1.4, z, 0); }
  for (const sz of [-1, 1]) {
    k.box(span, 0.05, 0.05, M.crane, x + 0.2, 0.95, z + sz * 0.34, 0);
    // 大臂：上下弦 + 斜腹杆
    const bl = 3.2, bx0 = x - 2.1;
    k.box(bl, 0.05, 0.05, M.crane, bx0 + bl / 2 + 0.3, ch, z + sz * 0.34, 0.004);
    k.box(bl, 0.05, 0.05, M.crane, bx0 + bl / 2 + 0.3, ch - 0.2, z + sz * 0.34, 0.004);
    const nseg = 16;
    for (let i = 0; i < nseg; i++) {
      const sx0 = bx0 + 0.3 + (i / nseg) * bl, dx = bl / nseg;
      k.box(0.025, 0.2, 0.025, M.crane, sx0, ch - 0.2, z + sz * 0.34, 0);
      k.box(Math.hypot(dx, 0.2), 0.02, 0.02, M.crane, sx0 + dx / 2, ch - 0.1, z + sz * 0.34, 0, [0, 0, (i % 2 ? 1 : -1) * Math.atan2(0.2, dx)]);
    }
  }
  for (let i = 0; i < 8; i++) k.box(0.05, 0.05, 0.7, M.crane, x - 2.0 + i * 0.4, ch, z, 0);                  // 大臂横梁
  k.box(0.5, 0.26, 0.75, M.craneW, x + 0.45, ch + 0.05, z, 0.02);                                            // 机房
  k.box(0.2, 0.2, 0.2, M.glass, x - 0.15, ch - 0.12, z - 0.45, 0.01);                                         // 司机室
  k.cyl(0.01, 0.01, 0.3, M.steel, x + 0.45, ch + 0.31, z, 5);
  // 小车：沿大臂前后走，吊具上下
  const tro = new THREE.Group(); tro.position.set(x - 0.6, ch - 0.12, z); g.add(tro);
  const tk = mkit(tro);
  tk.box(0.28, 0.12, 0.62, M.craneW, 0, 0, 0, 0.01);
  tk.cyl(0.006, 0.006, 0.5, M.dark, -0.1, -0.5, -0.2, 4); tk.cyl(0.006, 0.006, 0.5, M.dark, 0.1, -0.5, 0.2, 4);
  tk.box(0.4, 0.03, 0.2, M.yellow, 0, -0.52, 0, 0.005);
  tk.box(0.38, 0.12, 0.18, containerMats[(Math.floor(phase) + 2) % containerMats.length], 0, -0.66, 0, 0.003);
  tk.finish();
  ticks.push(t => { tro.position.x = x - 1.3 + Math.sin(t * 0.35 + phase) * 1.0; });
}

export function buildHarbor(root, { IW, ID, ticks }) {
  const qx0 = -IW - 0.2, qx1 = -IW - 4.2, qz0 = -1.5, qz1 = 8.2;
  const qcx = (qx0 + qx1) / 2, qcz = (qz0 + qz1) / 2, qw = Math.abs(qx1 - qx0), qd = qz1 - qz0;
  const g = new THREE.Group(); g.position.set(qcx, 0, qcz); root.add(g);
  const k = mkit(g);
  const wl = -qw / 2;                                           // 码头朝海的一侧（西）

  // ───── 码头面、桩基、黄线、系缆桩、护舷 ─────
  k.box(qw, 0.3, qd, M.deck, 0, -0.3, 0, 0.02);
  k.box(qw + 0.12, 0.08, qd + 0.12, M.deckD, 0, -0.38, 0, 0.012);
  for (let z = -qd / 2 + 0.3; z < qd / 2; z += 0.9) for (const sx of [-0.4, 0.5]) k.cyl(0.08, 0.09, 0.7, M.pile, wl + 0.2 + (sx + 0.4) * 1.5, -1.0, z, 10);
  k.box(0.05, 0.006, qd - 0.2, M.yellow, wl + 0.35, 0, 0, 0);
  for (let z = -qd / 2 + 0.5; z < qd / 2; z += 0.8) {
    k.cyl(0.05, 0.06, 0.08, M.dark, wl + 0.16, 0, z, 10);             // 系缆桩：底座 + 带帽的柱
    k.cyl(0.036, 0.036, 0.07, M.dark, wl + 0.16, 0.08, z, 10);
    k.ball(0.05, M.dark, wl + 0.16, 0.16, z, [1, 0.6, 1]);
    k.torus(0.075, 0.03, M.tyre, wl - 0.02, -0.12, z + 0.4, [0, Math.PI / 2, 0]);   // 轮胎护舷
  }
  // 栈桥连到岛上
  k.box(2.4, 0.08, 1.0, M.deck, qw / 2 + 1.2, -0.08, 3.4 - qcz, 0.01);
  for (const s of [-1, 1]) { k.box(2.4, 0.04, 0.04, M.steel, qw / 2 + 1.2, 0.12, 3.4 - qcz + s * 0.48, 0); for (let i = 0; i < 6; i++) k.box(0.03, 0.2, 0.03, M.steel, qw / 2 + 0.2 + i * 0.4, 0, 3.4 - qcz + s * 0.48, 0); }

  // ───── 集装箱堆 ─────
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
    const hgt = 1 + ((i * 7 + j * 3) % 3);
    for (let h = 0; h < hgt; h++) k.box(0.6, 0.25, 0.26, containerMats[(i * 5 + j + h) % containerMats.length], 0.45 + i * 0.64 - 1.3, 0.005 + h * 0.255, -qd / 2 + 3.0 + j * 0.29, 0.004);
  }

  // ───── 仓库：带棱的屋顶、卷帘门、小办公室、招牌 ─────
  {
    const wx = 0.5, wz = qd / 2 - 1.3;
    k.box(1.8, 0.65, 1.6, M.wh, wx, 0, wz, 0.012);
    k.box(1.88, 0.05, 1.68, M.white, wx, 0.65, wz, 0.01);
    for (let i = 0; i < 8; i++) k.box(0.1, 0.06, 1.7, M.red, wx - 0.84 + i * 0.24, 0.7, wz, 0.008);
    for (let i = 0; i < 3; i++) { k.box(0.42, 0.42, 0.03, M.dark, wx - 0.55 + i * 0.55, 0, wz - 0.81, 0); for (let r = 1; r < 8; r++) k.box(0.42, 0.006, 0.035, M.steel, wx - 0.55 + i * 0.55, r * 0.05, wz - 0.82, 0); }
    k.box(0.3, 0.26, 0.28, M.white, wx + 0.65, 0.76, wz + 0.2, 0.01);                      // 屋顶通风
    k.box(1.0, 0.36, 0.03, M.sign, wx, 0.28, wz + 0.82, 0.004);
  }

  // ───── 岸桥 ×2 ─────
  crane(k, g, ticks, wl + 1.35, -qd / 2 + 1.0, 0);
  crane(k, g, ticks, wl + 1.35, -qd / 2 + 2.45, 2.1);

  // ───── 集卡：车头 + 挡风玻璃 + 底盘 + 车轮 + 一个集装箱 ─────
  {
    k.push(1.2, 0, -0.2, Math.PI / 2);
    k.box(0.28, 0.28, 0.3, mat('#1c7ed6', { roughness: 0.4 }), 0.55, 0.06, 0, 0.02);
    k.box(0.02, 0.12, 0.26, M.glass, 0.7, 0.2, 0, 0);
    k.box(0.92, 0.05, 0.26, M.dark, -0.1, 0.06, 0, 0.005);
    k.box(0.8, 0.25, 0.26, containerMats[0], -0.1, 0.11, 0, 0.004);
    for (const [wx2, sz] of [[0.55, 1], [0.55, -1], [-0.3, 1], [-0.3, -1], [-0.45, 1], [-0.45, -1]]) k.cyl(0.055, 0.055, 0.05, M.tyre, wx2, 0.0, sz * 0.14, 12, [Math.PI / 2, 0, 0]);
    k.pop();
  }
  k.finish();

  // ───── 货轮 ─────
  const docked = makeShip(4.4, '#2b3442');
  docked.position.set(qx1 - 0.55, -0.55, 3.3);
  docked.rotation.y = Math.PI / 2;
  root.add(docked);
  const sail = makeShip(5, '#1864ab');
  root.add(sail);
  const sea = new THREE.CatmullRomCurve3([
    [-IW - 12, 0, -2], [-IW - 8, 0, ID + 9], [0, 0, ID + 12], [IW + 10, 0, ID + 6], [IW + 13, 0, -6], [IW + 4, 0, -ID - 11], [-6, 0, -ID - 13], [-IW - 10, 0, -ID - 4],
  ].map(a => new THREE.Vector3(...a)), true);
  let su = 0;
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
  wake.rotation.x = -Math.PI / 2; wake.position.set(-3.4, -0.18, 0); sail.add(wake);
  ticks.push((t, dt) => {
    su = (su + dt * 0.0035) % 1;
    const p = sea.getPointAt(su), tg = sea.getTangentAt(su);
    sail.position.set(p.x, -0.55 + Math.sin(t * 1.3) * 0.03, p.z);
    sail.rotation.set(0, Math.atan2(-tg.z, tg.x), Math.sin(t * 1.1) * 0.03);
    wake.material.opacity = 0.4 + Math.sin(t * 4) * 0.1;
  });
}
