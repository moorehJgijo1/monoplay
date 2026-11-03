// 东北「金融区」街区的中央景观（8 × 4）：
// 居中是证券交易所（古典柱廊 + 楼顶滚动行情屏），圆塔和方塔分列左右后角，喷泉在正前方，金牛和花坛在两侧前。
// 用 modeling.js 的零件箱重建；行情屏、喷泉水柱、塔顶信标是单独的动画网格。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';
import { makeBush } from './nature.js';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

// 不同颜色的玻璃幕墙贴图：一张 = 1m 宽 × 1.2m 高（4 层）
function curtainTex(c1, c2, seed) {
  return canvasTex(512, 614, (g, w, h) => {
    let t = seed; const r = () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; };
    const floors = 4, cols = 4, fh = h / floors, cw = w / cols;
    g.fillStyle = '#c7ced8'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < floors; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw + 5, y = j * fh + 9, pw = cw - 10, ph = fh * 0.74;
      const gr = g.createLinearGradient(x, y, x + pw, y + ph);
      const k = r() * 0.35;
      gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.fillRect(x, y, pw, ph);
      g.fillStyle = `rgba(255,255,255,${0.12 + k * 0.2})`;
      g.beginPath(); g.moveTo(x, y + ph); g.lineTo(x + pw * 0.45, y); g.lineTo(x + pw * 0.62, y); g.lineTo(x + pw * 0.1, y + ph); g.fill();
    }
  });
}
const nameTex = canvasTex(512, 64, (c, w, h) => {
  c.fillStyle = '#f4efe2'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#7a5a20'; c.font = `bold 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢乐城证券交易所', w / 2, h / 2 + 3);
});

const M = {
  marble: mat('#f6f2e8', { map: TEX.plaster, tile: 1, roughness: 0.45 }),
  marbleD: mat('#cfc7b4', { roughness: 0.6 }),
  stone: mat('#dad4c5', { map: TEX.stone, tile: 0.9, roughness: 0.75 }),
  stoneD: mat('#b8b2a4', { map: TEX.stone, tile: 0.9, roughness: 0.85 }),
  gold: mat('#f2c230', { metalness: 0.55, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.25 }),
  bronze: mat('#b98a2e', { metalness: 0.6, roughness: 0.38, emissive: '#3a2600', emissiveIntensity: 0.2 }),
  frame: mat('#2b3442', { roughness: 0.5, metalness: 0.3 }),
  door: mat('#5a3b1c', { roughness: 0.5 }),
  glassW: mat('#3d5a80', { glass: true }),
  name: mat('#ffffff', { map: nameTex, roughness: 0.5 }),
  curtainB: mat('#ffffff', { map: curtainTex('#8fc7ff', '#1f5fb5', 3), tile: [1, 1.2], roughness: 0.1, metalness: 0.4, envMapIntensity: 1.3 }),
  curtainT: mat('#ffffff', { map: curtainTex('#8fe8dc', '#1a8f84', 9), tile: [1, 1.2], roughness: 0.1, metalness: 0.4, envMapIntensity: 1.3 }),
  water: mat('#6fd0f0', { roughness: 0.04, metalness: 0.1, envMapIntensity: 1.4, emissive: '#0b5a7a', emissiveIntensity: 0.25 }),
  lampGlass: new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#ffd56b', emissiveIntensity: 0.7, roughness: 0.3 }),
  soil: mat('#6b4a2a', { roughness: 1 }),
};

// 爱奥尼柱：柱础 + 带凹槽的柱身 + 带涡卷的柱头
function column(k, x, y, z, h, r) {
  k.cyl(r * 1.5, r * 1.4, 0.05, M.marble, x, y, z, 24);
  k.cyl(r * 1.22, r * 1.22, 0.035, M.marble, x, y + 0.05, z, 24);
  k.cyl(r, r * 0.86, h - 0.26, M.marble, x, y + 0.085, z, 28);
  for (let i = 0; i < 14; i++) {                  // 凹槽：沿柱身的细长深色条
    const a = (i / 14) * Math.PI * 2;
    k.box(0.012, h - 0.34, 0.01, M.marbleD, x + Math.cos(a) * r * 0.9, y + 0.13, z + Math.sin(a) * r * 0.9, 0, [0, -a, 0]);
  }
  const ty = y + h - 0.175;
  k.cyl(r * 0.9, r * 1.1, 0.05, M.marble, x, ty, z, 24);
  for (const s of [-1, 1]) k.torus(r * 0.55, 0.018, M.marble, x + s * r * 1.15, ty + 0.06, z, [0, 0, 0]);   // 涡卷
  k.box(r * 3.0, 0.045, r * 3.0, M.marble, x, ty + 0.05, z, 0.01);
}

// 路灯：渐细的灯杆 + 弯臂 + 发光灯罩
function lamp(k, x, z) {
  k.cyl(0.06, 0.06, 0.06, M.frame, x, 0, z, 12);
  k.cyl(0.03, 0.022, 1.0, M.frame, x, 0.06, z, 12);
  k.torus(0.07, 0.012, M.frame, x, 0.55, z, [Math.PI / 2, 0, 0]);
  k.box(0.22, 0.025, 0.035, M.frame, x + 0.09, 1.04, z, 0);
  k.ball(0.065, M.lampGlass, x + 0.19, 0.99, z);
  k.cone(0.08, 0.05, M.frame, x + 0.19, 1.04, z, 12);
}

export function buildFinance(g, W, D, amb, api) {
  const k = mkit(g);

  // ═════ 证券交易所（居中）═════
  {
    k.push(0, 0, -0.5, 0);
    k.box(2.95, 0.08, 1.88, M.stone, 0, 0, 0, 0.02);
    k.box(2.72, 0.08, 1.66, M.stone, 0, 0.08, 0.02, 0.015);
    for (let i = 0; i < 3; i++) k.box(1.5 - i * 0.04, 0.055, 0.13, M.stone, 0, i * 0.055, 0.95 - i * 0.1, 0.01);   // 正门台阶
    const y0 = 0.16, ch = 1.0;
    k.box(2.3, 1.1, 1.1, M.marble, 0, y0, -0.15, 0.02);                     // 殿身
    for (let i = 0; i < 6; i++) column(k, -1.05 + i * 0.42, y0, 0.6, ch, 0.07);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.box(0.1, ch, 0.1, M.marble, sx * 1.1, y0, sz * 0.4 + 0.05, 0.01); }  // 侧面壁柱
    // 大门（青铜双扇）和两侧窗
    k.box(0.5, 0.74, 0.04, M.stoneD, 0, y0, 0.405, 0);
    for (const s of [-1, 1]) { k.box(0.22, 0.7, 0.03, M.door, s * 0.115, y0, 0.425, 0); k.box(0.16, 0.26, 0.012, M.bronze, s * 0.115, y0 + 0.36, 0.445, 0); k.ball(0.014, M.gold, s * 0.04, y0 + 0.36, 0.46); }
    k.box(0.58, 0.05, 0.08, M.marble, 0, y0 + 0.75, 0.42, 0.01);
    for (const sx of [-0.7, 0.7]) {
      k.box(0.36, 0.5, 0.03, M.stoneD, sx, y0 + 0.14, 0.405, 0); k.box(0.3, 0.44, 0.03, M.glassW, sx, y0 + 0.17, 0.42, 0);
      k.box(0.014, 0.44, 0.04, M.marble, sx, y0 + 0.17, 0.425, 0); k.box(0.3, 0.014, 0.04, M.marble, sx, y0 + 0.39, 0.425, 0);
      k.box(0.42, 0.05, 0.08, M.marble, sx, y0 + 0.66, 0.42, 0.01);
    }
    // 檐部：额枋 + 带三陇板的檐壁 + 檐口
    const ey = y0 + ch + 0.085;
    k.box(2.6, 0.1, 1.56, M.marble, 0, ey, 0.04, 0.012);
    k.box(2.62, 0.14, 1.58, M.marble, 0, ey + 0.1, 0.04, 0.012);
    for (let i = 0; i < 16; i++) k.box(0.05, 0.1, 0.02, M.marbleD, -1.2 + i * 0.16, ey + 0.12, 0.84, 0);        // 三陇板
    k.box(1.9, 0.12, 0.025, M.name, 0, ey + 0.11, 0.835, 0);                                                     // 铭牌
    k.box(2.76, 0.06, 1.7, M.marble, 0, ey + 0.24, 0.04, 0.014);
    // 山花：三角形 + 凹进的山花面 + 金色徽章
    const ped = new THREE.Shape();
    ped.moveTo(-1.38, 0); ped.lineTo(1.38, 0); ped.lineTo(0, 0.42); ped.closePath();
    k.geo(new THREE.ExtrudeGeometry(ped, { depth: 0.16, bevelEnabled: false }), M.marble, 0, ey + 0.3, 0.7, undefined, undefined, [2.76, 0.42, 0.16]);
    const tym = new THREE.Shape();
    tym.moveTo(-1.15, 0); tym.lineTo(1.15, 0); tym.lineTo(0, 0.34); tym.closePath();
    k.geo(new THREE.ExtrudeGeometry(tym, { depth: 0.02, bevelEnabled: false }), M.stoneD, 0, ey + 0.32, 0.865, undefined, undefined, [2.3, 0.34, 0.02]);
    k.cyl(0.075, 0.075, 0.025, M.gold, 0, ey + 0.47, 0.885, 28, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.box(0.012, 0.05, 0.012, M.gold, Math.cos(a) * 0.12, ey + 0.47 + Math.sin(a) * 0.12, 0.89, 0, [0, 0, a - Math.PI / 2]); }
    for (const s of [-1, 1]) { const a = Math.atan2(0.42, 1.38); k.box(1.5, 0.05, 0.04, M.marble, s * 0.69, ey + 0.3 + 0.2, 0.86, 0.01, [0, 0, -s * a]); }   // 斜檐
    // 行情屏：楼顶后面一块 LED 屏
    const tick = document.createElement('canvas');
    tick.width = 1024; tick.height = 64;
    const tickTex = new THREE.CanvasTexture(tick);
    tickTex.colorSpace = THREE.SRGBColorSpace; tickTex.wrapS = THREE.RepeatWrapping; tickTex.repeat.set(0.5, 1); tickTex.anisotropy = 16;
    k.box(2.34, 0.46, 0.14, M.frame, 0, ey + 0.3, -0.58, 0.02);
    for (const s of [-1, 1]) k.cyl(0.03, 0.03, 0.3, M.frame, s * 1.0, ey + 0.24, -0.58, 8);
    k.pop();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.34), new THREE.MeshBasicMaterial({ map: tickTex, toneMapped: false }));
    screen.position.set(0, ey + 0.3 + 0.23, -0.5 - 0.58 + 0.075);
    screen.renderOrder = 1;
    g.add(screen);
    let tickKey = '';
    api.drawTicker = items => {
      const key = items.map(m => m.price).join();
      if (key === tickKey) return;
      tickKey = key;
      const c = tick.getContext('2d');
      c.fillStyle = '#0b1020'; c.fillRect(0, 0, 1024, 64);
      c.font = `bold 34px ${FONT}`; c.textBaseline = 'middle';
      let x = 12;
      items.forEach(m => {
        const h = m.hist, chg = h.length > 1 ? m.price / h[h.length - 2] - 1 : 0;
        const col = chg > 0.0005 ? '#ff4d4d' : chg < -0.0005 ? '#2ee07a' : '#d0d6e2';
        c.fillStyle = '#ffd34d'; c.fillText(m.label, x, 33); x += c.measureText(m.label).width + 8;
        c.fillStyle = col; const t = `${m.price.toFixed(1)} ${chg >= 0 ? '▲' : '▼'}${Math.abs(chg * 100).toFixed(1)}%`;
        c.fillText(t, x, 33); x += c.measureText(t).width + 26;
      });
      tickTex.needsUpdate = true;
    };
    amb.push((t, dt) => { tickTex.offset.x = (tickTex.offset.x + dt * 0.06) % 1; });
  }

  // ═════ 左后角：圆形玻璃塔 ═════
  {
    const x = -W / 2 + 0.95, z = -D / 2 + 0.85, r = 0.5, h = 3.0, y0 = 0.3, circ = Math.PI * 2 * r;
    k.push(x, 0, z, 0);
    k.cyl(0.7, 0.74, 0.3, M.stone, 0, 0, 0, 36);
    k.cyl(0.64, 0.64, 0.04, M.gold, 0, 0.3, 0, 36);
    k.geo(new THREE.CylinderGeometry(r, r * 1.02, h, 48, 1), M.curtainB, 0, y0 + h / 2, 0, undefined, undefined, [circ, h, circ]);
    for (let i = 1; i < 8; i++) k.cyl(r + 0.05, r + 0.05, 0.04, M.frame, 0, y0 + i * 0.4, 0, 48);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; k.box(0.016, h - 0.1, 0.03, M.frame, Math.cos(a) * (r + 0.012), y0 + 0.05, Math.sin(a) * (r + 0.012), 0, [0, -a + Math.PI / 2, 0]); }
    k.cyl(0.3, 0.5, 0.4, M.frame, 0, y0 + h, 0, 36);
    k.cyl(0.32, 0.32, 0.05, M.gold, 0, y0 + h + 0.4, 0, 36);
    k.cyl(0.02, 0.03, 0.7, M.frame, 0, y0 + h + 0.45, 0, 8);
    k.pop();
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }));
    beacon.position.set(x, y0 + h + 1.18, z);
    g.add(beacon);
    amb.push(t => { beacon.visible = Math.sin(t * 4) > 0; });
  }

  // ═════ 右后角：青绿色方塔（带收分）═════
  {
    k.push(W / 2 - 1.0, 0, -D / 2 + 0.8, 0);
    k.box(1.3, 0.2, 1.2, M.stone, 0, 0, 0, 0.02);
    k.box(1.0, 2.5, 0.9, M.curtainT, 0, 0.2, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 2.5, 0.07, M.frame, sx * 0.5, 0.2, sz * 0.45, 0.008);
    for (let i = 0; i < 6; i++) { k.box(1.04, 0.035, 0.94, M.frame, 0, 0.5 + i * 0.4, 0, 0); }
    for (let i = -1; i <= 1; i++) k.box(0.02, 2.4, 0.04, M.frame, i * 0.25, 0.25, 0.465, 0);
    k.box(1.1, 0.1, 1.0, M.gold, 0, 2.7, 0, 0.016);
    k.box(0.75, 0.9, 0.7, M.curtainT, 0.08, 2.8, 0, 0.012);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, 0.9, 0.05, M.frame, 0.08 + sx * 0.375, 2.8, sz * 0.35, 0.008);
    k.box(0.85, 0.1, 0.8, M.gold, 0.08, 3.7, 0, 0.016);
    k.box(0.3, 0.2, 0.3, M.frame, 0.08, 3.8, 0, 0.01);
    k.cyl(0.012, 0.012, 0.5, M.frame, 0.08, 3.8, 0, 6);
    k.pop();
  }

  // ═════ 前排：喷泉（三层水盆）═════
  {
    const fx = 0, fz = D / 2 - 0.62;
    k.push(fx, 0, fz, 0);
    k.cyl(0.9, 0.92, 0.01, M.stoneD, 0, 0.0, 0, 48);                                   // 地面的圆形铺装
    k.cyl(0.66, 0.7, 0.16, M.stone, 0, 0, 0, 40);
    k.torus(0.66, 0.035, M.stone, 0, 0.16, 0, [Math.PI / 2, 0, 0]);
    k.cyl(0.6, 0.6, 0.02, M.water, 0, 0.15, 0, 40);
    k.cyl(0.07, 0.1, 0.34, M.stone, 0, 0.16, 0, 16);
    k.lathe([[0.001, 0], [0.24, 0.0], [0.3, 0.05], [0.3, 0.075], [0.26, 0.07], [0.22, 0.03], [0.05, 0.02], [0.05, 0.0]], M.stone, 0, 0.46, 0, 32);   // 中层水盆
    k.cyl(0.05, 0.06, 0.2, M.stone, 0, 0.5, 0, 12);
    k.lathe([[0.001, 0], [0.14, 0.0], [0.17, 0.04], [0.14, 0.05], [0.04, 0.02]], M.stone, 0, 0.7, 0, 24);
    k.ball(0.04, M.gold, 0, 0.78, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.ball(0.028, M.stone, Math.cos(a) * 0.66, 0.2, Math.sin(a) * 0.66); }
    k.pop();
    const waterMat = new THREE.MeshStandardMaterial({ color: '#bff0ff', transparent: true, opacity: 0.7, roughness: 0.1 });
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 14), waterMat);
    const spray = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), waterMat);
    jet.position.set(fx, 0.9, fz); spray.position.set(fx, 0.82, fz);
    const arcs = [];
    for (let i = 0; i < 8; i++) {                                   // 外圈小水柱
      const a = (i / 8) * Math.PI * 2, m = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.24, 6), waterMat);
      m.position.set(fx + Math.cos(a) * 0.5, 0.3, fz + Math.sin(a) * 0.5); m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); arcs.push(m); g.add(m);
    }
    g.add(jet, spray);
    amb.push(t => {
      const s = 1 + Math.sin(t * 5) * 0.12;
      jet.scale.set(1, s, 1); jet.position.y = 0.88 + 0.3 * (s - 1) + 0.05;
      spray.scale.set(1, 0.6 + Math.sin(t * 5 + 1) * 0.1, 1);
      arcs.forEach((m, i) => { m.scale.y = 0.8 + 0.3 * Math.sin(t * 6 + i); });
    });
    lamp(k, fx - 1.4, D / 2 - 0.35);
    lamp(k, fx + 1.4, D / 2 - 0.35);
  }

  // ═════ 左前：青铜金牛 ═════
  {
    k.push(-2.4, 0, D / 2 - 0.65, 0.5);
    k.box(0.9, 0.1, 0.6, M.stone, 0, 0, 0, 0.02);
    k.box(0.76, 0.22, 0.46, M.stoneD, 0, 0.1, 0, 0.02);
    const by = 0.32;
    k.ball(0.17, M.bronze, 0.0, by + 0.28, 0, [1.7, 0.95, 0.9]);              // 躯干
    k.ball(0.13, M.bronze, 0.2, by + 0.34, 0, [1.0, 0.95, 0.95]);             // 肩峰
    k.ball(0.1, M.bronze, 0.4, by + 0.3, 0, [1.35, 0.95, 0.9]);               // 头
    k.ball(0.04, M.bronze, 0.5, by + 0.27, 0, [1.0, 1.0, 1.2]);
    for (const s of [-1, 1]) {
      k.torus(0.07, 0.014, M.gold, 0.4, by + 0.4, s * 0.09, [0, Math.PI / 2, 0], Math.PI * 0.8);
      k.ball(0.03, M.bronze, 0.34, by + 0.36, s * 0.12, [1.4, 0.7, 0.6]);
    }
    for (const [lx, lz] of [[0.2, 0.08], [0.2, -0.08], [-0.22, 0.09], [-0.22, -0.09]]) { k.cyl(0.04, 0.032, 0.22, M.bronze, lx, by, lz, 10); k.cyl(0.036, 0.04, 0.03, M.bronze, lx, by - 0.01, lz, 10); }
    k.cyl(0.012, 0.01, 0.3, M.bronze, -0.3, by + 0.05, 0, 6, [0, 0, 0.5]);
    k.ball(0.022, M.bronze, -0.44, by + 0.02, 0);
    k.pop();
  }

  // ═════ 右前：花坛 ═════
  {
    k.cyl(0.34, 0.36, 0.16, M.stone, 2.4, 0, D / 2 - 0.65, 28);
    k.cyl(0.29, 0.29, 0.02, M.soil, 2.4, 0.16, D / 2 - 0.65, 24);
    const b = makeBush(2); b.position.set(2.4, 0.17, D / 2 - 0.65); b.scale.setScalar(1.25); g.add(b);
  }

  k.finish();
}
