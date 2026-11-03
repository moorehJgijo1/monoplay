// 西北「古城」街区的中央景观（10 × 4）：
// 高的放南侧（镜头在南边，高物体往上盖的是自己的空地，不会遮住北边的格子）：左前宝塔、右前城墙城楼；
// 矮的放北侧：左后荷花池和石拱桥，右后牌坊。
// 用 modeling.js 的零件箱重建，会动的（灯笼摇摆）单独放。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';
import { makeTree, makeRock } from './nature.js';
import { buildChinese, cnRoofMat, cnRoof, dougong, pillar, latticeWin, redRail, stairs, CN } from './bld-chinese.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const SLATE = '#3e4b5e';

// 金底黑字的匾额贴图
const plaqueTex = canvasTex(256, 96, (c, w, h) => {
  c.fillStyle = '#1d3f6e'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#e8b630'; c.lineWidth = 9; c.strokeRect(5, 5, w - 10, h - 10);
  c.strokeStyle = '#fff1b0'; c.lineWidth = 2; c.strokeRect(14, 14, w - 28, h - 28);
  c.fillStyle = '#ffd34d'; c.font = `bold 58px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('古 城', w / 2, h / 2 + 4);
});
const M = {
  plaque: mat('#ffffff', { map: plaqueTex, roughness: 0.4 }),
  wall: mat('#9b9890', { map: TEX.stone, tile: 0.8, roughness: 0.9 }),
  brickG: mat('#8f8c85', { map: TEX.stone, tile: 0.6, roughness: 0.9 }),
  water: mat('#4fbdd0', { roughness: 0.04, metalness: 0.15, envMapIntensity: 1.4, emissive: '#0b5a6b', emissiveIntensity: 0.25 }),
  rim: mat('#cfc9bb', { map: TEX.stone, tile: 0.7, roughness: 0.85 }),
  padG: mat('#4aa650', { roughness: 0.7, side: THREE.DoubleSide }),
  pink: mat('#ffa6c9', { roughness: 0.5 }),
  pinkD: mat('#ff7eb0', { roughness: 0.5 }),
  gold: CN.gold,
};

// 荷叶：带缺口的圆片
const padGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.absarc(0, 0, 1, 0.35, Math.PI * 2 - 0.1, false); s.lineTo(0, 0); const g = new THREE.ShapeGeometry(s, 16); g.rotateX(-Math.PI / 2); return g; })();

export function buildOldTown(g, W, D, amb) {
  const k = mkit(g);
  const roofCtx = { color: SLATE, accent: mat(SLATE), blink: () => {} };
  roofCtx.cnRoof = cnRoofMat(SLATE);
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#c4160c', emissiveIntensity: 0.6, roughness: 0.4 });
  const lanterns = [];
  const lantern = (x, y, z) => {                  // 灯笼：红灯笼是单独的网格（会摇），顶盖和流苏合并
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), lanternMat);
    l.scale.set(1, 0.86, 1); l.position.set(x, y, z); l.castShadow = true; g.add(l); lanterns.push(l);
    k.cyl(0.07, 0.07, 0.035, CN.gold, x, y + 0.1, z, 14); k.cyl(0.06, 0.06, 0.03, CN.gold, x, y - 0.13, z, 14);
    k.cyl(0.004, 0.004, 0.14, CN.gold, x, y - 0.27, z, 4); k.ball(0.014, CN.gold, x, y - 0.27, z);
  };

  // ───── 左前：宝塔（5 层，高的放南侧，往上盖住的是自己的空地）─────
  k.push(-W / 2 + 1.5, 0, D / 2 - 1.05, 0);
  buildChinese(k, 4, roofCtx);
  k.pop();

  // ───── 右前：城墙 + 城楼（门朝南）─────
  {
    const gx = 1.8, gz = D / 2 - 0.7, wl = 3.1, wh = 0.64, wd = 0.72;
    k.push(gx, 0, gz, 0);
    k.box(wl + 0.1, 0.08, wd + 0.1, CN.stone, 0, 0, 0, 0.02);
    k.box(wl, wh, wd, M.wall, 0, 0.08, 0, 0.02);
    k.box(wl + 0.1, 0.05, wd + 0.1, CN.stoneG, 0, 0.08 + wh, 0, 0.012);
    for (let x = -wl / 2 + 0.12; x <= wl / 2 - 0.05; x += 0.25) for (const sz of [-1, 1]) k.box(0.13, 0.14, 0.07, M.wall, x, 0.13 + wh, sz * (wd / 2 - 0.04), 0.01);
    for (const sx of [-1, 1]) k.box(0.07, 0.14, wd - 0.1, M.wall, sx * (wl / 2 - 0.04), 0.13 + wh, 0, 0.01);
    // 拱门：深色门洞 + 石拱圈 + 两扇红门（带铜钉）
    const az = wd / 2;
    k.box(0.46, 0.38, 0.04, CN.black, 0, 0.08, az + 0.004, 0);
    k.cyl(0.23, 0.23, 0.04, CN.black, 0, 0.46, az + 0.004, 28, [Math.PI / 2, 0, 0]);
    k.torus(0.255, 0.03, CN.stoneG, 0, 0.46, az + 0.012, [0, 0, 0], Math.PI);
    for (const s of [-1, 1]) {
      k.box(0.215, 0.37, 0.025, CN.red, s * 0.113, 0.08, az + 0.02, 0);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) k.ball(0.012, CN.gold, s * 0.113 + (i - 1) * 0.06, 0.15 + j * 0.08, az + 0.04, [1, 1, 0.6]);
    }
    k.box(0.04, 0.38, 0.03, CN.black, 0, 0.08, az + 0.03, 0);
    // 城楼：一层回廊 + 二层木格窗，两重飞檐，二层有一圈栏杆
    const ty = 0.08 + wh + 0.05, h1 = 0.44;
    k.box(1.34, h1, 0.54, CN.wall, 0, ty, 0, 0.012);
    for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) pillar(k, -0.68 + i * 0.272, ty, sz * 0.32, h1, 0.03);
    for (const sz of [-1, 1]) k.box(1.5, 0.05, 0.06, CN.red, 0, ty + h1, sz * 0.32, 0.01);
    for (const x of [-0.34, 0.34]) latticeWin(k, x, ty + 0.1, 0.275, 0.24, 0.22);
    k.box(0.26, 0.34, 0.03, CN.red, 0, ty, 0.285, 0);
    dougong(k, 1.5, 0.74, ty + h1 + 0.05);
    cnRoof(k, roofCtx, 1.66, 0.84, 0.17, ty + h1 + 0.095, { finial: false });
    const y2 = ty + h1 + 0.095 + 0.17 + 0.02, h2 = 0.34;
    k.box(1.08, 0.05, 0.5, CN.red, 0, y2 - 0.03, 0, 0.01);
    k.box(0.96, h2, 0.38, CN.lattice, 0, y2, 0, 0.01);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillar(k, sx * 0.52, y2, sz * 0.25, h2 + 0.02, 0.026);
    redRail(k, 0, y2 - 0.01, 0.28, 1.1, 0, 0.1); redRail(k, 0.55, y2 - 0.01, 0, 0.58, Math.PI / 2, 0.1); redRail(k, -0.55, y2 - 0.01, 0, 0.58, Math.PI / 2, 0.1);
    k.box(0.5, 0.2, 0.03, M.plaque, 0, y2 + 0.06, 0.2, 0.004);
    dougong(k, 1.2, 0.62, y2 + h2 + 0.02);
    cnRoof(k, roofCtx, 1.36, 0.72, 0.34, y2 + h2 + 0.065);
    k.pop();
    lantern(gx - 1.0, 0.5, gz + wd / 2 + 0.16);
    lantern(gx + 1.0, 0.5, gz + wd / 2 + 0.16);
    stairs(k, gx, 0, gz + wd / 2 + 0.02, 0.5, 2, 0.03, 0.07);
  }

  // ───── 右后：牌坊（三间四柱，三重飞檐，夹杆石）─────
  {
    const pfx = W / 2 - 1.5, pfz = -0.95;
    k.push(pfx, 0, pfz, 0);
    const xs = [-0.85, -0.28, 0.28, 0.85], ph = 1.3;
    for (const x of xs) {
      k.box(0.2, 0.26, 0.2, CN.stone, x, 0, 0, 0.02);                   // 夹杆石
      k.cyl(0.068, 0.078, ph, CN.red, x, 0.04, 0, 20);
      k.cyl(0.085, 0.085, 0.04, CN.gold, x, ph - 0.06, 0, 18);
    }
    for (const [yy, hh] of [[1.02, 0.1], [0.8, 0.07]]) k.box(2.0, hh, 0.14, CN.red, 0, yy, 0, 0.012);
    k.box(0.6, 0.22, 0.05, M.plaque, 0, 0.84, 0.08, 0.004);
    for (const x of [-0.56, 0, 0.56]) { for (let i = -2; i <= 2; i++) k.box(0.014, 0.05, 0.014, CN.gold, x + i * 0.08, 0.94, 0.0, 0); }
    cnRoof(k, roofCtx, 0.86, 0.34, 0.2, 1.3);                           // 中间高的
    for (const s of [-1, 1]) cnRoof(k, roofCtx, 0.62, 0.3, 0.14, 1.14, { x: s * 0.72, finial: false });
    k.pop();
    lantern(pfx - 0.56, 0.62, pfz + 0.15);
    lantern(pfx + 0.56, 0.62, pfz + 0.15);
  }

  // ───── 左后：荷花池 + 石拱桥 + 垂柳（平的、矮的放北侧）─────
  {
    const px = -0.4, pz = -0.8, ax = 1.3, az = 0.7;
    // 水面（椭圆）和一圈池岸
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), M.water);
    water.rotation.x = -Math.PI / 2; water.position.set(px, 0.045, pz); water.scale.set(ax, az, 1); water.receiveShadow = true;
    g.add(water);
    const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.1, 48), M.rim);
    rim.rotation.x = -Math.PI / 2; rim.position.set(px, 0.05, pz); rim.scale.set(ax, az, 1); g.add(rim);
    // 池边的石头
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.2;
      if (Math.abs(Math.sin(a)) > 0.93 && Math.cos(a) > -0.2 && Math.cos(a) < 0.2) continue; // 桥头留空
      const r = makeRock(0.09 + ((i * 7) % 5) * 0.025, i % 6);
      r.position.set(px + Math.cos(a) * ax * 1.12, 0.02, pz + Math.sin(a) * az * 1.12); r.rotation.y = a * 3;
      g.add(r);
    }
    // 荷叶和荷花
    [[-0.75, 0.15, 0.13], [0.7, -0.2, 0.11], [0.45, 0.3, 0.12], [-0.3, -0.3, 0.1], [-0.9, -0.2, 0.08], [0.05, 0.12, 0.09]].forEach(([dx, dz, r], i) => {
      const pad = new THREE.Mesh(padGeo, M.padG); pad.scale.setScalar(r); pad.position.set(px + dx, 0.052, pz + dz); pad.rotation.y = i * 1.3; g.add(pad);
      if (i % 2 === 0) for (let p = 0; p < 8; p++) { const a = p / 8 * Math.PI * 2; k.cone(0.026, 0.07, p % 2 ? M.pink : M.pinkD, px + dx + Math.cos(a) * 0.03, 0.055, pz + dz + Math.sin(a) * 0.03, 6, [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55]); }
    });
    // 石拱桥：拱形桥身（挤出）+ 桥面栏板 + 两端台阶，横跨池塘短边
    const bw = 0.34, span = az * 2 + 0.3;
    const arch = new THREE.Shape();
    arch.moveTo(-span / 2, 0); arch.lineTo(-span / 2, 0.1);
    arch.quadraticCurveTo(0, 0.55, span / 2, 0.1); arch.lineTo(span / 2, 0);
    arch.quadraticCurveTo(0, 0.28, -span / 2, 0); // 桥洞
    const bg = new THREE.ExtrudeGeometry(arch, { depth: bw, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 });
    bg.translate(0, 0, -bw / 2); bg.rotateY(Math.PI / 2);
    k.geo(bg, M.rim, px, 0.045, pz, undefined, undefined, [bw, 0.5, span]);
    for (const sx of [-1, 1]) {
      // 栏板：沿桥面弧线的一串小方块 + 望柱
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, z = (t - 0.5) * span * 0.96, y = 0.045 + 0.1 * (1 - t) * (1 - t) * 0 + (2 * (1 - t) * t * 0.55 + (1 - t) * (1 - t) * 0.1 + t * t * 0.1) - 0.0;
        k.box(0.04, 0.07, span / steps + 0.01, CN.red, px + sx * (bw / 2), y + 0.0, pz + z, 0.006);
        if (i % 3 === 0) { k.box(0.055, 0.12, 0.055, CN.stone, px + sx * (bw / 2), y, pz + z, 0.01); k.ball(0.03, CN.stone, px + sx * (bw / 2), y + 0.14, pz + z); }
      }
    }
    // 垂柳
    const w = makeTree('willow', 0); w.position.set(px - ax - 0.5, 0, pz - 0.1); w.scale.setScalar(1.05); g.add(w);
  }
  // 北侧左角一棵松树
  { const t = makeTree('pine', 1); t.position.set(-W / 2 + 0.5, 0, -D / 2 + 0.55); t.scale.setScalar(0.95); g.add(t); }

  k.finish();
  amb.push(t => { lanternMat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.15; lanterns.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.6 + i) * 0.08; }); });
}
