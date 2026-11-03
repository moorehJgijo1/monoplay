// 西南「海滨」街区的中央景观（8 × 6）：
// 左半边是泻湖（栈桥、两艘绕圈的帆船）；右半边从后到前依次是灯塔、救生员瞭望塔、沙滩伞和躺椅。
// 用 modeling.js 的零件箱重建；帆船和灯塔光束是单独的动画网格。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';
import { makePalm, makeRock } from './nature.js';

// 水面：蓝底 + 波纹
const waterTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#39b4e6'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.lineCap = 'round';
  for (let k = 0; k < 16; k++) {
    const x = (k * 71) % w, y = (k * 53) % h;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { c.beginPath(); c.moveTo(x + ox, y + oy); c.quadraticCurveTo(x + ox + 14, y + oy - 8, x + ox + 28, y + oy); c.quadraticCurveTo(x + ox + 42, y + oy + 8, x + ox + 56, y + oy); c.stroke(); }
  }
});
// 灯塔的红白条纹：竖向 8 道
const lhTex = canvasTex(8, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fbfbf8' : '#e43b2a'; c.fillRect(0, i * h / 8, w, h / 8 + 1); } });
// 沙滩伞的条纹
const stripeTex = (c1, c2) => canvasTex(128, 8, (c, w, h) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? c2 : c1; c.fillRect(i * w / 12, 0, w / 12 + 1, h); } });

const M = {
  foam: mat('#eaf9ff', { roughness: 0.6 }),
  water: mat('#ffffff', { map: waterTex, tile: 2, roughness: 0.06, metalness: 0.12, envMapIntensity: 1.4 }),
  plank: mat('#ffffff', { map: TEX.planks, tile: 0.5, roughness: 0.8 }),
  post: mat('#6e4a28', { roughness: 0.85 }),
  rope: mat('#e8d9b0', { roughness: 0.9 }),
  white: mat('#fbfbf8', { roughness: 0.5 }),
  red: mat('#e43b2a', { roughness: 0.45 }),
  dark: mat('#2b3442', { roughness: 0.5, metalness: 0.3 }),
  lh: mat('#ffffff', { map: lhTex, roughness: 0.55 }),
  glass: mat('#cfeeff', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, envMapIntensity: 1.4 }),
  gold: mat('#f0bd2e', { metalness: 0.5, roughness: 0.32, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  yellow: mat('#ffd34d', { roughness: 0.5 }),
  sandD: mat('#e7d29c', { roughness: 1 }),
  hullW: mat('#ffffff', { roughness: 0.35 }),
  mast: mat('#8a5a2b', { roughness: 0.6 }),
};

function umbrella(k, x, z, c1, c2, towelColor) {
  const st = mat('#ffffff', { map: stripeTex(c1, c2), roughness: 0.6, side: THREE.DoubleSide });
  k.cyl(0.014, 0.014, 0.85, M.white, x, 0, z, 8, [0, 0, 0.1]);
  k.geo(new THREE.ConeGeometry(0.46, 0.2, 24, 1, true), st, x + 0.04, 0.78, z, [0, 0, 0.1]);
  k.ball(0.022, M.gold, x + 0.09, 1.0, z);
  // 浴巾 + 躺椅
  k.box(0.32, 0.012, 0.6, mat(towelColor, { roughness: 0.9 }), x + 0.45, 0.01, z + 0.1, 0, [0, 0.15, 0]);
}
function lounger(k, x, z, ry, color) {
  k.push(x, 0, z, ry);
  k.box(0.2, 0.03, 0.5, M.white, 0, 0.1, 0, 0.012);
  k.box(0.2, 0.03, 0.26, M.white, 0, 0.17, -0.3, 0.012, [0.85, 0, 0]);
  k.box(0.17, 0.012, 0.44, mat(color, { roughness: 0.8 }), 0, 0.126, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.012, 0.012, 0.1, M.white, sx * 0.08, 0, sz * 0.2, 6);
  k.pop();
}

// 一艘小帆船（单独网格，会动）：船体、桅杆、主帆、前帆、小旗
function makeBoat(color) {
  const b = new THREE.Group();
  const hull = new THREE.Shape();
  hull.moveTo(-0.38, 0.12); hull.quadraticCurveTo(-0.3, -0.03, 0, -0.04); hull.quadraticCurveTo(0.34, -0.03, 0.5, 0.14); hull.lineTo(-0.38, 0.12);
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.22, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 12 });
  hg.translate(0, 0.02, -0.11);
  const h = new THREE.Mesh(hg, M.hullW); h.castShadow = true; b.add(h);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.25), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  stripe.position.set(0.06, 0.15, 0); b.add(stripe);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.85, 8), M.mast); mast.position.set(0.02, 0.5, 0); mast.castShadow = true; b.add(mast);
  const sailMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide });
  const mk = (w, hgt, x, y, bulge, c) => {
    const g = new THREE.PlaneGeometry(w, hgt, 6, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) / w + 0.5), v = (p.getY(i) / hgt + 0.5);
      p.setZ(i, Math.sin(u * Math.PI) * bulge * (1 - v * 0.5));
      p.setX(i, p.getX(i) * (1 - v * 0.92) - w * 0.5 * v * 0.92 * 0 + (v * w * 0.46));   // 逐渐收成三角形
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));
    m.position.set(x, y, 0); m.castShadow = true; return m;
  };
  b.add(mk(0.36, 0.7, -0.17, 0.52, 0.05, '#ffffff'));
  b.add(mk(0.26, 0.55, 0.27, 0.46, -0.04, color));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide })); flag.position.set(0.07, 0.9, 0); b.add(flag);
  return b;
}

export function buildBeach(g, W, D, amb) {
  const k = mkit(g);

  // ═════ 左：泻湖 ═════
  const lw = W * 0.62, ld = D * 0.6, r = 0.9, lx = -W / 2 + lw / 2 + 0.3, lz = -D / 2 + ld / 2 + 0.35;
  {
    const lagoon = new THREE.Shape();
    lagoon.moveTo(-lw / 2 + r, -ld / 2);
    lagoon.lineTo(lw / 2 - r, -ld / 2); lagoon.quadraticCurveTo(lw / 2, -ld / 2, lw / 2, -ld / 2 + r);
    lagoon.lineTo(lw / 2, ld / 2 - r); lagoon.quadraticCurveTo(lw / 2, ld / 2, lw / 2 - r, ld / 2);
    lagoon.lineTo(-lw / 2 + r, ld / 2); lagoon.quadraticCurveTo(-lw / 2, ld / 2, -lw / 2, ld / 2 - r);
    lagoon.lineTo(-lw / 2, -ld / 2 + r); lagoon.quadraticCurveTo(-lw / 2, -ld / 2, -lw / 2 + r, -ld / 2);
    const mk = (sx, sy, y, m) => { const me = new THREE.Mesh(new THREE.ShapeGeometry(lagoon, 24), m); me.rotation.x = -Math.PI / 2; me.position.set(lx, y, lz); me.scale.set(sx, sy, 1); me.receiveShadow = true; g.add(me); return me; };
    mk(1.13, 1.15, 0.03, M.sandD);                  // 湿沙
    mk(1.07, 1.09, 0.036, M.foam);                  // 浪花
    const water = mk(1, 1, 0.05, M.water);
    // 水面贴图重复：按水面大小换算
    const t = waterTex.clone(); t.needsUpdate = true; t.repeat.set(lw / 3, ld / 3); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    water.material = M.water.clone(); water.material.map = t;
    // 波纹缓缓移动
    amb.push((tm) => { t.offset.set(tm * 0.01, tm * 0.006); });
  }
  // 帆船：绕湖慢慢漂
  const boats = [[makeBoat('#ff6b6b'), 0], [makeBoat('#ffbf2f'), Math.PI]];
  boats.forEach(([b]) => g.add(b));
  amb.push(t => boats.forEach(([b, ph]) => {
    const a = t * 0.18 + ph;
    b.position.set(lx + Math.cos(a) * lw * 0.27, 0.05 + Math.sin(t * 2 + ph) * 0.02, lz + Math.sin(a) * ld * 0.22);
    b.rotation.y = -a - Math.PI / 2;      // 船头沿着环绕方向
    b.rotation.z = Math.sin(t * 1.7 + ph) * 0.07;
  }));

  // ═════ 栈桥：从沙滩伸进泻湖 ═════
  {
    const bx = lx + lw * 0.18, z0 = lz + ld / 2 + 0.45, z1 = lz - ld * 0.05, len = z0 - z1, cz = (z0 + z1) / 2;
    for (let z = z1; z < z0 - 0.05; z += 0.16) k.box(0.42, 0.03, 0.15, M.plank, bx, 0.17, z + 0.08, 0.004);   // 一块块木板
    for (const sx of [-1, 1]) k.box(0.05, 0.06, len, M.post, bx + sx * 0.18, 0.12, cz, 0.008);               // 纵梁
    for (let z = z1 + 0.1; z < z0; z += 0.42) for (const sx of [-1, 1]) {
      k.cyl(0.032, 0.036, 0.3, M.post, bx + sx * 0.2, -0.04, z, 10);
      k.cyl(0.036, 0.036, 0.012, M.dark, bx + sx * 0.2, 0.26, z, 10);
    }
    // 绳索栏杆
    for (const sx of [-1, 1]) {
      for (let z = z1 + 0.1; z < z0; z += 0.42) k.cyl(0.018, 0.018, 0.2, M.post, bx + sx * 0.2, 0.2, z, 6);
      k.box(0.014, 0.014, len, M.rope, bx + sx * 0.2, 0.38, cz, 0);
    }
    // 栈桥尽头的灯柱
    k.cyl(0.016, 0.016, 0.4, M.dark, bx, 0.2, z1 + 0.02, 6);
    k.ball(0.04, mat('#fff3b0', { emissive: '#ffd34d', emissiveIntensity: 0.8 }), bx, 0.62, z1 + 0.02);
  }

  // ═════ 右后：灯塔 ═════
  {
    const hx = W / 2 - 0.9, hz = -D / 2 + 0.95;
    const rock = makeRock(0.78, 2); rock.scale.set(0.9, 0.62, 0.9); rock.position.set(hx, 0.17, hz); g.add(rock);
    k.push(hx, 0.1, hz, 0);
    k.cyl(0.4, 0.42, 0.14, M.white, 0, 0, 0, 32);
    // 渐细的塔身：用多个点让条纹贴图的 v 方向均匀
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([0.33 - 0.11 * t, 0.14 + t * 2.3]); }
    k.lathe([[0.001, 0.14], ...pts], M.lh, 0, 0, 0, 40);
    k.box(0.14, 0.3, 0.05, M.dark, 0, 0.14, 0.31, 0);                      // 门
    k.cyl(0.07, 0.07, 0.05, M.dark, 0, 0.44, 0.31, 16, [Math.PI / 2, 0, 0]);
    for (const y of [1.0, 1.6]) k.box(0.07, 0.12, 0.04, M.dark, 0, y, 0.27 - (y - 1.0) * 0.06, 0.004);   // 小窗
    // 回廊 + 栏杆
    const gy = 2.44;
    k.cyl(0.36, 0.3, 0.07, M.dark, 0, gy, 0, 32);
    k.torus(0.34, 0.012, M.dark, 0, gy + 0.2, 0, [Math.PI / 2, 0, 0]);
    k.torus(0.34, 0.01, M.dark, 0, gy + 0.1, 0, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; k.cyl(0.008, 0.008, 0.2, M.dark, Math.cos(a) * 0.34, gy + 0.07, Math.sin(a) * 0.34, 4); }
    // 灯室：玻璃筒 + 发光灯芯 + 红色圆顶
    k.cyl(0.19, 0.19, 0.3, M.glass, 0, gy + 0.07, 0, 24);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.cyl(0.008, 0.008, 0.3, M.dark, Math.cos(a) * 0.19, gy + 0.07, Math.sin(a) * 0.19, 4); }
    k.cyl(0.21, 0.21, 0.04, M.dark, 0, gy + 0.37, 0, 24);
    k.dome(0.2, M.red, 0, gy + 0.41, 0, 0.5, [1, 1.1, 1]);
    k.cyl(0.008, 0.008, 0.12, M.dark, 0, gy + 0.62, 0, 6);
    k.ball(0.022, M.gold, 0, gy + 0.74, 0);
    k.pop();
    const lampM = new THREE.MeshStandardMaterial({ color: '#fff6c2', emissive: '#ffd34d', emissiveIntensity: 1.1 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 16), lampM);
    lamp.position.set(hx, 0.1 + gy + 0.2, hz); g.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    beam.geometry.translate(0, -1.3, 0);
    beam.rotation.z = Math.PI / 2;
    const pivot = new THREE.Group(); pivot.position.set(hx, 0.1 + gy + 0.2, hz); pivot.add(beam); g.add(pivot);
    amb.push((t, dt) => { pivot.rotation.y += dt * 1.2; });
  }

  // ═════ 右中：救生员瞭望塔 + 冲浪板架 ═════
  {
    const lgx = lx + lw / 2 + 0.75, lgz = lz + 0.35;
    k.push(lgx, 0, lgz, -0.25);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.026, 0.032, 0.95, M.white, sx * 0.22, 0, sz * 0.22, 8);
    for (const sx of [-1, 1]) { k.box(0.02, 0.02, 0.62, M.white, sx * 0.22, 0.4, 0, 0, [0, 0, 0]); k.box(0.02, 0.02, 0.62, M.white, sx * 0.22, 0.4, 0, 0, [0, 0, 0]); }
    for (const sz of [-1, 1]) { k.box(0.62, 0.02, 0.02, M.white, 0, 0.4, sz * 0.22, 0); k.box(0.04, 0.78, 0.02, M.white, 0, 0.1, sz * 0.22, 0, [0, 0, 0.55]); k.box(0.04, 0.78, 0.02, M.white, 0, 0.1, sz * 0.22, 0, [0, 0, -0.55]); }
    k.box(0.64, 0.05, 0.64, M.plank, 0, 0.95, 0, 0.012);
    k.box(0.48, 0.34, 0.48, M.red, 0, 1.0, 0, 0.02);
    k.box(0.5, 0.03, 0.5, M.white, 0, 1.0 + 0.2, 0, 0.01);
    k.box(0.5, 0.03, 0.5, M.white, 0, 1.0 + 0.0, 0, 0.01);
    k.box(0.3, 0.14, 0.02, M.glass, 0, 1.13, 0.245, 0); k.box(0.016, 0.14, 0.03, M.white, 0, 1.13, 0.25, 0);
    for (const s of [-1, 1]) { k.box(0.02, 0.16, 0.2, M.glass, s * 0.245, 1.12, 0, 0); }
    k.geo(new THREE.ConeGeometry(0.46, 0.22, 4), M.white, 0, 1.46, 0, [0, Math.PI / 4, 0]);
    k.box(0.05, 0.05, 0.05, M.red, 0, 1.58, 0, 0);
    k.box(0.28, 0.03, 0.62, M.plank, 0, 0.48, 0.5, 0.01, [-0.85, 0, 0]);          // 梯子
    for (const s of [-1, 1]) k.box(0.02, 0.02, 0.66, M.white, s * 0.14, 0.48, 0.5, 0, [-0.85, 0, 0]);
    k.cyl(0.01, 0.01, 0.55, M.dark, 0.3, 1.0, 0.28, 6);                           // 旗杆
    k.box(0.2, 0.12, 0.012, M.yellow, 0.4, 1.38, 0.28, 0);
    k.torus(0.05, 0.016, M.red, -0.245, 1.05, 0.0, [0, Math.PI / 2, 0]);          // 救生圈
    k.pop();
    // 冲浪板架：三块板斜靠在架子上
    k.push(lgx + 0.85, 0, lgz + 0.75, -0.3);
    k.box(0.6, 0.03, 0.03, M.post, 0, 0.3, 0, 0); for (const s of [-1, 1]) k.box(0.03, 0.3, 0.03, M.post, s * 0.28, 0, 0, 0);
    ['#ff6b6b', '#4dabf7', '#ffd34d'].forEach((c, i) => {
      const board = new THREE.CapsuleGeometry(0.075, 0.55, 4, 12); board.scale(1, 1, 0.22);
      k.geo(board, mat(c, { roughness: 0.3 }), -0.2 + i * 0.2, 0.4, -0.04, [0.12, 0, -0.1 + i * 0.1]);
    });
    k.pop();
  }

  // ═════ 前排：沙滩伞、躺椅、棕榈 ═════
  umbrella(k, W / 2 - 2.0, D / 2 - 0.7, '#ff6b6b', '#ffffff', '#ff6b6b');
  lounger(k, W / 2 - 2.5, D / 2 - 0.6, 0.1, '#ffd34d');
  umbrella(k, -W / 2 + 1.4, D / 2 - 0.6, '#2f80ed', '#ffffff', '#2f80ed');
  lounger(k, -W / 2 + 0.85, D / 2 - 0.9, -0.2, '#4dabf7');
  const palm1 = makePalm(1); palm1.position.set(-W / 2 + 0.5, 0, D / 2 - 0.5); palm1.rotation.y = -0.8; palm1.scale.setScalar(1.2); g.add(palm1);
  const palm2 = makePalm(2); palm2.position.set(W / 2 - 0.55, 0, D / 2 - 1.2); palm2.rotation.y = 1.4; palm2.scale.setScalar(1.1); g.add(palm2);
  // 一座小沙堡
  {
    k.push(0.9, 0, D / 2 - 0.5, 0);
    k.cyl(0.2, 0.24, 0.16, M.sandD, 0, 0, 0, 14);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.cyl(0.05, 0.06, 0.12, M.sandD, Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2, 8); }
    k.cone(0.07, 0.14, M.sandD, 0, 0.16, 0, 10);
    k.cyl(0.004, 0.004, 0.12, M.dark, 0, 0.3, 0, 3);
    k.box(0.07, 0.04, 0.004, M.red, 0.04, 0.38, 0, 0);
    k.pop();
  }

  k.finish();
}
