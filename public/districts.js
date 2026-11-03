// 四个街区的主题景观：路网围出的四块街区各有特色。
// 西北「古城」（dist-old.js）：宝塔、城楼、牌坊、荷花池；东北「金融区」（dist-finance.js）：证券交易所、玻璃塔楼、喷泉、金牛；
// 西南「海滨」（dist-beach.js）：泻湖、灯塔、救生塔、帆船；东南「游乐园」（dist-fun.js）：摩天轮、过山车、旋转木马、帐篷。
// 这里负责铺各街区的主题地面，并把景观放到街区里最大的空地上。只是装饰，不影响规则。
import * as THREE from 'three';
import { buildOldTown } from './dist-old.js';
import { buildFinance } from './dist-finance.js';
import { buildBeach } from './dist-beach.js';
import { buildFunPark } from './dist-fun.js';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

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
  // 游乐园：奶油色的方砖地，中间十字形的粉色小路（不再是草地，和周围的石砖广场连成一片）
  fun: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3e6cd'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e2d1ae'; g.lineWidth = 3;
    for (let k = 0; k <= w; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
    g.fillStyle = '#ffd1dd';
    g.fillRect(0, 104, w, 48); g.fillRect(104, 0, 48, h);
    g.fillStyle = '#fff1f5';
    for (let k = 0; k < w; k += 32) { g.fillRect(k, 124, 16, 8); g.fillRect(124, k, 8, 16); }
  }, [2, 2]),
};

export const THEMES = [
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
    b.theme = th.key;
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
