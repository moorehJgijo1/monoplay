// 东南「游乐园」街区的中央景观（8 × 6）：
// 后排：过山车（左）、摩天轮（右）；前排：旋转木马（左）、马戏帐篷（右）；大门居中，气球在右侧。
// 用 modeling.js 的零件箱重建；摩天轮、旋转木马、过山车、气球保留原来的动画。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const COLORS = ['#ff6b6b', '#ffd34d', '#4dabf7', '#51cf66', '#cc5de8', '#ff922b', '#22b8cf', '#f06595'];

const stripeTex = (c1, c2, n, vertical = true) => canvasTex(256, 16, (c, w, h) => { for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? c2 : c1; c.fillRect(i * w / n, 0, w / n + 1, h); } });

const M = {
  steel: mat('#e8ecf2', { metalness: 0.5, roughness: 0.32 }),
  steelD: mat('#9aa3b0', { metalness: 0.5, roughness: 0.4 }),
  red: mat('#f03e3e', { metalness: 0.3, roughness: 0.4 }),
  white: mat('#ffffff', { roughness: 0.45 }),
  pink: mat('#ff7aa8', { roughness: 0.45 }),
  yellow: mat('#ffd34d', { roughness: 0.4 }),
  cream: mat('#ffe8a3', { roughness: 0.6 }),
  plank: mat('#ffffff', { map: TEX.planks, tile: 0.5, roughness: 0.8 }),
  bulb: mat('#fff3b0', { emissive: '#ffd34d', emissiveIntensity: 0.9, roughness: 0.3 }),
  gold: mat('#f0bd2e', { metalness: 0.5, roughness: 0.32, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  wood: mat('#8a5a2b', { roughness: 0.7 }),
  dark: mat('#33404d', { roughness: 0.5 }),
  tie: mat('#5c6470', { roughness: 0.7 }),
  support: mat('#f1f3f5', { metalness: 0.3, roughness: 0.4 }),
  rail: mat('#ff4757', { metalness: 0.3, roughness: 0.4 }),
  glass: mat('#cfeeff', { roughness: 0.05, transparent: true, opacity: 0.5, envMapIntensity: 1.3 }),
  leaf: mat('#4aa650', { roughness: 0.85 }),
};
const colorMats = COLORS.map(c => mat(c, { roughness: 0.4 }));

// 一匹旋转木马的马：身体、脖子、头、鬃毛、尾巴、四条腿、马鞍
function horse(color, tail) {
  const g = new THREE.Group();
  const k = mkit(g), hm = mat(color, { roughness: 0.35 }), cream = mat('#fff4e0', { roughness: 0.5 });
  k.ball(0.07, hm, 0, 0.1, 0, [0.8, 0.95, 2.0]);                       // 躯干
  k.ball(0.05, hm, 0, 0.12, 0.14, [0.9, 1.1, 1.0]);                    // 胸
  k.cyl(0.032, 0.045, 0.16, hm, 0, 0.1, 0.18, 10, [0.6, 0, 0]);        // 脖子
  k.ball(0.04, hm, 0, 0.27, 0.25, [0.8, 0.9, 1.4]);                    // 头
  k.ball(0.022, hm, 0, 0.25, 0.31, [0.9, 0.8, 1.0]);                   // 口鼻
  for (const s of [-1, 1]) k.cone(0.012, 0.04, hm, s * 0.025, 0.3, 0.22, 6);   // 耳朵
  for (let i = 0; i < 4; i++) k.ball(0.022, cream, 0, 0.31 - i * 0.03, 0.2 - i * 0.012, [0.7, 1, 1]);   // 鬃毛
  k.ball(0.028, tail, 0, 0.13, -0.17, [0.6, 1.6, 0.8]);                // 尾巴
  for (const [lx, lz] of [[0.035, 0.1], [-0.035, 0.1], [0.035, -0.1], [-0.035, -0.1]]) { k.cyl(0.014, 0.01, 0.12, hm, lx, 0.0, lz, 6); }
  k.box(0.12, 0.02, 0.1, mat('#d4a017', { roughness: 0.4 }), 0, 0.17, 0.02, 0.006);   // 马鞍
  k.finish();
  return g;
}

export function buildFunPark(g, W, D, amb) {
  const k = mkit(g);

  // ═════ 后右：摩天轮 ═════
  {
    const fw = new THREE.Group();
    fw.position.set(W / 2 - 1.5, 0, -D / 2 + 1.2);
    fw.rotation.y = -0.35;
    g.add(fw);
    const R = 1.35, H = 1.75, fk = mkit(fw);
    // 底座和两个 A 字形支架（带横撑）
    fk.box(2.2, 0.1, 1.0, M.steelD, 0, 0, 0, 0.02);
    for (const sz of [-0.3, 0.3]) {
      for (const sx of [-1, 1]) {
        const len = Math.hypot(0.8, H), ang = Math.atan2(0.8, H);
        fk.cyl(0.035, 0.05, len, M.steel, sx * 0.4, 0.05, sz, 10, [0, 0, sx * ang]);
      }
      fk.box(0.62, 0.03, 0.03, M.steel, 0, 0.7, sz, 0); fk.box(0.36, 0.03, 0.03, M.steel, 0, 1.25, sz, 0);
      fk.cyl(0.12, 0.12, 0.08, M.steelD, 0, H - 0.04, sz, 16, [Math.PI / 2, 0, 0]);
    }
    fk.finish();
    const wheel = new THREE.Group();
    wheel.position.set(0, H, 0);
    fw.add(wheel);
    const wk = mkit(wheel);
    // 两圈外环 + 内环 + 辐条 + 环间拉杆 + 一圈小灯
    for (const sz of [-0.15, 0.15]) { wk.torus(R, 0.035, M.red, 0, 0, sz, [0, 0, 0]); wk.torus(R * 0.55, 0.02, M.steel, 0, 0, sz, [0, 0, 0]); }
    wk.cyl(0.12, 0.12, 0.66, M.steelD, 0, 0, 0, 16, [Math.PI / 2, 0, 0]);
    wk.cyl(0.07, 0.07, 0.8, M.steel, 0, 0, 0, 12, [Math.PI / 2, 0, 0]);
    const NS = 16;
    for (let i = 0; i < NS; i++) {
      const a = (i / NS) * Math.PI * 2;
      for (const sz of [-0.15, 0.15]) wk.box(R, 0.018, 0.018, M.steel, Math.cos(a) * R / 2, Math.sin(a) * R / 2 - 0.009, sz, 0, [0, 0, a]);
      wk.box(0.02, 0.02, 0.3, M.steel, Math.cos(a) * R, Math.sin(a) * R, 0, 0);
      wk.ball(0.022, M.bulb, Math.cos(a) * (R + 0.045), Math.sin(a) * (R + 0.045), 0.15);
      wk.ball(0.022, M.bulb, Math.cos(a) * (R + 0.045), Math.sin(a) * (R + 0.045), -0.15);
    }
    wk.finish();
    // 座舱：吊杆 + 带顶棚和窗的小舱，始终朝下
    const cars = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, car = new THREE.Group();
      car.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(car);
      const ck = mkit(car), cm = colorMats[i];
      ck.cyl(0.01, 0.01, 0.14, M.steel, 0, -0.14, 0, 5);
      ck.box(0.3, 0.2, 0.26, cm, 0, -0.36, 0, 0.03);
      ck.box(0.31, 0.12, 0.27, M.glass, 0, -0.32, 0, 0);
      ck.box(0.34, 0.035, 0.3, M.white, 0, -0.16, 0, 0.012);
      ck.cone(0.14, 0.06, cm, 0, -0.13, 0, 4, [0, Math.PI / 4, 0]);
      ck.finish();
      cars.push(car);
    }
    amb.push((t, dt) => { wheel.rotation.z += dt * 0.25; cars.forEach(c => { c.rotation.z = -wheel.rotation.z; }); });
  }

  // ═════ 前左：旋转木马 ═════
  {
    const cr = new THREE.Group();
    cr.position.set(-W / 2 + 1.7, 0, 1.15);
    g.add(cr);
    const ck = mkit(cr);
    ck.cyl(1.0, 1.05, 0.08, M.steelD, 0, 0, 0, 40);
    ck.cyl(0.92, 0.92, 0.1, M.cream, 0, 0.08, 0, 40);
    ck.torus(0.95, 0.018, M.gold, 0, 0.19, 0, [Math.PI / 2, 0, 0]);
    // 中心柱：带镜面片
    ck.cyl(0.14, 0.14, 1.28, M.yellow, 0, 0.18, 0, 20);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ck.box(0.07, 0.4, 0.012, M.glass, Math.cos(a) * 0.145, 0.5, Math.sin(a) * 0.145, 0, [0, -a + Math.PI / 2, 0]); }
    // 顶棚：粉色檐板 + 红白条纹圆锥 + 一圈小灯 + 顶上的金球
    ck.cyl(1.08, 1.08, 0.16, M.pink, 0, 1.3, 0, 40);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ck.cone(0.04, 0.09, i % 2 ? M.white : M.red, Math.cos(a) * 1.07, 1.2, Math.sin(a) * 1.07, 6, [Math.PI, 0, 0]); ck.ball(0.02, M.bulb, Math.cos(a) * 1.1, 1.38, Math.sin(a) * 1.1); }
    const roofMat = mat('#ffffff', { map: stripeTex('#ff6b6b', '#ffffff', 16), roughness: 0.5 });
    ck.geo(new THREE.ConeGeometry(1.1, 0.6, 40, 1), roofMat, 0, 1.76, 0, undefined, undefined, [Math.PI * 2.2, 0.7, Math.PI * 2.2]);
    ck.ball(0.07, M.gold, 0, 2.08, 0);
    ck.cyl(0.006, 0.006, 0.18, M.gold, 0, 2.1, 0, 4);
    ck.finish();
    // 转动部分：木马 + 立杆（木马单独上下起伏）
    const spin = new THREE.Group();
    cr.add(spin);
    const sk = mkit(spin);
    const horses = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, rr = i % 2 ? 0.58 : 0.8, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      sk.cyl(0.012, 0.012, 1.1, M.gold, x, 0.18, z, 6);
      const h = horse(COLORS[i % COLORS.length], mat('#ffffff'));
      h.position.set(x, 0.5, z);
      h.rotation.y = Math.PI / 2 - a;
      h.scale.setScalar(1.3);
      spin.add(h);
      horses.push(h);
    }
    sk.finish();
    amb.push((t, dt) => { spin.rotation.y += dt * 0.7; horses.forEach((h, i) => { h.position.y = 0.46 + Math.sin(t * 2.4 + i * 1.3) * 0.1; }); });
  }

  // ═════ 前右：马戏帐篷 ═════
  {
    k.push(W / 2 - 1.55, 0, 1.55, 0);
    const tm = mat('#ffffff', { map: stripeTex('#4dabf7', '#ffffff', 14), roughness: 0.6 });
    k.cyl(0.8, 0.8, 0.08, M.wood, 0, 0, 0, 36);
    k.geo(new THREE.CylinderGeometry(0.75, 0.75, 0.55, 36, 1, true), tm, 0, 0.35, 0, undefined, undefined, [Math.PI * 1.5, 0.55, Math.PI * 1.5]);
    k.geo(new THREE.ConeGeometry(0.88, 0.8, 36, 1), tm, 0, 0.98, 0, undefined, undefined, [Math.PI * 1.8, 0.9, Math.PI * 1.8]);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; k.cone(0.07, 0.09, i % 2 ? M.white : colorMats[2], Math.cos(a) * 0.76, 0.58, Math.sin(a) * 0.76, 6, [Math.PI, 0, 0]); }   // 波浪边
    k.cyl(0.012, 0.012, 0.42, M.steel, 0, 1.36, 0, 6);
    k.box(0.24, 0.15, 0.01, M.red, 0.13, 1.64, 0, 0);
    // 门帘：两片拉开的红色帘子 + 深色门洞 + 门楣小灯
    k.box(0.32, 0.4, 0.04, mat('#3b2614'), 0, 0.08, 0.745, 0);
    for (const s of [-1, 1]) k.box(0.1, 0.42, 0.04, M.red, s * 0.21, 0.08, 0.755, 0.01, [0, 0, s * 0.1]);
    for (let i = -3; i <= 3; i++) k.ball(0.014, M.bulb, i * 0.06, 0.52, 0.76);
    // 拴帐篷的木桩和旗绳
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; k.cyl(0.015, 0.015, 0.12, M.wood, Math.cos(a) * 0.96, 0, Math.sin(a) * 0.96, 5); }
    k.pop();
  }

  // ═════ 后左：过山车 ═════
  {
    const cx = -1.2, cz = -D / 2 + 1.25, rx = 1.65, rz = 0.8;
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const h = 0.35 + 1.25 * Math.pow(Math.max(0, Math.sin(a)), 3) + 0.35 * Math.max(0, Math.sin(a * 3 + 1));
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rx * (1 + 0.12 * Math.sin(a * 2)), h, cz + Math.sin(a) * rz));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const N = 280, left = [], right = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(0.1);
      left.push(p.clone().add(side)); right.push(p.clone().sub(side)); mid.push(p.clone());
    }
    [left, right].forEach(arr => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arr, true), 280, 0.024, 6, true), M.rail); m.castShadow = true; g.add(m); });
    const spine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid.map(p => p.clone().add(new THREE.Vector3(0, -0.05, 0))), true), 280, 0.012, 5, true), M.steelD);
    g.add(spine);
    // 枕木、支柱（细长的 A 形）、横撑
    for (let i = 0; i < 110; i++) {
      const u = i / 110, p = curve.getPointAt(u), t = curve.getTangentAt(u), ry = Math.PI / 2 - Math.atan2(t.z, t.x);
      k.box(0.26, 0.018, 0.035, M.tie, p.x, p.y - 0.04, p.z, 0, [0, ry, 0]);
      if (i % 5 === 0 && p.y > 0.12) {
        for (const s of [-1, 1]) {
          const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
          k.cyl(0.016, 0.026, p.y - 0.05, M.support, p.x + side.x * 0.1 * s, 0, p.z + side.z * 0.1 * s, 6);
        }
        k.box(0.2, 0.014, 0.014, M.support, p.x, p.y * 0.55, p.z, 0, [0, ry, 0]);
      }
    }
    // 车站站台
    k.box(0.9, 0.06, 0.4, M.plank, cx + 0.2, 0, cz + rz + 0.28, 0.01);
    k.box(0.92, 0.2, 0.04, M.red, cx + 0.2, 0.06, cz + rz + 0.48, 0.008);
    for (const s of [-1, 1]) k.cyl(0.02, 0.02, 0.3, M.white, cx + 0.2 + s * 0.4, 0.06, cz + rz + 0.48, 6);
    // 列车：三节车厢，低处快、高处慢（单独网格）
    const train = [];
    ['#ffd34d', '#4dabf7', '#51cf66'].forEach(c => {
      const car = new THREE.Group(); g.add(car);
      const ck = mkit(car), cm = mat(c, { roughness: 0.35 });
      ck.box(0.32, 0.1, 0.2, cm, 0, 0.02, 0, 0.03);
      ck.box(0.05, 0.12, 0.2, M.white, 0.14, 0.1, 0, 0.012);
      ck.box(0.04, 0.1, 0.2, cm, -0.14, 0.1, 0, 0.01);
      for (const sz of [-1, 1]) { ck.ball(0.042, mat('#ffd8b1', { roughness: 0.6 }), -0.02, 0.2, sz * 0.05); ck.box(0.07, 0.07, 0.05, mat(COLORS[(sz + 3) % 8]), -0.02, 0.1, sz * 0.05, 0.01); }
      ck.finish();
      train.push(car);
    });
    let pos = 0;
    amb.push((t, dt) => {
      const p0 = curve.getPointAt(pos);
      pos = (pos + dt * (0.06 + 0.1 * Math.max(0, 1.6 - p0.y))) % 1;
      train.forEach((car, i) => {
        const u = (pos - i * 0.03 + 1) % 1, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
        car.position.copy(p).add(new THREE.Vector3(0, 0.01, 0));
        car.rotation.order = 'YXZ';
        car.rotation.set(0, Math.atan2(-tg.z, tg.x), Math.asin(Math.max(-1, Math.min(1, tg.y))));
      });
    });
  }

  // ═════ 前排居中：乐园大门 ═════
  {
    const gx = 0, gz = D / 2 - 0.3;
    const tower = mat('#ffffff', { map: stripeTex('#ff6b8a', '#fff4e0', 10), roughness: 0.5 });
    const purple = mat('#7048e8', { roughness: 0.4 });
    for (const sx of [-1, 1]) {
      k.cyl(0.24, 0.26, 0.08, M.steelD, gx + sx * 0.8, 0, gz, 24);
      k.geo(new THREE.CylinderGeometry(0.19, 0.2, 1.0, 28, 1), tower, gx + sx * 0.8, 0.58, gz, [0, 0, 0], undefined, [Math.PI * 1.2, 1.0, Math.PI * 1.2]);
      k.cyl(0.24, 0.24, 0.05, M.white, gx + sx * 0.8, 1.08, gz, 28);
      k.cone(0.25, 0.42, purple, gx + sx * 0.8, 1.13, gz, 28);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.ball(0.014, M.bulb, gx + sx * 0.8 + Math.cos(a) * 0.245, 1.08, gz + Math.sin(a) * 0.245); }
      k.ball(0.03, M.gold, gx + sx * 0.8, 1.58, gz);
    }
    // 拱形招牌：弯成拱的一块板 + 文字面板
    const sign = canvasTex(256, 80, (c, w, h) => {
      c.fillStyle = '#ffd34d'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#ff6b8a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = '#c2255c'; c.font = `bold 46px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢 乐 谷', w / 2, h / 2 + 3);
    });
    k.torus(0.8, 0.05, mat('#ff6b8a', { roughness: 0.4 }), gx, 0.95, gz, [0, 0, 0], Math.PI);
    k.box(1.1, 0.3, 0.05, mat('#ffffff', { map: sign, roughness: 0.4 }), gx, 1.42, gz + 0.08, 0.01);
    for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; k.ball(0.018, M.bulb, gx + Math.cos(a) * 0.8, 0.95 + Math.sin(a) * 0.8, gz + 0.05); }
    k.ball(0.04, M.gold, gx, 1.78, gz);
  }

  // ═════ 右侧：气球 ═════
  const balloons = new THREE.Group();
  balloons.position.set(W / 2 - 0.45, 0, 0.3);
  g.add(balloons);
  {
    const bk = mkit(balloons);
    bk.box(0.36, 0.34, 0.3, M.cream, 0, 0, 0, 0.03);
    bk.box(0.4, 0.04, 0.34, M.pink, 0, 0.34, 0, 0.012);
    bk.finish();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2, bx = Math.cos(a) * 0.22, bz = Math.sin(a) * 0.22, by = 1.25 + (i % 3) * 0.16;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshStandardMaterial({ color: COLORS[i], roughness: 0.2, metalness: 0.05 }));
      b.scale.set(1, 1.18, 1); b.position.set(bx, by, bz); b.castShadow = true; balloons.add(b);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 6), b.material); knot.position.set(bx, by - 0.16, bz); knot.rotation.x = Math.PI; balloons.add(knot);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, by - 0.4, 3), new THREE.MeshStandardMaterial({ color: '#999' }));
      line.position.set(bx / 2, 0.34 + (by - 0.4) / 2, bz / 2); line.rotation.set(bz * 0.5, 0, -bx * 0.5); balloons.add(line);
    }
    amb.push(t => { balloons.rotation.y = Math.sin(t * 0.5) * 0.2; balloons.children.forEach((c, i) => { if (i > 1 && c.geometry.type === 'SphereGeometry') c.position.y += Math.sin(t * 2 + i) * 0.0012; }); });
  }

  k.finish();
}
