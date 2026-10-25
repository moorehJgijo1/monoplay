// 地产上的楼房：按所在片区的风格分四套造型，和街区中央的主题景观统一。
// old 古城（中式飞檐楼阁）、cbd 金融区（现代玻璃大楼）、beach 海滨（白墙度假屋）、fun 游乐园（童话城堡）。
// 每套都有 0~5 级：等级越高越高大。屋顶、遮阳篷、旗子等用地主的颜色，远看就能分清是谁的楼。
// 局部坐标里 +z 是正面（朝马路），占地不超过 1.5 × 1.5。
import * as THREE from 'three';

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function texMat(base, rx, ry, extra = {}) {
  const t = base.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, ...extra });
}

// ---------- 公用贴图和材质 ----------
const TEX = {
  win: canvasTex(64, 64, (g) => {
    g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#7cc4f2';
    for (let y = 6; y < 64; y += 20) for (let x = 6; x < 64; x += 20) g.fillRect(x, y, 12, 12);
  }),
  glass: canvasTex(64, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, '#9bd8ff'); grad.addColorStop(1, '#5aa9e6');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e3f4ff';
    for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 3);
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 2, 64);
  }),
  // 海滨酒店：白墙 + 蓝色拱窗
  resort: canvasTex(64, 64, (g) => {
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#5fb3e8';
    for (let x = 8; x < 64; x += 32) { g.fillRect(x, 14, 16, 20); g.beginPath(); g.arc(x + 8, 14, 8, Math.PI, 0); g.fill(); }
    g.fillStyle = '#e6e0d2'; g.fillRect(0, 54, 64, 4);
  }),
  // 古城：木格窗
  lattice: canvasTex(64, 64, (g) => {
    g.fillStyle = '#6b3a1a'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#e8c37a'; g.lineWidth = 3;
    for (let k = 8; k < 64; k += 12) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(64, k); g.stroke(); }
  }),
};
const M = {
  dark: std('#36414f'), door: std('#8b5a2b'), stone: std('#d9d2c3'), metal: std('#cfd6dd', { metalness: 0.6, roughness: 0.35 }),
  white: std('#fbfaf5'), cream: std('#fff3dc'), wood: std('#8a4b22'), redPillar: std('#b8382a'), grey: std('#a9a39a'),
  gold: std('#e8b630', { metalness: 0.55, roughness: 0.35 }), pool: std('#4fc3f7', { roughness: 0.15 }), deck: std('#c9a26b'),
  pinkWall: std('#ffe3ec'), lemonWall: std('#fff3c4'), mintWall: std('#dcf5e7'), candy: std('#ff6b8a'),
  light: new THREE.MeshBasicMaterial({ color: '#ff3b3b' }),
  lattice: new THREE.MeshStandardMaterial({ map: TEX.lattice, roughness: 0.6 }),
};

// ---------- 建模小工具 ----------
function kit(g) {
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y + h / 2, z);
  const cyl = (r1, r2, h, mat, x, y, z, seg = 16) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat), x, y + h / 2, z);
  const cone = (r, h, mat, x, y, z, seg = 16) => add(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat), x, y + h / 2, z);
  const ball = (r, mat, x, y, z) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat), x, y, z);
  return { add, box, cyl, cone, ball };
}
// 三角形山墙的两坡屋顶，屋脊前后走向
function gable(w, h, d, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, mat);
}
// 中式飞檐屋顶：出檐 + 四坡顶 + 四角翘起的檐角 + 宝顶
function roofCN(k, w, d, h, mat, y, { finial = true } = {}) {
  k.box(w + 0.26, 0.05, d + 0.26, mat, 0, y, 0);
  const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, 0.5, 0);
  geo.scale(w + 0.2, h, d + 0.2);
  k.add(new THREE.Mesh(geo, mat), 0, y + 0.05, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tip = k.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 5), mat), sx * (w / 2 + 0.12), y + 0.1, sz * (d / 2 + 0.12));
    tip.rotation.set(sz * 0.55, 0, -sx * 0.55);
  }
  if (finial) k.ball(0.06, M.gold, 0, y + 0.05 + h, 0);
}
// 城堡的垛口：沿着方形楼顶一圈小方块（w 是楼顶边长）
function battlements(k, w, y, mat) {
  const n = Math.max(3, Math.round(w / 0.16)), e = w / 2 - 0.04;
  for (let i = 0; i < n; i += 2) {
    const t = -w / 2 + (i + 0.5) * (w / n);
    k.box(0.1, 0.12, 0.08, mat, t, y, e);
    k.box(0.1, 0.12, 0.08, mat, t, y, -e);
    k.box(0.08, 0.12, 0.1, mat, e, y, t);
    k.box(0.08, 0.12, 0.1, mat, -e, y, t);
  }
}
// 圆塔 + 尖顶（城堡角楼、童话屋的小塔）
function turret(k, r, h, roofMat, wallMat, x, y, z) {
  k.cyl(r, r, h, wallMat, x, y, z, 14);
  k.cyl(r + 0.04, r + 0.04, 0.06, wallMat, x, y + h, z, 14);
  k.cone(r + 0.08, r * 2.6, roofMat, x, y + h + 0.06, z, 14);
  return y + h + 0.06 + r * 2.6;
}
// 摇摆的小旗子（地主颜色）
function flag(k, roof, x, y, z, h = 0.9) {
  k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 6), std('#666')), x, y + h / 2, z);
  k.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.03), roof), x + 0.22, y + h - 0.14, z);
}
const windowsFront = (k, w, y, z, n, mat = M.dark) => { for (let i = 0; i < n; i++) k.box(0.16, 0.18, 0.02, mat, -w / 2 + (i + 0.5) * (w / n), y, z); };

// ---------- 金融区：现代楼房（原来的造型） ----------
function modern(k, level, roof) {
  if (level === 0) {
    k.box(0.8, 0.5, 0.7, std('#d9a066'), 0, 0, 0);
    k.add(gable(0.92, 0.42, 0.82, roof), 0, 0.5, 0);
    k.box(0.2, 0.32, 0.02, M.door, 0, 0, 0.36);
    return 0.92;
  }
  if (level === 1) {
    k.box(1.15, 0.65, 0.9, M.white, 0, 0, 0);
    k.add(gable(1.3, 0.5, 1.02, roof), 0, 0.65, 0);
    k.box(0.14, 0.4, 0.14, std('#b5651d'), 0.35, 0.8, -0.15);
    k.box(0.22, 0.38, 0.02, M.door, 0, 0, 0.46);
    windowsFront(k, 1.15, 0.28, 0.46, 3);
    return 1.15;
  }
  if (level === 2) {
    k.box(1.2, 1.3, 1.0, M.cream, 0, 0, 0);
    k.add(gable(1.38, 0.62, 1.14, roof), 0, 1.3, 0);
    k.box(0.9, 0.06, 0.25, roof, 0, 0.68, 0.62);
    k.box(0.9, 0.18, 0.03, M.white, 0, 0.74, 0.74);
    k.box(0.24, 0.42, 0.02, M.door, 0, 0, 0.51);
    windowsFront(k, 1.2, 0.28, 0.51, 4);
    windowsFront(k, 1.2, 0.95, 0.51, 3);
    return 1.92;
  }
  if (level === 3) {
    k.box(1.2, 2.2, 1.1, texMat(TEX.win, 2, 4), 0, 0, 0);
    k.box(1.3, 0.14, 1.2, roof, 0, 2.2, 0);
    k.cyl(0.16, 0.16, 0.35, M.metal, -0.3, 2.34, -0.2, 12);
    k.box(0.6, 0.06, 0.3, roof, 0, 0.5, 0.68);
    k.box(0.3, 0.45, 0.02, M.dark, 0, 0, 0.56);
    return 2.75;
  }
  if (level === 4) {
    k.box(1.45, 0.55, 1.35, roof, 0, 0, 0);
    k.box(1.15, 2.9, 1.1, texMat(TEX.glass, 2, 6, { metalness: 0.3 }), 0, 0.55, 0);
    k.box(1.25, 0.3, 1.2, roof, 0, 3.45, 0);
    k.cyl(0.03, 0.03, 0.8, M.metal, 0.3, 3.75, 0, 6);
    k.box(0.5, 0.35, 0.02, M.dark, 0, 0, 0.68);
    return 3.75;
  }
  k.box(1.5, 0.8, 1.45, M.stone, 0, 0, 0);
  k.box(1.5, 0.12, 1.45, roof, 0, 0.8, 0);
  k.box(1.15, 2.6, 1.1, texMat(TEX.glass, 2, 6, { metalness: 0.3 }), 0, 0.92, 0);
  k.box(1.22, 0.14, 1.17, roof, 0, 3.52, 0);
  k.box(0.85, 1.7, 0.82, texMat(TEX.glass, 2, 4, { metalness: 0.3 }), 0, 3.66, 0);
  k.cone(0.62, 0.9, roof, 0, 5.36, 0, 4).rotation.y = Math.PI / 4;
  k.cyl(0.02, 0.06, 1.0, M.metal, 0, 6.25, 0, 6);
  k.ball(0.08, M.light, 0, 7.28, 0).userData.blink = true;
  k.box(0.6, 0.5, 0.02, M.dark, 0, 0, 0.73);
  return 6.3;
}

// ---------- 古城：中式楼阁，琉璃瓦屋顶是地主的颜色 ----------
function chinese(k, level, roof) {
  const base = (w, d, h = 0.12) => { k.box(w, h, d, M.grey, 0, 0, 0); return h; };
  const pillars = (w, d, y, h) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.035, 0.035, h, M.redPillar, sx * w / 2, y, sz * d / 2, 6); };
  if (level === 0) {
    // 小亭子：四根红柱 + 飞檐
    const y = base(0.85, 0.85, 0.1);
    pillars(0.6, 0.6, y, 0.5);
    k.box(0.3, 0.12, 0.3, M.grey, 0, y, 0);
    roofCN(k, 0.62, 0.62, 0.32, roof, y + 0.5);
    return 1.0;
  }
  if (level === 1) {
    // 四合院正房：白墙、木格窗、红门，前面一圈矮院墙
    const y = base(1.3, 1.1);
    k.box(1.1, 0.55, 0.75, M.white, 0, y, -0.12);
    k.box(0.24, 0.38, 0.02, M.redPillar, 0, y, 0.26);
    k.box(0.24, 0.16, 0.02, M.lattice, -0.34, y + 0.22, 0.26);
    k.box(0.24, 0.16, 0.02, M.lattice, 0.34, y + 0.22, 0.26);
    roofCN(k, 1.1, 0.75, 0.32, roof, y + 0.55);
    for (const sx of [-1, 1]) k.box(0.42, 0.22, 0.06, M.white, sx * 0.43, y, 0.5);
    return 1.0;
  }
  if (level === 2) {
    // 两层小楼：一层回廊红柱，二层木格窗，重檐
    const y = base(1.35, 1.25);
    k.box(1.0, 0.55, 0.8, M.white, 0, y, 0);
    pillars(1.12, 0.95, y, 0.55);
    k.box(0.24, 0.38, 0.02, M.redPillar, 0, y, 0.41);
    roofCN(k, 1.12, 0.95, 0.18, roof, y + 0.55, { finial: false });
    k.box(0.8, 0.5, 0.64, M.lattice, 0, y + 0.72, 0);
    k.box(0.92, 0.06, 0.76, M.redPillar, 0, y + 0.72, 0);
    roofCN(k, 0.84, 0.68, 0.36, roof, y + 1.22);
    return y + 1.65;
  }
  if (level === 3) {
    // 三层楼阁
    let y = base(1.4, 1.4, 0.18);
    const tiers = [[1.05, 0.6], [0.85, 0.5], [0.65, 0.45]];
    tiers.forEach(([w, h], i) => {
      k.box(w, h, w, i === 0 ? M.white : M.lattice, 0, y, 0);
      pillars(w + 0.08, w + 0.08, y, h);
      roofCN(k, w + 0.08, w + 0.08, i === tiers.length - 1 ? 0.38 : 0.16, roof, y + h, { finial: i === tiers.length - 1 });
      y += h + (i === tiers.length - 1 ? 0.45 : 0.2);
    });
    k.box(0.26, 0.38, 0.02, M.redPillar, 0, 0.18, 0.53);
    return y;
  }
  // 宝塔：大厦 5 层、摩天楼 7 层，顶上金色塔刹
  const n = level === 4 ? 5 : 7;
  let y = base(1.5, 1.5, 0.22);
  k.box(1.25, 0.12, 1.25, M.grey, 0, y, 0);
  y += 0.12;
  for (let i = 0; i < n; i++) {
    const s = 1 - i * (level === 4 ? 0.1 : 0.07), w = 1.0 * s, h = (level === 4 ? 0.52 : 0.5) * s;
    k.box(w, h, w, i % 2 ? M.lattice : M.white, 0, y, 0);
    pillars(w + 0.06, w + 0.06, y, h);
    roofCN(k, w + 0.06, w + 0.06, 0.16 * s, roof, y + h, { finial: false });
    y += h + 0.2 * s;
  }
  k.cyl(0.03, 0.07, 0.7, M.gold, 0, y, 0, 8);
  for (let i = 0; i < 3; i++) k.cyl(0.08 - i * 0.015, 0.08 - i * 0.015, 0.03, M.gold, 0, y + 0.15 + i * 0.15, 0, 10);
  if (level === 5) k.ball(0.07, M.light, 0, y + 0.78, 0).userData.blink = true;
  else k.ball(0.08, M.gold, 0, y + 0.74, 0);
  k.box(0.26, 0.38, 0.02, M.redPillar, 0, 0.34, 0.51);
  return y + 0.7;
}

// ---------- 海滨：白墙度假屋，遮阳篷和圆顶是地主的颜色 ----------
function seaside(k, level, roof) {
  if (level === 0) {
    // 高脚沙滩小屋
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.03, 0.03, 0.25, M.deck, sx * 0.3, 0, sz * 0.25, 6);
    k.box(0.8, 0.05, 0.7, M.deck, 0, 0.25, 0.04);
    k.box(0.65, 0.42, 0.5, std('#f7e7c6'), 0, 0.3, -0.04);
    k.add(gable(0.8, 0.3, 0.64, roof), 0, 0.72, -0.04);
    k.box(0.18, 0.28, 0.02, std('#5fb3e8'), 0, 0.3, 0.22);
    return 1.02;
  }
  if (level === 1) {
    // 白色平顶小别墅 + 遮阳篷 + 小泳池
    k.box(1.1, 0.6, 0.75, M.white, 0, 0, -0.25);
    k.box(1.16, 0.08, 0.81, roof, 0, 0.6, -0.25);
    k.box(0.24, 0.38, 0.02, std('#5fb3e8'), -0.25, 0, 0.13);
    k.box(0.3, 0.2, 0.02, std('#5fb3e8'), 0.25, 0.22, 0.13);
    k.box(0.7, 0.04, 0.32, roof, 0.1, 0.48, 0.3).rotation.x = 0.25;
    k.box(0.6, 0.04, 0.35, M.pool, 0.2, 0, 0.5);
    return 0.7;
  }
  if (level === 2) {
    // 圣托里尼式：错落的两层白房子，顶上一个圆顶
    k.box(1.2, 0.6, 0.9, M.white, 0, 0, -0.1);
    k.box(0.75, 0.55, 0.6, M.white, -0.18, 0.6, -0.22);
    k.box(0.22, 0.4, 0.02, std('#5fb3e8'), 0.2, 0, 0.36);
    windowsFront(k, 0.75, 0.82, 0.09, 2, std('#5fb3e8'));
    k.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), roof), -0.18, 1.15, -0.22).castShadow = true;
    k.box(0.45, 0.06, 0.5, M.white, 0.35, 0.6, 0.05);
    k.box(0.45, 0.12, 0.02, roof, 0.35, 0.66, 0.3);
    return 1.45;
  }
  if (level === 3) {
    // 四层度假酒店：拱窗、每层阳台、屋顶泳池和遮阳伞
    k.box(1.25, 2.1, 1.0, texMat(TEX.resort, 2, 4), 0, 0, -0.05);
    for (let i = 1; i < 4; i++) k.box(1.3, 0.04, 0.22, M.white, 0, i * 0.52, 0.55);
    for (let i = 1; i < 4; i++) k.box(1.3, 0.08, 0.02, roof, 0, i * 0.52 + 0.04, 0.66);
    k.box(1.31, 0.08, 1.06, roof, 0, 2.1, -0.05);
    k.box(0.6, 0.03, 0.4, M.pool, -0.2, 2.18, -0.15);
    k.cyl(0.01, 0.01, 0.35, M.white, 0.35, 2.18, 0.1, 4);
    k.cone(0.2, 0.08, roof, 0.35, 2.5, 0.1, 10);
    k.box(0.4, 0.4, 0.02, std('#5fb3e8'), 0, 0, 0.46);
    return 2.6;
  }
  if (level === 4) {
    // 弧形度假塔楼：一圈圈白色阳台，楼顶地主颜色的圆盘
    k.cyl(0.75, 0.78, 0.3, M.stone, 0, 0, 0, 24);
    k.cyl(0.55, 0.6, 3.1, texMat(TEX.resort, 4, 6), 0, 0.3, 0, 24);
    for (let i = 1; i < 7; i++) k.cyl(0.66, 0.66, 0.04, M.white, 0, 0.3 + i * 0.45, 0, 24);
    k.cyl(0.7, 0.62, 0.18, roof, 0, 3.4, 0, 24);
    k.cyl(0.03, 0.03, 0.5, M.metal, 0, 3.58, 0, 6);
    return 4.0;
  }
  // 帆船酒店：一面弧形的“风帆”立面，侧面伸出停机坪
  k.box(1.5, 0.25, 1.45, M.stone, 0, 0, 0);
  const sail = new THREE.Shape();
  sail.moveTo(-0.6, 0); sail.lineTo(0.6, 0); sail.quadraticCurveTo(0.6, 4.2, -0.6, 5.8); sail.closePath();
  const sg = new THREE.ExtrudeGeometry(sail, { depth: 0.9, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 16 });
  sg.translate(0, 0, -0.45);
  k.add(new THREE.Mesh(sg, texMat(TEX.resort, 1, 6)), 0.05, 0.25, 0);
  k.box(0.14, 5.9, 0.14, roof, -0.6, 0.25, 0.4);
  k.box(0.14, 5.9, 0.14, roof, -0.6, 0.25, -0.4);
  k.cyl(0.38, 0.38, 0.05, roof, 0.55, 4.1, 0.0, 20);
  k.box(0.5, 0.06, 0.08, M.metal, 0.25, 4.05, 0);
  k.cyl(0.02, 0.04, 0.8, M.metal, -0.6, 6.15, 0, 6);
  k.ball(0.07, M.light, -0.6, 7.0, 0).userData.blink = true;
  return 6.2;
}

// ---------- 游乐园：糖果色童话屋和城堡，尖顶是地主的颜色 ----------
function fairy(k, level, roof) {
  const walls = [M.pinkWall, M.lemonWall, M.mintWall];
  if (level === 0) {
    // 糖果小摊：条纹遮阳篷
    k.box(0.75, 0.42, 0.5, M.lemonWall, 0, 0, -0.05);
    k.box(0.8, 0.06, 0.3, roof, 0, 0.5, 0.28).rotation.x = 0.35;
    k.cyl(0.02, 0.02, 0.62, M.white, -0.36, 0, 0.36, 5);
    k.cyl(0.02, 0.02, 0.62, M.white, 0.36, 0, 0.36, 5);
    k.ball(0.12, M.candy, 0.2, 0.62, -0.1);
    k.cyl(0.012, 0.012, 0.2, M.white, 0.2, 0.42, -0.1, 4);
    return 0.75;
  }
  if (level === 1) {
    // 姜饼屋：陡坡顶、糖果柱、圆窗
    k.box(1.0, 0.6, 0.8, M.pinkWall, 0, 0, 0);
    k.add(gable(1.16, 0.7, 0.94, roof), 0, 0.6, 0);
    k.box(0.22, 0.36, 0.02, std('#c46a3a'), 0, 0, 0.41);
    k.cyl(0.08, 0.08, 0.02, M.white, -0.3, 0.35, 0.41, 12).rotation.x = Math.PI / 2;
    k.cyl(0.08, 0.08, 0.02, M.white, 0.3, 0.35, 0.41, 12).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) k.cyl(0.035, 0.035, 0.55, M.candy, sx * 0.55, 0, 0.45, 8);
    return 1.3;
  }
  if (level === 2) {
    // 小塔屋：房子 + 一座圆形尖顶小塔
    k.box(1.0, 0.85, 0.85, M.lemonWall, -0.15, 0, 0);
    k.add(gable(1.12, 0.5, 0.97, roof), -0.15, 0.85, 0);
    k.box(0.24, 0.4, 0.02, std('#c46a3a'), -0.15, 0, 0.43);
    windowsFront(k, 1.0, 0.55, 0.43, 2, std('#7cc4f2'));
    const top = turret(k, 0.25, 1.15, roof, M.pinkWall, 0.45, 0, 0.2);
    return top;
  }
  // 城堡：方形主堡 + 垛口 + 角楼，等级越高越高越多塔
  const keepH = level === 3 ? 1.1 : level === 4 ? 1.5 : 2.0;
  const kw = level === 3 ? 0.9 : 1.0;
  k.box(kw, keepH, kw, walls[level % 3], 0, 0, 0);
  battlements(k, kw, keepH, walls[level % 3]);
  k.box(0.3, 0.45, 0.02, std('#8a5a3c'), 0, 0, kw / 2 + 0.01);
  k.cyl(0.15, 0.15, 0.02, std('#8a5a3c'), 0, 0.45, kw / 2 + 0.01, 12).rotation.x = Math.PI / 2;
  windowsFront(k, kw, keepH * 0.6, kw / 2 + 0.01, 2, std('#7cc4f2'));
  const corners = level === 3 ? [[-1, 1], [1, 1]] : [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  const th = keepH + (level === 3 ? 0.25 : 0.3);
  corners.forEach(([sx, sz]) => turret(k, 0.2, th, roof, walls[(level + 1) % 3], sx * kw / 2, 0, sz * kw / 2));
  let top = th + 0.6;
  if (level >= 4) {
    // 中央高塔
    const mid = level === 4 ? 0.9 : 1.8;
    top = turret(k, 0.28, mid, roof, walls[(level + 2) % 3], 0, keepH, 0);
    if (level === 5) k.ball(0.07, M.light, 0, top + 0.08, 0).userData.blink = true;
  }
  return top;
}

const BUILDERS = { old: chinese, cbd: modern, beach: seaside, fun: fairy };

// 造一座楼：style 是片区风格，level 0~5，color 是地主颜色
export function makeBuilding(style, level, color) {
  const g = new THREE.Group();
  const roof = std(color, { roughness: 0.5 });
  const k = kit(g);
  const top = (BUILDERS[style] || modern)(k, level, roof);
  flag(k, roof, 0.64, 0, 0.64);
  g.userData.top = top;
  return g;
}

// ---------- 地块地面：和街区地面同一种风格 ----------
const LOT_TEX = {
  old: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#cbbf9f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a99c7a'; g.lineWidth = 4;
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  }),
  cbd: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#dde2e9'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cdd4de';
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) if ((x + y) / 32 % 2) g.fillRect(x, y, 32, 32);
    g.strokeStyle = '#f3f5f9'; g.lineWidth = 3;
    for (let k = 0; k <= w; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
  }),
  beach: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f0dca8'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 400; k++) { g.fillStyle = k % 2 ? '#e4cb8f' : '#fbecc4'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  }),
  fun: canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffe9c9'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd1dc';
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) if ((x + y) / 32 % 2) g.fillRect(x, y, 32, 32);
  }),
};
const CURB = { old: '#8f8a80', cbd: '#b9c1cc', beach: '#d9c18a', fun: '#ff9fb8' };
export function lotMaterials(style) {
  const t = (LOT_TEX[style] || LOT_TEX.cbd).clone();
  t.needsUpdate = true;
  t.repeat.set(1.2, 1.2);
  return { curb: std(CURB[style] || CURB.cbd), top: new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }) };
}

// 空地上的小摆设（放在地块后侧角落），没盖楼时也能看出是哪个片区
export function emptyDecor(style) {
  const g = new THREE.Group();
  const k = kit(g);
  if (style === 'old') {
    // 石灯笼
    k.box(0.22, 0.06, 0.22, M.grey, 0, 0, 0);
    k.cyl(0.04, 0.05, 0.3, M.grey, 0, 0.06, 0, 6);
    k.box(0.18, 0.14, 0.18, std('#ffcf6b', { emissive: '#ff9f1a', emissiveIntensity: 0.4 }), 0, 0.36, 0);
    k.cone(0.17, 0.12, M.grey, 0, 0.5, 0, 4).rotation.y = Math.PI / 4;
    k.cone(0.08, 0.28, std('#2f6b3e', { flatShading: true }), 0.32, 0.06, 0.05, 7);
  } else if (style === 'cbd') {
    // 方形花坛 + 一棵小树
    k.box(0.36, 0.14, 0.36, M.stone, 0, 0, 0);
    k.cyl(0.03, 0.04, 0.3, M.door, 0, 0.14, 0, 6);
    k.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), std('#4caf50', { flatShading: true })), 0, 0.55, 0);
  } else if (style === 'beach') {
    // 沙滩伞 + 躺椅
    k.cyl(0.015, 0.015, 0.6, M.white, 0, 0, 0, 5);
    k.cone(0.3, 0.13, std('#ff6b6b'), 0, 0.56, 0, 12);
    k.box(0.16, 0.03, 0.4, M.white, 0.25, 0.06, 0.1).rotation.x = -0.2;
  } else {
    // 一簇气球
    ['#ff6b6b', '#ffd34d', '#4dabf7'].forEach((c, i) => {
      const a = i * 2.1;
      k.ball(0.09, std(c, { roughness: 0.3 }), Math.cos(a) * 0.08, 0.72 + i * 0.07, Math.sin(a) * 0.08).scale.y = 1.15;
    });
    k.cyl(0.006, 0.006, 0.66, std('#888'), 0, 0, 0, 3);
    k.box(0.12, 0.1, 0.12, std('#ffe8a3'), 0, 0, 0);
  }
  return g;
}

// 椰子树（海滨片区的绿化）
export function palmTree(s = 1) {
  const p = new THREE.Group();
  const trunk = std('#9b6b3d'), frond = std('#3fae49', { flatShading: true, side: THREE.DoubleSide });
  let px = 0, py = 0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07 - i * 0.006, 0.08 - i * 0.006, 0.3, 7), trunk);
    seg.position.set(px, py + 0.15, 0);
    seg.rotation.z = -i * 0.07;
    seg.castShadow = true;
    p.add(seg);
    px += Math.sin(i * 0.07) * 0.3; py += Math.cos(i * 0.07) * 0.28;
  }
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.2), frond);
    f.geometry.translate(0.37, 0, 0);
    const holder = new THREE.Group();
    holder.position.set(px, py + 0.05, 0);
    holder.rotation.y = i / 7 * Math.PI * 2;
    f.rotation.set(Math.PI / 2, -0.35, 0);
    f.castShadow = true;
    holder.add(f);
    p.add(holder);
  }
  p.scale.setScalar(s);
  return p;
}

export { roofCN, kit, turret, battlements, gable, FONT };
