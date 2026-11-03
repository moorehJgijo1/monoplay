// 古城：从凉亭、四合院、两层小楼、三层楼阁到五层、七层宝塔（0~5 级）。
// 屋顶是真正的曲面：凹弧坡度 + 四角翘起的飞檐 + 瓦垄贴图；屋顶颜色用地主的颜色。
import * as THREE from 'three';
import { mat, TEX, canvasTex, PARTS } from './modeling.js';

const { railing } = PARTS;

// 冰裂/方格木窗：米黄窗纸 + 深色窗棂
const LATTICE = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#f2dfae'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#5a2f14'; g.lineWidth = 12;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.lineWidth = 7;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); }
  g.lineWidth = 4; g.strokeStyle = '#7a4a24';
  g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w - 20, h / 2); g.lineTo(w / 2, h - 20); g.lineTo(20, h / 2); g.closePath(); g.stroke();
});
// 白墙：带一点斑驳
const WALL = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
  let t = 5; const r = () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; };
  g.globalAlpha = 0.18;
  for (let i = 0; i < 700; i++) { g.fillStyle = r() > 0.5 ? '#c8bda6' : '#ffffff'; g.fillRect(r() * w, r() * h, 3 + r() * 5, 2 + r() * 4); }
  g.globalAlpha = 1;
});

const C = {
  wall: mat('#ffffff', { map: WALL, tile: 0.9, roughness: 0.9 }),
  lattice: mat('#ffffff', { map: LATTICE, tile: 0.26, roughness: 0.65 }),
  red: mat('#bd3a2b', { roughness: 0.4, metalness: 0.05 }),
  darkRed: mat('#8c2a1f', { roughness: 0.5 }),
  stone: mat('#ffffff', { map: TEX.stone, tile: 0.7, roughness: 0.85 }),
  stoneG: mat('#aaa59b', { roughness: 0.9 }),
  gold: mat('#f0bd2e', { metalness: 0.5, roughness: 0.32, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  wood: mat('#6b3f1e', { roughness: 0.7 }),
  black: mat('#2b2420', { roughness: 0.5 }),
  blue: mat('#2f7fb5', { roughness: 0.5 }),
  green: mat('#2f9a6a', { roughness: 0.5 }),
  lantern: mat('#ff3b2b', { emissive: '#ff5a1a', emissiveIntensity: 0.55, roughness: 0.45 }),
  leaf: mat('#2f7a46', { roughness: 0.85 }),
  trunk: mat('#6b4a2a', { roughness: 0.9 }),
  glass: mat('#2e4a60', { roughness: 0.3 }),
};

// ---------- 屋顶：曲面飞檐 ----------
// w × d 是屋檐外沿的尺寸，h 是从檐口到屋脊的高度。返回的几何体底面（檐口）在 y = 0。
export function cnRoofGeo(w, d, h, { up = 0.1, flare = 0.07, S = 7, R = 12 } = {}) {
  const m = Math.min(w, d) / 2, N = S * 4;
  const pos = [], uv = [], idx = [];
  const perim = 2 * (w + d), slope = Math.hypot(m, h);
  for (let i = 0; i <= R; i++) {
    const t = i / R, hx = w / 2 - t * m, hz = d / 2 - t * m, y = h * Math.pow(t, 1.65), k = 1 - t;
    for (let sd = 0; sd < 4; sd++) for (let j = 0; j < S; j++) {
      const f = j / S;
      let x, z;
      if (sd === 0) { x = -hx + 2 * hx * f; z = hz; }
      else if (sd === 1) { x = hx; z = hz - 2 * hz * f; }
      else if (sd === 2) { x = hx - 2 * hx * f; z = -hz; }
      else { x = -hx; z = -hz + 2 * hz * f; }
      const cx = hx > 1e-4 ? Math.abs(x) / hx : 0, cz = hz > 1e-4 ? Math.abs(z) / hz : 0;
      const c = Math.pow(cx * cz, 3);                 // 只在四个角上接近 1
      pos.push(x + Math.sign(x) * flare * c * k, y + up * k * k * c, z + Math.sign(z) * flare * c * k);
      uv.push(((sd * S + j) / N) * perim / 0.7, (t * slope) / 0.7);
    }
  }
  for (let i = 0; i < R; i++) for (let n = 0; n < N; n++) {
    const a = i * N + n, b = i * N + (n + 1) % N, c = (i + 1) * N + (n + 1) % N, e = (i + 1) * N + n;
    idx.push(a, b, e, b, c, e);
  }
  // 檐口下面的一圈封檐板
  const base = pos.length / 3;
  for (let n = 0; n < N; n++) { pos.push(pos[n * 3], pos[n * 3 + 1] - 0.055, pos[n * 3 + 2]); uv.push(uv[n * 2], -0.1); }
  for (let n = 0; n < N; n++) {
    const a = n, b = (n + 1) % N, al = base + n, bl = base + (n + 1) % N;
    idx.push(a, al, b, b, al, bl);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function cnRoofMat(color) { return mat(color, { map: TEX.cnTile, roughness: 0.32, metalness: 0.08, envMapIntensity: 1.1 }); }

// 放一个完整的屋顶：飞檐 + 屋脊 + 脊兽/宝顶 + 檐角风铃。返回屋顶总高度
function roofCN(k, ctx, w, d, h, y, { finial = true, bells = true, x = 0, z = 0 } = {}) {
  k.geo(cnRoofGeo(w, d, h), ctx.cnRoof, x, y, z);
  const m = Math.min(w, d) / 2, rl = w / 2 - m, rz = d / 2 - m;       // 屋脊半长（沿 x 或 z）
  if (finial || rl > 0.01 || rz > 0.01) {
    if (rl > 0.01 || rz > 0.01) {
      // 长方形屋顶：屋脊 + 两端上翘的鸱吻
      const along = rl > rz;
      const L = (along ? rl : rz) * 2;
      k.box(along ? L + 0.1 : 0.07, 0.07, along ? 0.07 : L + 0.1, ctx.cnRoof, x, y + h - 0.02, z, 0.02);
      for (const s of [-1, 1]) k.cone(0.035, 0.12, C.gold, x + (along ? s * (L / 2 + 0.05) : 0), y + h + 0.04, z + (along ? 0 : s * (L / 2 + 0.05)), 8);
    } else {
      // 攒尖顶：宝顶（葫芦形）
      k.lathe([[0.001, 0], [0.065, 0.0], [0.055, 0.03], [0.03, 0.06], [0.05, 0.1], [0.055, 0.14], [0.035, 0.18], [0.001, 0.26]], C.gold, x, y + h - 0.02, z, 16);
    }
  }
  if (bells) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bx = x + sx * (w / 2 + 0.07), bz = z + sz * (d / 2 + 0.07), by = y + 0.12;
      k.cone(0.026, 0.07, C.gold, bx, by - 0.07, bz, 10, [Math.PI, 0, 0]);
      k.ball(0.013, C.gold, bx, by - 0.075, bz);
    }
  }
  return h;
}

// 檐下斗拱：一圈小方块，蓝绿相间
function dougong(k, w, d, y) {
  k.box(w, 0.045, d, C.darkRed, 0, y, 0, 0.01);
  const row = (len, ry, off) => {
    k.push(0, y + 0.045, 0, ry);
    const n = Math.max(2, Math.round(len / 0.13));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (i + 0.5) * (len / n);
      k.box(0.05, 0.028, 0.08, i % 2 ? C.blue : C.green, x, 0, off, 0);
      k.box(0.085, 0.02, 0.05, C.gold, x, 0.028, off, 0);
    }
    k.pop();
  };
  row(w - 0.06, 0, d / 2 + 0.005); row(w - 0.06, Math.PI, d / 2 + 0.005);
  row(d - 0.06, Math.PI / 2, w / 2 + 0.005); row(d - 0.06, -Math.PI / 2, w / 2 + 0.005);
}

// 柱子：柱础 + 柱身
function pillar(k, x, y, z, h, r = 0.034) {
  k.cyl(r * 1.7, r * 1.55, 0.04, C.stoneG, x, y, z, 14);
  k.cyl(r, r * 1.06, h - 0.04, C.red, x, y + 0.04, z, 14);
}
// 一圈柱子（四角）
function pillarRing(k, w, d, y, h, r) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillar(k, sx * w / 2, y, sz * d / 2, h, r); }

// 红漆大门：双扇门板 + 铜钉 + 门环 + 门楣匾额
function gate(k, x, y, z, w, h) {
  k.push(x, y, z, 0);
  k.box(w + 0.09, h + 0.06, 0.05, C.darkRed, 0, 0, 0, 0);
  for (const s of [-1, 1]) {
    k.box(w / 2 - 0.006, h, 0.045, C.red, s * w / 4, 0, 0.012, 0);
    const cols = 4, rows = 5;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) k.ball(0.011, C.gold, s * w / 4 + (i - (cols - 1) / 2) * (w / 2 - 0.05) / cols, 0.06 + j * (h - 0.1) / rows, 0.04, [1, 1, 0.6]);
    k.torus(0.022, 0.005, C.gold, s * 0.025, h * 0.45, 0.045, [0, 0, 0]);
  }
  k.box(w * 0.7, 0.07, 0.03, C.black, 0, h + 0.07, 0.0, 0);
  k.box(w * 0.7 + 0.03, 0.012, 0.035, C.gold, 0, h + 0.133, 0.0, 0);
  k.box(w * 0.7 + 0.03, 0.012, 0.035, C.gold, 0, h + 0.063, 0.0, 0);
  k.pop();
}
// 木格窗
function latticeWin(k, x, y, z, w, h, ry = 0) {
  k.push(x, y, z, ry);
  k.box(w + 0.06, h + 0.06, 0.03, C.darkRed, 0, -0.03, 0, 0);
  k.box(w, h, 0.04, C.lattice, 0, 0, 0.003, 0);
  k.pop();
}
// 灯笼：红色灯笼 + 金色顶盖 + 流苏
function lantern(k, x, y, z, s = 1) {
  k.cyl(0.002 * s, 0.002 * s, 0.07 * s, C.black, x, y, z, 4);
  k.cyl(0.03 * s, 0.03 * s, 0.014 * s, C.gold, x, y - 0.014 * s, z, 12);
  k.ball(0.05 * s, C.lantern, x, y - 0.06 * s, z, [1, 0.88, 1]);
  k.cyl(0.028 * s, 0.028 * s, 0.014 * s, C.gold, x, y - 0.118 * s, z, 12);
  k.cyl(0.003 * s, 0.003 * s, 0.05 * s, C.gold, x, y - 0.17 * s, z, 4);
}
// 红色栏杆（带望柱）：沿 x 方向 len，在 (x, y, z) 处转 ry
function redRail(k, x, y, z, len, ry, h = 0.15) {
  k.push(x, y, z, ry);
  k.box(len, 0.024, 0.04, C.red, 0, h, 0, 0.006);
  k.box(len, 0.02, 0.03, C.red, 0, 0.03, 0, 0.004);
  const n = Math.max(2, Math.round(len / 0.065));
  for (let i = 0; i <= n; i++) k.box(0.014, h, 0.014, C.darkRed, -len / 2 + (len * i) / n, 0.03, 0, 0);
  k.pop();
}
// 一小盆松
function pine(k, x, z, s = 1) {
  k.cyl(0.02 * s, 0.03 * s, 0.2 * s, C.trunk, x, 0, z, 8);
  for (let i = 0; i < 3; i++) k.cone((0.2 - i * 0.05) * s, 0.2 * s, C.leaf, x, (0.14 + i * 0.12) * s, z, 12);
}
// 台阶（三级，朝 +z）
function stairs(k, x, y, z, w, steps = 3, rise = 0.035, run = 0.07) {
  for (let i = 0; i < steps; i++) k.box(w, rise * (steps - i), run, C.stone, x, y, z + i * run, 0.008);
}
// 塔刹：莲座 + 相轮 + 宝珠，从 y 往上
function pagodaTop(k, y, ctx, blink) {
  k.lathe([[0.001, 0], [0.12, 0], [0.12, 0.03], [0.06, 0.05], [0.05, 0.12]], C.gold, 0, y, 0, 20);
  for (let i = 0; i < 4; i++) k.cyl(0.075 - i * 0.012, 0.075 - i * 0.012, 0.025, C.gold, 0, y + 0.14 + i * 0.07, 0, 18);
  k.cyl(0.012, 0.012, 0.36, C.gold, 0, y + 0.1, 0, 8);
  k.lathe([[0.001, 0], [0.05, 0.02], [0.06, 0.06], [0.04, 0.12], [0.001, 0.18]], C.gold, 0, y + 0.44, 0, 16);
  if (blink) ctx.blink(0, y + 0.66, 0);
  else k.ball(0.04, C.gold, 0, y + 0.66, 0);
}

export function buildChinese(k, level, ctx) {
  ctx.cnRoof = cnRoofMat(ctx.color);
  const accent = ctx.accent;

  // ───────── 0 级：四角亭 ─────────
  if (level === 0) {
    k.box(0.98, 0.07, 0.98, C.stone, 0, 0, 0, 0.02);
    k.box(0.9, 0.05, 0.9, C.stone, 0, 0.07, 0, 0.015);
    stairs(k, 0, 0, 0.5, 0.34, 2, 0.04, 0.07);
    const y = 0.12, ph = 0.5, o = 0.3;
    pillarRing(k, o * 2, o * 2, y, ph, 0.03);
    for (const [bx, bz, bw, bd] of [[0, o, o * 2 + 0.06, 0.05], [0, -o, o * 2 + 0.06, 0.05], [o, 0, 0.05, o * 2 + 0.06], [-o, 0, 0.05, o * 2 + 0.06]]) k.box(bw, 0.06, bd, C.red, bx, y + ph - 0.07, bz, 0.01);
    // 挂落：梁下的金色花牙子
    for (const [px, pz, rot] of [[0, o, 0], [0, -o, 0], [o, 0, Math.PI / 2], [-o, 0, Math.PI / 2]]) {
      k.push(px, y + ph - 0.1, pz, rot);
      for (let i = -3; i <= 3; i++) k.box(0.012, 0.05 - Math.abs(i) * 0.005, 0.012, C.gold, i * 0.075, -0.045, 0, 0);
      k.box(o * 2 - 0.08, 0.012, 0.014, C.gold, 0, -0.005, 0, 0);
      k.pop();
    }
    // 三面栏杆 + 坐凳，正面留口
    redRail(k, 0, y + 0.07, -o, o * 2, 0, 0.14);
    redRail(k, o, y + 0.07, 0, o * 2, Math.PI / 2, 0.14);
    redRail(k, -o, y + 0.07, 0, o * 2, Math.PI / 2, 0.14);
    k.cyl(0.07, 0.06, 0.1, C.stone, 0, y, 0, 16);                       // 石桌
    k.cyl(0.085, 0.085, 0.02, C.stone, 0, y + 0.1, 0, 20);
    dougong(k, o * 2 + 0.12, o * 2 + 0.12, y + ph);
    roofCN(k, ctx, 1.06, 1.06, 0.4, y + ph + 0.045);
    for (const sx of [-1, 1]) lantern(k, sx * o, y + ph - 0.1, o + 0.0, 0.9);
    return y + ph + 0.045 + 0.4 + 0.22;
  }

  // ───────── 1 级：四合院正房 ─────────
  if (level === 1) {
    k.box(1.4, 0.1, 1.2, C.stone, 0, 0, 0.02, 0.02);
    const y = 0.1, wh = 0.5, zc = -0.15;
    k.box(1.06, 0.06, 0.66, C.stoneG, 0, y, zc, 0.01);                  // 墙基
    k.box(1.0, wh, 0.62, C.wall, 0, y + 0.06, zc, 0.012);
    // 前廊：四根红柱 + 额枋
    const zf = zc + 0.31 + 0.12;
    for (const x of [-0.5, -0.17, 0.17, 0.5]) pillar(k, x, y, zf, wh + 0.06, 0.03);
    k.box(1.1, 0.06, 0.05, C.red, 0, y + wh, zf, 0.01);
    for (const s of [-1, 1]) k.box(0.05, 0.05, 0.12, C.red, s * 0.5, y + wh + 0.005, zf - 0.06, 0);
    // 门和窗
    gate(k, 0, y + 0.06, zc + 0.31 + 0.005, 0.28, 0.34);
    for (const sx of [-1, 1]) latticeWin(k, sx * 0.335, y + 0.2, zc + 0.31 + 0.01, 0.2, 0.22);
    for (const sx of [-1, 1]) k.box(0.18, 0.28, 0.01, C.lattice, sx * 0.5 + 0, y + 0.18, zc + 0.0, 0);
    dougong(k, 1.14, 0.8, y + wh + 0.06);
    roofCN(k, ctx, 1.36, 0.98, 0.3, y + wh + 0.105, { x: 0, z: zc + 0.02 });
    for (const x of [-0.335, 0.335]) lantern(k, x, y + wh - 0.02, zf + 0.03, 0.85);
    stairs(k, 0, 0.1, zf + 0.1, 0.38, 2, 0.04, 0.07);
    // 院墙：两段矮墙 + 门柱
    const wz = 0.64;
    for (const sx of [-1, 1]) {
      k.box(0.42, 0.2, 0.06, C.wall, sx * 0.5, 0, wz, 0.01);
      k.box(0.46, 0.035, 0.1, C.stoneG, sx * 0.5, 0.2, wz, 0.01);
    }
    for (const sx of [-1, 1]) { k.box(0.07, 0.26, 0.07, C.red, sx * 0.16, 0, wz, 0.01); k.box(0.1, 0.035, 0.1, C.stoneG, sx * 0.16, 0.26, wz, 0.01); }
    k.box(0.32, 0.04, 0.06, C.red, 0, 0.22, wz, 0.008);
    for (const x of [-0.3, 0.3]) latticeWin(k, x, y + 0.2, zc - 0.31 - 0.01, 0.2, 0.22, Math.PI);
    pine(k, 0.55, 0.38, 0.9);
    k.cyl(0.05, 0.05, 0.1, C.stone, -0.55, 0, 0.4, 14);               // 石鼓/花盆
    k.ball(0.05, C.leaf, -0.55, 0.15, 0.4);
    return 1.08;
  }

  // ───────── 2 级：两层小楼，重檐 ─────────
  if (level === 2) {
    k.box(1.46, 0.1, 1.3, C.stone, 0, 0, 0, 0.02);
    const y = 0.1, h1 = 0.5;
    k.box(0.98, 0.05, 0.8, C.stoneG, 0, y, 0, 0.01);
    k.box(0.92, h1, 0.74, C.wall, 0, y + 0.05, 0, 0.012);
    // 一层回廊的柱子
    const px = 0.56, pz = 0.5;
    for (const x of [-px, -0.19, 0.19, px]) pillar(k, x, y, pz, h1 + 0.05, 0.032);
    for (const z of [-pz, -0.17, 0.17]) { pillar(k, -px, y, z, h1 + 0.05, 0.032); pillar(k, px, y, z, h1 + 0.05, 0.032); }
    pillar(k, -0.19, y, -pz, h1 + 0.05, 0.032); pillar(k, 0.19, y, -pz, h1 + 0.05, 0.032);
    k.box(1.2, 0.06, 0.06, C.red, 0, y + h1 - 0.0, pz, 0.01);
    gate(k, 0, y + 0.05, 0.37 + 0.005, 0.26, 0.32);
    for (const sx of [-1, 1]) latticeWin(k, sx * 0.34, y + 0.2, 0.37 + 0.01, 0.2, 0.22);
    redRail(k, 0, y + 0.05, pz + 0.01, 0.4, 0, 0.1);
    dougong(k, 1.2, 1.02, y + h1 + 0.06);
    roofCN(k, ctx, 1.36, 1.2, 0.2, y + h1 + 0.105, { finial: false, bells: true });
    // 二层
    const y2 = y + h1 + 0.2 + 0.07, h2 = 0.46;
    k.box(0.72, 0.04, 0.6, C.red, 0, y2 - 0.02, 0, 0.01);
    k.box(0.66, h2, 0.52, C.lattice, 0, y2 + 0.02, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillar(k, sx * 0.34, y2, sz * 0.28, h2 + 0.02, 0.026);
    // 二层前面一圈阳台栏杆
    redRail(k, 0, y2 + 0.0, 0.34, 0.74, 0, 0.12);
    redRail(k, 0.37, y2, 0.05, 0.6, Math.PI / 2, 0.12);
    redRail(k, -0.37, y2, 0.05, 0.6, Math.PI / 2, 0.12);
    k.box(0.14, 0.34, 0.012, C.darkRed, 0, y2 + 0.04, 0.265, 0);
    dougong(k, 0.82, 0.7, y2 + h2 + 0.02);
    roofCN(k, ctx, 1.04, 0.9, 0.36, y2 + h2 + 0.065);
    lantern(k, -0.38, y2 + h2 - 0.02, 0.34, 0.8); lantern(k, 0.38, y2 + h2 - 0.02, 0.34, 0.8);
    return y2 + h2 + 0.065 + 0.36 + 0.24;
  }

  // ───────── 3 级：三层楼阁；4 级：五层宝塔；5 级：七层宝塔 ─────────
  const tower = level === 3;
  const n = level === 3 ? 3 : level === 4 ? 5 : 7;
  const base = level === 3 ? 1.46 : 1.5;
  k.box(base, 0.14, base, C.stone, 0, 0, 0, 0.025);
  k.box(base - 0.18, 0.1, base - 0.18, C.stone, 0, 0.14, 0, 0.02);
  stairs(k, 0, 0, base / 2 + 0.0, 0.42, 3, 0.04, 0.07);
  redRail(k, 0, 0.24, base / 2 - 0.12, base - 0.34, 0, 0.1);
  let y = 0.24;
  for (let i = 0; i < n; i++) {
    const sc = tower ? 1 - i * 0.18 : 1 - i * (level === 4 ? 0.1 : 0.075);
    const w = (tower ? 1.0 : 0.96) * sc, h = (tower ? 0.58 : level === 4 ? 0.5 : 0.46) * Math.max(sc, 0.7);
    // 塔身
    k.box(w, h, w, i % 2 && !tower ? C.lattice : C.wall, 0, y, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillar(k, sx * (w / 2 + 0.02), y, sz * (w / 2 + 0.02), h, 0.03 * Math.max(sc, 0.75));
    k.box(w + 0.1, 0.05, w + 0.1, C.red, 0, y + h - 0.01, 0, 0.01);
    // 每面的门/窗：第一层是大门，上面各层是拱窗
    for (let f = 0; f < 4; f++) {
      k.push(0, 0, 0, f * Math.PI / 2);
      if (i === 0 && f === 0) gate(k, 0, y, w / 2 + 0.005, 0.26, 0.34);
      else if (tower) latticeWin(k, 0, y + h * 0.25, w / 2 + 0.012, w * 0.34, h * 0.5);
      else {
        k.box(w * 0.28, h * 0.55, 0.03, C.black, 0, y + h * 0.18, w / 2 + 0.005, 0);
        k.cyl(w * 0.14, w * 0.14, 0.03, C.black, 0, y + h * 0.18 + h * 0.55 - 0.001, w / 2 + 0.005, 16, [Math.PI / 2, 0, 0]);
      }
      k.pop();
    }
    // 每层的腰檐平座栏杆
    redRail(k, 0, y + h + 0.045, (w + 0.16) / 2, w + 0.1, 0, 0.09);
    dougong(k, w + 0.16, w + 0.16, y + h + 0.04);
    const top = i === n - 1;
    const rh = top ? (tower ? 0.42 : 0.32 * sc + 0.06) : 0.17 * Math.max(sc, 0.75);
    roofCN(k, ctx, w + 0.4 * sc, w + 0.4 * sc, rh, y + h + 0.085, { finial: top && tower, bells: true });
    y += h + 0.085 + rh * 0.62;
    if (!top) k.box(w * 0.82, 0.05, w * 0.82, C.stone, 0, y - 0.02, 0, 0.01);
  }
  if (tower) {
    return y + 0.4;
  }
  pagodaTop(k, y - 0.06, ctx, level === 5);
  return y + 0.7;
}

// 给街区景物（dist-*.js）复用的中式零件
export { roofCN as cnRoof, dougong, pillar, pillarRing, gate, latticeWin, lantern, redRail, pine as cnPine, stairs, pagodaTop, C as CN, LATTICE };
