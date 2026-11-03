// 金融区：从小木屋一路盖到玻璃摩天楼（0~5 级）。局部坐标 +z 是正面，占地不超过 1.5 × 1.5。
import * as THREE from 'three';
import { mat, TEX, PARTS } from './modeling.js';

const { windowUnit, door, railing, gableRoof, chimney, awning } = PARTS;

const W = {
  planks: mat('#ffffff', { map: TEX.planks, tile: 0.5, roughness: 0.8 }),
  plaster: mat('#fff1d6', { map: TEX.plaster, tile: 1, roughness: 0.85 }),
  plasterW: mat('#fbfaf5', { map: TEX.plaster, tile: 1, roughness: 0.85 }),
  plasterB: mat('#cfe3f2', { map: TEX.plaster, tile: 1, roughness: 0.85 }),
  concrete: mat('#e7e4de', { map: TEX.plaster, tile: 0.8, roughness: 0.9 }),
  brick: mat('#ffffff', { map: TEX.brick, tile: 0.55, roughness: 0.85 }),
  stone: mat('#ffffff', { map: TEX.stone, tile: 0.8, roughness: 0.8 }),
  base: mat('#b9b2a4', { map: TEX.stone, tile: 0.8, roughness: 0.9 }),
  door: mat('#7a4522', { roughness: 0.6 }),
  doorDark: mat('#2e3742', { roughness: 0.4, metalness: 0.2 }),
  trim: mat('#fbfaf6', { roughness: 0.5 }),
  dark: mat('#38414d', { roughness: 0.6 }),
  metal: mat('#cdd5dc', { metalness: 0.7, roughness: 0.3 }),
  steel: mat('#8d98a5', { metalness: 0.7, roughness: 0.35 }),
  wood: mat('#9a6a3c', { roughness: 0.7 }),
  green: mat('#5bb35a', { roughness: 0.9 }),
  leaf: mat('#3f9e4a', { roughness: 0.9 }),
  flowerR: mat('#ff5a7a', { roughness: 0.6 }),
  flowerY: mat('#ffd23f', { roughness: 0.6 }),
  gold: mat('#f0bd2e', { metalness: 0.5, roughness: 0.32, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  tank: mat('#d7dde3', { metalness: 0.4, roughness: 0.45 }),
  lamp: mat('#fff1b8', { emissive: '#ffd66b', emissiveIntensity: 0.9, roughness: 0.4 }),
};

// 一排小花（窗台花箱）
function flowerBox(k, x, y, z, w) {
  k.box(w, 0.06, 0.07, W.wood, x, y, z, 0);
  const n = Math.round(w / 0.07);
  for (let i = 0; i < n; i++) {
    const fx = x - w / 2 + (i + 0.5) * (w / n);
    k.ball(0.032, i % 2 ? W.flowerR : W.flowerY, fx, y + 0.08, z, [1, 1, 1]);
    k.ball(0.026, W.leaf, fx + 0.025, y + 0.065, z + 0.01);
  }
}
// 一圈白色尖桩篱笆（前面和两侧），z0 是前篱笆的位置
function picketFence(k, w, d, z0) {
  const pk = (x, z, ry) => { k.push(x, 0, z, ry); const n = Math.round(w / 0.075); for (let i = 0; i <= n; i++) { k.box(0.03, 0.15, 0.015, W.trim, -w / 2 + (w * i) / n, 0, 0, 0); k.cone(0.021, 0.04, W.trim, -w / 2 + (w * i) / n, 0.15, 0, 4); } k.box(w, 0.025, 0.02, W.trim, 0, 0.055, -0.012, 0); k.box(w, 0.025, 0.02, W.trim, 0, 0.1, -0.012, 0); k.pop(); };
  pk(0, z0, 0);
}
// 一棵小圆树
function smallTree(k, x, z, s = 1) {
  k.cyl(0.028 * s, 0.04 * s, 0.22 * s, W.wood, x, 0, z, 10);
  k.ball(0.16 * s, W.leaf, x, 0.34 * s, z, [1, 1.05, 1]);
  k.ball(0.11 * s, W.green, x + 0.07 * s, 0.4 * s, z + 0.04 * s);
}
// 屋顶设备：空调外机
function acUnit(k, x, y, z, ry = 0) {
  k.push(x, y, z, ry);
  k.box(0.14, 0.09, 0.09, W.tank, 0, 0, 0, 0);
  k.cyl(0.032, 0.032, 0.012, W.dark, 0, 0.09, 0, 14);
  k.pop();
}

export function buildModern(k, level, ctx) {
  const roof = ctx.roof, accent = ctx.accent;
  const wall = (m, w, h, d, y = 0) => k.box(w, h, d, m, 0, y, 0, 0.025);

  // ───────── 0 级：小木屋 ─────────
  if (level === 0) {
    const w = 0.86, d = 0.74, h = 0.44;
    k.box(w + 0.08, 0.07, d + 0.08, W.base, 0, 0, 0, 0.015);              // 石基
    wall(W.planks, w, h, d, 0.07);
    // 墙角木柱
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, h, 0.05, W.wood, sx * (w / 2 - 0.01), 0.07, sz * (d / 2 - 0.01), 0);
    gableRoof(k, w, d, 0.36, roof, W.planks, 0, 0.07 + h, 0, { overhang: 0.1 });
    chimney(k, 0.24, 0.07 + h + 0.16, -0.12, 0.1, 0.3, W.brick, W.stone);
    // 前门、窗
    door(k, 0, 0.07, d / 2 + 0.02, 0.17, 0.3, W.door, { frame: W.trim });
    windowUnit(k, -0.28, 0.21, d / 2 + 0.01, 0.12, 0.13, { shutter: true, shutterMat: W.wood, bars: 1 });
    windowUnit(k, 0.28, 0.21, d / 2 + 0.01, 0.12, 0.13, { shutter: true, shutterMat: W.wood, bars: 1 });
    // 侧窗
    for (const sx of [-1, 1]) { k.push(sx * (w / 2 + 0.01), 0, 0, sx * Math.PI / 2); windowUnit(k, 0, 0.21, 0, 0.14, 0.13); k.pop(); }
    // 门口台阶和小灯
    k.box(0.34, 0.035, 0.16, W.stone, 0, 0, d / 2 + 0.09, 0.01);
    k.ball(0.022, W.lamp, 0.16, 0.34, d / 2 + 0.05);
    k.push(0, 0, -d / 2 - 0.01, Math.PI); windowUnit(k, -0.2, 0.21, 0, 0.13, 0.13, { shutter: true, shutterMat: W.wood }); windowUnit(k, 0.2, 0.21, 0, 0.13, 0.13, { shutter: true, shutterMat: W.wood }); k.pop();
    smallTree(k, -0.58, 0.45, 0.85);
    return 0.95;
  }

  // ───────── 1 级：带烟囱和门廊的小平房 ─────────
  if (level === 1) {
    const w = 1.12, d = 0.88, h = 0.6;
    k.box(w + 0.07, 0.08, d + 0.07, W.base, 0, 0, 0, 0.015);
    wall(W.plaster, w, h, d, 0.08);
    k.box(w + 0.04, 0.035, d + 0.04, W.trim, 0, 0.08 + h - 0.03, 0, 0.008);   // 檐口线脚
    gableRoof(k, w, d, 0.46, roof, W.plaster, 0, 0.08 + h, 0, { overhang: 0.11 });
    chimney(k, -0.36, 0.08 + h + 0.2, -0.15, 0.13, 0.42, W.brick, W.stone);
    // 门廊：两根柱子 + 小雨篷
    const dz = d / 2;
    door(k, 0, 0.08, dz + 0.02, 0.2, 0.36, W.door, { frame: W.trim });
    for (const sx of [-1, 1]) k.cyl(0.022, 0.026, 0.4, W.trim, sx * 0.2, 0.08, dz + 0.17, 12);
    k.box(0.52, 0.04, 0.26, accent, 0, 0.48, dz + 0.1, 0.01);
    k.box(0.5, 0.03, 0.24, W.stone, 0, 0.08 - 0.0, dz + 0.1, 0.008);
    windowUnit(k, -0.38, 0.28, dz + 0.01, 0.17, 0.2, { shutter: true, shutterMat: accent, bars: 1 });
    windowUnit(k, 0.38, 0.28, dz + 0.01, 0.17, 0.2, { shutter: true, shutterMat: accent, bars: 1 });
    flowerBox(k, -0.38, 0.13, dz + 0.06, 0.2);
    flowerBox(k, 0.38, 0.13, dz + 0.06, 0.2);
    for (const sx of [-1, 1]) for (const z of [-0.22, 0.22]) { k.push(sx * (w / 2 + 0.01), 0, z, sx * Math.PI / 2); windowUnit(k, 0, 0.28, 0, 0.16, 0.2); k.pop(); }
    k.push(0, 0, -d / 2 - 0.01, Math.PI); for (const x of [-0.3, 0.3]) windowUnit(k, x, 0.28, 0, 0.17, 0.2, { shutter: true, shutterMat: accent, bars: 1 }); door(k, 0, 0.08, 0, 0.18, 0.34, W.door, { frame: W.trim }); k.pop();
    picketFence(k, 1.34, d, dz + 0.4);
    smallTree(k, 0.6, 0.0 + dz + 0.28, 0.9);
    return 1.15;
  }

  // ───────── 2 级：两层别墅，有阳台和门廊 ─────────
  if (level === 2) {
    const w = 1.18, d = 1.0, h1 = 0.62, h2 = 0.58;
    k.box(w + 0.08, 0.09, d + 0.08, W.base, 0, 0, 0, 0.015);
    wall(W.plasterW, w, h1 + h2, d, 0.09);
    // 一层和二层之间的腰线、檐口线
    k.box(w + 0.05, 0.04, d + 0.05, W.trim, 0, 0.09 + h1 - 0.02, 0, 0.008);
    k.box(w + 0.05, 0.04, d + 0.05, W.trim, 0, 0.09 + h1 + h2 - 0.03, 0, 0.008);
    // 墙角石砌
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, h1, 0.07, W.stone, sx * (w / 2 - 0.01), 0.09, sz * (d / 2 - 0.01), 0);
    gableRoof(k, w, d, 0.54, roof, W.plasterW, 0, 0.09 + h1 + h2, 0, { overhang: 0.12 });
    chimney(k, 0.4, 0.09 + h1 + h2 + 0.22, -0.2, 0.14, 0.5, W.brick, W.stone);
    const dz = d / 2;
    door(k, 0, 0.09, dz + 0.02, 0.22, 0.4, W.door, { frame: W.trim });
    awning(k, 0, 0.58, dz + 0.01, 0.5, 0.2, accent);
    for (const sx of [-1, 1]) windowUnit(k, sx * 0.4, 0.27, dz + 0.01, 0.2, 0.28, { shutter: true, shutterMat: accent, bars: 2 });
    // 二层：中间是阳台门，两侧是窗
    const y2 = 0.09 + h1 + 0.1;
    for (const sx of [-1, 1]) windowUnit(k, sx * 0.42, y2, dz + 0.01, 0.19, 0.26, { shutter: true, shutterMat: accent, bars: 1 });
    door(k, 0, y2 - 0.07, dz + 0.02, 0.2, 0.36, W.trim, { frame: W.trim, panels: false, knob: W.metal });
    k.box(0.14, 0.3, 0.012, PARTS.glassMat, 0, y2 - 0.04, dz + 0.052, 0);
    // 阳台
    k.box(0.5, 0.04, 0.2, W.stone, 0, y2 - 0.1, dz + 0.1, 0.01);
    railing(k, 0, y2 - 0.06, dz + 0.2, 0.5, 0, W.trim, 0.16);
    for (const sx of [-1, 1]) railing(k, sx * 0.25, y2 - 0.06, dz + 0.1, 0.2, Math.PI / 2, W.trim, 0.16);
    flowerBox(k, 0.42, y2 - 0.07, dz + 0.06, 0.2);
    flowerBox(k, -0.42, y2 - 0.07, dz + 0.06, 0.2);
    // 侧面窗
    for (const sx of [-1, 1]) for (const z of [-0.25, 0.25]) {
      k.push(sx * (w / 2 + 0.01), 0, z, sx * Math.PI / 2);
      windowUnit(k, 0, 0.27, 0, 0.17, 0.26); windowUnit(k, 0, y2, 0, 0.17, 0.26);
      k.pop();
    }
    k.push(0, 0, -d / 2 - 0.01, Math.PI);
    for (const x of [-0.4, 0, 0.4]) { windowUnit(k, x, 0.27, 0, 0.17, 0.26); windowUnit(k, x, y2, 0, 0.17, 0.26); }
    k.cyl(0.07, 0.07, 0.02, W.trim, 0, 0.09 + h1 + h2 + 0.14, 0, 20, [Math.PI / 2, 0, 0]);
    k.cyl(0.05, 0.05, 0.022, PARTS.glassMat, 0, 0.09 + h1 + h2 + 0.14, 0.004, 20, [Math.PI / 2, 0, 0]);
    k.pop();
    // 山墙上的圆窗
    k.cyl(0.07, 0.07, 0.02, W.trim, 0, 0.09 + h1 + h2 + 0.14, dz + 0.0, 20, [Math.PI / 2, 0, 0]);
    k.cyl(0.05, 0.05, 0.022, PARTS.glassMat, 0, 0.09 + h1 + h2 + 0.14, dz + 0.004, 20, [Math.PI / 2, 0, 0]);
    picketFence(k, 1.4, d, dz + 0.36);
    smallTree(k, -0.62, dz + 0.22, 1.05);
    smallTree(k, 0.6, dz + 0.24, 0.9);
    return 1.95;
  }

  // ───────── 3 级：公寓楼，每层都有阳台，屋顶有水箱 ─────────
  if (level === 3) {
    const w = 1.22, d = 1.1, floors = 6, fh = 0.34, gh = 0.4, H = gh + floors * fh;
    k.box(w + 0.08, 0.06, d + 0.08, W.base, 0, 0, 0, 0.012);
    wall(W.concrete, w, H, d, 0.06);
    const y0 = 0.06;
    // 一层的玻璃门厅 + 雨篷
    door(k, 0, y0, d / 2 + 0.015, 0.3, 0.32, W.doorDark, { frame: W.metal, panels: false, knob: W.metal });
    k.box(0.3, 0.26, 0.012, PARTS.glassMat, 0, y0 + 0.03, d / 2 + 0.05, 0);
    k.box(0.64, 0.045, 0.28, accent, 0, y0 + 0.4, d / 2 + 0.14, 0.012);
    for (const sx of [-1, 1]) windowUnit(k, sx * 0.4, y0 + 0.1, d / 2 + 0.01, 0.2, 0.22, { bars: 2, frame: W.metal, sillMat: W.concrete });
    // 楼层窗 + 前面每层一个小阳台
    for (let f = 0; f < floors; f++) {
      const y = y0 + gh + f * fh;
      for (let c = 0; c < 4; c++) {
        const x = -0.45 + c * 0.3;
        if (c === 1 || c === 2) {
          // 中间两列：阳台门 + 阳台
          windowUnit(k, x, y + 0.04, d / 2 + 0.01, 0.13, 0.22, { bars: 1, rows: 0, sill: false });
          k.box(0.25, 0.03, 0.11, W.concrete, x, y - 0.015, d / 2 + 0.05, 0.008);
          railing(k, x, y + 0.01, d / 2 + 0.1, 0.25, 0, W.metal, 0.12);
        } else windowUnit(k, x, y + 0.07, d / 2 + 0.01, 0.15, 0.17, { bars: 1, frame: W.metal, sillMat: W.concrete });
      }
      // 楼层线脚
      k.box(w + 0.03, 0.022, d + 0.03, W.trim, 0, y0 + gh + f * fh - 0.01, 0, 0.005);
      // 后墙和侧墙窗
      for (const [px, pz, ry] of [[0, -d / 2 - 0.01, Math.PI], [w / 2 + 0.01, 0, Math.PI / 2], [-w / 2 - 0.01, 0, -Math.PI / 2]]) {
        k.push(px, 0, pz, ry);
        const cols = ry === Math.PI ? 4 : 3, gap = ry === Math.PI ? 0.3 : 0.32;
        for (let c = 0; c < cols; c++) windowUnit(k, (c - (cols - 1) / 2) * gap, y + 0.07, 0, 0.14, 0.17, { bars: 1, frame: W.metal, sillMat: W.concrete });
        k.pop();
      }
    }
    // 屋顶：矮墙、水箱、空调、楼梯间、天线
    const ty = y0 + H;
    k.box(w + 0.1, 0.07, d + 0.1, accent, 0, ty - 0.005, 0, 0.012);
    k.box(w + 0.02, 0.1, 0.03, W.trim, 0, ty + 0.065, d / 2 - 0.02, 0.005); k.box(w + 0.02, 0.1, 0.03, W.trim, 0, ty + 0.065, -d / 2 + 0.02, 0.005);
    k.box(0.03, 0.1, d - 0.02, W.trim, w / 2 - 0.02, ty + 0.065, 0, 0.005); k.box(0.03, 0.1, d - 0.02, W.trim, -w / 2 + 0.02, ty + 0.065, 0, 0.005);
    k.box(0.3, 0.16, 0.26, W.concrete, -0.32, ty + 0.065, -0.2, 0.012);
    k.box(0.12, 0.2, 0.01, W.doorDark, -0.32, ty + 0.065, -0.065, 0);
    for (const [dx, dz] of [[0.1, -0.15], [0.25, 0.0]]) { k.cyl(0.012, 0.012, 0.1, W.steel, dx, ty + 0.065, dz, 6); }
    k.cyl(0.13, 0.13, 0.2, W.tank, 0.3, ty + 0.2, -0.22, 20);
    k.cone(0.14, 0.08, W.steel, 0.3, ty + 0.4, -0.22, 20);
    for (const [dx, dz] of [[-0.05, 0.25], [0.12, 0.28], [0.3, 0.26]]) acUnit(k, dx, ty + 0.065, dz);
    k.cyl(0.008, 0.008, 0.35, W.steel, 0.05, ty + 0.065, -0.3, 6);
    return ty + 0.4;
  }

  // ───────── 4 级：写字楼，玻璃幕墙 ─────────
  const glassT = PARTS.curtainGlass;
  const finMat = W.metal;
  if (level === 4) {
    const pw = 1.46, pd = 1.36, ph = 0.56;
    k.box(pw, ph, pd, W.stone, 0, 0, 0, 0.03);
    // 裙楼：一圈深色玻璃带
    for (const [px, pz, ry, ww] of [[0, pd / 2 + 0.005, 0, pw], [0, -pd / 2 - 0.005, Math.PI, pw], [pw / 2 + 0.005, 0, Math.PI / 2, pd], [-pw / 2 - 0.005, 0, -Math.PI / 2, pd]]) {
      k.push(px, 0, pz, ry);
      k.box(ww - 0.2, 0.26, 0.02, glassT, 0, 0.2, 0, 0);
      k.pop();
    }
    k.box(pw + 0.06, 0.05, pd + 0.06, accent, 0, ph - 0.02, 0, 0.012);
    // 入口：玻璃门 + 雨篷 + 台阶
    k.box(0.5, 0.04, 0.3, W.base, 0, 0, pd / 2 + 0.12, 0.01);
    k.box(0.44, 0.34, 0.02, W.doorDark, 0, 0.04, pd / 2 + 0.01, 0);
    k.box(0.38, 0.28, 0.012, PARTS.glassMat, 0, 0.07, pd / 2 + 0.025, 0);
    k.box(0.7, 0.05, 0.34, accent, 0, 0.44, pd / 2 + 0.17, 0.012);
    for (const sx of [-1, 1]) k.cyl(0.018, 0.018, 0.4, W.metal, sx * 0.3, 0.04, pd / 2 + 0.3, 10);
    // 塔楼
    const tw = 1.15, td = 1.1, ty = ph, th = 2.9;
    k.box(tw, th, td, glassT, 0, ty, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, th, 0.06, finMat, sx * tw / 2, ty, sz * td / 2, 0.008);
    // 立面竖向遮阳翅片
    for (let i = -2; i <= 2; i++) { k.box(0.018, th - 0.1, 0.05, finMat, i * 0.21, ty + 0.05, td / 2 + 0.01, 0); k.box(0.018, th - 0.1, 0.05, finMat, i * 0.21, ty + 0.05, -td / 2 - 0.01, 0); }
    // 顶部：皇冠、设备层、天线
    k.box(tw + 0.12, 0.1, td + 0.12, accent, 0, ty + th, 0, 0.018);
    k.box(0.7, 0.26, 0.6, W.steel, 0, ty + th + 0.1, 0, 0.02);
    k.cyl(0.14, 0.14, 0.02, W.dark, 0.0, ty + th + 0.36, 0, 24);
    k.cyl(0.012, 0.012, 0.85, W.metal, 0.22, ty + th + 0.1, 0.18, 8);
    k.ball(0.03, W.lamp, 0.22, ty + th + 0.96, 0.18);
    return ty + th + 0.95;
  }

  // ───────── 5 级：摩天楼，三段收分 + 尖顶 ─────────
  {
    const pw = 1.5, pd = 1.45, ph = 0.84;
    k.box(pw, ph, pd, W.stone, 0, 0, 0, 0.03);
    k.box(pw + 0.08, 0.06, pd + 0.08, accent, 0, ph - 0.03, 0, 0.012);
    // 门廊：一排柱子
    k.box(0.9, 0.05, 0.36, W.base, 0, 0, pd / 2 + 0.14, 0.012);
    k.box(0.9, 0.05, 0.38, accent, 0, 0.6, pd / 2 + 0.14, 0.012);
    for (let i = 0; i < 4; i++) k.cyl(0.032, 0.036, 0.55, W.trim, -0.36 + i * 0.24, 0.05, pd / 2 + 0.28, 16);
    k.box(0.5, 0.42, 0.02, W.doorDark, 0, 0.05, pd / 2 + 0.01, 0);
    k.box(0.44, 0.36, 0.012, PARTS.glassMat, 0, 0.08, pd / 2 + 0.025, 0);
    // 裙楼侧面窗
    for (const [px, pz, ry, ww] of [[pw / 2 + 0.005, 0, Math.PI / 2, pd], [-pw / 2 - 0.005, 0, -Math.PI / 2, pd], [0, -pd / 2 - 0.005, Math.PI, pw]]) {
      k.push(px, 0, pz, ry);
      for (let i = -2; i <= 2; i++) windowUnit(k, i * 0.26, 0.28, 0, 0.14, 0.32, { bars: 1, frame: W.metal, sillMat: W.base });
      k.pop();
    }
    const t1w = 1.17, t1d = 1.12, y1 = ph, h1 = 2.6;
    k.box(t1w, h1, t1d, glassT, 0, y1, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, h1, 0.07, W.metal, sx * t1w / 2, y1, sz * t1d / 2, 0.01);
    k.box(t1w + 0.12, 0.12, t1d + 0.12, accent, 0, y1 + h1, 0, 0.02);
    const t2w = 0.86, t2d = 0.82, y2 = y1 + h1 + 0.12, h2 = 1.7;
    k.box(t2w, h2, t2d, glassT, 0, y2, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, h2, 0.05, W.metal, sx * t2w / 2, y2, sz * t2d / 2, 0.008);
    for (let i = -1; i <= 1; i++) { k.box(0.02, h2, 0.04, W.metal, i * 0.22, y2, t2d / 2 + 0.01, 0); }
    k.box(t2w + 0.1, 0.1, t2d + 0.1, accent, 0, y2 + h2, 0, 0.018);
    // 尖顶：四棱锥 + 金色圈 + 天线 + 闪烁灯
    const y3 = y2 + h2 + 0.1;
    k.geo(new THREE.ConeGeometry(0.58, 0.9, 4), accent, 0, y3 + 0.45, 0, [0, Math.PI / 4, 0], undefined, [0.82, 0.9, 0.82]);
    k.cyl(0.05, 0.05, 0.03, W.gold, 0, y3 + 0.88, 0, 12);
    k.cyl(0.01, 0.03, 1.0, W.metal, 0, y3 + 0.9, 0, 8);
    const top = y3 + 1.95;
    ctx.blink(0, top, 0);
    return top + 0.05;
  }
}
