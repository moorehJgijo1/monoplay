// 四个街区的主题景观：路网围出的四块街区各有特色。
// 西北「古城」：宝塔、牌坊、灯笼、青瓦小院；东北「金融区」：证券交易所（楼顶滚动行情屏）、玻璃塔楼、金牛；
// 西南「海滨」：泻湖、灯塔、帆船、椰子树；东南「游乐园」：摩天轮、旋转木马、马戏帐篷、气球。
// 只是装饰，不影响规则。镜头在南边（+z），高的东西尽量放在街区南侧，免得挡住后面的马路。
import * as THREE from 'three';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// 在 parent 里放一个网格，返回它
function put(parent, geo, mat, x, y, z, { shadow = true, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p, w, h, d, mat, x, y, z, o) => put(p, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, o);
const cyl = (p, r1, r2, h, mat, x, y, z, seg = 16, o) => put(p, new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y + h / 2, z, o);
// 四角攒尖的屋顶（中式）
const hipRoof = (p, r, h, mat, x, y, z) => put(p, new THREE.ConeGeometry(r, h, 4), mat, x, y + h / 2, z, { ry: Math.PI / 4 });

// ---------- 地面贴图 ----------
const GROUNDS = {
  old: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d9c8a2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9a47a'; g.lineWidth = 3;
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  }, [4, 2]),
  cbd: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d5dae2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c3cad5';
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) if ((x + y) / 32 % 2) g.fillRect(x, y, 32, 32);
    g.strokeStyle = '#eef1f6'; g.lineWidth = 2;
    for (let k = 0; k <= w; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
  }, [4, 2]),
  beach: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f0dca8'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 260; k++) { g.fillStyle = Math.random() < 0.5 ? '#e4cb8f' : '#fbecc4'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [3, 3]),
  fun: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9ad97a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6e2c4';
    g.fillRect(0, 54, w, 20); g.fillRect(54, 0, 20, h);
    g.fillStyle = '#ffb3c7';
    for (let k = 0; k < w; k += 16) { g.fillRect(k, 54, 8, 3); g.fillRect(k + 8, 71, 8, 3); }
  }, [2, 2]),
};

// ---------- 西北：古城 ----------
function buildOldTown(g, W, D, amb) {
  const red = std('#b8382a'), wall = std('#efe3c8'), tile = std('#3e4b5e', { roughness: 0.6 }), gold = std('#e8b630', { metalness: 0.5, roughness: 0.35 });
  const grey = std('#9aa0a6'), wood = std('#7a4a20');
  // 宝塔：五层，南侧偏左
  const pg = new THREE.Group();
  pg.position.set(-W / 2 + 1.2, 0, D / 2 - 1.2);
  g.add(pg);
  box(pg, 1.5, 0.25, 1.5, grey, 0, 0, 0);
  let y = 0.25;
  for (let k = 0; k < 5; k++) {
    const s = 1 - k * 0.15, bw = 0.95 * s, bh = 0.5 * s;
    box(pg, bw, bh, bw, k % 2 ? wall : red, 0, y, 0);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cyl(pg, 0.04, 0.04, bh, red, dx * bw * 0.48, y, dz * bw * 0.48, 6);
    y += bh;
    hipRoof(pg, bw * 0.95, 0.28 * s, tile, 0, y - 0.04, 0);
    y += 0.18 * s;
  }
  cyl(pg, 0.03, 0.06, 0.6, gold, 0, y, 0, 8);
  put(pg, new THREE.SphereGeometry(0.09, 10, 8), gold, 0, y + 0.62, 0);
  // 牌坊：两根红柱、横梁、青瓦顶、金匾
  const ar = new THREE.Group();
  ar.position.set(0.6, 0, D / 2 - 0.55);
  g.add(ar);
  for (const sx of [-1, 1]) { cyl(ar, 0.09, 0.1, 1.6, red, sx * 0.85, 0, 0, 10); box(ar, 0.32, 0.2, 0.32, grey, sx * 0.85, 0, 0); }
  box(ar, 2.0, 0.16, 0.2, red, 0, 1.3, 0);
  box(ar, 2.3, 0.1, 0.42, tile, 0, 1.62, 0);
  hipRoof(ar, 1.35, 0.3, tile, 0, 1.68, 0).scale.set(1, 1, 0.3);
  const plaque = canvasTex(128, 48, (c, w, h) => {
    c.fillStyle = '#1d3f6e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e8b630'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#ffd34d'; c.font = `bold 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('古 城', w / 2, h / 2 + 2);
  });
  box(ar, 0.8, 0.3, 0.06, new THREE.MeshStandardMaterial({ map: plaque }), 0, 1.04, 0.07);
  // 灯笼：牌坊下挂两只，路边一排
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#c4160c', emissiveIntensity: 0.6, roughness: 0.4 });
  const lanterns = [];
  const lantern = (x, yy, z) => {
    const l = put(g, new THREE.SphereGeometry(0.13, 12, 10), lanternMat, x, yy, z);
    l.scale.set(1, 0.85, 1);
    put(g, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), gold, x, yy + 0.12, z, { shadow: false });
    lanterns.push(l);
  };
  lantern(0.6 - 0.45, 1.12, D / 2 - 0.55);
  lantern(0.6 + 0.45, 1.12, D / 2 - 0.55);
  // 青瓦小院：两座坡顶小屋 + 院墙
  const house = (x, z, rot) => {
    const h = new THREE.Group();
    h.position.set(x, 0, z);
    h.rotation.y = rot;
    g.add(h);
    box(h, 1.1, 0.55, 0.75, wall, 0, 0, 0);
    // 两坡顶：屋脊沿长边
    const tri = new THREE.Shape();
    tri.moveTo(-0.5, 0); tri.lineTo(0.5, 0); tri.lineTo(0, 0.38); tri.closePath();
    const rg = new THREE.ExtrudeGeometry(tri, { depth: 1.3, bevelEnabled: false });
    rg.translate(0, 0, -0.65);
    put(h, rg, tile, 0, 0.55, 0, { ry: Math.PI / 2 });
    box(h, 0.22, 0.36, 0.02, red, 0, 0, 0.38);
    box(h, 0.2, 0.14, 0.02, wood, -0.33, 0.25, 0.38);
    box(h, 0.2, 0.14, 0.02, wood, 0.33, 0.25, 0.38);
  };
  house(W / 2 - 1.0, -D / 2 + 0.75, 0);
  house(W / 2 - 2.5, -D / 2 + 0.75, 0);
  box(g, 3.2, 0.32, 0.1, std('#c9c2b4'), W / 2 - 1.75, 0, -D / 2 + 1.5);
  for (let k = 0; k < 4; k++) {
    const x = W / 2 - 0.6 - k * 0.75;
    cyl(g, 0.03, 0.03, 0.9, wood, x, 0, D / 2 - 0.25, 6);
    lantern(x, 0.98, D / 2 - 0.25);
  }
  // 松树
  const pineMat = std('#2f6b3e', { flatShading: true });
  const pine = (x, z, s) => {
    cyl(g, 0.05 * s, 0.07 * s, 0.4 * s, wood, x, 0, z, 6);
    put(g, new THREE.ConeGeometry(0.42 * s, 0.6 * s, 7), pineMat, x, 0.6 * s, z);
    put(g, new THREE.ConeGeometry(0.32 * s, 0.5 * s, 7), pineMat, x, 0.88 * s, z);
  };
  pine(-W / 2 + 2.6, -D / 2 + 0.6, 1.2);
  pine(-W / 2 + 0.6, -D / 2 + 0.5, 1);
  pine(-W / 2 + 3.4, D / 2 - 0.5, 0.9);
  amb.push(t => { lanternMat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.15; lanterns.forEach((l, k) => { l.rotation.z = Math.sin(t * 1.6 + k) * 0.08; }); });
}

// ---------- 东北：金融区 ----------
function buildFinance(g, W, D, amb, api) {
  const white = std('#f4f1ea'), stone = std('#d8d2c4'), gold = std('#f2c230', { metalness: 0.75, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#3d7fd6', metalness: 0.6, roughness: 0.15 });
  const glass2 = new THREE.MeshStandardMaterial({ color: '#2fb4a8', metalness: 0.55, roughness: 0.18 });
  const frame = std('#2b3442');
  // 证券交易所：古典柱廊 + 三角山花 + 楼顶滚动行情屏
  const ex = new THREE.Group();
  ex.position.set(-W / 2 + 1.75, 0, D / 2 - 1.15);
  g.add(ex);
  box(ex, 2.8, 0.12, 1.7, stone, 0, 0, 0);
  box(ex, 2.6, 0.1, 1.55, stone, 0, 0.12, 0.04);
  box(ex, 2.3, 1.15, 1.1, white, 0, 0.22, -0.15);
  for (let k = 0; k < 6; k++) cyl(ex, 0.07, 0.08, 1.05, white, -1.05 + k * 0.42, 0.22, 0.6, 12);
  box(ex, 2.5, 0.14, 1.5, white, 0, 1.27, 0.05);
  const ped = new THREE.Shape();
  ped.moveTo(-1.25, 0); ped.lineTo(1.25, 0); ped.lineTo(0, 0.4); ped.closePath();
  const pedGeo = new THREE.ExtrudeGeometry(ped, { depth: 0.2, bevelEnabled: false });
  put(ex, pedGeo, white, 0, 1.41, 0.6);
  const name = canvasTex(256, 48, (c, w, h) => {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7a5a20'; c.font = `bold 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('欢乐城证券交易所', w / 2, h / 2 + 2);
  });
  box(ex, 1.9, 0.12, 0.02, new THREE.MeshStandardMaterial({ map: name }), 0, 1.28, 0.81, { shadow: false });
  // 行情屏：一张横向循环滚动的贴图，内容随股价更新
  const tick = document.createElement('canvas');
  tick.width = 1024; tick.height = 64;
  const tickTex = new THREE.CanvasTexture(tick);
  tickTex.colorSpace = THREE.SRGBColorSpace;
  tickTex.wrapS = THREE.RepeatWrapping;
  tickTex.repeat.set(0.5, 1);
  box(ex, 2.3, 0.42, 0.12, frame, 0, 1.36, -0.55);
  const screen = put(ex, new THREE.PlaneGeometry(2.18, 0.32), new THREE.MeshBasicMaterial({ map: tickTex, toneMapped: false }), 0, 1.57, -0.485, { shadow: false });
  screen.renderOrder = 1;
  cyl(ex, 0.03, 0.03, 0.5, frame, -1.0, 1.27, -0.55, 6);
  cyl(ex, 0.03, 0.03, 0.5, frame, 1.0, 1.27, -0.55, 6);
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
  // 玻璃塔楼：一座圆塔、一座方塔，颜色和玩家的楼区分开（深蓝、青绿玻璃）
  const tower1 = new THREE.Group();
  tower1.position.set(W / 2 - 1.0, 0, -D / 2 + 0.9);
  g.add(tower1);
  cyl(tower1, 0.62, 0.68, 0.3, stone, 0, 0, 0, 20);
  cyl(tower1, 0.5, 0.55, 3.0, glass, 0, 0.3, 0, 20);
  for (let k = 1; k < 8; k++) cyl(tower1, 0.56, 0.56, 0.04, frame, 0, 0.3 + k * 0.4, 0, 20, { });
  cyl(tower1, 0.3, 0.5, 0.4, frame, 0, 3.3, 0, 20);
  cyl(tower1, 0.02, 0.03, 0.7, frame, 0, 3.7, 0, 6);
  const beacon = put(tower1, new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }), 0, 4.42, 0, { shadow: false });
  const tower2 = new THREE.Group();
  tower2.position.set(W / 2 - 2.35, 0, -D / 2 + 0.75);
  g.add(tower2);
  box(tower2, 1.0, 2.5, 0.9, glass2, 0, 0, 0);
  box(tower2, 0.75, 0.9, 0.7, glass2, 0.08, 2.5, 0);
  for (let k = 1; k < 7; k++) box(tower2, 1.02, 0.03, 0.92, frame, 0, k * 0.4, 0, { shadow: false });
  box(tower2, 0.8, 0.12, 0.75, gold, 0.08, 3.4, 0);
  // 金牛雕像
  const bull = new THREE.Group();
  bull.position.set(W / 2 - 1.1, 0, D / 2 - 0.55);
  bull.rotation.y = -0.5;
  g.add(bull);
  box(bull, 0.7, 0.25, 0.5, stone, 0, 0, 0);
  box(bull, 0.55, 0.26, 0.24, gold, 0, 0.42, 0);
  box(bull, 0.2, 0.2, 0.2, gold, 0.34, 0.5, 0);
  for (const [lx, lz] of [[0.2, 0.08], [0.2, -0.08], [-0.2, 0.08], [-0.2, -0.08]]) box(bull, 0.07, 0.18, 0.07, gold, lx, 0.25, lz);
  for (const s of [-1, 1]) box(bull, 0.04, 0.04, 0.18, gold, 0.4, 0.66, s * 0.12, { ry: s * 0.5 });
  box(bull, 0.04, 0.04, 0.2, gold, -0.3, 0.55, 0, { rz: 0.8 });
  // 方形花坛里的小树
  const leaf = std('#4caf50', { flatShading: true });
  for (const [x, z] of [[-W / 2 + 0.4, -D / 2 + 0.5], [0.0, -D / 2 + 0.5], [W / 2 - 0.3, D / 2 - 1.5]]) {
    box(g, 0.45, 0.2, 0.45, stone, x, 0, z);
    put(g, new THREE.IcosahedronGeometry(0.28, 0), leaf, x, 0.55, z);
  }
  amb.push(t => { beacon.visible = Math.sin(t * 4) > 0; });
}

// ---------- 西南：海滨 ----------
function buildBeach(g, W, D, amb) {
  const waterTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#3fb6e8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const x = (k * 37) % w, y = (k * 53) % h;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y - 5, x + 16, y); c.quadraticCurveTo(x + 24, y + 5, x + 32, y); c.stroke();
    }
  }, [3, 2]);
  // 泻湖：圆角的水面，边上一圈浅色的浪花
  const lagoon = new THREE.Shape();
  const lw = W * 0.62, ld = D * 0.6, r = 0.9;
  lagoon.moveTo(-lw / 2 + r, -ld / 2);
  lagoon.lineTo(lw / 2 - r, -ld / 2); lagoon.quadraticCurveTo(lw / 2, -ld / 2, lw / 2, -ld / 2 + r);
  lagoon.lineTo(lw / 2, ld / 2 - r); lagoon.quadraticCurveTo(lw / 2, ld / 2, lw / 2 - r, ld / 2);
  lagoon.lineTo(-lw / 2 + r, ld / 2); lagoon.quadraticCurveTo(-lw / 2, ld / 2, -lw / 2, ld / 2 - r);
  lagoon.lineTo(-lw / 2, -ld / 2 + r); lagoon.quadraticCurveTo(-lw / 2, -ld / 2, -lw / 2 + r, -ld / 2);
  const lx = -W / 2 + lw / 2 + 0.3, lz = -D / 2 + ld / 2 + 0.35;
  const foam = put(g, new THREE.ShapeGeometry(lagoon), std('#e9f8ff'), lx, 0.035, lz, { shadow: false, rx: -Math.PI / 2 });
  foam.scale.set(1.06, 1.08, 1);
  const water = put(g, new THREE.ShapeGeometry(lagoon), new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.15, metalness: 0.1 }), lx, 0.05, lz, { shadow: false, rx: -Math.PI / 2 });
  amb.push((t, dt) => { waterTex.offset.x = (waterTex.offset.x + dt * 0.02) % 1; waterTex.offset.y = Math.sin(t * 0.6) * 0.03; });
  // 帆船：在泻湖里绕圈慢慢漂
  const boats = [];
  [['#ff6b6b', 0], ['#ffd34d', Math.PI]].forEach(([col, ph]) => {
    const b = new THREE.Group();
    g.add(b);
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.6, 4, 1), std('#ffffff'));
    hull.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    hull.scale.set(1, 1, 0.45);
    hull.position.y = 0.1;
    hull.castShadow = true;
    b.add(hull);
    cyl(b, 0.015, 0.015, 0.7, std('#7a4a20'), 0, 0.12, 0, 5);
    const sail = new THREE.Shape();
    sail.moveTo(0, 0); sail.lineTo(0.32, 0); sail.lineTo(0, 0.6); sail.closePath();
    const sm = put(b, new THREE.ShapeGeometry(sail), std(col, { side: THREE.DoubleSide }), 0.02, 0.22, 0, { ry: Math.PI / 2 });
    sm.castShadow = true;
    boats.push({ b, ph });
  });
  amb.push(t => boats.forEach(({ b, ph }) => {
    const a = t * 0.18 + ph;
    b.position.set(lx + Math.cos(a) * lw * 0.28, 0.02 + Math.sin(t * 2 + ph) * 0.03, lz + Math.sin(a) * ld * 0.22);
    b.rotation.y = -a;
    b.rotation.z = Math.sin(t * 1.7 + ph) * 0.08;
  }));
  // 灯塔：南侧，红白相间，顶上的灯光会转
  const lh = new THREE.Group();
  lh.position.set(W / 2 - 0.85, 0, D / 2 - 0.9);
  g.add(lh);
  put(lh, new THREE.DodecahedronGeometry(0.55, 0), std('#8d8a83', { flatShading: true }), 0, 0.15, 0).scale.set(1.2, 0.5, 1.2);
  const stripes = ['#e8452c', '#ffffff'];
  for (let k = 0; k < 5; k++) cyl(lh, 0.3 - (k + 1) * 0.03, 0.3 - k * 0.03, 0.5, std(stripes[k % 2]), 0, 0.35 + k * 0.5, 0, 16);
  cyl(lh, 0.22, 0.22, 0.06, std('#2b3442'), 0, 2.85, 0, 16);
  const lamp = cyl(lh, 0.13, 0.13, 0.28, new THREE.MeshStandardMaterial({ color: '#fff6c2', emissive: '#ffd34d', emissiveIntensity: 1 }), 0, 2.91, 0, 12);
  lamp.castShadow = false;
  put(lh, new THREE.ConeGeometry(0.2, 0.25, 12), std('#e8452c'), 0, 3.32, 0);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -1.2, 0);
  beam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 3.05;
  beamPivot.add(beam);
  lh.add(beamPivot);
  amb.push((t, dt) => { beamPivot.rotation.y += dt * 1.2; });
  // 椰子树
  const trunk = std('#9b6b3d'), frond = std('#3fae49', { flatShading: true, side: THREE.DoubleSide });
  const palm = (x, z, lean, s) => {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.rotation.y = lean;
    p.scale.setScalar(s);
    g.add(p);
    let px = 0, py = 0;
    for (let k = 0; k < 6; k++) {
      const seg = cyl(p, 0.07 - k * 0.006, 0.08 - k * 0.006, 0.3, trunk, px, py, 0, 7);
      seg.rotation.z = -k * 0.07;
      px += Math.sin(k * 0.07) * 0.3; py += Math.cos(k * 0.07) * 0.28;
    }
    for (let k = 0; k < 6; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.2), frond);
      f.geometry.translate(0.37, 0, 0);
      const holder = new THREE.Group();
      holder.position.set(px, py + 0.05, 0);
      holder.rotation.y = k / 6 * Math.PI * 2;
      f.rotation.set(Math.PI / 2, -0.35, 0);
      f.castShadow = true;
      holder.add(f);
      p.add(holder);
    }
    put(p, new THREE.SphereGeometry(0.06, 8, 6), std('#6b4423'), px + 0.06, py - 0.06, 0.04);
  };
  palm(W / 2 - 0.75, -D / 2 + 0.85, 0.4, 1.0);
  palm(W / 2 - 1.5, -D / 2 + 0.5, 2.2, 1);
  palm(-W / 2 + 0.5, D / 2 - 0.5, -0.8, 1.05);
  palm(W / 2 - 2.2, D / 2 - 0.45, 1.4, 0.9);
  // 沙滩伞和浴巾
  const umbrella = (x, z, c1, c2) => {
    cyl(g, 0.02, 0.02, 0.75, std('#eeeeee'), x, 0, z, 5);
    const tex = canvasTex(64, 8, (c, w) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? c1 : c2; c.fillRect(k * w / 8, 0, w / 8, 8); } });
    put(g, new THREE.ConeGeometry(0.42, 0.2, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }), x, 0.8, z);
    box(g, 0.3, 0.01, 0.55, std(c1), x + 0.32, 0.03, z + 0.1, { shadow: false });
  };
  umbrella(W / 2 - 1.9, -D / 2 + 1.7, '#ff6b6b', '#ffffff');
  umbrella(-W / 2 + 1.4, D / 2 - 0.6, '#2f80ed', '#ffffff');
}

// ---------- 东南：游乐园 ----------
function buildFunPark(g, W, D, amb) {
  const white = std('#ffffff'), steel = std('#e8ecf2', { metalness: 0.4, roughness: 0.35 }), pink = std('#ff7aa8'), yellow = std('#ffd34d');
  const colors = ['#ff6b6b', '#ffd34d', '#4dabf7', '#51cf66', '#cc5de8', '#ff922b', '#22b8cf', '#f06595'];
  // 摩天轮：南侧，绕 x 轴转，座舱始终保持朝下
  const fw = new THREE.Group();
  fw.position.set(W / 2 - 1.4, 0, D / 2 - 0.9);
  fw.rotation.y = -0.35;
  g.add(fw);
  const R = 1.35, H = 1.75;
  for (const sz of [-0.28, 0.28]) {
    for (const sx of [-1, 1]) {
      const leg = cyl(fw, 0.04, 0.05, Math.hypot(0.75, H), steel, sx * 0.375, 0, sz, 8);
      leg.rotation.z = sx * Math.atan2(0.75, H);
      leg.position.y = H / 2;
    }
  }
  box(fw, 2.1, 0.12, 0.9, std('#adb5bd'), 0, 0, 0);
  const wheel = new THREE.Group();
  wheel.position.set(0, H, 0);
  fw.add(wheel);
  const ringMat = std('#f03e3e', { metalness: 0.3, roughness: 0.4 });
  for (const sz of [-0.14, 0.14]) put(wheel, new THREE.TorusGeometry(R, 0.035, 8, 40), ringMat, 0, 0, sz);
  put(wheel, new THREE.CylinderGeometry(0.1, 0.1, 0.62, 12), steel, 0, 0, 0, { rx: Math.PI / 2 });
  const cars = [];
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    const sp = put(wheel, new THREE.CylinderGeometry(0.015, 0.015, R, 4), steel, Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, { shadow: false });
    sp.rotation.z = a - Math.PI / 2;
    const car = new THREE.Group();
    car.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    wheel.add(car);
    box(car, 0.26, 0.22, 0.24, std(colors[k]), 0, -0.3, 0);
    box(car, 0.3, 0.04, 0.28, white, 0, -0.08, 0);
    cyl(car, 0.01, 0.01, 0.1, steel, 0, -0.1, 0, 4);
    cars.push(car);
  }
  amb.push((t, dt) => { wheel.rotation.z += dt * 0.25; cars.forEach(c => { c.rotation.z = -wheel.rotation.z; }); });
  // 旋转木马：条纹圆锥顶，木马上下起伏
  const cr = new THREE.Group();
  cr.position.set(-W / 2 + 1.25, 0, D / 2 - 1.1);
  g.add(cr);
  cyl(cr, 0.95, 1.0, 0.16, std('#ffe8a3'), 0, 0, 0, 24);
  cyl(cr, 0.08, 0.08, 1.2, yellow, 0, 0.16, 0, 10);
  const roofTex = canvasTex(256, 16, (c, w) => { for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? '#ff6b6b' : '#ffffff'; c.fillRect(k * w / 16, 0, w / 16, 16); } });
  put(cr, new THREE.ConeGeometry(1.08, 0.55, 24), new THREE.MeshStandardMaterial({ map: roofTex }), 0, 1.6, 0);
  cyl(cr, 1.06, 1.06, 0.14, pink, 0, 1.26, 0, 24);
  put(cr, new THREE.SphereGeometry(0.09, 10, 8), yellow, 0, 1.92, 0);
  const spin = new THREE.Group();
  cr.add(spin);
  const horses = [];
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, x = Math.cos(a) * 0.68, z = Math.sin(a) * 0.68;
    cyl(spin, 0.015, 0.015, 1.1, steel, x, 0.16, z, 5, { shadow: false });
    const h = new THREE.Group();
    h.position.set(x, 0.5, z);
    h.rotation.y = -a;
    spin.add(h);
    const hm = std(colors[k]);
    box(h, 0.08, 0.14, 0.32, hm, 0, 0, 0);
    box(h, 0.07, 0.16, 0.08, hm, 0, 0.12, 0.17);
    for (const [lx, lz] of [[0.025, 0.1], [-0.025, 0.1], [0.025, -0.1], [-0.025, -0.1]]) box(h, 0.03, 0.12, 0.03, hm, lx, -0.12, lz, { shadow: false });
    horses.push(h);
  }
  amb.push((t, dt) => { spin.rotation.y += dt * 0.7; horses.forEach((h, k) => { h.position.y = 0.5 + Math.sin(t * 2.4 + k * 1.3) * 0.1; }); });
  // 马戏帐篷
  const tent = new THREE.Group();
  tent.position.set(-W / 2 + 1.0, 0, -D / 2 + 0.9);
  g.add(tent);
  const tentTex = canvasTex(256, 16, (c, w) => { for (let k = 0; k < 12; k++) { c.fillStyle = k % 2 ? '#4dabf7' : '#ffffff'; c.fillRect(k * w / 12, 0, w / 12, 16); } });
  const tentMat = new THREE.MeshStandardMaterial({ map: tentTex });
  cyl(tent, 0.75, 0.75, 0.55, tentMat, 0, 0, 0, 24);
  put(tent, new THREE.ConeGeometry(0.85, 0.75, 24), tentMat, 0, 0.92, 0);
  cyl(tent, 0.015, 0.015, 0.4, steel, 0, 1.28, 0, 4);
  box(tent, 0.26, 0.18, 0.01, std('#ff6b6b', { side: THREE.DoubleSide }), 0.14, 1.48, 0, { shadow: false });
  box(tent, 0.3, 0.4, 0.02, std('#3b2614'), 0, 0, 0.75);
  // 气球：一簇彩色气球上下飘
  const balloons = new THREE.Group();
  balloons.position.set(W / 2 - 0.6, 0, -D / 2 + 0.7);
  g.add(balloons);
  box(balloons, 0.35, 0.4, 0.3, std('#ffe8a3'), 0, 0, 0);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2, bx = Math.cos(a) * 0.22, bz = Math.sin(a) * 0.22, by = 1.25 + (k % 3) * 0.16;
    put(balloons, new THREE.SphereGeometry(0.13, 12, 10), std(colors[k], { roughness: 0.3 }), bx, by, bz).scale.set(1, 1.15, 1);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, by - 0.4, 3), std('#888'));
    line.position.set(bx / 2, 0.4 + (by - 0.4) / 2, bz / 2);
    line.rotation.set(bz * 0.5, 0, -bx * 0.5);
    balloons.add(line);
  }
  amb.push(t => { balloons.children.forEach((c, k) => { if (k) c.position.y += Math.sin(t * 2 + k) * 0.0012; }); balloons.rotation.y = Math.sin(t * 0.5) * 0.2; });
  // 冰淇淋车
  const truck = new THREE.Group();
  truck.position.set(0.2, 0, -D / 2 + 0.75);
  g.add(truck);
  box(truck, 0.75, 0.4, 0.4, std('#ffc9de'), 0, 0.08, 0);
  box(truck, 0.3, 0.25, 0.38, std('#ffffff'), 0.25, 0.48, 0);
  for (const [wx, wz] of [[0.25, 0.2], [-0.25, 0.2], [0.25, -0.2], [-0.25, -0.2]]) cyl(truck, 0.07, 0.07, 0.05, std('#333'), wx, 0.04, wz, 10, { rx: Math.PI / 2 });
  put(truck, new THREE.ConeGeometry(0.08, 0.2, 10), std('#e0a458'), -0.15, 0.6, 0, { rx: Math.PI });
  put(truck, new THREE.SphereGeometry(0.09, 10, 8), pink, -0.15, 0.73, 0);
}

const THEMES = [
  { key: 'old', name: '古城区', build: buildOldTown },
  { key: 'cbd', name: '金融区', build: buildFinance },
  { key: 'beach', name: '海滨区', build: buildBeach },
  { key: 'fun', name: '游乐园', build: buildFunPark },
];

// blocks：路网围出的街区，每个是 { cells:[[x,z]...], free:{x0,x1,z0,z1}（街区里最大的一块空地，格子坐标）}
// world(x, z)：格子坐标 → 世界坐标；U：格子间距
export function buildDistricts(scene, blocks, world, U) {
  const ambient = [];
  const api = { drawTicker: null };
  // 按位置排：先北后南，先西后东 → 西北、东北、西南、东南
  const sorted = blocks.slice().sort((a, b) => (a.cz - b.cz) || (a.cx - b.cx));
  sorted.forEach((b, k) => {
    const th = THEMES[k % THEMES.length];
    // 整个街区铺上主题地面（比街区略小一圈，留出路边的绿化带）
    const p0 = world(b.x0, b.z0), p1 = world(b.x1, b.z1);
    const gw = p1.x - p0.x + U * 0.78, gd = p1.z - p0.z + U * 0.78;
    const tex = GROUNDS[th.key].clone();
    tex.needsUpdate = true;
    tex.repeat.set(gw / 2.5, gd / 2.5);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((p0.x + p1.x) / 2, 0.02, (p0.z + p1.z) / 2);
    ground.receiveShadow = true;
    scene.add(ground);
    // 地标放在最大的那块空地上
    const f = b.free, q0 = world(f.x0, f.z0), q1 = world(f.x1, f.z1);
    const W = q1.x - q0.x + U, D = q1.z - q0.z + U;
    const g = new THREE.Group();
    g.position.set((q0.x + q1.x) / 2, 0, (q0.z + q1.z) / 2);
    scene.add(g);
    th.build(g, W, D, ambient, api);
  });
  return {
    tick(t, dt) { for (const f of ambient) f(t, dt); },
    // items：[{ label, price, hist }]，画到证券交易所楼顶的行情屏上
    setMarket(items) { if (api.drawTicker) api.drawTicker(items); },
  };
}
