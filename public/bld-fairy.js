// 游乐园：糖果小摊 → 姜饼屋 → 小塔屋 → 三种童话城堡（0~5 级）。
// 尖顶的瓦片、条纹篷布、旗帜用地主的颜色；墙是马卡龙色。
import * as THREE from 'three';
import { mat, TEX, canvasTex, PARTS } from './modeling.js';

const { windowUnit, door, gableRoof } = PARTS;

const prng = (seed) => { let t = seed >>> 0; return () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; }; };

// 彩色玫瑰窗
const ROSE = canvasTex(128, 128, (g, w, h) => {
  const cols = ['#ff6b8a', '#ffd34d', '#4dabf7', '#69db7c', '#b197fc', '#ffa94d'];
  g.fillStyle = '#4a3a5a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 56, i * Math.PI / 6, (i + 1) * Math.PI / 6); g.closePath(); g.fill();
  }
  g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(64, 64, 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#4a3a5a'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.stroke();
});
// 棒棒糖：螺旋
const SWIRL = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff5c8a';
  for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(64, 64); for (let r = 0; r <= 64; r += 2) { const th = a * Math.PI / 3 + r * 0.06; g.lineTo(64 + Math.cos(th) * r, 64 + Math.sin(th) * r); } for (let r = 64; r >= 0; r -= 2) { const th = a * Math.PI / 3 + r * 0.06 + 0.5; g.lineTo(64 + Math.cos(th) * r, 64 + Math.sin(th) * r); } g.closePath(); g.fill(); }
});
// 红白糖果拐杖条纹（斜纹）
const CANE = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff4d6d';
  for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + 64, 64); g.lineTo(i * 32 + 64, 64); g.fill(); }
});

// 亮色的砖块贴图（几乎白色，染上马卡龙色也不会发灰）
const BLOCKS = canvasTex(512, 512, (g, w, h) => {
  const r = prng(21), rows = 8, rh = h / rows;
  g.fillStyle = '#e2e0dc'; g.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    let x = -r() * 50;
    while (x < w) {
      const bw = 60 + r() * 70, v = 246 + Math.floor(r() * 9);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 2, j * rh + 2, bw - 4, rh - 4);
      x += bw;
    }
  }
});

const F = {
  pink: mat('#ffc6da', { map: TEX.plaster, tile: 1, roughness: 0.75 }),
  lemon: mat('#fff0a6', { map: TEX.plaster, tile: 1, roughness: 0.75 }),
  mint: mat('#bdf0d3', { map: TEX.plaster, tile: 1, roughness: 0.75 }),
  sky: mat('#c3e4ff', { map: TEX.plaster, tile: 1, roughness: 0.75 }),
  lav: mat('#dccdff', { map: TEX.plaster, tile: 1, roughness: 0.75 }),
  ginger: mat('#c98a55', { map: TEX.plaster, tile: 0.7, roughness: 0.8 }),
  stonePink: mat('#ffd7e2', { map: BLOCKS, tile: 0.8, roughness: 0.7 }),
  stoneYel: mat('#fff1b5', { map: BLOCKS, tile: 0.8, roughness: 0.7 }),
  stoneMint: mat('#c9f2dc', { map: BLOCKS, tile: 0.8, roughness: 0.7 }),
  stoneSky: mat('#cfe7ff', { map: BLOCKS, tile: 0.8, roughness: 0.7 }),
  icing: mat('#fffdf6', { roughness: 0.35 }),
  choco: mat('#7b4a2b', { roughness: 0.55 }),
  wood: mat('#a1693a', { roughness: 0.75 }),
  woodD: mat('#6b4226', { roughness: 0.75 }),
  gold: mat('#f6c431', { metalness: 0.5, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  iron: mat('#505a66', { metalness: 0.6, roughness: 0.45 }),
  glass: mat('#9fd6ff', { roughness: 0.08, metalness: 0.25, envMapIntensity: 1.3 }),
  dark: mat('#3c3550', { roughness: 0.6 }),
  white: mat('#ffffff', { roughness: 0.5 }),
  leaf: mat('#4fbf5f', { roughness: 0.9 }),
  rose: mat('#ffffff', { map: ROSE, roughness: 0.3, emissive: '#553', emissiveIntensity: 0.12 }),
  swirl: mat('#ffffff', { map: SWIRL, roughness: 0.25 }),
  cane: mat('#ffffff', { map: CANE, tile: 0.1, roughness: 0.3 }),
  jar: mat('#dff3ff', { roughness: 0.05, transparent: true, opacity: 0.5, envMapIntensity: 1.4 }),
};
const CANDY = ['#ff5c8a', '#ffd34d', '#4dabf7', '#69db7c', '#b197fc', '#ffa94d'].map(c => mat(c, { roughness: 0.25 }));
const ballMat = (i) => CANDY[i % CANDY.length];

// 圆锥尖顶：瓦片贴图，底边一圈糖霜小圆珠
function cone(k, ctx, x, y, z, r, h, { scallop = true, finial = true } = {}) {
  const slant = Math.hypot(r, h), circ = Math.PI * 2 * r;
  k.geo(new THREE.ConeGeometry(r, h, 36, 1), ctx.roofTile, x, y + h / 2, z, undefined, undefined, [circ, slant, circ]);
  k.cyl(r + 0.015, r + 0.015, 0.03, ctx.accent, x, y - 0.012, z, 36);
  if (scallop) {
    const n = Math.max(8, Math.round(circ / 0.07));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; k.ball(0.022, F.icing, x + Math.cos(a) * (r + 0.012), y - 0.02, z + Math.sin(a) * (r + 0.012)); }
  }
  if (finial) { k.cyl(0.006, 0.006, 0.12, F.gold, x, y + h - 0.01, z, 6); k.ball(0.028, F.gold, x, y + h + 0.12, z); }
  return y + h + 0.14;
}
// 圆塔：塔身 + 檐口线脚 + 箭孔 + 尖顶
function turret(k, ctx, x, z, r, h, wallMat, coneH, { y = 0, slits = true } = {}) {
  k.cyl(r + 0.03, r + 0.04, 0.06, F.stonePink, x, y, z, 28);
  k.cyl(r, r, h, wallMat, x, y + 0.06, z, 32);
  k.cyl(r + 0.05, r + 0.05, 0.05, F.white, x, y + h, z, 32);
  k.torus(r + 0.02, 0.014, F.white, x, y + h - 0.03, z, [Math.PI / 2, 0, 0]);
  if (slits) for (const a of [0.0, 1.57, 3.14, 4.71]) for (let f = 0; f < Math.max(1, Math.floor(h / 0.6)); f++) {
    const yy = y + 0.3 + f * 0.55; if (yy > y + h - 0.2) continue;
    k.box(0.035, 0.12, 0.03, F.dark, x + Math.sin(a) * r, yy, z + Math.cos(a) * r, 0, [0, a, 0]);
  }
  return cone(k, ctx, x, y + h + 0.05, z, r + 0.07, coneH);
}
// 垛口：沿方形楼顶一圈
function crenel(k, w, d, y, m) {
  const mer = (len, fx, fz, ry) => {
    k.push(fx, y, fz, ry);
    const n = Math.max(3, Math.round(len / 0.14)) | 1;
    for (let i = 0; i < n; i += 2) k.box(len / n * 0.95, 0.12, 0.07, m, -len / 2 + (i + 0.5) * (len / n), 0, 0, 0.012);
    k.pop();
  };
  mer(w - 0.02, 0, d / 2 - 0.035, 0); mer(w - 0.02, 0, -d / 2 + 0.035, 0);
  mer(d - 0.02, w / 2 - 0.035, 0, Math.PI / 2); mer(d - 0.02, -w / 2 + 0.035, 0, Math.PI / 2);
  k.box(w + 0.04, 0.04, d + 0.04, F.white, 0, y - 0.04, 0, 0.012);
}
// 拱形窗（天蓝玻璃）
function arch(k, x, y, z, w, h, frame = F.white) {
  k.push(x, y, z, 0);
  const r = w / 2, rh = h - r;
  k.box(w + 0.06, rh, 0.04, frame, 0, 0, 0, 0);
  k.cyl(r + 0.03, r + 0.03, 0.04, frame, 0, rh, 0, 20, [Math.PI / 2, 0, 0]);
  k.box(w, rh, 0.05, F.glass, 0, 0, 0.005, 0);
  k.cyl(r, r, 0.05, F.glass, 0, rh, 0.005, 20, [Math.PI / 2, 0, 0]);
  k.box(0.014, h, 0.06, frame, 0, 0, 0.008, 0);
  k.pop();
}
// 吊旗（地主色）：挂在墙上
function banner(k, ctx, x, y, z, w, h, ry = 0) {
  k.push(x, y, z, ry);
  k.box(w + 0.04, 0.025, 0.03, F.gold, 0, h, 0, 0);
  k.box(w, h, 0.014, ctx.accent, 0, 0, 0.01, 0);
  k.geo(new THREE.ConeGeometry(w * 0.7, w * 0.5, 3), ctx.accent, 0, -0.04, 0.01, [0, 0, Math.PI], [1, 1, 0.1]);
  k.ball(0.024, F.gold, 0, h * 0.5, 0.025);
  k.pop();
}
// 糖霜滴落的屋檐：一排白色小球
function icingRow(k, x, y, z, len, ry = 0, r = 0.022) {
  k.push(x, y, z, ry);
  const n = Math.round(len / (r * 2.6));
  for (let i = 0; i < n; i++) k.ball(r * (0.8 + (i % 3) * 0.16), F.icing, -len / 2 + (i + 0.5) * (len / n), -((i % 3) * 0.012), 0);
  k.pop();
}
function lollipop(k, x, y, z, h, i, ry = 0) {
  k.cyl(0.008, 0.008, h, F.white, x, y, z, 6);
  k.push(x, y + h, z, ry);
  k.cyl(0.06, 0.06, 0.016, F.swirl, 0, 0, 0, 24, [Math.PI / 2, 0, 0]);
  k.pop();
}
function balloons(k, x, y, z, n = 3) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.1, bx = x + Math.cos(a) * 0.08, bz = z + Math.sin(a) * 0.08, by = y + 0.55 + i * 0.07;
    k.ball(0.085, ballMat(i + 1), bx, by, bz, [1, 1.18, 1]);
    k.cone(0.014, 0.025, ballMat(i + 1), bx, by - 0.115, bz, 6, [Math.PI, 0, 0]);
    k.cyl(0.002, 0.002, 0.5, F.white, (x + bx) / 2, y + 0.05, (z + bz) / 2, 3);
  }
}
function stairs(k, x, z, w, steps = 3) { for (let i = 0; i < steps; i++) k.box(w, 0.04 * (steps - i), 0.07, F.stonePink, x, 0, z + i * 0.07, 0.008); }
function flowerBox(k, x, y, z, w) {
  k.box(w, 0.05, 0.06, F.wood, x, y, z, 0);
  const n = Math.round(w / 0.06);
  for (let i = 0; i < n; i++) k.ball(0.028, ballMat(i), x - w / 2 + (i + 0.5) * (w / n), y + 0.07, z);
}

export function buildFairy(k, level, ctx) {
  const roof = ctx.roof, accent = ctx.accent;
  ctx.roofTile = roof; ctx.accent = accent;
  const stripe = (() => {
    const t = canvasTex(128, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : ctx.color; g.fillRect(i * w / 4, 0, w / 4 + 1, h); } });
    return mat('#ffffff', { map: t, tile: 0.2, roughness: 0.55, side: THREE.DoubleSide });
  })();

  // ───────── 0 级：糖果小摊 ─────────
  if (level === 0) {
    k.cyl(0.52, 0.55, 0.04, F.stonePink, 0, 0, 0, 36);
    // 摊位：粉色柜台 + 背板
    k.box(0.8, 0.3, 0.34, F.pink, 0, 0.04, 0.04, 0.025);
    k.box(0.86, 0.04, 0.4, F.white, 0, 0.34, 0.04, 0.012);
    k.box(0.8, 0.62, 0.06, F.lemon, 0, 0.04, -0.2, 0.012);
    for (const sx of [-1, 1]) k.cyl(0.018, 0.018, 0.66, F.cane, sx * 0.4, 0.04, 0.2, 10);
    // 条纹遮阳篷
    k.box(0.9, 0.025, 0.46, stripe, 0, 0.0, 0.0, 0.01, [0.0, 0, 0]);
    k.box(0.9, 0.03, 0.48, stripe, 0, 0.74, 0.03, 0.01, [0.3, 0, 0]);
    icingRow(k, 0, 0.7, 0.275, 0.9, 0, 0.03);
    // 台面上的糖果罐、棒棒糖、棉花糖
    for (let i = 0; i < 4; i++) {
      k.cyl(0.05, 0.05, 0.1, F.jar, -0.3 + i * 0.12, 0.38, 0.1, 16);
      for (let j = 0; j < 5; j++) k.ball(0.02, ballMat(i + j), -0.3 + i * 0.12 + ((j % 2) - 0.5) * 0.04, 0.4 + Math.floor(j / 2) * 0.03, 0.1 + ((j % 3) - 1) * 0.02);
      k.cyl(0.054, 0.054, 0.014, F.gold, -0.3 + i * 0.12, 0.48, 0.1, 16);
    }
    k.cone(0.03, 0.12, F.white, 0.32, 0.38, 0.15, 10);
    k.ball(0.07, mat('#ffb3d1', { roughness: 0.95 }), 0.32, 0.55, 0.15);
    lollipop(k, -0.35, 0.38, -0.12, 0.16, 0);
    lollipop(k, -0.25, 0.38, -0.12, 0.2, 1);
    // 后墙上的招牌（一颗大糖果）
    k.cyl(0.11, 0.11, 0.03, F.swirl, 0, 0.5, -0.17, 28, [Math.PI / 2, 0, 0]);
    // 气球、串旗
    balloons(k, 0.52, 0.0, 0.2, 3);
    for (let i = 0; i < 9; i++) k.geo(new THREE.ConeGeometry(0.03, 0.06, 3), ballMat(i), -0.42 + i * 0.105, 0.76, 0.3 + Math.sin(i / 8 * Math.PI) * -0.02, [Math.PI, 0, 0], [1, 1, 0.2]);
    return 0.82;
  }

  // ───────── 1 级：姜饼屋 ─────────
  if (level === 1) {
    const w = 0.96, d = 0.78, h = 0.5;
    k.box(w + 0.1, 0.05, d + 0.1, F.white, 0, 0, 0, 0.012);
    k.box(w, h, d, F.ginger, 0, 0.05, 0, 0.03);
    // 白色糖霜装饰线
    k.box(w + 0.02, 0.03, d + 0.02, F.icing, 0, 0.05 + h - 0.04, 0, 0.012);
    k.box(w + 0.02, 0.03, d + 0.02, F.icing, 0, 0.05 + 0.02, 0, 0.012);
    gableRoof(k, w, d, 0.52, roof, F.ginger, 0, 0.05 + h, 0, { overhang: 0.12, ridgeMat: F.icing });
    // 屋顶糖霜滴落 + 软糖
    for (const sx of [-1, 1]) icingRow(k, sx * (w / 2 + 0.1), 0.05 + h + 0.0, 0.0, d + 0.24, Math.PI / 2, 0.026);
    let r = prng(3);
    for (let i = 0; i < 18; i++) { const sx = r() > 0.5 ? 1 : -1, t = 0.15 + r() * 0.7; k.ball(0.028, ballMat(i), sx * (w / 2 * (1 - t) + 0.02), 0.05 + h + 0.52 * t + 0.045, (r() - 0.5) * d * 0.9); }
    // 棉花糖烟囱
    k.cyl(0.055, 0.055, 0.28, F.white, 0.26, 0.05 + h + 0.2, -0.15, 16);
    k.cyl(0.062, 0.062, 0.03, ctx.accent, 0.26, 0.05 + h + 0.47, -0.15, 16);
    // 前面：巧克力门 + 糖果拐杖柱 + 圆窗
    door(k, 0, 0.05, d / 2 + 0.02, 0.2, 0.32, F.choco, { frame: F.icing, knob: F.gold });
    for (const sx of [-1, 1]) { k.cyl(0.022, 0.022, 0.5, F.cane, sx * 0.19, 0.05, d / 2 + 0.07, 10); k.torus(0.04, 0.02, F.cane, sx * 0.19 + sx * -0.0, 0.57, d / 2 + 0.07, [0, 0, 0], Math.PI); }
    for (const sx of [-1, 1]) {
      k.cyl(0.075, 0.075, 0.03, F.icing, sx * 0.34, 0.25, d / 2 + 0.015, 20, [Math.PI / 2, 0, 0]);
      k.cyl(0.058, 0.058, 0.04, F.glass, sx * 0.34, 0.25, d / 2 + 0.02, 20, [Math.PI / 2, 0, 0]);
    }
    k.cyl(0.07, 0.07, 0.03, F.rose, 0, 0.05 + h + 0.18, d / 2 + 0.0, 24, [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) for (const z of [-0.18, 0.18]) {
      k.push(sx * (w / 2 + 0.008), 0, z, sx * Math.PI / 2);
      k.cyl(0.07, 0.07, 0.03, F.icing, 0, 0.3, 0, 20, [Math.PI / 2, 0, 0]);
      k.cyl(0.054, 0.054, 0.04, F.glass, 0, 0.3, 0.005, 20, [Math.PI / 2, 0, 0]);
      k.pop();
    }
    k.push(0, 0, -d / 2 - 0.008, Math.PI); for (const x of [-0.26, 0.26]) { k.cyl(0.075, 0.075, 0.03, F.icing, x, 0.28, 0, 20, [Math.PI / 2, 0, 0]); k.cyl(0.058, 0.058, 0.04, F.glass, x, 0.28, 0.005, 20, [Math.PI / 2, 0, 0]); } k.cyl(0.07, 0.07, 0.03, F.rose, 0, 0.05 + h + 0.18, 0, 24, [Math.PI / 2, 0, 0]); k.pop();
    // 糖果篱笆 + 棒棒糖
    for (let i = -5; i <= 5; i++) { k.cyl(0.012, 0.012, 0.16, i % 2 ? F.cane : F.white, i * 0.135, 0, 0.6, 6); k.ball(0.022, ballMat(i + 5), i * 0.135, 0.17, 0.6); }
    lollipop(k, 0.55, 0.0, 0.42, 0.34, 0, 0.3); lollipop(k, -0.55, 0.0, 0.46, 0.28, 1, -0.3);
    for (const sx of [-1, 1]) k.ball(0.05, ballMat(sx + 3), sx * 0.62, 0.07, 0.3);
    return 1.3;
  }

  // ───────── 2 级：塔屋 ─────────
  if (level === 2) {
    const w = 0.98, d = 0.82, h = 0.78;
    k.box(w + 0.1, 0.06, d + 0.1, F.stonePink, -0.15, 0, 0, 0.012);
    k.box(w, h, d, F.lemon, -0.15, 0.06, 0, 0.03);
    k.box(w + 0.04, 0.035, d + 0.04, F.white, -0.15, 0.06 + 0.34, 0, 0.01);
    gableRoof(k, w, d, 0.46, roof, F.lemon, -0.15, 0.06 + h, 0, { overhang: 0.1, ridgeMat: F.icing });
    icingRow(k, -0.15 - w / 2 - 0.1, 0.06 + h, 0.0, d + 0.2, Math.PI / 2, 0.025);
    icingRow(k, -0.15 + w / 2 + 0.1, 0.06 + h, 0.0, d + 0.2, Math.PI / 2, 0.025);
    door(k, -0.15, 0.06, d / 2 + 0.02, 0.22, 0.38, F.woodD, { frame: F.white, knob: F.gold });
    k.box(0.5, 0.04, 0.2, ctx.accent, -0.15, 0.5, d / 2 + 0.11, 0.01);
    for (const sx of [-1, 1]) arch(k, -0.15 + sx * 0.33, 0.2, d / 2 + 0.015, 0.16, 0.28);
    for (const sx of [-1, 0, 1]) { arch(k, -0.15 + sx * 0.3, 0.52, d / 2 + 0.015, 0.14, 0.2); }
    flowerBox(k, -0.48, 0.17, d / 2 + 0.05, 0.2);
    flowerBox(k, 0.18, 0.17, d / 2 + 0.05, 0.2);
    k.cyl(0.06, 0.06, 0.03, F.rose, -0.15, 0.06 + h + 0.2, d / 2 + 0.0, 20, [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) for (const z of [-0.2, 0.2]) {
      k.push(-0.15 + sx * (w / 2 + 0.008), 0, z, sx * Math.PI / 2);
      arch(k, 0, 0.2, 0, 0.14, 0.26); arch(k, 0, 0.55, 0, 0.12, 0.2);
      k.pop();
    }
    k.push(-0.15, 0, -d / 2 - 0.008, Math.PI); for (const x of [-0.3, 0, 0.3]) { arch(k, x, 0.2, 0, 0.14, 0.26); arch(k, x, 0.52, 0, 0.14, 0.2); } k.pop();
    // 圆塔
    const tx = 0.48, tz = 0.12;
    const top = turret(k, ctx, tx, tz, 0.22, 1.1, F.pink, 0.62, { y: 0.0, slits: false });
    arch(k, tx, 0.4, tz + 0.215, 0.12, 0.2);
    k.cyl(0.05, 0.05, 0.03, F.rose, tx, 0.82, tz + 0.215, 20, [Math.PI / 2, 0, 0]);
    banner(k, ctx, tx, 0.62, tz + 0.23, 0.12, 0.2);
    lollipop(k, 0.7, 0, 0.5, 0.3, 2, 0.2); lollipop(k, -0.65, 0, 0.5, 0.26, 3, -0.2);
    k.cyl(0.4, 0.45, 0.03, F.leaf, 0, 0, 0, 3);
    return top;
  }

  // ───────── 3~5 级：城堡 ─────────
  const wallMats = [F.stonePink, F.stoneYel, F.stoneMint, F.stoneSky];
  const keepH = level === 3 ? 1.1 : level === 4 ? 1.5 : 2.0;
  const kw = level === 3 ? 0.94 : 1.02;
  const km = wallMats[level % 4], tm = wallMats[(level + 1) % 4], cm = wallMats[(level + 2) % 4];
  k.box(kw + 0.3, 0.1, kw + 0.3, F.stonePink, 0, 0, 0, 0.025);
  k.box(kw, keepH, kw, km, 0, 0.1, 0, 0.02);
  // 层间线脚 + 垛口
  for (let i = 1; i < Math.round(keepH / 0.55); i++) k.box(kw + 0.03, 0.035, kw + 0.03, F.white, 0, 0.1 + i * 0.55, 0, 0.008);
  crenel(k, kw, kw, 0.1 + keepH, km);
  // 城门：拱门 + 木门 + 铁栅栏 + 吊桥
  const gz = kw / 2;
  k.box(0.34, 0.4, 0.03, F.dark, 0, 0.1, gz + 0.012, 0);
  k.cyl(0.17, 0.17, 0.03, F.dark, 0, 0.5, gz + 0.012, 24, [Math.PI / 2, 0, 0]);
  k.box(0.3, 0.38, 0.03, F.woodD, 0, 0.1, gz + 0.024, 0);
  k.cyl(0.15, 0.15, 0.03, F.woodD, 0, 0.48, gz + 0.024, 24, [Math.PI / 2, 0, 0]);
  for (const yy of [0.2, 0.38]) k.box(0.31, 0.018, 0.04, F.iron, 0, yy, gz + 0.03, 0);
  for (let i = -3; i <= 3; i++) k.ball(0.011, F.iron, i * 0.04, 0.29, gz + 0.05);
  k.torus(0.17, 0.016, F.white, 0, 0.5, gz + 0.03, [0, 0, 0], Math.PI);
  k.box(0.3, 0.028, 0.34, F.wood, 0, 0.07, gz + 0.2, 0.008, [0.12, 0, 0]);
  for (const sx of [-1, 1]) { k.box(0.012, 0.012, 0.36, F.iron, sx * 0.14, 0.17, gz + 0.19, 0, [-0.4, 0, 0]); }
  // 箭孔、玫瑰窗、旗
  // 窗只开在城门两侧、角楼之间的墙面上（x=±0.2），并且窗顶不能超过墙顶的垛口
  const wallTop = 0.1 + keepH - 0.14;
  for (let f = 0; f < 3; f++) { const wy = 0.74 + f * 0.5; if (wy + 0.22 > wallTop) continue; for (const sx of [-1, 1]) arch(k, sx * 0.2, wy, gz + 0.015, 0.08, 0.22, F.white); }
  k.cyl(0.11, 0.11, 0.035, F.rose, 0, 0.1 + keepH * 0.62, gz + 0.012, 28, [Math.PI / 2, 0, 0]);
  banner(k, ctx, 0, 0.1 + keepH * 0.62 - 0.35, gz + 0.03, 0.14, 0.26);
  for (const [px, pz, ry] of [[kw / 2 + 0.012, 0, Math.PI / 2], [-kw / 2 - 0.012, 0, -Math.PI / 2], [0, -kw / 2 - 0.012, Math.PI]]) {
    k.push(px, 0, pz, ry);
    for (let f = 0; f < 3; f++) { const wy = 0.35 + f * 0.5; if (wy + 0.22 > wallTop) continue; arch(k, 0, wy, 0, 0.1, 0.22, F.white); }
    k.pop();
  }
  // 角楼
  const corners = level === 3 ? [[-1, 1], [1, 1]] : [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  const th = keepH + (level === 3 ? 0.3 : 0.4);
  const tr = level === 3 ? 0.19 : 0.2;
  let top = 0;
  corners.forEach(([sx, sz], i) => { top = Math.max(top, turret(k, ctx, sx * kw / 2, sz * kw / 2, tr, th, tm, 0.58 + (level - 3) * 0.08, { y: 0.1 })); });
  if (level === 3) return top + 0.2;

  // 中央高塔
  const mid = level === 4 ? 0.9 : 1.7;
  const ctop = turret(k, ctx, 0, 0, 0.3, mid, cm, level === 4 ? 0.8 : 1.15, { y: 0.1 + keepH });
  k.cyl(0.07, 0.07, 0.03, F.rose, 0, 0.1 + keepH + mid * 0.55, 0.3, 20, [Math.PI / 2, 0, 0]);
  banner(k, ctx, 0.32, 0.1 + keepH + mid * 0.4, 0.0, 0.12, 0.22, Math.PI / 2);
  // 高塔上多加一圈阳台
  if (level === 5) {
    k.cyl(0.4, 0.4, 0.04, F.white, 0, 0.1 + keepH + 0.65, 0, 32);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; k.cyl(0.01, 0.01, 0.1, F.white, Math.cos(a) * 0.38, 0.1 + keepH + 0.69, Math.sin(a) * 0.38, 5); }
    k.torus(0.38, 0.012, F.white, 0, 0.1 + keepH + 0.79, 0, [Math.PI / 2, 0, 0]);
    // 屋顶连廊：两座角楼之间的小拱桥
    for (const sz of [-1, 1]) { k.box(0.0 + kw, 0.04, 0.05, F.white, 0, 0.1 + keepH + 0.1, sz * kw / 2, 0); }
    ctx.blink(0, ctop + 0.2, 0);
  }
  return ctop + 0.25;
}
