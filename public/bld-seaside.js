// 海滨：高脚沙滩屋 → 地中海别墅 → 圣托里尼 → 度假酒店 → 圆形度假塔 → 风帆酒店（0~5 级）。
// 遮阳篷、沙滩伞、圆顶、塔冠用地主的颜色。
import * as THREE from 'three';
import { mat, TEX, canvasTex, PARTS } from './modeling.js';

const { windowUnit, door, railing, gableRoof, awning } = PARTS;

// 白墙 + 蓝色拱窗的度假酒店立面：一张贴图 = 0.66m 宽 × 0.5m 高（3 个拱窗），白墙略带颗粒
const RESORT = canvasTex(512, 384, (g, w, h) => {
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h);
  let t = 9; const r = () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; };
  g.globalAlpha = 0.16;
  for (let i = 0; i < 600; i++) { g.fillStyle = r() > 0.5 ? '#d8cdb5' : '#ffffff'; g.fillRect(r() * w, r() * h, 3 + r() * 5, 2 + r() * 4); }
  g.globalAlpha = 1;
  const cw = w / 3;
  for (let i = 0; i < 3; i++) {
    const x = i * cw + cw * 0.22, ww = cw * 0.56, top = h * 0.18, bot = h * 0.74;
    // 窗洞和拱
    g.fillStyle = '#e9e1d0';
    g.beginPath(); g.moveTo(x - 6, bot + 6); g.lineTo(x - 6, top + ww / 2); g.arc(x + ww / 2, top + ww / 2, ww / 2 + 6, Math.PI, 0); g.lineTo(x + ww + 6, bot + 6); g.closePath(); g.fill();
    const gr = g.createLinearGradient(x, top, x + ww, bot);
    gr.addColorStop(0, '#9bd6f7'); gr.addColorStop(0.5, '#3f93d6'); gr.addColorStop(1, '#1f5f9e');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x, bot); g.lineTo(x, top + ww / 2); g.arc(x + ww / 2, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(x + ww, bot); g.closePath(); g.fill();
    g.strokeStyle = '#fffdf8'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x + ww / 2, top); g.lineTo(x + ww / 2, bot); g.stroke();
    g.beginPath(); g.moveTo(x, top + ww / 2 + 8); g.lineTo(x + ww, top + ww / 2 + 8); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath(); g.moveTo(x + 8, bot - 6); g.lineTo(x + ww * 0.45, top + 18); g.lineTo(x + ww * 0.6, top + 18); g.lineTo(x + 24, bot - 6); g.fill();
  }
  g.fillStyle = '#e6dfcf'; g.fillRect(0, h - 14, w, 14);
});
// 圆塔的玻璃立面：横向一圈圈落地窗，一张贴图 = 0.3m 宽 × 0.45m 高（一层）
const TOWER_WIN = canvasTex(256, 384, (g, w, h) => {
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#a8def9'); gr.addColorStop(0.5, '#4a9fdc'); gr.addColorStop(1, '#2468a8');
  g.fillStyle = gr; g.fillRect(14, 30, w - 28, h * 0.62);
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.beginPath(); g.moveTo(14, 30 + h * 0.62); g.lineTo(w * 0.5, 30); g.lineTo(w * 0.7, 30); g.lineTo(60, 30 + h * 0.62); g.fill();
  g.fillStyle = '#e6dfcf'; g.fillRect(0, h - 12, w, 12);
});
// 风帆立面：白色帆布 + 一排排玻璃窗带，一张贴图 = 0.5m × 0.4m
const SAIL = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#8fd0f5'); gr.addColorStop(1, '#2f7fc4');
  g.fillStyle = gr; g.fillRect(0, h * 0.18, w, h * 0.5);
  g.strokeStyle = '#ffffff'; g.lineWidth = 5;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * w / 4, h * 0.18); g.lineTo(i * w / 4, h * 0.68); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h - 8, w, 8);
});
const HELI = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2b6cb0'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#2b6cb0'; g.font = 'bold 74px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 68);
});

const S = {
  white: mat('#fffdf8', { map: TEX.plaster, tile: 1, roughness: 0.85 }),
  resort: mat('#ffffff', { map: RESORT, tile: [0.66, 0.5], roughness: 0.75 }),
  tower: mat('#ffffff', { map: TOWER_WIN, tile: [0.3, 0.45], roughness: 0.4, metalness: 0.08 }),
  sail: mat('#ffffff', { map: SAIL, tile: [0.5, 0.4], roughness: 0.3, metalness: 0.1, envMapIntensity: 1.2 }),
  stone: mat('#ffffff', { map: TEX.stone, tile: 0.8, roughness: 0.85 }),
  sand: mat('#f1dca6', { roughness: 1 }),
  deck: mat('#ffffff', { map: TEX.planks, tile: 0.5, roughness: 0.8 }),
  wood: mat('#a87444', { roughness: 0.8 }),
  woodL: mat('#e8cf9f', { roughness: 0.8 }),
  blue: mat('#2f86d6', { roughness: 0.35 }),
  blueD: mat('#1d5fa8', { roughness: 0.4 }),
  pool: mat('#37c5ee', { roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4, emissive: '#0a5a7a', emissiveIntensity: 0.3 }),
  poolRim: mat('#f4efe2', { roughness: 0.6 }),
  metal: mat('#cfd6dd', { metalness: 0.7, roughness: 0.3 }),
  glass: mat('#bfe6ff', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, envMapIntensity: 1.4 }),
  leaf: mat('#3fae49', { roughness: 0.9 }),
  leafD: mat('#2e8b57', { roughness: 0.9 }),
  pink: mat('#e2358b', { roughness: 0.8 }),
  pot: mat('#c4663a', { roughness: 0.85 }),
  red: mat('#e8453c', { roughness: 0.5 }),
  heli: mat('#ffffff', { map: HELI, roughness: 0.6 }),
  gold: mat('#f0bd2e', { metalness: 0.5, roughness: 0.32, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  dark: mat('#33404d', { roughness: 0.6 }),
};

// 条纹贴图（遮阳篷、沙滩伞）：地主颜色 + 白色相间
function stripeMat(color, n, tile) {
  const t = canvasTex(128, 128, (g, w, h) => {
    const sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#ffffff' : color; g.fillRect(i * sw, 0, sw + 1, h); }
  });
  return mat('#ffffff', { map: t, tile, roughness: 0.6, side: THREE.DoubleSide });
}

// 拱形窗：下半是矩形，上半是半圆，带白框和窗棂
function archWindow(k, x, y, z, w, h, glass = S.blue) {
  k.push(x, y, z, 0);
  const r = w / 2, rh = h - r;
  k.box(w + 0.07, rh, 0.04, S.poolRim, 0, 0, 0, 0);
  k.cyl(r + 0.035, r + 0.035, 0.04, S.poolRim, 0, rh, 0, 24, [Math.PI / 2, 0, 0]);
  k.box(w, rh, 0.05, glass, 0, 0, 0.004, 0);
  k.cyl(r, r, 0.05, glass, 0, rh, 0.004, 24, [Math.PI / 2, 0, 0]);
  k.box(0.016, h - 0.01, 0.06, S.poolRim, 0, 0, 0.006, 0);
  k.box(w, 0.016, 0.06, S.poolRim, 0, rh * 0.55, 0.006, 0);
  k.pop();
}
// 拱形门
function archDoor(k, x, y, z, w, h, m = S.blueD) {
  k.push(x, y, z, 0);
  const r = w / 2, rh = h - r;
  k.box(w + 0.08, rh, 0.045, S.poolRim, 0, 0, 0, 0);
  k.cyl(r + 0.04, r + 0.04, 0.045, S.poolRim, 0, rh, 0, 24, [Math.PI / 2, 0, 0]);
  k.box(w, rh, 0.055, m, 0, 0, 0.005, 0);
  k.cyl(r, r, 0.055, m, 0, rh, 0.005, 24, [Math.PI / 2, 0, 0]);
  k.box(0.012, h - 0.02, 0.065, S.poolRim, 0, 0, 0.01, 0);
  k.ball(0.014, S.gold, 0.035, h * 0.45, 0.045);
  k.pop();
}
function umbrella(k, x, y, z, r, sm) {
  k.cyl(0.011, 0.011, 0.5, S.metal, x, y, z, 6);
  k.geo(new THREE.ConeGeometry(r, 0.12, 24, 1, true), sm, x, y + 0.5 + 0.03, z);
  k.ball(0.014, S.gold, x, y + 0.6, z);
}
function lounger(k, x, y, z, ry, sm) {
  k.push(x, y, z, ry);
  k.box(0.12, 0.03, 0.3, S.white, 0, 0.04, 0, 0.012);
  k.box(0.12, 0.03, 0.14, S.white, 0, 0.05, -0.17, 0.012, [0.9, 0, 0]);
  k.box(0.1, 0.012, 0.26, sm, 0, 0.07, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.008, 0.008, 0.04, S.metal, sx * 0.05, 0, sz * 0.12, 5);
  k.pop();
}
// 圆冠小树
function palmSmall(k, x, z, s = 1) {
  let px = x, py = 0;
  for (let i = 0; i < 5; i++) { k.cyl(0.03 * s, 0.036 * s, 0.1 * s, S.wood, px, py, z, 8); py += 0.095 * s; px += 0.012 * s; }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.geo(new THREE.PlaneGeometry(0.34 * s, 0.07 * s, 4, 1), S.leaf, px + Math.cos(a) * 0.12 * s, py - 0.0, z + Math.sin(a) * 0.12 * s, [-1.1, -a + Math.PI / 2 + 0, 0.0]);
  }
  k.ball(0.03 * s, S.wood, px, py - 0.02, z);
}
function pottedPlant(k, x, y, z, s = 1) {
  k.cyl(0.034 * s, 0.026 * s, 0.05 * s, S.pot, x, y, z, 12);
  k.ball(0.045 * s, S.leaf, x, y + 0.08 * s, z);
}
// 簇拥的三角梅（粉色小球）
function bougainvillea(k, x, y, z, n = 6, s = 1, seed = 1) {
  let t = seed * 977; const r = () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; };
  for (let i = 0; i < n; i++) k.ball((0.025 + r() * 0.02) * s, i % 3 ? S.pink : S.leafD, x + (r() - 0.5) * 0.14 * s, y + (r() - 0.5) * 0.1 * s, z + r() * 0.05);
}
function pool(k, x, y, z, w, d) {
  k.box(w + 0.1, 0.04, d + 0.1, S.poolRim, x, y, z, 0.012);
  k.box(w, 0.02, d, S.pool, x, y + 0.035, z, 0);
}

export function buildSeaside(k, level, ctx) {
  const roof = ctx.roof, accent = ctx.accent;
  const stripe = stripeMat(ctx.color, 4, 0.2), stripeU = stripeMat(ctx.color, 12, 1);

  // ───────── 0 级：高脚沙滩屋 ─────────
  if (level === 0) {
    // 沙地和木桩
    k.cyl(0.62, 0.7, 0.05, S.sand, 0, 0, 0, 28);
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) k.cyl(0.032, 0.036, 0.3, S.wood, sx * 0.34, 0.02, sz * 0.28, 10);
    k.box(1.0, 0.05, 0.84, S.deck, 0, 0.3, 0.03, 0.01);
    // 小屋
    k.box(0.64, 0.4, 0.5, S.woodL, 0, 0.35, -0.1, 0.012);
    for (let i = -3; i <= 3; i++) { k.box(0.012, 0.4, 0.012, S.wood, i * 0.1, 0.35, 0.16, 0); }
    gableRoof(k, 0.64, 0.5, 0.3, roof, S.woodL, 0, 0.75, -0.1, { overhang: 0.12 });
    door(k, 0, 0.35, 0.16, 0.16, 0.3, S.blueD, { frame: S.poolRim, panels: false });
    windowUnit(k, -0.2, 0.52, 0.155, 0.1, 0.12, { shutter: true, shutterMat: S.blue, bars: 1 });
    windowUnit(k, 0.2, 0.52, 0.155, 0.1, 0.12, { shutter: true, shutterMat: S.blue, bars: 1 });
    // 前廊栏杆、台阶
    railing(k, -0.25, 0.35, 0.44, 0.48, 0, S.wood, 0.1);
    railing(k, 0.34, 0.35, 0.44, 0.3, 0, S.wood, 0.1);
    for (let i = 0; i < 4; i++) k.box(0.2, 0.04, 0.06, S.deck, 0.0 + 0.0, 0.3 - i * 0.075 - 0.01, 0.5 + i * 0.07, 0.006);
    // 冲浪板（地主颜色）、救生圈、小灯
    k.box(0.07, 0.5, 0.018, accent, 0.46, 0.35, 0.18, 0.008, [0, 0, -0.18]);
    k.box(0.02, 0.5, 0.02, S.white, 0.465, 0.35, 0.19, 0, [0, 0, -0.18]);
    k.torus(0.05, 0.016, S.red, -0.31, 0.5, 0.155, [0, 0, 0]);
    k.torus(0.05, 0.0165, S.white, -0.31, 0.5, 0.157, [0, 0, 0], Math.PI * 0.5);
    k.ball(0.022, mat('#fff1b8', { emissive: '#ffd66b', emissiveIntensity: 0.9 }), 0.11, 0.62, 0.17);
    palmSmall(k, -0.55, 0.45, 0.8);
    return 1.0;
  }

  // ───────── 1 级：白色平顶别墅 + 泳池 ─────────
  if (level === 1) {
    const w = 1.12, d = 0.76, h = 0.58, zc = -0.3;
    k.box(w + 0.06, 0.06, d + 0.06, S.stone, 0, 0, zc, 0.012);
    k.box(w, h, d, S.white, 0, 0.06, zc, 0.03);
    k.box(w + 0.07, 0.05, d + 0.07, roof, 0, 0.06 + h, zc, 0.016);                  // 屋顶板（地主色）
    k.box(w + 0.05, 0.07, 0.03, S.white, 0, 0.06 + h + 0.05, zc + d / 2 + 0.02, 0.006);
    k.box(w + 0.05, 0.07, 0.03, S.white, 0, 0.06 + h + 0.05, zc - d / 2 - 0.02, 0.006);
    for (const sx of [-1, 1]) k.box(0.03, 0.07, d + 0.05, S.white, sx * (w / 2 + 0.02), 0.06 + h + 0.05, zc, 0.006);
    // 屋顶上的小楼梯间 + 太阳能板
    k.box(0.28, 0.22, 0.26, S.white, -0.3, 0.06 + h + 0.05, zc - 0.1, 0.02);
    k.box(0.12, 0.08, 0.1, S.metal, 0.3, 0.06 + h + 0.05, zc - 0.05, 0.01);
    k.box(0.12, 0.08, 0.1, S.metal, 0.44, 0.06 + h + 0.05, zc - 0.05, 0.01);
    // 立面：拱形门窗、遮阳篷
    const fz = zc + d / 2;
    archDoor(k, -0.28, 0.06, fz + 0.02, 0.2, 0.38);
    archWindow(k, 0.12, 0.2, fz + 0.015, 0.2, 0.3);
    archWindow(k, 0.42, 0.2, fz + 0.015, 0.16, 0.3);
    awning(k, 0.27, 0.54, fz + 0.01, 0.56, 0.26, stripe);
    for (const sx of [-1, 1]) for (const z of [-0.15, 0.15]) { k.push(sx * (w / 2 + 0.005), 0, zc + z, sx * Math.PI / 2); archWindow(k, 0, 0.2, 0, 0.14, 0.26); k.pop(); }
    // 泳池 + 躺椅 + 沙滩伞
    k.push(0, 0, zc - d / 2 - 0.005, Math.PI); archWindow(k, -0.3, 0.2, 0, 0.16, 0.3); archWindow(k, 0.0, 0.2, 0, 0.16, 0.3); archWindow(k, 0.3, 0.2, 0, 0.16, 0.3); k.pop();
    pool(k, 0.1, 0.0, 0.38, 0.62, 0.34);
    lounger(k, -0.42, 0.0, 0.38, 0, stripe); lounger(k, -0.55, 0.0, 0.38, 0, stripe);
    umbrella(k, -0.5, 0.0, 0.1, 0.3, stripeU);
    pottedPlant(k, 0.55, 0.0, 0.3); pottedPlant(k, -0.6, 0.0, 0.62, 0.9);
    palmSmall(k, 0.58, 0.08, 0.9);
    return 0.95;
  }

  // ───────── 2 级：圣托里尼 ─────────
  if (level === 2) {
    // 底层长方体
    k.box(1.3, 0.1, 1.1, S.stone, 0, 0, -0.03, 0.02);
    const y0 = 0.1;
    k.box(1.2, 0.5, 0.84, S.white, 0, y0, -0.12, 0.035);
    archDoor(k, 0.22, y0, 0.31, 0.2, 0.36);
    archWindow(k, -0.2, y0 + 0.14, 0.31, 0.15, 0.26);
    archWindow(k, -0.45, y0 + 0.14, 0.31, 0.13, 0.24);
    // 二层错落的小房子，上面是蓝色圆顶（地主色）
    k.box(0.72, 0.5, 0.56, S.white, -0.22, y0 + 0.5, -0.26, 0.04);
    archWindow(k, -0.4, y0 + 0.62, 0.025, 0.12, 0.24);
    archWindow(k, -0.1, y0 + 0.62, 0.025, 0.12, 0.24);
    k.cyl(0.25, 0.25, 0.08, S.white, -0.22, y0 + 1.0, -0.26, 28);
    k.dome(0.26, accent, -0.22, y0 + 1.08, -0.26, 0.5);
    k.cyl(0.012, 0.012, 0.1, S.gold, -0.22, y0 + 1.33, -0.26, 8);
    k.box(0.05, 0.012, 0.012, S.gold, -0.22, y0 + 1.4, -0.26, 0);
    k.box(0.012, 0.07, 0.012, S.gold, -0.22, y0 + 1.37, -0.26, 0);
    // 屋顶平台：栏杆、遮阳棚、钟楼
    k.box(0.52, 0.05, 0.56, S.white, 0.34, y0 + 0.5, -0.05, 0.02);
    railing(k, 0.34, y0 + 0.55, 0.23, 0.52, 0, S.white, 0.11);
    railing(k, 0.6, y0 + 0.55, -0.05, 0.56, Math.PI / 2, S.white, 0.11);
    k.box(0.16, 0.34, 0.12, S.white, 0.5, y0 + 0.55, -0.28, 0.02);
    k.cyl(0.05, 0.05, 0.14, S.white, 0.5, y0 + 0.89, -0.28, 14, [Math.PI / 2, 0, 0]);
    k.box(0.1, 0.17, 0.14, S.dark, 0.5, y0 + 0.62, -0.221, 0, [0, 0, 0]);
    k.cyl(0.032, 0.04, 0.05, S.gold, 0.5, y0 + 0.68, -0.22, 10);
    awning(k, 0.28, y0 + 0.78, 0.0, 0.36, 0.22, stripe);
    for (const sx of [-1, 1]) k.cyl(0.01, 0.01, 0.25, S.metal, 0.28 + sx * 0.16, y0 + 0.55, 0.2, 6);
    for (const sx of [-1, 1]) for (const z of [-0.3, 0.0]) {
      k.push(sx * 0.608, 0, -0.12 + z, sx * Math.PI / 2);
      archWindow(k, 0, y0 + 0.14, 0, 0.14, 0.26);
      k.pop();
    }
    for (const sx of [-1, 1]) { k.push(-0.22 + sx * 0.368, 0, -0.26, sx * Math.PI / 2); archWindow(k, 0, y0 + 0.62, 0, 0.14, 0.24); k.pop(); }
    k.push(0, 0, -0.12 - 0.42 - 0.005, Math.PI); archWindow(k, -0.4, y0 + 0.14, 0, 0.15, 0.26); archWindow(k, 0, y0 + 0.14, 0, 0.15, 0.26); archWindow(k, 0.4, y0 + 0.14, 0, 0.15, 0.26); k.pop();
    k.push(-0.22, 0, -0.26 - 0.28 - 0.005, Math.PI); archWindow(k, -0.2, y0 + 0.62, 0, 0.12, 0.24); archWindow(k, 0.2, y0 + 0.62, 0, 0.12, 0.24); k.pop();
    // 三角梅、花盆、台阶
    bougainvillea(k, 0.05, y0 + 0.42, 0.34, 9, 1.1, 3);
    bougainvillea(k, -0.68, y0 + 0.3, 0.2, 7, 1.0, 5);
    bougainvillea(k, -0.5, y0 + 0.88, 0.04, 7, 0.9, 7);
    pottedPlant(k, 0.46, y0, 0.45); pottedPlant(k, -0.1, y0, 0.45, 0.9);
    for (let i = 0; i < 4; i++) k.box(0.3, 0.04 * (4 - i), 0.07, S.stone, 0.22, 0, 0.55 + i * 0.07 - 0.07, 0.008);
    return 1.5;
  }

  // ───────── 3 级：度假酒店（4 层，拱窗 + 阳台 + 屋顶泳池）─────────
  if (level === 3) {
    const w = 1.26, d = 1.0, y0 = 0.07, gh = 0.42, fh = 0.44, floors = 4, H = gh + floors * fh;
    k.box(w + 0.1, y0, d + 0.1, S.stone, 0, 0, 0, 0.012);
    k.box(w, H, d, S.resort, 0, y0, 0, 0.025);
    k.box(w + 0.02, gh, d + 0.02, S.white, 0, y0, 0, 0.02);                        // 底层白色基座
    // 每层窗 + 阳台（前面）
    for (let f = 0; f < floors; f++) {
      const y = y0 + gh + f * fh;
      for (const x of [-0.4, 0, 0.4]) {
        archWindow(k, x, y + 0.09, d / 2 + 0.012, 0.18, 0.3);
        k.box(0.34, 0.035, 0.14, S.white, x, y + 0.02, d / 2 + 0.07, 0.01);
        k.box(0.34, 0.07, 0.014, accent, x, y + 0.06, d / 2 + 0.14, 0.004);
        k.box(0.34, 0.1, 0.01, S.glass, x, y + 0.055, d / 2 + 0.148, 0);
      }
      k.box(w + 0.03, 0.025, d + 0.03, S.poolRim, 0, y - 0.005, 0, 0.006);
    }
    // 底层：玻璃大堂 + 门廊柱 + 雨篷
    k.box(0.5, 0.3, 0.02, S.dark, 0, y0, d / 2 + 0.01, 0);
    k.box(0.44, 0.27, 0.012, S.glass, 0, y0 + 0.01, d / 2 + 0.024, 0);
    k.box(0.9, 0.045, 0.36, accent, 0, y0 + 0.36, d / 2 + 0.18, 0.012);
    for (const x of [-0.4, 0.4]) k.cyl(0.02, 0.022, 0.34, S.white, x, y0, d / 2 + 0.32, 12);
    for (const sx of [-1, 1]) archWindow(k, sx * 0.48, y0 + 0.06, d / 2 + 0.012, 0.15, 0.24);
    // 侧面和后面用贴图窗
    // 屋顶：地主色屋檐 + 泳池 + 遮阳伞
    const ty = y0 + H;
    k.box(w + 0.08, 0.07, d + 0.08, accent, 0, ty, 0, 0.018);
    for (const [bx, bz, bw, bd] of [[0, d / 2 + 0.02, w + 0.04, 0.025], [0, -d / 2 - 0.02, w + 0.04, 0.025], [w / 2 + 0.02, 0, 0.025, d + 0.04], [-w / 2 - 0.02, 0, 0.025, d + 0.04]]) k.box(bw, 0.1, bd, S.glass, bx, ty + 0.07, bz, 0);
    pool(k, -0.22, ty + 0.0, -0.1, 0.56, 0.4);
    lounger(k, 0.15, ty + 0.07, 0.15, Math.PI / 2, stripe); lounger(k, 0.15, ty + 0.07, -0.05, Math.PI / 2, stripe);
    umbrella(k, 0.35, ty + 0.07, 0.25, 0.24, stripeU);
    k.box(0.22, 0.17, 0.22, S.white, 0.38, ty + 0.07, -0.28, 0.02);
    palmSmall(k, -0.6, 0.72, 0.85); palmSmall(k, 0.62, 0.72, 0.9);
    return ty + 0.25;
  }

  // ───────── 4 级：圆形度假塔 ─────────
  if (level === 4) {
    k.cyl(0.78, 0.8, 0.3, S.stone, 0, 0, 0, 36);
    k.cyl(0.7, 0.7, 0.03, S.pool, 0, 0.3, 0, 36);                                   // 裙楼上的环形水池
    k.cyl(0.55, 0.55, 0.03, S.poolRim, 0, 0.3, 0, 36);
    const floors = 7, fh = 0.45, y0 = 0.32;
    k.cyl(0.54, 0.56, floors * fh, S.tower, 0, y0, 0, 48);
    for (let i = 0; i <= floors; i++) {
      const y = y0 + i * fh;
      k.cyl(0.66, 0.66, 0.045, S.white, 0, y - 0.02, 0, 48);
      k.torus(0.655, 0.01, S.metal, 0, y + 0.1, 0, [Math.PI / 2, 0, 0]);
      if (i < floors) k.cyl(0.655, 0.655, 0.09, S.glass, 0, y + 0.025, 0, 48);
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.cyl(0.012, 0.012, floors * fh, S.metal, Math.cos(a) * 0.655, y0, Math.sin(a) * 0.655, 5); }
    const ty = y0 + floors * fh;
    k.cyl(0.72, 0.62, 0.16, accent, 0, ty, 0, 48);
    k.cyl(0.36, 0.36, 0.1, S.white, 0, ty + 0.16, 0, 32);
    k.cyl(0.25, 0.25, 0.02, S.heli, 0, ty + 0.26, 0, 32);
    k.cyl(0.02, 0.03, 0.55, S.metal, 0, ty + 0.26, 0, 8);
    ctx.blink(0, ty + 0.85, 0);
    // 入口雨篷 + 棕榈
    k.box(0.5, 0.04, 0.32, accent, 0, 0.26, 0.9, 0.012);
    for (const sx of [-1, 1]) k.cyl(0.02, 0.02, 0.24, S.white, sx * 0.2, 0.02, 1.0, 10);
    palmSmall(k, -0.66, 0.68, 0.95); palmSmall(k, 0.66, 0.68, 0.9);
    return ty + 0.85;
  }

  // ───────── 5 级：风帆酒店 ─────────
  {
    k.box(1.5, 0.12, 1.45, S.stone, 0, 0, 0, 0.03);
    k.box(1.46, 0.02, 1.41, S.pool, 0, 0.12, 0, 0);
    k.box(1.0, 0.14, 0.9, S.white, 0.05, 0.12, 0, 0.03);
    // 帆
    const H = 5.7, sh = new THREE.Shape();
    sh.moveTo(-0.55, 0); sh.lineTo(0.55, 0); sh.quadraticCurveTo(0.55, H * 0.72, -0.55, H); sh.closePath();
    const sail = new THREE.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 40 });
    sail.translate(0, 0, -0.4);
    const sm = S.sail.clone();
    sm.map = SAIL.clone(); sm.map.needsUpdate = true; sm.map.repeat.set(1 / 0.5, 1 / 0.4);
    k.geo(sail, sm, 0.05, 0.26, 0);
    // 桅杆结构（地主色）：前后两根立柱 + 顶部斜撑
    for (const sz of [-1, 1]) k.box(0.1, H + 0.05, 0.1, accent, -0.5, 0.26, sz * 0.43, 0.02);
    // 横向的白色楼层线：按帆的弧线（二次贝塞尔）算出每个高度上帆的右边缘
    for (let i = 1; i < 14; i++) {
      const y = i * (H / 14), t = y / H;
      const sp = (1.44 - Math.sqrt(1.44 * 1.44 - 4 * 0.44 * t)) / 0.88;     // 解 H(1.44s - 0.44s²) = y
      const xr = 0.55 * (1 - 2 * sp * sp);
      const len = xr + 0.55;
      if (len > 0.12) k.box(len, 0.02, 0.84, S.white, 0.05 + (xr - 0.55) / 2, 0.26 + y, 0, 0);
    }
    // 停机坪：圆盘挑出在帆的右侧，下面有斜撑
    const hy = 0.26 + 4.1, hx = 0.58;
    k.cyl(0.36, 0.36, 0.04, S.heli, hx, hy, 0.0, 32);
    k.cyl(0.38, 0.38, 0.03, accent, hx, hy - 0.035, 0.0, 32);
    for (const sz of [-1, 1]) k.box(0.42, 0.035, 0.04, S.metal, hx - 0.2, hy - 0.1, sz * 0.2, 0, [0, 0, 0.5]);
    // 顶部天线 + 闪烁灯
    k.cyl(0.015, 0.035, 0.9, S.metal, -0.5, 6.0, 0, 8);
    ctx.blink(-0.5, 6.95, 0);
    // 入口
    k.box(0.5, 0.04, 0.3, accent, 0.05, 0.38, 0.78, 0.012);
    for (const sx of [-1, 1]) k.cyl(0.02, 0.02, 0.24, S.white, 0.05 + sx * 0.2, 0.14, 0.88, 10);
    palmSmall(k, -0.62, 0.62, 0.85); palmSmall(k, 0.65, 0.62, 0.9);
    return 6.2;
  }
}
