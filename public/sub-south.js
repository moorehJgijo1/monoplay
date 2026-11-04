// 南边（镜头这一侧，全是矮的）：西段沙滩、中间欢迎花坛、东段水上乐园，海上的游艇码头。
// 沙滩：排球场、条纹遮阳伞 + 躺椅 + 浴巾、沙堡、救生椅。花坛：同心花环、三层喷泉、欢迎牌楼。
// 水上乐园：泳池 + 分道线、懒人河、螺旋滑梯、躺椅伞、凉亭。游艇码头：浮桥、帆船、快艇。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

const sandTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#f1dca6'; c.fillRect(0, 0, w, h);
  let t = 3; const r = () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; };
  for (let i = 0; i < 700; i++) { c.fillStyle = i % 2 ? '#e4cb8f' : '#fbecc4'; c.fillRect(r() * w, r() * h, 2, 2); }
  c.strokeStyle = 'rgba(200,170,110,.25)'; c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = i * 22 + 8; c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(w / 2, y + 6, w, y); c.stroke(); }   // 沙纹
});
const poolTile = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#eee8da'; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8d0bd'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } });
const welcomeTex = canvasTex(512, 128, (c, w, h) => {
  const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff6b6b'); gr.addColorStop(1, '#ffa94d');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#fff'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.strokeRect(18, 18, w - 36, h - 36);
  c.fillStyle = '#fff'; c.font = `bold 66px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢迎来到 欢乐城', w / 2, h / 2 + 4);
});
const stripeTex = (c1, c2, n = 12) => canvasTex(128, 8, (c, w, h) => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? c2 : c1; c.fillRect(i * w / n, 0, w / n + 1, h); } });

const M = {
  sand: mat('#ffffff', { map: sandTex, tile: 3, roughness: 1 }),
  sandD: mat('#e4c88a', { roughness: 1 }),
  tile: mat('#ffffff', { map: poolTile, tile: 1.2, roughness: 0.6 }),
  white: mat('#fbfbf8', { roughness: 0.5 }),
  stone: mat('#d9d2c0', { map: TEX.stone, tile: 0.8, roughness: 0.8 }),
  wood: mat('#ffffff', { map: TEX.planks, tile: 0.5, roughness: 0.8 }),
  woodD: mat('#7a4a20', { roughness: 0.8 }),
  red: mat('#e43b2a', { roughness: 0.5 }),
  yellow: mat('#ffd34d', { roughness: 0.45 }),
  steel: mat('#cfd6dd', { metalness: 0.6, roughness: 0.35 }),
  dark: mat('#33404d', { roughness: 0.5 }),
  pool: mat('#37c5ee', { roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4, emissive: '#0a5a7a', emissiveIntensity: 0.3 }),
  welcome: mat('#ffffff', { map: welcomeTex, roughness: 0.45 }),
  leaf: mat('#4aa650', { roughness: 0.85 }),
  glass: mat('#cfeeff', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.5, envMapIntensity: 1.3 }),
  netM: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, side: THREE.DoubleSide, roughness: 0.9 }),
};
const FLOWERS = ['#ff7aa2', '#ffd43b', '#c084fc', '#ffffff'].map(c => mat(c, { roughness: 0.6 }));
const COLORS = ['#ff6b6b', '#4dabf7', '#ffd34d', '#51cf66'];

function umbrella(k, x, y, z, c, r = 0.34) {
  const st = mat('#ffffff', { map: stripeTex(c, '#ffffff'), roughness: 0.6, side: THREE.DoubleSide });
  k.cyl(0.013, 0.013, 0.7, M.white, x, y, z, 8, [0, 0, 0.08]);
  k.geo(new THREE.ConeGeometry(r, 0.15, 20, 1, true), st, x + 0.03, y + 0.66, z, [0, 0, 0.08]);
  k.ball(0.018, M.yellow, x + 0.06, y + 0.84, z);
}
function lounger(k, x, y, z, ry, color) {
  k.push(x, y, z, ry);
  k.box(0.16, 0.025, 0.38, M.white, 0, y + 0.08, 0, 0.01);
  k.box(0.16, 0.025, 0.2, M.white, 0, y + 0.14, -0.26, 0.01, [0.8, 0, 0]);
  k.box(0.14, 0.012, 0.34, mat(color, { roughness: 0.8 }), 0, y + 0.1, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.01, 0.01, 0.08, M.white, sx * 0.07, y, sz * 0.15, 5);
  k.pop();
}

// 游艇船体：细分的盒子压成尖船头
function hullGeo(len, h, w) {
  const g = new THREE.BoxGeometry(len, h, w, 20, 3, 6), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = (x + len / 2) / len, v = (y + h / 2) / h, bow = Math.max(0, (u - 0.62) / 0.38);
    z *= (1 - 0.95 * Math.pow(bow, 1.4)) * (0.65 + 0.35 * v);
    x += bow * 0.12 * v;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function buildSouth(root, { z, bandD, ID, ticks }) {
  const g = new THREE.Group(); g.position.set(0, 0, z); root.add(g);
  const k = mkit(g);

  // ═════ 西段：沙滩 ═════
  {
    const bx = -9.6, bw = 7, bd = bandD - 0.2;
    k.box(bw, 0.04, bd, M.sand, bx, 0, 0, 0.012);
    // 排球场：沙地场 + 白线 + 立柱 + 球网 + 球
    k.push(bx - 2.2, 0, 0, 0);
    k.box(2.0, 0.006, 1.2, M.sandD, 0, 0.04, 0, 0);
    for (const [w, d, x, zz] of [[2.0, 0.03, 0, -0.6], [2.0, 0.03, 0, 0.6], [0.03, 1.2, -1.0, 0], [0.03, 1.2, 1.0, 0]]) k.box(w, 0.008, d, M.white, x, 0.046, zz, 0);
    for (const sz of [-1, 1]) { k.cyl(0.016, 0.018, 0.55, M.white, 0, 0.04, sz * 0.66, 8); k.cyl(0.026, 0.026, 0.02, M.red, 0, 0.04, sz * 0.66, 8); }
    k.box(0.01, 0.15, 1.3, M.netM, 0, 0.42, 0, 0);
    k.box(0.014, 0.014, 1.32, M.white, 0, 0.58, 0, 0); k.box(0.014, 0.014, 1.32, M.white, 0, 0.42, 0, 0);
    k.ball(0.05, M.yellow, -0.5, 0.1, 0.3);
    k.pop();
    // 四顶条纹伞 + 躺椅 + 浴巾
    COLORS.forEach((c, i) => {
      const x = bx - 0.3 + i * 0.95;
      umbrella(k, x, 0.04, -0.6, c);
      lounger(k, x - 0.17, 0.04, -0.12, 0, c); lounger(k, x + 0.17, 0.04, -0.12, 0, c);
      k.box(0.24, 0.006, 0.46, mat(['#e64980', '#20c997', '#fab005', '#7048e8'][i], { roughness: 0.9 }), x, 0.045, 0.5, 0, [0, 0.12 * (i % 2 ? 1 : -1), 0]);
    });
    // 沙堡：主堡 + 四座带尖顶的小塔 + 城墙 + 小旗
    k.push(bx + 2.9, 0.04, 0.55, 0);
    k.box(0.4, 0.1, 0.32, M.sandD, 0, 0, 0, 0.02);
    for (const [x, zz] of [[-0.17, -0.12], [0.17, -0.12], [-0.17, 0.12], [0.17, 0.12]]) { k.cyl(0.055, 0.065, 0.2, M.sandD, x, 0, zz, 10); k.cone(0.065, 0.09, M.sandD, x, 0.2, zz, 10); }
    k.cyl(0.07, 0.08, 0.2, M.sandD, 0, 0.1, 0, 12); k.cone(0.08, 0.12, M.sandD, 0, 0.3, 0, 12);
    k.cyl(0.004, 0.004, 0.14, M.dark, 0, 0.4, 0, 3); k.box(0.07, 0.04, 0.004, M.red, 0.035, 0.5, 0, 0);
    k.pop();
    // 救生椅
    k.push(bx + 3.1, 0.04, -0.3, 0);
    for (const [x, zz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) k.cyl(0.018, 0.022, 0.6, M.white, x, 0, zz, 8);
    k.box(0.44, 0.03, 0.44, M.white, 0, 0.58, 0, 0.01); k.box(0.44, 0.26, 0.03, M.red, 0, 0.61, -0.2, 0.008);
    for (let i = 0; i < 4; i++) k.box(0.3, 0.02, 0.03, M.white, 0, 0.1 + i * 0.13, 0.22, 0);
    k.pop();
  }

  // ═════ 中间：欢迎花坛 ═════
  {
    k.cyl(1.3, 1.35, 0.08, M.stone, 0, 0, 0.1, 40);
    const rings = [1.15, 0.9, 0.65], cnt = [34, 26, 18];
    rings.forEach((rr, r) => {
      k.torus(rr + 0.12, 0.025, M.stone, 0, 0.09, 0.1, [Math.PI / 2, 0, 0]);
      k.cyl(rr + 0.115, rr + 0.115, 0.01, mat('#6b4a2a'), 0, 0.08, 0.1, 40);
      for (let i = 0; i < cnt[r]; i++) {
        const a = (i / cnt[r]) * Math.PI * 2, fx = Math.cos(a) * rr, fz = 0.1 + Math.sin(a) * rr;
        k.cyl(0.004, 0.004, 0.05, M.leaf, fx, 0.09, fz, 3);
        for (let p = 0; p < 5; p++) { const pa = p / 5 * Math.PI * 2; k.ball(0.022, FLOWERS[(r + i) % 4], fx + Math.cos(pa) * 0.03, 0.15, fz + Math.sin(pa) * 0.03); }
        k.ball(0.014, M.yellow, fx, 0.155, fz);
      }
    });
    // 三层喷泉
    k.cyl(0.36, 0.4, 0.14, M.stone, 0, 0.08, 0.1, 28);
    k.cyl(0.32, 0.32, 0.01, M.pool, 0, 0.21, 0.1, 28);
    k.cyl(0.05, 0.07, 0.24, M.stone, 0, 0.22, 0.1, 12);
    k.lathe([[0.001, 0], [0.18, 0.0], [0.22, 0.04], [0.2, 0.06], [0.05, 0.02]], M.stone, 0, 0.4, 0.1, 24);
    k.cyl(0.035, 0.04, 0.14, M.stone, 0, 0.44, 0.1, 10);
    k.ball(0.04, M.stone, 0, 0.6, 0.1);
    const water = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.36, 10), new THREE.MeshStandardMaterial({ color: '#bff0ff', transparent: true, opacity: 0.7 }));
    water.position.set(0, 0.74, 0.1); g.add(water);
    ticks.push(t => { water.scale.y = 1 + Math.sin(t * 5) * 0.15; });
    // 欢迎牌楼：两根石柱（带帽）+ 横梁 + 彩色牌 + 两侧灌木篱笆
    k.push(0, 0, -1.25, 0);
    for (const sx of [-1, 1]) { k.box(0.22, 0.9, 0.22, M.stone, sx * 1.55, 0, 0, 0.02); k.box(0.3, 0.07, 0.3, M.white, sx * 1.55, 0.9, 0, 0.012); k.ball(0.06, M.yellow, sx * 1.55, 1.01, 0); }
    k.box(3.1, 0.08, 0.14, M.white, 0, 0.88, 0, 0.01);
    k.box(2.9, 0.6, 0.07, M.welcome, 0, 0.3, 0.02, 0.01);
    for (let i = -6; i <= 6; i++) k.ball(0.02, M.yellow, i * 0.22, 0.92, 0.08);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) k.ball(0.15, M.leaf, sx * (1.95 + i * 0.28), 0.14, 0.0, [1, 0.8, 1]);
    k.pop();
    // 长椅
    for (const sx of [-1, 1]) { k.push(sx * 1.7, 0, 0.6, sx * 0.4); k.box(0.5, 0.03, 0.14, M.wood, 0, 0.14, 0, 0.005); k.box(0.5, 0.12, 0.02, M.wood, 0, 0.2, -0.07, 0.005); for (const s of [-1, 1]) k.box(0.03, 0.14, 0.12, M.dark, s * 0.2, 0, 0, 0); k.pop(); }
  }

  // ═════ 东段：水上乐园 ═════
  {
    const wx = 9.6, wd = bandD - 0.2;
    k.box(7, 0.05, wd, M.tile, wx, 0, 0, 0.012);
    const pool = (x, zz, w, d) => { k.box(w + 0.18, 0.08, d + 0.18, M.white, wx + x, 0, zz, 0.02); k.box(w, 0.02, d, M.pool, wx + x, 0.075, zz, 0); };
    pool(-2.0, -0.3, 2.3, 1.5);
    for (let r = 1; r < 4; r++) { k.box(2.1, 0.006, 0.01, M.white, wx - 2.0, 0.1, -0.3 - 0.75 + r * 0.375, 0); for (let i = 0; i < 10; i++) k.ball(0.024, i % 2 ? M.red : M.white, wx - 3.05 + i * 0.234, 0.105, -0.3 - 0.75 + r * 0.375); }
    pool(0.8, 0.4, 1.4, 1.0);
    // 懒人河：椭圆环形水道 + 漂着的救生圈
    k.geo(new THREE.TorusGeometry(0.7, 0.21, 8, 36), M.white, wx + 2.55, 0.05, -0.1, [-Math.PI / 2, 0, 0], [1, 1, 0.28]);
    k.geo(new THREE.TorusGeometry(0.7, 0.15, 8, 36), M.pool, wx + 2.55, 0.08, -0.1, [-Math.PI / 2, 0, 0], [1, 1, 0.22]);
    ['#ff6b6b', '#ffd34d', '#4dabf7'].forEach((c, i) => { const a = i * 2.1; k.torus(0.055, 0.025, mat(c, { roughness: 0.4 }), wx + 2.55 + Math.cos(a) * 0.7, 0.12, -0.1 + Math.sin(a) * 0.2, [Math.PI / 2, 0, 0]); });
    // 螺旋滑梯：塔 + 平台 + 螺旋管 + 出口水池
    {
      const tx = wx - 0.3, tz = -1.3;
      k.push(tx, 0, tz, 0);
      for (const [x, zz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) k.box(0.04, 1.0, 0.04, M.yellow, x, 0.05, zz, 0.004);
      k.box(0.46, 0.04, 0.46, M.red, 0, 1.0, 0, 0.01);
      k.cone(0.38, 0.28, M.red, 0, 1.06, 0, 4, [0, Math.PI / 4, 0]);
      for (let i = 0; i < 8; i++) k.box(0.2, 0.03, 0.06, M.white, 0, 0.1 + i * 0.12, 0.26 + 0.0, 0, [0, 0, 0]);   // 楼梯台阶
      k.pop();
      const helix = [];
      for (let i = 0; i <= 44; i++) { const a = i / 44 * Math.PI * 3.2; helix.push(new THREE.Vector3(Math.cos(a) * 0.45, 0.96 - Math.pow(i / 44, 0.9) * 0.86, Math.sin(a) * 0.45)); }
      helix.push(new THREE.Vector3(-0.3, 0.1, 0.8));
      k.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 90, 0.075, 12), mat('#ff6b8a', { roughness: 0.3 }), tx + 0.2, 0.0, tz + 0.2);
      k.box(0.5, 0.03, 0.4, M.white, tx - 0.1, 0.05, tz + 1.05, 0.01); k.box(0.44, 0.02, 0.34, M.pool, tx - 0.1, 0.08, tz + 1.05, 0);
    }
    // 躺椅 + 伞 + 凉亭
    ['#ff922b', '#22b8cf', '#e64980'].forEach((c, i) => { const x = wx + i * 0.85; umbrella(k, x, 0.05, 1.25, c, 0.3); lounger(k, x - 0.18, 0.05, 1.18, 0, c); lounger(k, x + 0.18, 0.05, 1.18, 0, c); });
    k.push(wx + 3.0, 0, 1.1, 0);
    k.box(0.95, 0.04, 0.75, M.wood, 0, 0.05, 0, 0.01);
    for (const [x, zz] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) k.cyl(0.025, 0.028, 0.6, M.white, x, 0.09, zz, 10);
    k.cone(0.7, 0.28, mat('#c5a46d', { roughness: 0.8 }), 0, 0.69, 0, 4, [0, Math.PI / 4, 0]);
    k.ball(0.035, M.yellow, 0, 0.98, 0);
    k.pop();
    // 围栏
    const fz = -wd / 2 + 0.1;
    for (let i = 0; i <= 24; i++) k.box(0.03, 0.2, 0.03, M.white, wx - 3.5 + i * 0.2917, 0.05, fz, 0.004);
    k.box(7, 0.025, 0.02, M.white, wx, 0.14, fz, 0); k.box(7, 0.025, 0.02, M.white, wx, 0.22, fz, 0);
  }

  // ═════ 海上：游艇码头 ═════
  {
    const yx = -9, yz = ID + 0.3 - z;
    k.box(0.45, 0.06, 3.4, M.wood, yx, -0.12, yz + 1.5, 0.01);
    for (let i = 0; i < 6; i++) k.box(1.1, 0.05, 0.22, M.wood, yx + (i % 2 ? 0.75 : -0.75), -0.12, yz + 0.5 + Math.floor(i / 2) * 1.1, 0.008);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) k.cyl(0.03, 0.035, 0.3, M.woodD, yx + s * 0.2, -0.45, yz + 0.1 + i * 0.8, 8);
    k.finish();
    // 游艇：帆船 + 快艇，随波轻轻晃
    const boats = [];
    [[-1.3, 0.9, 1], [1.3, 0.9, 0], [-1.3, 2.0, 0], [1.3, 2.0, 1], [-1.3, 3.1, 1]].forEach(([x, zz, mast], i) => {
      const b = new THREE.Group(); b.position.set(yx + x, -0.62, z + yz + zz); root.add(b);
      const bk = mkit(b), tint = ['#1c7ed6', '#e03131', '#20c997'][i % 3];
      bk.geo(hullGeo(0.95, 0.16, 0.32), M.white, 0, 0.1, 0);
      bk.box(0.97, 0.03, 0.33, mat(tint, { roughness: 0.4 }), 0, 0.14, 0, 0.005);
      bk.box(0.85, 0.02, 0.26, M.wood, -0.03, 0.2, 0, 0);
      bk.box(0.32, 0.12, 0.2, M.glass, -0.1, 0.22, 0, 0.01);
      bk.box(0.34, 0.025, 0.22, M.white, -0.1, 0.34, 0, 0.008);
      if (mast) {
        bk.cyl(0.011, 0.011, 1.3, M.steel, 0.1, 0.2, 0, 6);
        bk.box(0.3, 0.014, 0.014, M.steel, -0.04, 0.5, 0, 0);
        // 主帆：弯曲的布
        const sg = new THREE.PlaneGeometry(0.42, 1.0, 6, 10), sp = sg.attributes.position;
        for (let j = 0; j < sp.count; j++) { const u = sp.getX(j) / 0.42 + 0.5, v = sp.getY(j) + 0.5; sp.setZ(j, Math.sin(u * Math.PI) * 0.06 * (1 - v * 0.4)); sp.setX(j, sp.getX(j) * (1 - v * 0.95) + 0.21 * v * 0.95 * 0 - 0.0); }
        sg.computeVertexNormals();
        bk.geo(sg, mat('#ffffff', { roughness: 0.85, side: THREE.DoubleSide }), -0.07, 0.72, 0.0, [0, Math.PI / 2, 0]);
        bk.geo(new THREE.PlaneGeometry(0.3, 0.7, 4, 6), mat('#ffffff', { roughness: 0.85, side: THREE.DoubleSide }), 0.42, 0.56, 0.0, [0, Math.PI / 2, 0], [1, 1, 0.1]);
      } else {
        bk.box(0.2, 0.1, 0.18, M.dark, -0.28, 0.2, 0, 0.01);
        bk.cyl(0.01, 0.01, 0.2, M.steel, -0.34, 0.2, 0, 6);
      }
      bk.finish();
      boats.push({ b, ph: i * 1.3 });
    });
    ticks.push(t => boats.forEach(({ b, ph }) => { b.position.y = -0.62 + Math.sin(t * 1.4 + ph) * 0.025; b.rotation.x = Math.sin(t * 1.1 + ph) * 0.04; }));
    return;
  }
}
