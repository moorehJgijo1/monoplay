// 自然景物：树、棕榈、灌木、岩石、山丘。
// 全部是程序生成的高细节模型：噪声扰动的圆润树冠、层层下垂的松枝、弯曲的棕榈树干和弧形叶片、
// 带棱角又不生硬的岩石。用顶点色做明暗和苔藓，不需要贴图。每种造型缓存几个变体，实例共用同一份几何体。
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from './vendor/BufferGeometryUtils.js';

// ---------- 噪声 ----------
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = sm(x - xi), fy = sm(y - yi), fz = sm(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), fx), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), fx), fy),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), fx), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
const fbm = (x, y, z, o = 3) => { let a = 0.5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2; } return s / (1 - Math.pow(0.5, o)) / 1; };
function prng(seed) { let t = (seed * 2654435761) >>> 0; return () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; }; }

// ---------- 几何工具 ----------
// 补一个全 0 的 uv，让它能和带 uv 的普通零件合批
const withUV = g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
// 把不带索引的几何体合并顶点，让法线可以平滑
function smooth(geo) {
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  const g = mergeVertices(geo, 1e-4);
  return g;
}
// 噪声扰动的球：r 半径，amp 起伏幅度（相对半径），freq 噪声频率；sy 纵向压扁
function lumpy(r, seed, { detail = 3, amp = 0.22, freq = 1.6, sy = 1 } = {}) {
  const g = smooth(new THREE.IcosahedronGeometry(1, detail));
  const p = g.attributes.position, o = seed * 17.3;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x * freq + o, y * freq + o * 0.7, z * freq + o * 1.3, 3) - 0.5;
    const k = r * (1 + amp * 2 * n);
    p.setXYZ(i, x * k, y * k * sy, z * k);
  }
  return g;
}
// 给几何体上顶点色：由 colorFn(x, y, z, ny) → THREE.Color
function paint(g, fn) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i), n.getY(i)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const tr = (g, x, y, z) => { g.translate(x, y, z); return g; };
const merged = (list) => { const m = mergeGeometries(list, false); list.forEach(g => g.dispose()); return m; };

// ---------- 材质（全局共用）----------
const M = {
  leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
  leafTwo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }),
  bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
};

const PALETTES = {
  round: [['#2f8f3f', '#6ccf55'], ['#3f9e4a', '#86d765'], ['#2e8b57', '#69c98a'], ['#4aa73e', '#a1df63']],
  pine: [['#2a7a4f', '#58c486'], ['#2d8556', '#63cc90'], ['#27704a', '#4fb67d']],
};
const cl = h => new THREE.Color(h);

// ---------- 树干 ----------
function trunk(h, r0, r1, seed, lean = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 12, 6, true);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (y + h / 2) / h, a = Math.atan2(z, x);
    const k = 1 + 0.09 * Math.sin(a * 7 + seed) + 0.05 * (fbm(a * 2 + seed, y * 3, 0) - 0.5) * 2 + 0.55 * Math.pow(1 - t, 6) * 0.6; // 树皮棱 + 根部外扩
    p.setXYZ(i, x * k + lean * t * t, y + h / 2, z * k);
  }
  return paint(g, (c, x, y) => { c.set('#6e4a2a').lerp(cl('#8b6339'), Math.min(1, y / h) * 0.6 + (fbm(x * 9, y * 5, 0) - 0.5) * 0.5); });
}
function branch(x0, y0, z0, x1, y1, z1, r) {
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = d.length();
  const g = new THREE.CylinderGeometry(r * 0.5, r, len, 6, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(x0, y0, z0);
  return g;
}

// ---------- 阔叶树 ----------
function buildRound(seed) {
  const rnd = prng(seed + 1), pal = PALETTES.round[seed % PALETTES.round.length];
  const lo = cl(pal[0]), hi = cl(pal[1]);
  const th = 0.62 + rnd() * 0.12;
  const bark = [trunk(th + 0.2, 0.12, 0.05, seed, (rnd() - 0.5) * 0.08)];
  // 两根伸进树冠的树枝
  bark.push(branch(0, th * 0.75, 0, 0.22, th + 0.28, 0.08, 0.035), branch(0, th * 0.65, 0, -0.2, th + 0.22, -0.12, 0.03));
  // 根部三个小隆起
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + rnd(); const rt = new THREE.ConeGeometry(0.045, 0.2, 5); rt.translate(0, 0.1, 0); rt.rotateZ(0.9); rt.rotateY(a); rt.translate(Math.cos(a) * 0.08, 0, -Math.sin(a) * 0.08); bark.push(rt); }
  const barkG = merged(bark.map(g => { if (g.index) g = g.toNonIndexed(); if (!g.attributes.color) paint(g, (c) => c.set('#76502d')); g.deleteAttribute('uv'); return g; }));

  // 树冠：一个大球 + 5~7 个小球，全部噪声扰动 + 压扁，上亮下暗
  const lumps = [];
  const cy = th + 0.42, R = 0.5 + rnd() * 0.08;
  lumps.push(tr(lumpy(R, seed, { amp: 0.2, sy: 0.88 }), 0, cy, 0));
  const n = 6 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6, rr = 0.34 + rnd() * 0.12, h = (rnd() - 0.45) * 0.34;
    lumps.push(tr(lumpy(0.27 + rnd() * 0.1, seed * 7 + i, { amp: 0.25, sy: 0.9 }), Math.cos(a) * rr, cy + h, Math.sin(a) * rr));
  }
  lumps.push(tr(lumpy(0.28, seed * 3, { amp: 0.25 }), (rnd() - 0.5) * 0.2, cy + 0.38, (rnd() - 0.5) * 0.2));
  const fg = merged(lumps);          // 都带索引，合并后法线仍然平滑
  paint(fg, (c, x, y, z, ny) => {
    const t = Math.min(1, Math.max(0, (y - (cy - R * 0.9)) / (R * 2.0)));
    const patch = fbm(x * 4.5 + seed, y * 4.5, z * 4.5) - 0.5;
    c.copy(lo).lerp(hi, Math.min(1, Math.max(0, t * 0.9 + ny * 0.2 + patch * 0.6)));
  });
  return { bark: barkG, foliage: fg };
}

// ---------- 松树 ----------
function buildPine(seed) {
  const rnd = prng(seed + 11), pal = PALETTES.pine[seed % PALETTES.pine.length];
  const lo = cl(pal[0]), hi = cl(pal[1]);
  const barkG = trunk(0.75, 0.07, 0.03, seed);
  const tiers = [];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const r = 0.56 * (1 - i * 0.17), h = 0.62 * (1 - i * 0.07), y0 = 0.36 + i * 0.27;
    const g = new THREE.ConeGeometry(r, h, 22, 4);
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j), a = Math.atan2(z, x), t = (y + h / 2) / h; // t: 0 底 → 1 尖
      const wob = 1 + (0.13 * Math.sin(a * 5 + i * 1.7 + seed) + 0.05 * Math.sin(a * 11 + i)) * (1 - t) + 0.1 * (fbm(a * 2 + seed, i, 0) - 0.5);
      const droop = (1 - t) * (1 - t) * 0.08 * (0.6 + 0.4 * Math.sin(a * 5 + i * 1.7 + seed));
      p.setXYZ(j, x * wob, y + h / 2 - droop, z * wob);
    }
    g.translate(0, y0, 0);
    tiers.push(g);
  }
  const fg = merged(tiers.map(smooth));
  paint(fg, (c, x, y, z, ny) => {
    const t = Math.min(1, Math.max(0, (y - 0.3) / 1.4));
    const sh = Math.max(0, Math.min(1, 0.5 + ny * 0.5));
    c.copy(lo).lerp(hi, Math.min(1, t * 0.55 + sh * 0.35 + (fbm(x * 5, y * 3, z * 5) - 0.5) * 0.5));
  });
  return { bark: barkG, foliage: fg };
}

// ---------- 棕榈 ----------
function buildPalm(seed) {
  const rnd = prng(seed + 23);
  const H = 1.35 + rnd() * 0.25, lean = 0.28 + rnd() * 0.22, N = 16, S = 10;
  // 弯曲的树干（带环纹）：沿弧线放一圈圈截面
  const pos = [], idx = [], cols = [];
  const center = t => [lean * t * t, H * t, 0];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [cx, cy, cz] = center(t), r = (0.095 - 0.04 * t) * (1 + 0.1 * Math.cos(i * 2.6));
    const dx = lean * 2 * t, dy = H, len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len; // 截面朝向（垂直切线）
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(cx + nx * c * r, cy + ny * c * r, cz + s * r);
      const k = 0.5 + 0.5 * Math.cos(i * 2.6);
      cols.push(0.36 + 0.1 * k, 0.25 + 0.08 * k, 0.15 + 0.06 * k);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) {
    const a = i * S + j, b = i * S + (j + 1) % S, c = (i + 1) * S + (j + 1) % S, d = (i + 1) * S + j;
    idx.push(a, d, b, b, d, c);
  }
  const trunkG = new THREE.BufferGeometry();
  trunkG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  trunkG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  trunkG.setIndex(idx);
  trunkG.computeVertexNormals();
  const [tx, ty] = center(1);

  // 叶片：沿弧线的带状面，两侧有锯齿，中间有折痕
  const fronds = [];
  const NF = 13;
  for (let f = 0; f < NF; f++) {
    const yaw = (f / NF) * Math.PI * 2 + rnd() * 0.4, len = 0.7 + rnd() * 0.2, up = 0.25 + rnd() * 0.4, droop = 0.85 + rnd() * 0.5;
    const seg = 12, p2 = [], c2 = [], i2 = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, w = 0.14 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (i % 2 ? 0.6 : 1) + 0.006;
      const out = len * t, y = len * (up * t - droop * t * t * 0.55);
      // 叶片局部坐标：x 沿叶向，y 上，z 宽度方向；折痕：边缘比中轴低
      for (const side of [-1, 0, 1]) {
        const lx = out, ly = y - (side !== 0 ? 0.018 : 0), lz = side * w;
        p2.push(lx, ly, lz);
        const g = 0.22 + 0.2 * t + (side === 0 ? 0.0 : 0.03);
        c2.push(0.16 + 0.1 * t, g + 0.34, 0.12 + 0.03 * t);
      }
    }
    for (let i = 0; i < seg; i++) for (let s = 0; s < 2; s++) {
      const a = i * 3 + s, b = i * 3 + s + 1, c = (i + 1) * 3 + s + 1, d = (i + 1) * 3 + s;
      i2.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
    g.setIndex(i2);
    g.rotateY(yaw);
    g.translate(tx, ty + 0.02, 0);
    g.computeVertexNormals();
    fronds.push(g.toNonIndexed());
  }
  const foliage = merged(fronds);
  // 椰子
  const nuts = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.2 + rnd(); const g = new THREE.IcosahedronGeometry(0.045, 2); const gs = smooth(g); gs.translate(tx + Math.cos(a) * 0.07, ty - 0.05, Math.sin(a) * 0.07); nuts.push(paint(gs, c => c.set('#6b4a1f'))); }
  const bark = merged([trunkG.toNonIndexed(), ...nuts.map(g => g.toNonIndexed())]);
  return { bark, foliage };
}

// ---------- 缓存与实例化 ----------
const cache = new Map();
function variant(kind, i) {
  const key = kind + i;
  if (!cache.has(key)) cache.set(key, kind === 'pine' ? buildPine(i) : kind === 'palm' ? buildPalm(i) : buildRound(i));
  return cache.get(key);
}
// kind：'round' | 'pine' | 'palm'；v：变体编号（任意整数，会取模）
export function makeTree(kind = 'round', v = 0) {
  const n = kind === 'pine' ? 3 : 4;
  const d = variant(kind, ((v % n) + n) % n);
  const g = new THREE.Group();
  const b = new THREE.Mesh(d.bark, M.bark), f = new THREE.Mesh(d.foliage, kind === 'palm' ? M.leafTwo : M.leaf);
  b.castShadow = f.castShadow = true;
  f.receiveShadow = b.receiveShadow = true;
  g.add(b, f);
  return g;
}
export const makePalm = (v = 0) => makeTree('palm', v);

// ---------- 灌木 ----------
const bushCache = [];
export function makeBush(v = 0) {
  const i = ((v % 4) + 4) % 4;
  if (!bushCache[i]) {
    const rnd = prng(i + 40), pal = PALETTES.round[i], lo = cl(pal[0]), hi = cl(pal[1]);
    const parts = [tr(lumpy(0.26, i * 5, { amp: 0.25, sy: 0.8 }), 0, 0.17, 0)];
    for (let k = 0; k < 3; k++) { const a = rnd() * 6.28; parts.push(tr(lumpy(0.16 + rnd() * 0.06, i * 5 + k + 1, { amp: 0.28, sy: 0.85 }), Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2)); }
    const g = merged(parts);
    paint(g, (c, x, y, z, ny) => c.copy(lo).lerp(hi, Math.min(1, Math.max(0, y / 0.4 + (fbm(x * 6, y * 6, z * 6) - 0.5) * 0.7))));
    bushCache[i] = g;
  }
  const m = new THREE.Mesh(bushCache[i], M.leaf);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------- 岩石 ----------
// size 是大致半径。返回带顶点色的几何体（顶面偏亮、偏绿一点像苔藓）；mossy=false 时不带苔藓
const rockCache = new Map();
export function rockGeo(v = 0, { colors = true, mossy = true } = {}) {
  const key = v + '|' + colors + '|' + mossy;
  if (rockCache.has(key)) return rockCache.get(key);
  const g = smooth(new THREE.IcosahedronGeometry(1, 3));
  const p = g.attributes.position, o = v * 11.7;
  const sx = 1 + (hash3(v, 1, 2) - 0.5) * 0.5, sz = 1 + (hash3(v, 3, 4) - 0.5) * 0.5;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // 大块起伏 + 细小的棱角（用 abs 做出折角感）
    const big = fbm(x * 1.4 + o, y * 1.4, z * 1.4 + o, 3) - 0.5;
    const edge = Math.abs(fbm(x * 3.2 + o, y * 3.2, z * 3.2, 2) - 0.5);
    const k = 0.82 + 0.5 * big - 0.22 * edge;
    x *= k * sx; z *= k * sz; y *= k * 0.85;
    if (y < -0.3) y = -0.3 + (y + 0.3) * 0.15;      // 底部压平，埋进地里
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  if (colors) {
    paint(g, (c, x, y, z, ny) => {
      const n = fbm(x * 5 + o, y * 5, z * 5);
      c.set('#8e897f').lerp(cl('#b9b3a6'), Math.min(1, Math.max(0, ny * 0.5 + 0.25 + (n - 0.5)))).multiplyScalar(0.85 + 0.3 * n);
      if (mossy && ny > 0.55 && n > 0.45) c.lerp(cl('#6f9a4a'), Math.min(0.75, (ny - 0.55) * 2.0 * (n - 0.4) * 3));
    });
  }
  if (!colors) withUV(g);
  rockCache.set(key, g);
  return g;
}
export function makeRock(size = 1, v = 0) {
  const m = new THREE.Mesh(rockGeo(v), M.rock);
  m.scale.setScalar(size);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------- 山丘 ----------
// 半球形山丘：顶部是草地，坡度陡的地方露出岩石，山脚泛沙色。radius 底面半径，height 高度
export function hillGeo(radius, height, seed = 0, { sand = false } = {}) {
  const g = smooth(new THREE.SphereGeometry(1, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2));
  const p = g.attributes.position, o = seed * 9.1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x * 2.2 + o, y * 2.2, z * 2.2 + o, 4) - 0.5;
    const k = 1 + n * 0.3;
    p.setXYZ(i, x * radius * k, Math.max(0, y) * height * (1 + n * 0.5 * (1 - Math.max(0, y))), z * radius * k);   // 山顶不受起伏影响，方便在上面放东西
  }
  return paint(g, (c, x, y, z, ny) => {
    const n = fbm(x * 1.3 + o, y * 1.3, z * 1.3, 3), t = y / height;
    c.set('#79c05a').lerp(cl('#a2dc72'), Math.min(1, Math.max(0, t * 0.8 + (n - 0.5)))).multiplyScalar(0.92 + 0.16 * n);
    if (ny < 0.8) c.lerp(cl('#9d978b'), Math.min(1, (0.8 - ny) * 3.2));
    if (sand && t < 0.12) c.lerp(cl('#f1dca6'), 1 - t / 0.12);
  });
}
export function makeHill(radius, height, seed = 0, opts) {
  const m = new THREE.Mesh(hillGeo(radius, height, seed, opts), M.rock);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 圆润的一团（给郊区合批用的灌木、草丛）：单位半径，带平滑法线，不带颜色
const blobCache = new Map();
export function blobGeo(v = 0) {
  const k = ((v % 4) + 4) % 4;
  if (!blobCache.has(k)) { const g = lumpy(1, k + 70, { detail: 2, amp: 0.25 }); g.computeVertexNormals(); withUV(g); blobCache.set(k, g); }
  return blobCache.get(k);
}
