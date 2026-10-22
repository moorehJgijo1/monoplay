// 3D 棋盘：用 Three.js 渲染城市路网、地产楼房、棋子与特效。
// 只负责“画”，不含任何规则；由 app.js 把要展示的状态和动画指令交给它。
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import * as CANNON from './vendor/cannon-es.js';

const U = 2; // 相邻路口的间距
const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const TYPE_STYLE = {
  start: ['#ffd34d', '🏁'], chance: ['#ffb340', '❓'], destiny: ['#b388ff', '🔮'], news: ['#74b9ff', '📰'],
  shop: ['#55efc4', '🏪'], wheel: ['#fd79a8', '🎡'], casino: ['#ff7675', '🎰'], points: ['#ffeaa7', '🎟️'],
  tax: ['#b2bec3', '🧾'], police: ['#7f9cf5', '👮'], jail: ['#a4a4a4', '🚔'], hospital: ['#ffffff', '🏥'], park: ['#7bed9f', '🌳'],
};
const LEVEL_COLORS = { glass: '#8fd0ff', wall: '#fbf8f1' };

function easeOutBack(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas: c, ctx: c.getContext('2d'), tex };
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });

const emojiCache = new Map();
function emojiTexture(emoji) {
  if (emojiCache.has(emoji)) return emojiCache.get(emoji);
  const { ctx, tex } = makeCanvas(128, 128);
  ctx.font = `96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 72);
  emojiCache.set(emoji, tex);
  return tex;
}
function emojiSprite(emoji, size = 1, onTop = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji), depthTest: !onTop, transparent: true }));
  s.scale.set(size, size, 1);
  if (onTop) s.renderOrder = 10;
  return s;
}
function textSprite(text, bg, fg = '#fff', height = 0.55) {
  const { canvas, ctx, tex } = makeCanvas(512, 128);
  ctx.font = `bold 64px ${FONT}`;
  const w = Math.min(500, ctx.measureText(text).width + 56);
  canvas.width = w;
  ctx.font = `bold 64px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  roundRect(ctx, 4, 8, w - 8, 112, 40);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.fillText(text, w / 2, 68);
  tex.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(height * w / 128, height, 1);
  s.renderOrder = 11;
  return s;
}

export function createBoard3D(container, E, opts = {}) {
  const { BOARD, ADJ, MAP_W, MAP_H, GROUPS, CHARACTERS, LANDS } = E;

  // ---------- 场景基础 ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#aee0ff');
  scene.fog = new THREE.Fog('#aee0ff', 70, 150);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 70;
  controls.maxPolarAngle = 1.25;
  controls.minPolarAngle = 0.35;

  scene.add(new THREE.HemisphereLight('#ffffff', '#7a9a5a', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.8);
  sun.position.set(-18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 20, bottom: -20, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const world = (x, z) => new THREE.Vector3((x - (MAP_W - 1) / 2) * U, 0, (z - (MAP_H - 1) / 2) * U);
  const cellPos = i => world(BOARD[i].x, BOARD[i].z);
  const center = new THREE.Vector3(0, 0, 0);
  const rng = (() => { let t = 12345; return () => { t = (t * 1103515245 + 12345) & 0x7fffffff; return t / 0x7fffffff; }; })();

  // ---------- 地面、街区装饰 ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W * U + 70, MAP_H * U + 70), std('#8fd16f'));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 道路：相邻路口之间铺沥青
  const roadMat = std('#5f6b78');
  const lineMat = std('#f5f1e6');
  for (let a = 0; a < BOARD.length; a++) {
    for (const b of ADJ[a]) {
      if (b < a) continue;
      const pa = cellPos(a), pb = cellPos(b), mid = pa.clone().add(pb).multiplyScalar(0.5);
      const horiz = BOARD[a].z === BOARD[b].z;
      const road = new THREE.Mesh(new THREE.BoxGeometry(horiz ? U : U * 0.72, 0.1, horiz ? U * 0.72 : U), roadMat);
      road.position.set(mid.x, 0.05, mid.z);
      road.receiveShadow = true;
      scene.add(road);
      const line = new THREE.Mesh(new THREE.BoxGeometry(horiz ? U * 0.3 : 0.06, 0.02, horiz ? 0.06 : U * 0.3), lineMat);
      line.position.set(mid.x, 0.11, mid.z);
      scene.add(line);
    }
  }

  // 地产地块的朝向：朝向路网外侧或街区内部的空地，且不和别的地块重叠
  const occupied = new Set(BOARD.map(c => c.x + ',' + c.z));
  const usedLots = new Set();
  const lotDir = {};
  LANDS.forEach(i => {
    const c = BOARD[i];
    const horizontal = ADJ[i].some(n => BOARD[n].z === c.z);
    const dirs = horizontal ? [[0, -1], [0, 1]] : [[1, 0], [-1, 0]];
    const outside = ([dx, dz]) => c.x + dx < 0 || c.x + dx >= MAP_W || c.z + dz < 0 || c.z + dz >= MAP_H;
    dirs.sort((a, b) => outside(b) - outside(a));
    const d = dirs.find(([dx, dz]) => !occupied.has((c.x + dx) + ',' + (c.z + dz)) && !usedLots.has((c.x + dx) + ',' + (c.z + dz))) || dirs[0];
    usedLots.add((c.x + d[0]) + ',' + (c.z + d[1]));
    lotDir[i] = d;
  });

  // 树
  const trunkMat = std('#8b5a2b'), leafMats = ['#3fae49', '#57c75e', '#2e8b57', '#6bcf63'].map(c => std(c, { flatShading: true }));
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6), leafGeo = new THREE.IcosahedronGeometry(0.45, 0);
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.y = 0.3;
    const l = new THREE.Mesh(leafGeo, leafMats[Math.floor(rng() * leafMats.length)]);
    l.position.y = 0.85;
    l.scale.set(1, 1.25, 1);
    [t, l].forEach(m => { m.castShadow = true; g.add(m); });
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
  }
  // 路边只种矮灌木，离路远的地方才种树；镜头一侧（南边）留空，免得挡住视线
  const bushGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const nearRoad = (x, z) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => occupied.has((x + dx) + ',' + (z + dz)));
  for (let z = -5; z < MAP_H + 5; z++) {
    for (let x = -5; x < MAP_W + 5; x++) {
      const key = x + ',' + z;
      if (occupied.has(key) || usedLots.has(key)) continue;
      const inside = x >= 0 && x < MAP_W && z >= 0 && z < MAP_H;
      const p = world(x, z);
      if (inside || nearRoad(x, z)) {
        if (rng() < 0.55) {
          const b = new THREE.Mesh(bushGeo, leafMats[Math.floor(rng() * leafMats.length)]);
          b.position.set(p.x + (rng() - 0.5) * U * 0.5, 0.2, p.z + (rng() - 0.5) * U * 0.5);
          b.scale.set(1, 0.8, 1);
          b.castShadow = true;
          scene.add(b);
        }
        if (inside && !nearRoad(x, z)) tree(p.x, p.z, 0.8);
        continue;
      }
      if (z >= MAP_H && z < MAP_H + 3) continue;
      if (Math.abs(x - MAP_W / 2) + Math.abs(z - MAP_H / 2) < 4) continue;
      if (rng() < 0.55) tree(p.x + (rng() - 0.5) * U * 0.7, p.z + (rng() - 0.5) * U * 0.7, 0.8 + rng() * 0.5);
    }
  }
  // 远处的城市背景
  const farMats = ['#c9d6e3', '#b8c6d9', '#d8e0ea', '#aebfd4'].map(c => std(c));
  for (let k = 0; k < 70; k++) {
    const ang = rng() * Math.PI * 2, r = 34 + rng() * 22;
    const h = 2 + rng() * 9;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2 + rng() * 2, h, 2 + rng() * 2), farMats[k % farMats.length]);
    b.position.set(Math.cos(ang) * r * 1.2, h / 2, Math.sin(ang) * r);
    scene.add(b);
  }
  // 中央公园的喷泉
  const park = BOARD.findIndex(c => c.type === 'park');
  if (park >= 0) {
    const pp = cellPos(park);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.12, 20), std('#4fc3f7', { roughness: 0.2 }));
      pond.position.set(pp.x + sx * U * 0.75, 0.06, pp.z + sz * U * 0.75);
      scene.add(pond);
    });
  }

  // ---------- 路口格子 ----------
  const tileGeo = new THREE.BoxGeometry(U * 0.9, 0.3, U * 0.9);
  const tileSide = std('#e9e2d0');
  const tiles = BOARD.map((c, i) => {
    const top = makeCanvas(256, 256);
    const mesh = new THREE.Mesh(tileGeo, [tileSide, tileSide, new THREE.MeshStandardMaterial({ map: top.tex, roughness: 0.8 }), tileSide, tileSide, tileSide]);
    const p = cellPos(i);
    mesh.position.set(p.x, 0.15, p.z);
    mesh.receiveShadow = true;
    mesh.userData.cell = i;
    scene.add(mesh);
    // 高亮层（可选目标、走过的轨迹）
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(U * 0.94, U * 0.94), new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(p.x, 0.32, p.z);
    glow.userData.cell = i;
    scene.add(glow);
    return { mesh, top, glow, key: '', trail: 0 };
  });

  function drawTile(i, s) {
    const c = BOARD[i], t = tiles[i];
    let key;
    if (c.type === 'land') {
      const ld = s.lands[i], owner = ld.owner !== null ? s.players[ld.owner] : null;
      key = `${owner ? owner.color : ''}|${ld.level}|${owner ? E.rentFor(s, i) : c.price}`;
    } else key = c.type;
    if (t.key === key) return;
    t.key = key;
    const g = t.top.ctx;
    g.clearRect(0, 0, 256, 256);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (c.type === 'land') {
      const ld = s.lands[i], owner = ld.owner !== null ? s.players[ld.owner] : null;
      // 无主的地是中性的石板色；只有被买下后才染成地主的颜色（颜色只用来区分玩家）
      const grp = GROUPS[c.group];
      g.fillStyle = owner ? owner.color : '#f1ece0';
      g.fillRect(0, 0, 256, 256);
      if (owner) { g.fillStyle = 'rgba(255,255,255,.72)'; g.fillRect(14, 14, 228, 228); }
      g.fillStyle = owner ? owner.color : '#5b6472';
      g.fillRect(0, 0, 256, 78);
      g.fillStyle = '#fff';
      g.font = `bold ${c.name.length > 2 ? 46 : 54}px ${FONT}`;
      g.fillText(c.name, 128, 42);
      g.fillStyle = owner ? '#222' : '#6b5a45';
      g.font = `bold 34px ${FONT}`;
      g.fillText(`${grp.name} · ${owner ? '过路费' : '地价'}`, 128, 118);
      g.font = `bold 50px ${FONT}`;
      const v = owner ? E.rentFor(s, i) : c.price;
      g.fillText(v >= 10000 ? '¥' + (v / 10000).toFixed(1).replace(/\.0$/, '') + '万' : '¥' + v.toLocaleString('en-US'), 128, 170);
      if (owner) {
        g.font = `40px ${FONT}`;
        g.fillStyle = '#f0a500';
        g.fillText('★'.repeat(ld.level) + '☆'.repeat(5 - ld.level), 128, 222);
      }
    } else {
      // 特殊格子只带一点淡淡的底色，主要靠图标区分，避免和玩家颜色混淆
      const [bg, icon] = TYPE_STYLE[c.type] || ['#eee', '❔'];
      g.fillStyle = '#f7f3ea';
      g.fillRect(0, 0, 256, 256);
      g.globalAlpha = 0.28;
      g.fillStyle = bg;
      g.fillRect(0, 0, 256, 256);
      g.globalAlpha = 1;
      g.font = `110px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",${FONT}`;
      g.fillText(icon, 128, 108);
      g.fillStyle = '#2d1e10';
      g.font = `bold ${c.name.length > 3 ? 40 : 48}px ${FONT}`;
      g.fillText(c.name, 128, 212);
    }
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.lineWidth = 8;
    g.strokeRect(4, 4, 248, 248);
    t.top.tex.needsUpdate = true;
  }

  // ---------- 地块与楼房 ----------
  const winTex = (() => {
    const { ctx, tex } = makeCanvas(64, 64);
    ctx.fillStyle = '#fbf8f1';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#7cc4f2';
    for (let y = 6; y < 64; y += 20) for (let x = 6; x < 64; x += 20) ctx.fillRect(x, y, 12, 12);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  })();
  const glassTex = (() => {
    const { ctx, tex } = makeCanvas(64, 64);
    ctx.fillStyle = '#8fd0ff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#d9f1ff';
    for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 3);
    for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 2, 64);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  })();
  function texMat(base, rx, ry) {
    const t = base.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
  }

  const lots = {};
  LANDS.forEach(i => {
    const [dx, dz] = lotDir[i], p = cellPos(i);
    const lc = new THREE.Vector3(p.x + dx * U * 0.95, 0, p.z + dz * U * 0.95);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(U * 0.86, 0.14, U * 0.86), std('#d9d1bf'));
    plate.position.set(lc.x, 0.07, lc.z);
    plate.receiveShadow = true;
    plate.userData.cell = i;
    scene.add(plate);
    const holder = new THREE.Group();
    holder.position.set(lc.x, 0.14, lc.z);
    holder.rotation.y = Math.atan2(-dx, -dz); // 正面（+z）朝向马路
    scene.add(holder);
    lots[i] = { holder, plate, center: lc, key: null, building: null };
  });

  // 各等级的建筑。局部坐标里 +z 是正面（朝马路），屋顶、阳台、雨棚、楼冠用地主的颜色
  const darkMat = std('#36414f'), doorMat = std('#8b5a2b'), stoneMat = std('#d9d2c3'), metalMat = std('#cfd6dd', { metalness: 0.6, roughness: 0.35 });
  function gable(w, h, d, mat) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2); // 三角形山墙朝向正面（马路），屋脊前后走向
    return new THREE.Mesh(geo, mat);
  }
  function makeBuilding(level, color) {
    const g = new THREE.Group();
    const roof = std(color, { roughness: 0.55 });
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
    const box = (w, h, d, mat, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y + h / 2, z);
    const windowsFront = (w, y, z, n) => { for (let k = 0; k < n; k++) box(0.16, 0.18, 0.02, darkMat, -w / 2 + (k + 0.5) * (w / n), y, z); };
    let top = 0;
    if (level === 0) {
      // 小木屋
      box(0.8, 0.5, 0.7, std('#d9a066'), 0, 0, 0);
      add(gable(0.92, 0.42, 0.82, roof), 0, 0.5, 0);
      box(0.2, 0.32, 0.02, doorMat, 0, 0, 0.36);
      top = 0.92;
    } else if (level === 1) {
      // 平房：烟囱、窗户
      box(1.15, 0.65, 0.9, std('#fbf8f1'), 0, 0, 0);
      add(gable(1.3, 0.5, 1.02, roof), 0, 0.65, 0);
      box(0.14, 0.4, 0.14, std('#b5651d'), 0.35, 0.8, -0.15);
      box(0.22, 0.38, 0.02, doorMat, 0, 0, 0.46);
      windowsFront(1.15, 0.28, 0.46, 3);
      top = 1.15;
    } else if (level === 2) {
      // 洋房：两层、阳台
      box(1.2, 1.3, 1.0, std('#fff3dc'), 0, 0, 0);
      add(gable(1.38, 0.62, 1.14, roof), 0, 1.3, 0);
      box(0.9, 0.06, 0.25, roof, 0, 0.68, 0.62);
      box(0.9, 0.18, 0.03, std('#ffffff'), 0, 0.74, 0.74);
      box(0.24, 0.42, 0.02, doorMat, 0, 0, 0.51);
      windowsFront(1.2, 0.28, 0.51, 4);
      windowsFront(1.2, 0.95, 0.51, 3);
      top = 1.92;
    } else if (level === 3) {
      // 公寓：平顶、水塔、雨棚
      box(1.2, 2.2, 1.1, texMat(winTex, 2, 4), 0, 0, 0);
      box(1.3, 0.14, 1.2, roof, 0, 2.2, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 12), metalMat), -0.3, 2.52, -0.2);
      box(0.6, 0.06, 0.3, roof, 0, 0.5, 0.68);
      box(0.3, 0.45, 0.02, darkMat, 0, 0, 0.56);
      top = 2.75;
    } else if (level === 4) {
      // 大厦：裙楼、玻璃塔楼、楼冠、天线
      box(1.45, 0.55, 1.35, roof, 0, 0, 0);
      box(1.15, 2.9, 1.1, texMat(glassTex, 2, 6), 0, 0.55, 0);
      box(1.25, 0.3, 1.2, roof, 0, 3.45, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), metalMat), 0.3, 4.15, 0);
      box(0.5, 0.35, 0.02, darkMat, 0, 0, 0.68);
      top = 3.75;
    } else if (level === 5) {
      // 摩天楼：三段收分、尖顶、航空灯
      box(1.5, 0.8, 1.45, stoneMat, 0, 0, 0);
      box(1.5, 0.12, 1.45, roof, 0, 0.8, 0);
      box(1.15, 2.6, 1.1, texMat(glassTex, 2, 6), 0, 0.92, 0);
      box(1.22, 0.14, 1.17, roof, 0, 3.52, 0);
      box(0.85, 1.7, 0.82, texMat(glassTex, 2, 4), 0, 3.66, 0);
      const crown = add(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.9, 4), roof), 0, 5.81, 0);
      crown.rotation.y = Math.PI / 4;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 1.0, 6), metalMat), 0, 6.75, 0);
      const light = add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3b3b' })), 0, 7.28, 0);
      light.userData.blink = true;
      box(0.6, 0.5, 0.02, darkMat, 0, 0, 0.73);
      top = 6.3;
    }
    // 小旗子
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), std('#666')), 0.62, 0.3, 0.62);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.02), roof), 0.79, 0.5, 0.62);
    g.userData.top = top;
    return g;
  }
  // 待售牌：中性的木牌，所有空地共用一张贴图
  const saleMats = (() => {
    const { ctx, tex } = makeCanvas(128, 64);
    ctx.fillStyle = '#ecdcb8';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 58);
    ctx.fillStyle = '#5a3a1a';
    ctx.font = `bold 38px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('待售', 64, 34);
    tex.needsUpdate = true;
    const wood = std('#c9a26b');
    return [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex }), wood];
  })();
  function saleSign() {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), std('#8b5a2b'));
    post.position.y = 0.4;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 0.04), saleMats);
    board.position.y = 0.85;
    [post, board].forEach(m => { m.castShadow = true; g.add(m); });
    return g;
  }

  const anims = [];
  function animate(ms, update) {
    return new Promise(resolve => anims.push({ t0: performance.now(), ms: Math.max(ms, 1), update, resolve }));
  }

  function setLot(i, s) {
    const ld = s.lands[i], lot = lots[i];
    const owner = ld.owner !== null ? s.players[ld.owner] : null;
    const key = owner ? `${owner.color}|${ld.level}` : 'none';
    if (lot.key === key) return;
    const first = lot.key === null;
    const grew = !first && owner && (!lot.prev || ld.level > lot.prev.level || lot.prev.owner !== ld.owner);
    lot.key = key;
    lot.prev = { level: ld.level, owner: ld.owner };
    lot.holder.clear();
    lot.plate.material.color.set(owner ? new THREE.Color(owner.color).lerp(new THREE.Color('#ffffff'), 0.72) : '#d9d1bf');
    const b = owner ? makeBuilding(ld.level, owner.color) : saleSign();
    lot.blink = null;
    b.traverse(o => { o.userData.cell = i; if (o.userData.blink) lot.blink = o; });
    if (!owner) b.rotation.y = -lot.holder.rotation.y; // 待售牌始终朝向镜头一侧
    lot.holder.add(b);
    if (grew) {
      b.scale.set(1, 0.01, 1);
      animate(700, t => b.scale.set(1, Math.max(0.01, easeOutBack(t)), 1));
    }
  }

  // ---------- 神仙与障碍 ----------
  const markers = {};
  function syncMarkers(s) {
    const want = {};
    Object.entries(s.gods).forEach(([c, g]) => { want[c + ':god'] = [Number(c), E.GODS[g].emoji, 'god']; });
    Object.entries(s.obstacles).forEach(([c, o]) => { want[c + ':ob'] = [Number(c), o === 'mine' ? '💣' : '🚧', 'ob']; });
    Object.keys(markers).forEach(k => {
      if (!want[k] || want[k][1] !== markers[k].emoji) { scene.remove(markers[k].sprite); delete markers[k]; }
    });
    Object.entries(want).forEach(([k, [c, emoji, kind]]) => {
      if (markers[k]) return;
      const sp = emojiSprite(emoji, kind === 'god' ? 1.3 : 1.1);
      const p = cellPos(c);
      sp.position.set(p.x + (kind === 'god' ? 0.35 : -0.35), kind === 'god' ? 1.4 : 0.75, p.z);
      scene.add(sp);
      markers[k] = { sprite: sp, emoji, kind, base: sp.position.y, phase: rng() * 6 };
    });
  }

  // ---------- 棋子 ----------
  let pieces = [];
  const OFFSETS = {
    1: [[0, 0]], 2: [[-0.22, 0], [0.22, 0]], 3: [[-0.22, -0.18], [0.22, -0.18], [0, 0.22]],
    4: [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.22], [0.22, 0.22]],
    5: [[-0.27, -0.2], [0, -0.2], [0.27, -0.2], [-0.14, 0.22], [0.14, 0.22]],
    6: [[-0.27, -0.2], [0, -0.2], [0.27, -0.2], [-0.27, 0.22], [0, 0.22], [0.27, 0.22]],
  };
  let posArr = [], alive = [];
  function makePiece(p) {
    const g = new THREE.Group();
    const col = new THREE.Color(p.color);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.16, 24), std(col.clone().multiplyScalar(0.75)));
    base.position.y = 0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 0.8, 20), std(col, { roughness: 0.45 }));
    body.position.y = 0.56;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.06, 8, 20), std('#ffffff'));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.96;
    [base, body, collar].forEach(m => { m.castShadow = true; g.add(m); });
    const head = emojiSprite(CHARACTERS[p.char].emoji, 1.25);
    head.position.y = 1.5;
    g.add(head);
    const tag = textSprite(p.name, p.color, '#fff', 0.5);
    tag.position.y = 2.45;
    g.add(tag);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 4), std('#ffd43b', { emissive: '#ffb300', emissiveIntensity: 0.6 }));
    arrow.rotation.x = Math.PI;
    arrow.position.y = 3.2;
    arrow.visible = false;
    g.add(arrow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 40), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.visible = false;
    g.add(ring);
    const bubble = emojiSprite('💭', 0.8);
    bubble.position.set(0.75, 2.0, 0);
    bubble.visible = false;
    g.add(bubble);
    scene.add(g);
    return { group: g, head, tag, arrow, ring, bubble, moving: false };
  }
  function pieceTarget(k) {
    const cell = posArr[k];
    const same = alive.map((a, j) => j).filter(j => alive[j] && posArr[j] === cell);
    const off = (OFFSETS[same.length] || OFFSETS[6])[Math.max(0, same.indexOf(k))] || [0, 0];
    const p = cellPos(cell);
    return new THREE.Vector3(p.x + off[0] * U, 0.3, p.z + off[1] * U);
  }

  // ---------- 相机 ----------
  let viewMode = 'follow', focus = null;
  camera.position.set(0, 15, 15);
  controls.target.set(0, 0, 0);
  // 竖屏（手机）时视野窄，镜头要拉远一些
  const viewDist = mode => (mode === 'follow' ? 19 : 44) * Math.max(1, 1.25 / Math.max(camera.aspect, 0.3));
  function setView(mode) {
    viewMode = mode;
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).add(dir.multiplyScalar(viewDist(mode)));
  }

  // ---------- 选格高亮、岔路箭头、特效 ----------
  let selectable = null;
  let highlight = null;
  let forkArrows = [];
  let forkHits = [];
  let forkCells = null;
  let onFork = null;
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  // cellMap：格子 → 方向。点到某条路上的任何格子（或它的地块）都算选了那个方向
  function setFork(options, from, cb, cellMap) {
    [...forkArrows, ...forkHits].forEach(a => scene.remove(a));
    forkArrows = [];
    forkHits = [];
    onFork = cb || null;
    forkCells = cellMap || null;
    if (!options) return;
    const fp = cellPos(from);
    options.forEach(o => {
      const p = cellPos(o);
      const g = new THREE.Group();
      const mat = std('#ffd43b', { emissive: '#ff9f00', emissiveIntensity: 0.7 });
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.7), mat);
      shaft.position.z = 0.15;
      const headM = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 4), mat);
      headM.rotation.x = -Math.PI / 2;
      headM.rotation.y = Math.PI / 4;
      headM.position.z = -0.45;
      g.add(shaft, headM);
      g.traverse(m => { m.userData.fork = o; m.castShadow = true; });
      g.scale.setScalar(1.6);
      g.position.set(p.x, 1.1, p.z);
      g.rotation.y = Math.atan2(-(p.x - fp.x), -(p.z - fp.z));
      g.userData.base = g.position.clone();
      scene.add(g);
      forkArrows.push(g);
      // 看不见但很大的点击区域，盖住整个路口格子和箭头
      const hit = new THREE.Mesh(new THREE.BoxGeometry(U * 0.98, 2.6, U * 0.98), hitMat);
      hit.position.set(p.x, 1.3, p.z);
      hit.userData.fork = o;
      scene.add(hit);
      forkHits.push(hit);
    });
  }

  const effects = [];
  function ringBurst(i, color) {
    const p = cellPos(i);
    const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 40), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.35, p.z);
    scene.add(m);
    animate(900, t => { m.scale.setScalar(1 + t * 1.8); m.material.opacity = 1 - t; if (t >= 1) scene.remove(m); });
  }
  function floatText(pos, text, bg) {
    const sp = textSprite(text, bg, '#fff', 0.6);
    sp.position.copy(pos);
    scene.add(sp);
    animate(1600, t => { sp.position.y = pos.y + t * 1.5; sp.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; if (t >= 1) scene.remove(sp); });
  }
  function flash(i, kind, color) {
    if (kind === 'trail') { tiles[i].trail = 1; tiles[i].glow.material.color.set(color); return; }
    if (kind === 'landed') { ringBurst(i, color); return; }
    const lot = lots[i];
    if (!lot) return;
    if (kind === 'stamp') {
      floatText(lot.center.clone().setY(2.2), '已购', color);
      ringBurst(i, color);
    } else if (kind === 'crash') {
      const h = lot.holder, x0 = h.position.x;
      animate(600, t => { h.position.x = x0 + Math.sin(t * 40) * 0.12 * (1 - t); });
      floatText(lot.center.clone().setY(1.6), '💥 拆！', '#e03131');
    }
  }

  // ---------- 点击 ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (onFork) {
      // 选路时：点箭头、路口格子、那条路上的格子或地块都算选方向；都没点中就选离点击处最近的方向；不弹格子信息
      const hit = raycaster.intersectObjects([...forkArrows, ...forkHits], true)[0];
      if (hit) { onFork(hit.object.userData.fork); return; }
      const h = raycaster.intersectObjects(scene.children, true).find(x => x.object.userData.cell !== undefined);
      if (h && forkCells && forkCells.has(h.object.userData.cell)) { onFork(forkCells.get(h.object.userData.cell)); return; }
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) {
        let best = null, bestD = U * 1.6;
        forkHits.forEach(b => { const d = Math.hypot(b.position.x - pt.x, b.position.z - pt.z); if (d < bestD) { bestD = d; best = b.userData.fork; } });
        if (best !== null) onFork(best);
      }
      return;
    }
    const hits = raycaster.intersectObjects(scene.children, true);
    const h = hits.find(x => x.object.userData.fork !== undefined || x.object.userData.cell !== undefined);
    if (!h) return;
    if (h.object.userData.fork !== undefined && onFork) onFork(h.object.userData.fork);
    else if (opts.onCellClick) opts.onCellClick(h.object.userData.cell);
  });

  // ---------- 主循环 ----------
  let last = performance.now();
  const clock = { t: 0 };
  function frame(now) {
    // 先排下一帧：即使下面哪里出错，画面也不会就此停住
    requestAnimationFrame(frame);
    const rawDt = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, rawDt);
    last = now;
    clock.t += dt;
    // rAF 的时间戳可能比创建动画时取的 performance.now() 还早，所以 t 要夹在 0~1 之间
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k], t = Math.min(1, Math.max(0, (now - a.t0) / a.ms));
      let failed = false;
      try { a.update(t); } catch (e) { console.error('动画出错，已跳过', e); failed = true; }
      if (t >= 1 || failed) { anims.splice(k, 1); a.resolve(); }
    }
    // 相机平滑跟随
    const want = viewMode === 'follow' && focus !== null && pieces[focus] ? pieces[focus].group.position.clone().setY(0) : center.clone();
    const delta = want.sub(controls.target).multiplyScalar(1 - Math.pow(0.02, Math.min(rawDt, 0.25)));
    controls.target.add(delta);
    camera.position.add(delta);
    controls.update();
    // 动态元素
    pieces.forEach(pc => {
      if (pc.arrow.visible) { pc.arrow.position.y = 3.2 + Math.sin(clock.t * 4) * 0.18; pc.arrow.rotation.y += dt * 2; }
      if (pc.ring.visible) { const s = 1 + (Math.sin(clock.t * 4) + 1) * 0.12; pc.ring.scale.setScalar(s); }
      if (pc.bubble.visible) pc.bubble.position.y = 2.0 + Math.sin(clock.t * 5) * 0.08;
    });
    Object.values(lots).forEach(l => { if (l.blink) l.blink.visible = Math.sin(clock.t * 4) > 0; });
    Object.values(markers).forEach(m => { m.sprite.position.y = m.base + Math.sin(clock.t * 2.5 + m.phase) * (m.kind === 'god' ? 0.2 : 0.03); });
    forkArrows.forEach(a => { a.position.y = a.userData.base.y + Math.abs(Math.sin(clock.t * 4)) * 0.35; });
    tiles.forEach((t, i) => {
      if (selectable && selectable.has(i)) { t.glow.material.color.set('#ff2d55'); t.glow.material.opacity = 0.35 + Math.sin(clock.t * 6) * 0.2; }
      else if (highlight && highlight.has(i)) { t.glow.material.color.set('#ffc400'); t.glow.material.opacity = 0.45 + Math.sin(clock.t * 5) * 0.2; }
      else if (t.trail > 0) { t.trail = Math.max(0, t.trail - dt * 0.8); t.glow.material.opacity = t.trail * 0.55; }
      else t.glow.material.opacity = 0;
    });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    const changed = Math.abs(camera.aspect - w / h) > 0.05;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (changed) setView(viewMode);
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(container);
  window.addEventListener('resize', resize);
  resize();

  // ---------- 物理骰子 ----------
  // 点数由引擎决定。做法：先在后台把整个抛掷过程用物理引擎算完并记录每一帧，
  // 看最后哪一面朝上，再把骰子的点数贴图重新排列，让朝上那面正好是要的点数，最后回放轨迹。
  const PIP_POS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const faceMats = [null, 1, 2, 3, 4, 5, 6].map(v => {
    if (!v) return null;
    const { ctx: g, tex } = makeCanvas(128, 128);
    g.fillStyle = '#fbfbf8';
    g.fillRect(0, 0, 128, 128);
    PIP_POS[v].forEach(k => {
      const x = 28 + (k % 3) * 36, y = 28 + Math.floor(k / 3) * 36, r = v === 1 ? 17 : 12;
      const grad = g.createRadialGradient(x - 3, y - 3, 1, x, y, r);
      grad.addColorStop(0, v === 1 || v === 4 ? '#ff6b6b' : '#555');
      grad.addColorStop(1, v === 1 || v === 4 ? '#c40000' : '#0b0b0b');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    });
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.02 });
  });
  const DIE = 1.05;
  const dieGeo = new RoundedBoxGeometry(DIE, DIE, DIE, 4, 0.16);
  // BoxGeometry 的六个面依次是 +x -x +y -y +z -z，对面成对：(0,1) (2,3) (4,5)
  const FACE_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a));
  function upFace(q) {
    let best = 0, bestY = -2;
    FACE_NORMALS.forEach((n, k) => { const y = n.clone().applyQuaternion(q).y; if (y > bestY) { bestY = y; best = k; } });
    return [best, bestY];
  }
  function labelFaces(up, value) {
    const vals = Array(6);
    vals[up] = value;
    vals[up ^ 1] = 7 - value;
    const rest = [1, 2, 3].filter(x => x !== value && x !== 7 - value);
    const pairs = [0, 2, 4].filter(p => p !== (up & ~1));
    pairs.forEach((p, k) => { vals[p] = rest[k]; vals[p + 1] = 7 - rest[k]; });
    return vals.map(v => faceMats[v]);
  }

  function simulateThrow(center, toward) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0), allowSleep: true });
    const dieMat = new CANNON.Material('die'), hardMat = new CANNON.Material('hard');
    world.addContactMaterial(new CANNON.ContactMaterial(dieMat, hardMat, { friction: 0.32, restitution: 0.52 }));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.15, restitution: 0.6 }));
    const addStatic = (shape, x, y, z) => { const b = new CANNON.Body({ mass: 0, material: hardMat }); b.addShape(shape); b.position.set(x, y, z); world.addBody(b); };
    const ground = new CANNON.Body({ mass: 0, material: hardMat });
    ground.addShape(new CANNON.Plane());
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);
    const R = 4.6, near = (x, z, pad = 1.5) => Math.abs(x - center.x) < R + pad && Math.abs(z - center.z) < R + pad;
    // 抛掷区域四周的隐形墙，骰子不会飞出画面
    [[R, 0], [-R, 0], [0, R], [0, -R]].forEach(([dx, dz]) => addStatic(new CANNON.Box(new CANNON.Vec3(dx ? 0.25 : R + 0.25, 5, dz ? 0.25 : R + 0.25)), center.x + dx, 5, center.z + dz));
    // 路口格子、地块、房子、棋子都能撞
    BOARD.forEach((_, i) => { const p = cellPos(i); if (near(p.x, p.z)) addStatic(new CANNON.Box(new CANNON.Vec3(U * 0.45, 0.15, U * 0.45)), p.x, 0.15, p.z); });
    Object.values(lots).forEach(l => {
      if (!near(l.center.x, l.center.z)) return;
      addStatic(new CANNON.Box(new CANNON.Vec3(U * 0.43, 0.07, U * 0.43)), l.center.x, 0.07, l.center.z);
      const b = l.holder.children[0], top = b && b.userData.top;
      if (top) addStatic(new CANNON.Box(new CANNON.Vec3(0.62, top / 2, 0.62)), l.center.x, 0.14 + top / 2, l.center.z);
    });
    pieces.forEach((pc, k) => {
      const p = pc.group.position;
      if (alive[k] && near(p.x, p.z)) addStatic(new CANNON.Cylinder(0.45, 0.45, 1.5, 12), p.x, 0.3 + 0.75, p.z);
    });
    const side = new THREE.Vector3(-toward.z, 0, toward.x);
    const dice = [-1, 1].map(sgn => {
      const b = new CANNON.Body({ mass: 1, material: dieMat, sleepSpeedLimit: 0.12, sleepTimeLimit: 0.3, linearDamping: 0.02, angularDamping: 0.1 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(DIE / 2, DIE / 2, DIE / 2)));
      // 从画面上方之外的高空一边旋转一边落下，砸在玩家附近，再弹跳、翻滚、滑行
      const start = center.clone().addScaledVector(toward, 1.6 + Math.random() * 0.6).addScaledVector(side, sgn * (1.3 + Math.random() * 0.4));
      b.position.set(start.x, 10 + Math.random() * 1.5, start.z);
      b.quaternion.setFromEuler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
      const v = toward.clone().multiplyScalar(-(1.5 + Math.random() * 1.5)).addScaledVector(side, -sgn * (0.8 + Math.random() * 1.2));
      b.velocity.set(v.x, -3 - Math.random() * 2, v.z);
      const spin = () => (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 15);
      b.angularVelocity.set(spin(), spin(), spin());
      world.addBody(b);
      return b;
    });
    const hits = [], lastHit = [-1, -1];
    let time = 0;
    dice.forEach((b, k) => b.addEventListener('collide', e => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.2 && time - lastHit[k] > 0.05) { hits.push({ t: time, v, x: b.position.x, z: b.position.z }); lastHit[k] = time; }
    }));
    const frames = [];
    const STEP = 1 / 120;
    for (let n = 0; n < 120 * 3.6; n++) {
      world.step(STEP);
      time += STEP;
      if (n % 2 === 0) frames.push(dice.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
      // 后半段逐渐加大阻尼，像在桌面上摩擦减速，自然地晃一晃再停稳
      if (time > 1.5) dice.forEach(b => { b.linearDamping = Math.min(0.6, b.linearDamping + 0.004); b.angularDamping = Math.min(0.6, b.angularDamping + 0.004); });
      if (time > 0.6 && dice.every(b => b.sleepState === CANNON.Body.SLEEPING)) break;
    }
    return { frames, hits };
  }

  // 预先编译骰子的材质，避免第一次掷骰时卡一下
  {
    const warm = new THREE.Mesh(dieGeo, faceMats.slice(1));
    warm.position.set(0, -20, 0);
    scene.add(warm);
    renderer.compile(scene, camera);
    scene.remove(warm);
  }

  const dustGeo = new THREE.SphereGeometry(0.13, 6, 5);
  function dust(x, z, v) {
    const n = Math.min(9, 3 + Math.floor(v / 2));
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: '#efe6d2', transparent: true, opacity: 0.8, depthWrite: false }));
      const ang = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 0.9;
      p.position.set(x, 0.35, z);
      scene.add(p);
      animate(450 + Math.random() * 250, t => {
        p.position.set(x + Math.cos(ang) * sp * t, 0.35 + t * 0.5, z + Math.sin(ang) * sp * t);
        p.scale.setScalar(1 + t * 2);
        p.material.opacity = 0.8 * (1 - t);
        if (t >= 1) scene.remove(p);
      });
    }
  }

  function ripple(x, z, v) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.33, z);
    scene.add(m);
    const grow = 1.2 + Math.min(1.5, v / 10);
    animate(420, t => { m.scale.setScalar(1 + t * grow); m.material.opacity = 0.55 * (1 - t); if (t >= 1) scene.remove(m); });
  }

  async function rollDice(values, { speed = 1, onHit, onReveal } = {}) {
    const ref = focus !== null && pieces[focus] ? pieces[focus].group.position.clone().setY(0) : controls.target.clone().setY(0);
    const toward = camera.position.clone().sub(controls.target).setY(0).normalize();
    const { frames, hits } = simulateThrow(ref, toward);
    // 按最终朝上的面重新贴点数；如果斜靠在房子上，追加几帧把它摆正
    const last = frames[frames.length - 1];
    const fixes = values.map((v, k) => {
      const q = new THREE.Quaternion(last[k][3], last[k][4], last[k][5], last[k][6]);
      const [up, dot] = upFace(q);
      const target = dot < 0.97 ? new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[up].clone().applyQuaternion(q), new THREE.Vector3(0, 1, 0)).multiply(q) : q;
      return { up, q, target };
    });
    if (fixes.some(f => f.q !== f.target)) {
      for (let j = 1; j <= 9; j++) {
        frames.push(fixes.map((f, k) => {
          const qq = f.q.clone().slerp(f.target, j / 9);
          return [last[k][0], last[k][1], last[k][2], qq.x, qq.y, qq.z, qq.w];
        }));
      }
    }
    const meshes = values.map((v, k) => {
      const m = new THREE.Mesh(dieGeo, labelFaces(fixes[k].up, v));
      m.castShadow = true;
      scene.add(m);
      return m;
    });
    // 每次碰撞：声音 + 落点扬尘；重的撞击在地面泛起一圈冲击波纹（镜头保持稳定）
    const timers = hits.map(h => setTimeout(() => {
      if (onHit) onHit(h.v);
      if (h.v > 3) dust(h.x, h.z, h.v);
      if (h.v > 6) ripple(h.x, h.z, h.v);
    }, (h.t * 1000) / speed));
    // 拖影：高速运动时身后跟着几个渐隐的残影
    const ghosts = meshes.map(() => [0.32, 0.2, 0.1].map(op => {
      const g = new THREE.Mesh(dieGeo, new THREE.MeshBasicMaterial({ color: '#fffbe8', transparent: true, opacity: 0, depthWrite: false }));
      g.userData.op = op;
      scene.add(g);
      return g;
    }));
    const pose = (fi, k, obj) => {
      fi = Math.max(0, Math.min(frames.length - 1, fi));
      const a = frames[Math.floor(fi)], b = frames[Math.ceil(fi)], w = fi - Math.floor(fi);
      obj.position.set(a[k][0] + (b[k][0] - a[k][0]) * w, a[k][1] + (b[k][1] - a[k][1]) * w, a[k][2] + (b[k][2] - a[k][2]) * w);
      obj.quaternion.set(a[k][3], a[k][4], a[k][5], a[k][6]).slerp(new THREE.Quaternion(b[k][3], b[k][4], b[k][5], b[k][6]), w);
    };
    const dur = (frames.length / 60) * 1000 / speed;
    await animate(dur, t => {
      const fi = t * (frames.length - 1);
      meshes.forEach((m, k) => {
        pose(fi, k, m);
        const a = frames[Math.max(0, Math.floor(fi) - 1)][k], b = frames[Math.floor(fi)][k];
        const v = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 60;
        ghosts[k].forEach((g, j) => {
          pose(fi - (j + 1) * 1.5, k, g);
          g.material.opacity = g.userData.op * Math.min(1, Math.max(0, (v - 3) / 8));
        });
      });
    });
    timers.forEach(clearTimeout);
    ghosts.flat().forEach(g => scene.remove(g));
    // 亮出点数：骰子下方光圈 + 头顶大数字
    const mid = meshes[0].position.clone().add(meshes[1].position).multiplyScalar(0.5);
    meshes.forEach(m => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 40), new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(m.position.x, 0.35, m.position.z);
      scene.add(ring);
      animate(900, t => { ring.scale.setScalar(1 + t * 1.6); ring.material.opacity = 1 - t; if (t >= 1) scene.remove(ring); });
    });
    // 总点数从当前玩家的头顶冒出来，停在名字牌上方
    const head = focus !== null && pieces[focus] ? pieces[focus].group.position.clone() : mid.clone();
    const total = textSprite(String(values[0] + values[1]), '#e8452c', '#fff', 1.6);
    total.position.set(head.x, head.y + 1.5, head.z);
    scene.add(total);
    if (onReveal) onReveal();
    const s0 = total.scale.clone();
    await animate(480 / speed, t => {
      const e = easeOutBack(t);
      total.scale.copy(s0).multiplyScalar(Math.max(0.01, e));
      total.position.y = head.y + 1.5 + 2.4 * Math.min(1, e);
    });
    await new Promise(r => setTimeout(r, 650 / speed));
    await animate(300 / speed, t => {
      meshes.forEach(m => m.scale.setScalar(Math.max(0.01, 1 - t)));
      total.material.opacity = 1 - t;
      total.position.y = head.y + 3.9 + t;
    });
    meshes.forEach(m => scene.remove(m));
    scene.remove(total);
  }

  // ---------- 对外接口 ----------
  return {
    // 新的一局：重建棋子
    reset(s) {
      pieces.forEach(pc => scene.remove(pc.group));
      pieces = s.players.map(makePiece);
      posArr = s.players.map(p => p.pos);
      alive = s.players.map(p => !p.bankrupt);
      Object.values(lots).forEach(l => { l.key = null; l.prev = null; });
      tiles.forEach(t => { t.key = ''; });
      setFork(null);
      selectable = null;
      highlight = null;
      pieces.forEach((pc, k) => pc.group.position.copy(pieceTarget(k)));
    },
    // 同步展示状态（不带动画的部分）
    update(s, pos, active, thinking) {
      posArr = pos.slice();
      alive = s.players.map(p => !p.bankrupt);
      BOARD.forEach((_, i) => drawTile(i, s));
      LANDS.forEach(i => setLot(i, s));
      syncMarkers(s);
      pieces.forEach((pc, k) => {
        pc.group.visible = alive[k];
        if (!pc.moving) pc.group.position.copy(pieceTarget(k));
        const isActive = k === active;
        pc.arrow.visible = isActive;
        pc.ring.visible = isActive;
        pc.tag.scale.multiplyScalar(1 / (pc.tagScale || 1));
        pc.tagScale = isActive ? 1.25 : 0.8;
        pc.tag.scale.multiplyScalar(pc.tagScale);
        pc.bubble.visible = k === thinking;
        pc.head.material.color.set(s.players[k].stay > 0 ? '#999' : '#fff');
      });
      if (active !== null && active !== undefined) focus = active;
    },
    // 走一步（跳到相邻格）
    async step(k, cell, ms) {
      const pc = pieces[k];
      if (!pc) return;
      focus = k;
      pc.moving = true;
      posArr[k] = cell;
      const from = pc.group.position.clone(), to = pieceTarget(k);
      pc.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      await animate(ms, t => {
        pc.group.position.lerpVectors(from, to, easeInOut(t));
        pc.group.position.y = to.y + Math.sin(Math.PI * t) * 1.1;
        const sq = t < 0.15 ? 1 - t * 1.5 : t > 0.85 ? 1 - (1 - t) * 1.5 : 1;
        pc.group.scale.set(1, sq, 1);
      });
      pc.group.scale.set(1, 1, 1);
      pc.moving = false;
    },
    // 瞬移（进监狱、传送）
    async jump(k, cell, ms) {
      const pc = pieces[k];
      if (!pc) return;
      focus = k;
      pc.moving = true;
      await animate(ms / 2, t => { pc.group.scale.setScalar(Math.max(0.01, 1 - t)); pc.group.position.y = 0.3 + t * 2; });
      posArr[k] = cell;
      pc.group.position.copy(pieceTarget(k)).setY(2.3);
      await animate(ms / 2, t => { pc.group.scale.setScalar(Math.max(0.01, t)); pc.group.position.y = 2.3 - t * 2; });
      pc.group.scale.setScalar(1);
      pc.moving = false;
    },
    flash,
    setSelectable(cells) { selectable = cells ? new Set(cells) : null; },
    // 金色闪烁：预计会停下的格子
    setHighlight(cells) { highlight = cells && cells.length ? new Set(cells) : null; },
    setFork(options, from, cb, cellMap) { setFork(options, from, cb, cellMap); },
    setView(mode) { setView(mode); },
    get viewMode() { return viewMode; },
    focusOn(k) { focus = k; },
    // 棋子头顶在容器里的屏幕坐标（用于飘字）
    screenOf(k) {
      const pc = pieces[k];
      if (!pc) return null;
      const v = pc.group.position.clone().setY(pc.group.position.y + 2.2).project(camera);
      return [(v.x + 1) / 2 * container.clientWidth, (1 - v.y) / 2 * container.clientHeight];
    },
    resize,
    rollDice,
  };
}
