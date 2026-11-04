// 外围的田园和海景：西北的稻田（田埂、倒映天空的水面、一丛丛秧苗、稻草人）、小山上的凉亭（石阶、灯笼）、
// 东边海上的风车（渐细的塔筒、流线机舱、扭转的叶片，会转）。
import * as THREE from 'three';
import { mkit, mat, TEX } from './modeling.js';
import { makeTree, makeRock, makeHill, makeBush } from './nature.js';
import { buildChinese, lantern as cnLantern } from './bld-chinese.js';

const M = {
  bund: mat('#a07a4d', { roughness: 1 }),
  bundTop: mat('#8f8a3c', { roughness: 1 }),
  path: mat('#d9c7a0', { roughness: 1 }),
  stone: mat('#d3cdbf', { map: TEX.stone, tile: 0.7, roughness: 0.85 }),
  wood: mat('#8a5a2b', { roughness: 0.8 }),
  straw: mat('#e2c35a', { roughness: 1 }),
  shirt: mat('#c0392b', { roughness: 0.9 }),
  skin: mat('#f1d9a7', { roughness: 0.8 }),
  white: mat('#f7f8fa', { roughness: 0.35 }),
  yellow: mat('#ffd43b', { roughness: 0.5 }),
  grey: mat('#aeb4bb', { metalness: 0.5, roughness: 0.4 }),
  dark: mat('#2b3442', { roughness: 0.5 }),
  concrete: mat('#bfbab0', { roughness: 0.9 }),
};
const WATER = ['#9fd8c8', '#a9dcb4', '#b9e0a0', '#cfe39a'].map(c => mat(c, { roughness: 0.08, metalness: 0.1, envMapIntensity: 1.2 }));
const RICE = ['#4f9e3e', '#6dba4c', '#b9b94a', '#3f8f38'].map(c => mat(c, { roughness: 0.85 }));

// ───── 稻田 ─────
export function buildPaddies(root, { x0, x1, z0, z1 }) {
  const k = mkit(root);
  const cw = 1.45, cd = 1.2, gap = 0.14;
  let fi = 0;
  const pathX = x0 + 2 * (cw + gap) - gap / 2;
  for (let x = x0; x + cw <= x1 + 0.01; x += cw + gap) for (let z = z0; z + cd <= z1 + 0.01; z += cd + gap) {
    const cx = x + cw / 2, cz = z + cd / 2, kind = fi++ % 4;
    k.box(cw + gap, 0.08, cd + gap, M.bund, cx, 0, cz, 0.02);                     // 田埂（高出水面一圈）
    k.box(cw + gap - 0.02, 0.012, cd + gap - 0.02, M.bundTop, cx, 0.08, cz, 0);
    k.box(cw - 0.1, 0.03, cd - 0.1, WATER[kind], cx, 0.07, cz, 0);                 // 水面
    if (kind === 3) continue;                                                       // 空田，只有水
    const tall = kind === 2 ? 0.2 : kind === 1 ? 0.16 : 0.11;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
      const px = cx - cw / 2 + 0.17 + i * (cw - 0.34) / 6, pz = cz - cd / 2 + 0.15 + j * (cd - 0.3) / 4;
      for (let b = 0; b < 3; b++) { const a = b * 2.1 + i + j; k.cone(0.018, tall, RICE[kind], px + Math.cos(a) * 0.02, 0.09, pz + Math.sin(a) * 0.02, 4, [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]); }
      if (kind === 2) k.ball(0.014, M.straw, px, 0.09 + tall, pz);               // 成熟的稻穗
    }
  }
  // 田间土路 + 踏脚石 + 灌溉渠
  k.box(0.26, 0.085, z1 - z0, M.path, pathX, 0, (z0 + z1) / 2, 0.01);
  for (let z = z0 + 0.3; z < z1; z += 0.55) k.box(0.1, 0.01, 0.12, M.stone, pathX + ((Math.floor(z * 3) % 2) - 0.5) * 0.06, 0.085, z, 0.004);
  k.push(x0 + 2.1, 0, z0 + 0.7, 0.3);
  // 稻草人：十字木架、破旧衣服、草帽、脑袋，肩上落着一只小鸟
  k.box(0.04, 0.6, 0.04, M.wood, 0, 0.08, 0, 0.005);
  k.box(0.44, 0.03, 0.03, M.wood, 0, 0.45, 0, 0.005);
  k.box(0.2, 0.22, 0.09, M.shirt, 0, 0.32, 0, 0.02);
  for (const s of [-1, 1]) { k.box(0.12, 0.05, 0.07, M.shirt, s * 0.14, 0.43, 0, 0.015); k.cone(0.012, 0.06, M.straw, s * 0.24, 0.36, 0, 5, [Math.PI, 0, 0]); }
  k.ball(0.075, M.skin, 0, 0.64, 0);
  k.cyl(0.15, 0.15, 0.015, M.straw, 0, 0.69, 0, 16); k.cone(0.085, 0.07, M.straw, 0, 0.7, 0, 14);
  k.ball(0.025, M.dark, 0.2, 0.5, 0.0, [1, 0.9, 1.3]);
  k.pop();
  k.finish();
}

// ───── 小山 + 凉亭 ─────
export function buildHillPavilion(root, { hx, hz, rng }) {
  const g = new THREE.Group(); g.position.set(hx, 0, hz); root.add(g);
  const hill = makeHill(2.3, 1.62, 5); hill.scale.z = 0.9; g.add(hill);
  const r1 = makeRock(1.0, 3); r1.position.set(0.95, 0.35, 0.65); g.add(r1);
  const r2 = makeRock(0.55, 4); r2.position.set(-1.0, 0.25, 0.9); g.add(r2);
  const surf = (x, z) => 1.62 * Math.sqrt(Math.max(0, 1 - ((x / 2.3) ** 2 + (z / (2.3 * 0.9)) ** 2)));
  const k = mkit(g);
  // 山顶凉亭：直接用古城的亭子模型（灰蓝屋顶）
  const ctx = { color: '#3e4b5e', accent: mat('#3e4b5e'), blink: () => {} };
  k.push(0, 1.5, 0, 0.3);
  k.cyl(0.7, 0.8, 0.12, M.stone, 0, -0.1, 0, 20);               // 把亭子的石台垫进山顶
  buildChinese(k, 0, ctx);
  k.pop();
  // 石阶：盘山小路，每级是一块有厚度的石板，旁边隔几级放一盏石灯
  for (let i = 0; i < 11; i++) {
    const a = -0.5 + i * 0.16, r = 2.05 - i * 0.18;
    const sx = Math.sin(a) * r * 0.5 - 0.2, sz = Math.cos(a) * r * 0.9, y = Math.max(0, surf(sx, sz) - 0.03);
    k.box(0.34, 0.08, 0.18, M.stone, sx, y, sz, 0.015, [0, a, 0]);
    if (i % 3 === 1) { const lx = sx + Math.cos(a) * 0.26, lz = sz - Math.sin(a) * 0.26; k.box(0.06, 0.12, 0.06, M.stone, lx, y, lz, 0.005); k.box(0.09, 0.05, 0.09, mat('#ffd56b', { emissive: '#ffb347', emissiveIntensity: 0.6 }), lx, y + 0.12, lz, 0.005); k.cone(0.07, 0.05, M.stone, lx, y + 0.17, lz, 4, [0, Math.PI / 4, 0]); }
  }
  k.finish();
  // 松树、灌木：贴着山坡
  [[-1.2, 0.2, 0.8], [-0.6, -1.1, 0.9], [1.0, -0.8, 0.7], [-1.4, -0.6, 0.6], [0.4, 1.2, 0.6]].forEach(([x, z, s]) => {
    const t = makeTree('pine', Math.floor(rng() * 3)); t.scale.setScalar(s * 1.05); t.position.set(x, surf(x, z) - 0.04, z); g.add(t);
  });
  [[-0.3, 1.0], [0.8, 0.3], [-0.9, -0.3], [0.2, -1.0]].forEach(([x, z], i) => { const b = makeBush(i); b.position.set(x, surf(x, z) - 0.02, z); b.scale.setScalar(0.7); g.add(b); });
}

// ───── 海上风车 ─────
export function buildTurbines(root, { IW, ticks }) {
  const rotors = [];
  [-9, -1, 7].forEach((z, i) => {
    const g = new THREE.Group(); g.position.set(IW + 5 + (i % 2) * 2, 0, z); root.add(g);
    const k = mkit(g);
    // 基础：水下的桩 + 水面的黄色过渡段 + 平台和栏杆
    k.cyl(0.3, 0.36, 0.6, M.concrete, 0, -0.9, 0, 20);
    k.cyl(0.26, 0.26, 0.5, M.yellow, 0, -0.35, 0, 20);
    k.cyl(0.4, 0.4, 0.04, M.grey, 0, 0.15, 0, 20);
    for (let b = 0; b < 12; b++) { const a = b / 12 * Math.PI * 2; k.cyl(0.006, 0.006, 0.1, M.grey, Math.cos(a) * 0.38, 0.19, Math.sin(a) * 0.38, 4); }
    k.torus(0.38, 0.006, M.grey, 0, 0.29, 0, [Math.PI / 2, 0, 0]);
    k.box(0.05, 0.5, 0.02, M.dark, 0.17, -0.3, 0.0, 0);                                   // 爬梯
    // 塔筒：渐细的圆筒，分三节有环缝
    k.lathe([[0.001, 0.19], [0.14, 0.19], [0.1, 2.2], [0.075, 4.35], [0.001, 4.35]], M.white, 0, 0, 0, 24);
    for (const y of [1.2, 2.6, 3.8]) k.torus(0.11 - y * 0.012, 0.005, M.grey, 0, y, 0, [Math.PI / 2, 0, 0]);
    // 机舱：流线型椭球 + 尾部风速仪
    k.ball(0.14, M.white, 0, 4.45, -0.05, [0.85, 0.9, 2.1]);
    k.box(0.04, 0.025, 0.06, M.dark, 0, 4.6, -0.25, 0);
    k.finish();
    // 转子：轮毂 + 三片扭转的锥形叶片
    const rotor = new THREE.Group(); rotor.position.set(0, 4.45, 0.3); g.add(rotor);
    const rk = mkit(rotor);
    rk.cone(0.075, 0.17, M.white, 0, 0, 0.0, 16, [Math.PI / 2, 0, 0]);
    for (let b = 0; b < 3; b++) {
      const bl = new THREE.Shape();
      bl.moveTo(-0.035, 0.05); bl.lineTo(0.07, 0.2); bl.lineTo(0.035, 1.0); bl.lineTo(0.012, 1.62); bl.lineTo(-0.012, 1.62); bl.lineTo(-0.03, 1.0); bl.closePath();
      const bg = new THREE.ExtrudeGeometry(bl, { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1 });
      const pp = bg.attributes.position;
      for (let v = 0; v < pp.count; v++) { const t = pp.getY(v) / 1.62, tw = (1 - t) * 0.5; const x = pp.getX(v), z2 = pp.getZ(v); pp.setX(v, x * Math.cos(tw) - z2 * Math.sin(tw)); pp.setZ(v, x * Math.sin(tw) + z2 * Math.cos(tw)); }   // 叶片扭转
      bg.computeVertexNormals();
      rk.geo(bg, M.white, 0, 0.05, -0.01, [0, 0, b / 3 * Math.PI * 2]);
    }
    rk.finish();
    rotors.push(rotor);
  });
  ticks.push((t, dt) => rotors.forEach((r, i) => { r.rotation.z += dt * (1.2 + i * 0.15); }));
}
