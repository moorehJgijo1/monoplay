// Q 版 3D 角色：全部用基本几何体拼出来，不需要外部模型文件。
// 卡通渲染（色阶明暗 + 描边），局部坐标 +z 是正面，脚底在 y=0，总高约 1.7。
// 返回可做动画的部件：头、手臂、腿、眼睛（眨眼）。
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const SKIN = '#ffd9b8';

// ---------- 材质 ----------
// 四级色阶的卡通明暗
const gradient = (() => {
  const data = new Uint8Array([90, 150, 210, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats = new Map();
function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...opts }));
  return mats.get(key);
}
// 描边：沿法线把背面往外推一点，画成深色
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color('#2b1a10') }, thickness: { value: 0.016 } },
  vertexShader: 'uniform float thickness; void main() { vec3 p = position + normal * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
  side: THREE.BackSide,
});

// ---------- 几何体工具 ----------
const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const sphere = (r, ws = 24, hs = 16) => cached(`s${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const capsule = (r, len) => cached(`c${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));
const cyl = (rt, rb, h, s = 20) => cached(`y${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const torus = (r, t, arc = Math.PI * 2, rs = 8, ts = 24) => cached(`t${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const box = (w, h, d) => cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cone = (r, h, s = 12) => cached(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
// 旋转曲面：用 [半径, 高度] 轮廓画出圆润的躯干、裙子
const lathe = (key, pts) => cached('l' + key, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28));
// 只盖住上半部分的球面（头发、帽子）
const capGeo = (r, cover) => cached(`h${r}|${cover}`, () => new THREE.SphereGeometry(r, 28, 16, 0, Math.PI * 2, 0, Math.PI * cover));

// 放一个部件：位置、旋转、缩放一次设好；outline=false 表示不描边（很小或透明的部件）
function part(parent, geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], outline = true, mat } = {}) {
  const m = new THREE.Mesh(geo, mat || toon(color));
  m.position.set(...p);
  m.rotation.set(...r);
  m.scale.set(...s);
  m.castShadow = true;
  m.userData.outline = outline;
  parent.add(m);
  return m;
}
function group(parent, p = [0, 0, 0], r = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.set(...p);
  g.rotation.set(...r);
  parent.add(g);
  return g;
}

// ---------- 通用身体 ----------
function skeleton(o) {
  const skin = o.skin || SKIN;
  const root = new THREE.Group();

  // 腿和鞋
  const legs = [-1, 1].map(sd => {
    const leg = group(root, [sd * 0.1, 0.42, 0]);
    part(leg, capsule(0.068, 0.2), o.socks || o.pants, { p: [0, -0.16, 0] });
    const shoe = group(leg, [0, -0.34, 0.03]);
    part(shoe, sphere(0.095), o.shoes, { s: [1, 0.62, 1.4] });
    part(shoe, box(0.17, 0.035, 0.27), o.sole || '#3a2a20', { p: [0, -0.05, 0] });
    if (o.shoeStripe) part(shoe, box(0.19, 0.02, 0.1), o.shoeStripe, { p: [0, 0.01, 0.02], outline: false });
    return leg;
  });

  // 躯干：裙装是外扩的下摆，普通衣服是圆润的上身 + 裤子
  if (o.dress) {
    part(root, lathe('dress' + (o.dressFlare || 0.36), [[0, 0.3], [o.dressFlare || 0.36, 0.3], [o.dressFlare - 0.04 || 0.32, 0.36], [0.24, 0.6], [0.21, 0.8], [0.19, 0.92], [0.12, 0.99], [0, 1.0]]), o.dress);
  } else {
    part(root, sphere(0.205), o.pants, { p: [0, 0.47, 0], s: [1, 0.55, 0.9] });
    part(root, lathe('torso', [[0, 0.44], [0.2, 0.45], [0.235, 0.56], [0.225, 0.76], [0.2, 0.9], [0.12, 0.99], [0, 1.0]]), o.shirt);
  }
  part(root, cyl(0.07, 0.075, 0.1), skin, { p: [0, 1.03, 0] });

  // 手臂：肩膀处是转轴；手是带大拇指的“手套”形状
  const arms = [-1, 1].map(sd => {
    const arm = group(root, [sd * 0.235, 0.92, 0], [0, 0, sd * 0.2]);
    part(arm, capsule(0.06, 0.22), o.sleeve || o.dress || o.shirt, { p: [0, -0.15, 0] });
    if (o.cuff) part(arm, torus(0.062, 0.018), o.cuff, { p: [0, -0.27, 0], r: [Math.PI / 2, 0, 0], outline: false });
    const hand = group(arm, [0, -0.35, 0]);
    part(hand, sphere(0.072), skin, { s: [1, 1.05, 0.85] });
    part(hand, sphere(0.032), skin, { p: [-sd * 0.05, 0.02, 0.04] });
    arm.userData.hand = hand;
    return arm;
  });

  // 头
  const head = group(root, [0, 1.36, 0]);
  part(head, sphere(0.37, 32, 22), skin, { s: [1.04, 0.96, 1] });
  [-1, 1].forEach(sd => part(head, sphere(0.075, 12, 10), skin, { p: [sd * 0.37, -0.03, 0], s: [0.5, 1, 0.8] }));
  if (!o.masked) {
    part(head, sphere(0.03, 10, 8), '#f2b48f', { p: [0, -0.06, 0.365], outline: false });
    // 张开的笑嘴 + 小舌头
    const mouthMat = toon(o.lips || '#7a1f1f', { side: THREE.DoubleSide });
    part(head, cached('mouth', () => new THREE.CircleGeometry(0.062, 18, Math.PI, Math.PI)), null, { p: [0, -0.15, 0.343], r: [-0.22, 0, 0], outline: false, mat: mouthMat });
    part(head, cached('tongue', () => new THREE.CircleGeometry(0.032, 12, Math.PI, Math.PI)), null, { p: [0, -0.187, 0.346], r: [-0.22, 0, 0], outline: false, mat: toon('#ff7b8a', { side: THREE.DoubleSide }) });
    [-1, 1].forEach(sd => part(head, cached('blush', () => new THREE.CircleGeometry(0.055, 16)), null, {
      p: [sd * 0.22, -0.085, 0.3], r: [0, sd * 0.55, 0], outline: false, mat: toon('#ff9aa0', { transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    }));
  }
  // 眼睛：眼白、虹膜、瞳孔、两个高光、上眼线；女生加睫毛
  const eyes = [-1, 1].map(sd => {
    // 眼睛要稍微凸出脸面，否则会被头部挡住只剩瞳孔
    const eye = group(head, [sd * 0.13, 0.0, o.masked ? 0.392 : 0.335], [0, sd * 0.3, 0]);
    part(eye, sphere(0.085, 18, 14), '#ffffff', { s: [0.82, 1.14, 0.5] });
    part(eye, sphere(0.062, 16, 12), o.eye || '#5a3a22', { p: [0, -0.008, 0.024], s: [0.82, 1.1, 0.45], outline: false });
    part(eye, sphere(0.033, 12, 10), '#141414', { p: [0, -0.008, 0.042], s: [1, 1.1, 0.4], outline: false });
    part(eye, sphere(0.019, 8, 6), '#ffffff', { p: [0.022, 0.035, 0.052], outline: false });
    part(eye, sphere(0.009, 6, 6), '#ffffff', { p: [-0.018, -0.03, 0.052], outline: false });
    part(eye, torus(0.08, 0.013, Math.PI * 0.9), '#2b1a10', { p: [0, 0.006, 0.012], r: [0, 0, Math.PI * 0.05], s: [0.9, 1.15, 1], outline: false });
    if (o.lashes) part(eye, cone(0.016, 0.06, 6), '#2b1a10', { p: [sd * 0.072, 0.07, 0.012], r: [0, 0, -sd * 0.9], outline: false });
    return eye;
  });
  if (!o.noBrows) [-1, 1].forEach(sd => part(head, capsule(0.014, 0.075), o.brows || '#4a2e1c', { p: [sd * 0.13, 0.15, 0.34], r: [0, sd * 0.25, Math.PI / 2 + sd * 0.12], outline: false }));

  return { root, head, arms, legs, eyes };
}

// 合并：同一个组（一起动的部件）里材质相同的网格合成一个，大幅减少绘制次数
function mergeTree(obj) {
  obj.children.filter(c => !c.isMesh).forEach(mergeTree);
  const buckets = new Map();
  obj.children.filter(c => c.isMesh).forEach(m => {
    const key = m.material.uuid + '|' + (m.userData.outline !== false);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(m);
  });
  buckets.forEach(list => {
    if (list.length < 2) return;
    const geos = list.map(m => {
      m.updateMatrix();
      let g = m.geometry.index ? m.geometry : m.geometry;
      g = g.clone().applyMatrix4(m.matrix);
      ['uv1', 'uv2'].forEach(a => g.deleteAttribute && g.getAttribute(a) && g.deleteAttribute(a));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) return;
    const mm = new THREE.Mesh(merged, list[0].material);
    mm.userData.outline = list[0].userData.outline;
    mm.castShadow = true;
    list.forEach(m => obj.remove(m));
    obj.add(mm);
  });
}

// 给所有够大的部件加描边
function addOutlines(root) {
  const list = [];
  root.traverse(m => {
    if (!m.isMesh || m.userData.outline === false || m.material.transparent) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    if (m.geometry.boundingSphere.radius < 0.03) return;
    list.push(m);
  });
  list.forEach(m => { const ol = new THREE.Mesh(m.geometry, outlineMat); ol.userData.isOutline = true; m.add(ol); });
}

// ---------- 六个角色 ----------
const strawTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e6c27a';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#c99d4d';
  g.lineWidth = 3;
  for (let k = 0; k < 64; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 32, 64); g.stroke(); g.beginPath(); g.moveTo(k + 32, 0); g.lineTo(k, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
})();
function textTex(text, bg, fg, w = 128, h = 128, size = 90) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `bold ${size}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BUILDERS = {
  // 阿土伯：编织草帽、白发白胡子、背心、弯柄拐杖
  atubo() {
    const c = skeleton({ shirt: '#f7f2e6', sleeve: '#f7f2e6', pants: '#6b4f2e', shoes: '#5a3a22', eye: '#4a3020', brows: '#f4f4ee', cuff: '#e3dccb' });
    const { head, root, arms } = c;
    part(root, lathe('vest', [[0.205, 0.46], [0.24, 0.56], [0.23, 0.76], [0.205, 0.9], [0.13, 0.985]]), '#8a5a2b', { s: [1.03, 1, 1.03] });
    part(root, box(0.03, 0.4, 0.02), '#f7f2e6', { p: [0, 0.71, 0.232], outline: false });
    [0.62, 0.72, 0.82].forEach(y => part(root, sphere(0.018), '#f2c94c', { p: [0.04, y, 0.232], outline: false }));
    [-1, 1].forEach(sd => part(root, box(0.08, 0.06, 0.02), '#734820', { p: [sd * 0.12, 0.6, 0.215], r: [0, sd * 0.4, 0] }));
    // 白发、胡子
    [-1, 1].forEach(sd => part(head, sphere(0.12), '#f1f1ea', { p: [sd * 0.31, 0.02, -0.08], s: [0.55, 1, 1.1] }));
    part(head, sphere(0.14), '#f1f1ea', { p: [0, -0.02, -0.28], s: [1.6, 0.9, 0.6] });
    [[0, -0.24, 0.26, 0.17], [-0.1, -0.2, 0.27, 0.11], [0.1, -0.2, 0.27, 0.11], [0, -0.32, 0.22, 0.1]].forEach(([x, y, z, r]) => part(head, sphere(r), '#f6f6f0', { p: [x, y, z], s: [1, 0.85, 0.7] }));
    [-1, 1].forEach(sd => part(head, sphere(0.07), '#f6f6f0', { p: [sd * 0.075, -0.11, 0.335], s: [1.5, 0.6, 0.6], r: [0, 0, sd * 0.2] }));
    // 草帽
    const hat = group(head, [0, 0.22, 0], [-0.08, 0, 0]);
    part(hat, cyl(0.6, 0.6, 0.035, 36), null, { mat: new THREE.MeshToonMaterial({ map: strawTex, gradientMap: gradient }) });
    part(hat, cyl(0.25, 0.31, 0.22, 28), null, { p: [0, 0.12, 0], mat: new THREE.MeshToonMaterial({ map: strawTex, gradientMap: gradient }) });
    part(hat, cyl(0.315, 0.315, 0.07, 28), '#b5442f', { p: [0, 0.05, 0], outline: false });
    // 弯柄拐杖
    const cane = group(arms[1].userData.hand, [0, 0, 0.05]);
    part(cane, cyl(0.022, 0.022, 0.78, 8), '#6b3f1d', { p: [0, -0.37, 0] });
    part(cane, torus(0.07, 0.022, Math.PI, 8, 14), '#6b3f1d', { p: [-0.07, 0.02, 0], r: [0, 0, 0] });
    return c;
  },
  // 孙小美：一缕缕刘海、发卷马尾、蝴蝶结、娃娃领连衣裙、白袜红皮鞋
  xiaomei() {
    const c = skeleton({ dress: '#ff8fb8', dressFlare: 0.37, pants: '#ffd9b8', socks: '#ffffff', shoes: '#d6336c', sole: '#7a1032', eye: '#7a3f1c', lashes: true, brows: '#5a3220', cuff: '#ffffff' });
    const { head, root } = c;
    const hair = '#5a3220';
    part(head, capGeo(0.395, 0.52), hair, { p: [0, 0.02, -0.02] });
    part(head, sphere(0.36), hair, { p: [0, -0.02, -0.08], s: [1.05, 1, 0.95] });
    [-0.2, -0.07, 0.07, 0.2].forEach((x, k) => part(head, sphere(0.1), hair, { p: [x, 0.2 - Math.abs(x) * 0.25, 0.28], s: [1, 0.75, 0.6], r: [0, 0, (k - 1.5) * 0.25] }));
    [-1, 1].forEach(sd => {
      const tail = group(head, [sd * 0.42, 0.02, -0.06], [0, 0, sd * 0.25]);
      part(tail, sphere(0.13), hair, { s: [0.85, 1.1, 0.85] });
      part(tail, sphere(0.1), hair, { p: [sd * 0.04, -0.17, 0], s: [0.8, 1.1, 0.8] });
      part(tail, sphere(0.06), hair, { p: [sd * 0.02, -0.29, 0] });
      const bow = group(head, [sd * 0.33, 0.17, -0.02], [0, 0, sd * 0.3]);
      [-1, 1].forEach(b => part(bow, cone(0.07, 0.15, 4), '#ff4d8d', { p: [b * 0.07, 0, 0], r: [0, 0, b * Math.PI / 2] }));
      part(bow, sphere(0.04), '#ff4d8d');
    });
    // 娃娃领、腰带蝴蝶结、裙摆花边
    [-1, 1].forEach(sd => part(root, sphere(0.1, 16, 10), '#ffffff', { p: [sd * 0.08, 0.95, 0.11], s: [1.1, 0.35, 0.9], r: [0.3, 0, sd * 0.2] }));
    part(root, torus(0.235, 0.025), '#ffffff', { p: [0, 0.6, 0], r: [Math.PI / 2, 0, 0], outline: false });
    part(root, torus(0.365, 0.022, Math.PI * 2, 8, 36), '#ffffff', { p: [0, 0.31, 0], r: [Math.PI / 2, 0, 0], outline: false });
    const back = group(root, [0, 0.62, -0.23]);
    [-1, 1].forEach(b => part(back, cone(0.08, 0.17, 4), '#ff4d8d', { p: [b * 0.08, 0, 0], r: [0, 0, b * Math.PI / 2] }));
    part(back, sphere(0.045), '#ff4d8d');
    return c;
  },
  // 钱夫人：发髻配金簪和花、旗袍立领和盘扣、珍珠项链、翡翠手镯、带扇骨的折扇
  qian() {
    const c = skeleton({ dress: '#d62828', dressFlare: 0.32, pants: '#ffd9b8', shoes: '#7a1010', sole: '#3a0606', eye: '#2a1a12', lashes: true, lips: '#a30d1b', brows: '#1c1c1c' });
    const { head, root, arms } = c;
    const hair = '#1c1c1c';
    part(head, capGeo(0.39, 0.55), hair, { p: [0, 0.02, -0.02] });
    part(head, sphere(0.36), hair, { p: [0, 0, -0.08] });
    part(head, sphere(0.15), hair, { p: [-0.12, 0.25, 0.25], s: [1.6, 0.6, 0.7], r: [0, 0, 0.3] });
    part(head, sphere(0.18), hair, { p: [0, 0.36, -0.12] });
    part(head, torus(0.12, 0.04), hair, { p: [0, 0.4, -0.12], r: [Math.PI / 2.4, 0, 0] });
    part(head, cyl(0.012, 0.012, 0.5, 6), '#f2c94c', { p: [0.08, 0.42, -0.1], r: [0, 0, 1.15], outline: false });
    for (let k = 0; k < 5; k++) part(head, sphere(0.045), '#ff6b8a', { p: [-0.2 + Math.cos(k * 1.256) * 0.05, 0.38 + Math.sin(k * 1.256) * 0.05, -0.02], outline: false });
    part(head, sphere(0.03), '#ffd43b', { p: [-0.2, 0.38, -0.01], outline: false });
    [-1, 1].forEach(sd => part(head, sphere(0.032), '#a8e6cf', { p: [sd * 0.37, -0.13, 0.03], outline: false }));
    // 旗袍立领、金边、盘扣、珍珠项链
    part(root, cyl(0.1, 0.12, 0.08), '#d62828', { p: [0, 1.01, 0] });
    part(root, cyl(0.325, 0.325, 0.03, 32), '#f2c94c', { p: [0, 0.32, 0], outline: false });
    [0.86, 0.78, 0.7].forEach(y => part(root, torus(0.025, 0.008), '#f2c94c', { p: [0.1, y, 0.19], outline: false }));
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; part(root, sphere(0.022, 8, 6), '#fffaf0', { p: [Math.sin(a) * 0.14, 0.98 - (Math.cos(a) + 1) * 0.03, Math.cos(a) * 0.14 + 0.02], outline: false }); }
    part(arms[0].userData.hand, torus(0.07, 0.02), '#3cbf8f', { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], outline: false });
    // 折扇：扇面 + 扇骨
    const fan = group(arms[1].userData.hand, [0, 0.02, 0.1], [0.4, 0, 0.9]);
    part(fan, cached('fanFace', () => new THREE.CircleGeometry(0.28, 20, Math.PI * 0.2, Math.PI * 0.6)), null, { mat: toon('#f2c94c', { side: THREE.DoubleSide }) });
    for (let k = 0; k <= 6; k++) { const a = Math.PI * 0.2 + (k / 6) * Math.PI * 0.6; part(fan, box(0.01, 0.28, 0.01), '#8a5a2b', { p: [Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.005], r: [0, 0, a - Math.PI / 2], outline: false }); }
    return c;
  },
  // 金贝贝：反戴棒球帽、刺猬头、号码 T 恤、创可贴、条纹球鞋
  beibei() {
    const c = skeleton({ shirt: '#ffd23f', pants: '#2f6fd6', shoes: '#ffffff', shoeStripe: '#e53935', sole: '#cfd6dd', eye: '#3a6fd6', brows: '#c4621a', cuff: '#e53935' });
    const { head, root } = c;
    const hair = '#e07a1f';
    part(head, capGeo(0.385, 0.48), hair, { p: [0, 0.02, 0] });
    for (let k = 0; k < 7; k++) part(head, cone(0.07, 0.2, 6), hair, { p: [-0.24 + k * 0.08, 0.2, 0.27], r: [0.9, 0, (k - 3) * 0.2] });
    // 反戴的帽子
    part(head, capGeo(0.4, 0.42), '#1f5fbf', { p: [0, 0.05, -0.02] });
    part(head, cyl(0.21, 0.21, 0.03, 24), '#1f5fbf', { p: [0, 0.18, -0.38], s: [1, 1, 0.75] });
    part(head, sphere(0.04), '#e53935', { p: [0, 0.44, -0.02], outline: false });
    const logo = part(head, cached('logoPlane', () => new THREE.PlaneGeometry(0.16, 0.16)), null, { p: [0, 0.26, 0.355], r: [-0.55, 0, 0], outline: false, mat: new THREE.MeshToonMaterial({ map: textTex('B', '#1f5fbf', '#ffffff'), gradientMap: gradient }) });
    logo.visible = false;
    part(head, box(0.1, 0.035, 0.02), '#f0c7a0', { p: [0.2, -0.06, 0.3], r: [0, 0.55, 0.5], outline: false });
    // T 恤号码
    part(root, cached('shirtNum', () => new THREE.PlaneGeometry(0.2, 0.2)), null, { p: [0, 0.72, 0.235], outline: false, mat: new THREE.MeshToonMaterial({ map: textTex('8', '#ffd23f', '#e53935'), gradientMap: gradient, transparent: false }) });
    part(root, torus(0.21, 0.02), '#e53935', { p: [0, 0.93, 0], r: [Math.PI / 2, 0, 0], outline: false });
    return c;
  },
  // 忍太郎：面罩只露眼睛、护额金属片、红围巾、腰带、绑带、背后缠柄武士刀、手里剑
  ninja() {
    const c = skeleton({ shirt: '#262b33', pants: '#262b33', shoes: '#14161a', sole: '#0a0a0a', masked: true, eye: '#1d1d1d', noBrows: true, cuff: '#e9e2d0' });
    const { head, root } = c;
    part(head, sphere(0.385, 32, 22), '#262b33', { s: [1.04, 0.96, 1] });
    part(head, box(0.52, 0.17, 0.1), SKIN, { p: [0, 0.0, 0.345] });
    [-1, 1].forEach(sd => part(head, box(0.11, 0.022, 0.02), '#141414', { p: [sd * 0.13, 0.095, 0.4], r: [0, 0, sd * -0.35], outline: false }));
    part(head, torus(0.385, 0.04, Math.PI * 2, 8, 32), '#e53935', { p: [0, 0.16, 0], r: [Math.PI / 2, 0, 0] });
    part(head, box(0.2, 0.09, 0.03), '#cfd6dd', { p: [0, 0.16, 0.39], mat: toon('#cfd6dd', { emissive: '#333' }) });
    part(head, cone(0.025, 0.05, 3), '#5a6370', { p: [0, 0.16, 0.41], r: [Math.PI / 2, 0, 0], outline: false });
    [-1, 1].forEach(sd => part(head, box(0.07, 0.32, 0.02), '#e53935', { p: [sd * 0.07, 0.02, -0.38], r: [0.3, 0, sd * 0.35] }));
    // 红围巾 + 飘带
    part(root, torus(0.15, 0.06), '#e53935', { p: [0, 1.0, 0], r: [Math.PI / 2, 0, 0] });
    part(root, box(0.12, 0.38, 0.03), '#e53935', { p: [0.1, 0.84, -0.2], r: [0.5, 0, -0.3] });
    // 腰带 + 手里剑
    part(root, torus(0.225, 0.035), '#5b3a1a', { p: [0, 0.55, 0], r: [Math.PI / 2, 0, 0] });
    const star = group(root, [0.16, 0.55, 0.17], [0, 0.5, 0]);
    for (let k = 0; k < 4; k++) part(star, cone(0.03, 0.09, 3), '#9aa3ad', { r: [0, 0, (k * Math.PI) / 2], p: [Math.sin(k * Math.PI / 2) * -0.04, Math.cos(k * Math.PI / 2) * 0.04, 0], outline: false });
    // 背后的武士刀
    const sword = group(root, [0, 0.8, -0.25], [0, 0, 0.65]);
    part(sword, box(0.05, 0.7, 0.025), '#cfd6dd', { p: [0, 0.15, 0], mat: toon('#dfe6ec', { emissive: '#222' }) });
    part(sword, cyl(0.033, 0.033, 0.24, 8), '#3a2214', { p: [0, -0.33, 0] });
    for (let k = 0; k < 4; k++) part(sword, torus(0.035, 0.008), '#e9e2d0', { p: [0, -0.24 - k * 0.05, 0], r: [Math.PI / 2, 0, 0.6], outline: false });
    part(sword, cyl(0.07, 0.07, 0.02, 10), '#d4a017', { p: [0, -0.2, 0] });
    return c;
  },
  // 大老千：插着扑克牌的高礼帽、燕尾服翻领、马甲、怀表链、卷八字胡、单片眼镜、一手扑克牌
  laoqian() {
    const c = skeleton({ shirt: '#1f1f24', pants: '#1f1f24', shoes: '#0d0d0d', sole: '#000000', eye: '#3a2a1a', brows: '#2b1d14', cuff: '#ffffff' });
    const { head, root, arms } = c;
    part(root, cone(0.11, 0.34, 3), '#ffffff', { p: [0, 0.8, 0.19], r: [Math.PI + 0.12, 0, 0] });
    [-1, 1].forEach(sd => part(root, box(0.09, 0.32, 0.03), '#2e2e36', { p: [sd * 0.1, 0.8, 0.21], r: [0.12, 0, sd * -0.35] }));
    part(root, lathe('waistcoat', [[0.205, 0.5], [0.235, 0.58], [0.226, 0.68]]), '#7a1c2a', { s: [1.02, 1, 1.02] });
    [-1, 1].forEach(sd => part(root, cone(0.06, 0.12, 4), '#d62828', { p: [sd * 0.06, 0.95, 0.2], r: [0, 0, sd * Math.PI / 2] }));
    part(root, sphere(0.03), '#d62828', { p: [0, 0.95, 0.21], outline: false });
    part(root, torus(0.08, 0.008, Math.PI), '#f2c94c', { p: [0.06, 0.6, 0.235], r: [0, 0, Math.PI], outline: false });
    part(root, cyl(0.03, 0.03, 0.012, 14), '#f2c94c', { p: [0.14, 0.58, 0.235], r: [Math.PI / 2, 0, 0], outline: false });
    // 头发、卷胡子、单片眼镜
    part(head, capGeo(0.385, 0.38), '#2b1d14', { p: [0, 0, -0.03] });
    [-1, 1].forEach(sd => {
      part(head, sphere(0.06), '#2b1d14', { p: [sd * 0.08, -0.085, 0.34], s: [1.9, 0.55, 0.6], r: [0, 0, sd * -0.25] });
      part(head, torus(0.035, 0.016, Math.PI * 1.2), '#2b1d14', { p: [sd * 0.17, -0.06, 0.32], r: [0, 0, sd > 0 ? -0.6 : Math.PI + 0.6], outline: false });
    });
    part(head, torus(0.075, 0.013), '#f2c94c', { p: [0.13, 0.0, 0.345], mat: toon('#f2c94c', { emissive: '#3a2a00' }), outline: false });
    part(head, cyl(0.004, 0.004, 0.35, 4), '#f2c94c', { p: [0.2, -0.17, 0.32], r: [0, 0, 0.3], outline: false });
    // 高礼帽 + 帽带里的扑克牌
    const hat = group(head, [0, 0.25, 0], [-0.06, 0, 0.06]);
    part(hat, cyl(0.44, 0.44, 0.04, 32), '#16161a');
    part(hat, cyl(0.27, 0.28, 0.48, 28), '#16161a', { p: [0, 0.26, 0] });
    part(hat, cyl(0.285, 0.285, 0.08, 28), '#d62828', { p: [0, 0.07, 0], outline: false });
    part(hat, cached('card', () => new THREE.PlaneGeometry(0.12, 0.17)), null, { p: [0.2, 0.18, 0.2], r: [0, 0.8, 0.2], outline: false, mat: new THREE.MeshToonMaterial({ map: textTex('A♥', '#ffffff', '#d62828', 96, 128, 46), gradientMap: gradient, side: THREE.DoubleSide }) });
    // 手里一把扑克牌
    const cards = group(arms[0].userData.hand, [0, 0.04, 0.08], [0.2, 0, -0.3]);
    ['K♠', 'A♥', 'Q♦'].forEach((t, k) => part(cards, cached('card', () => new THREE.PlaneGeometry(0.12, 0.17)), null, { p: [(k - 1) * 0.05, 0.06, k * 0.004], r: [0, 0, (1 - k) * 0.35], outline: false, mat: new THREE.MeshToonMaterial({ map: textTex(t, '#ffffff', k === 0 ? '#111' : '#d62828', 96, 128, 46), gradientMap: gradient, side: THREE.DoubleSide }) }));
    return c;
  },
};

export function buildCharacter(key) {
  const c = (BUILDERS[key] || BUILDERS.atubo)();
  mergeTree(c.root);
  addOutlines(c.root);
  c.root.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.isOutline; o.receiveShadow = false; } });
  return c;
}
