// 建模工具：给建筑、景观用的一套"零件库"。
// 和 buildings.js 里旧的 kit 不同，这里的零件
//   1. 默认带倒角（圆角方块），边缘有高光，看起来更精致；
//   2. 按材质合并成少数几个网格，零件再多也只有几次绘制；
//   3. 贴图按"米"计算重复次数，大小方块上的砖、瓦、窗格疏密一致；
//   4. 支持局部坐标变换（push / pop），窗户、栏杆之类的零件可以朝向任意一面墙。
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

export const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

// ---------- 贴图 ----------
export function canvasTex(w, h, draw, { srgb = true, aniso = 16 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// 确定性的伪随机，保证每次启动生成的贴图一样
function prng(seed) { let t = seed >>> 0; return () => { t = (Math.imul(t, 1664525) + 1013904223) >>> 0; return t / 4294967296; }; }
function speckle(g, w, h, n, seed, colors, size = 2, alpha = 0.25) {
  const r = prng(seed);
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) { g.fillStyle = colors[Math.floor(r() * colors.length)]; g.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r())); }
  g.globalAlpha = 1;
}

export const TEX = {
  // 抹灰墙：白色带细密的颗粒（染色靠材质的 color）
  plaster: canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2600, 1, ['#d9d4c8', '#ffffff', '#efe9dc'], 2.2, 0.35);
  }),
  // 西式小屋顶的瓦片：一排排鱼鳞形的瓦，灰度的，用材质颜色染成地主色
  shingle: canvasTex(512, 512, (g, w, h) => {
    const r = prng(7), rows = 8, cols = 8, rh = h / rows, cw = w / cols;
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h);
    for (let j = rows - 1; j >= 0; j--) for (let i = -1; i <= cols; i++) {
      const x = i * cw + (j % 2 ? cw / 2 : 0), y = j * rh, v = 205 + Math.floor(r() * 50);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + cw, y); g.lineTo(x + cw, y + rh * 0.62);
      g.quadraticCurveTo(x + cw, y + rh * 1.12, x + cw / 2, y + rh * 1.12);
      g.quadraticCurveTo(x, y + rh * 1.12, x, y + rh * 0.62); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,70,70,.55)'; g.lineWidth = 2.5; g.stroke();
      // 每片瓦下沿的阴影
      const gr = g.createLinearGradient(0, y, 0, y + rh * 1.1);
      gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.22)');
      g.fillStyle = gr; g.fill();
    }
  }),
  // 中式筒瓦：竖向的瓦垄，一凸一凹
  cnTile: canvasTex(512, 512, (g, w, h) => {
    const n = 16, cw = w / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(i * cw, 0, (i + 1) * cw, 0);
      gr.addColorStop(0, '#8e8e8e'); gr.addColorStop(0.28, '#f4f4f4'); gr.addColorStop(0.5, '#ffffff');
      gr.addColorStop(0.72, '#ececec'); gr.addColorStop(1, '#7a7a7a');
      g.fillStyle = gr; g.fillRect(i * cw, 0, cw, h);
    }
    // 瓦片的横缝
    g.strokeStyle = 'rgba(40,40,40,.35)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    speckle(g, w, h, 900, 3, ['#999', '#fff'], 2, 0.25);
  }),
  brick: canvasTex(512, 512, (g, w, h) => {
    const r = prng(11), rows = 16, cols = 6, rh = h / rows, cw = w / cols;
    g.fillStyle = '#c9b9a6'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) {
      const x = i * cw + (j % 2 ? cw / 2 : 0) + 3, y = j * rh + 3;
      const k = 0.85 + r() * 0.25;
      g.fillStyle = `rgb(${Math.floor(178 * k)},${Math.floor(96 * k)},${Math.floor(72 * k)})`;
      g.fillRect(x, y, cw - 6, rh - 6);
    }
    speckle(g, w, h, 1800, 5, ['#6a3a2a', '#d7a58f'], 2, 0.2);
  }),
  planks: canvasTex(512, 512, (g, w, h) => {
    const r = prng(13), n = 8, ph = h / n;
    for (let j = 0; j < n; j++) {
      const v = 0.85 + r() * 0.3;
      g.fillStyle = `rgb(${Math.floor(176 * v)},${Math.floor(122 * v)},${Math.floor(74 * v)})`;
      g.fillRect(0, j * ph, w, ph);
      g.strokeStyle = 'rgba(70,40,15,.18)'; g.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const y = j * ph + r() * ph; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 3, w * .6, y - 3, w, y + 1); g.stroke(); }
      g.fillStyle = 'rgba(50,28,10,.65)'; g.fillRect(0, j * ph, w, 3);
    }
  }),
  stone: canvasTex(512, 512, (g, w, h) => {
    const r = prng(17), rows = 6, rh = h / rows;
    g.fillStyle = '#9d978c'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) {
      let x = -r() * 60;
      while (x < w) {
        const bw = 70 + r() * 90, v = 212 + Math.floor(r() * 36);
        g.fillStyle = `rgb(${v},${v - 4},${v - 14})`;
        g.fillRect(x + 2.5, j * rh + 2.5, bw - 5, rh - 5);
        x += bw;
      }
    }
    speckle(g, w, h, 1500, 19, ['#7c776c', '#fff'], 2, 0.2);
  }),
  // 玻璃幕墙：每层一排深蓝玻璃 + 一条窄的窗间墙，金属分格。一张贴图 = 1m 宽 × 1.2m 高（4 层）
  curtain: canvasTex(512, 614, (g, w, h) => {
    const r = prng(23), floors = 4, cols = 4, fh = h / floors, cw = w / cols;
    g.fillStyle = '#c4ccd6'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < floors; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw + 5, y = j * fh + 9, pw = cw - 10, ph = fh * 0.74;
      const gr = g.createLinearGradient(x, y, x + pw, y + ph);
      const k = r() * 0.5;
      gr.addColorStop(0, `rgb(${Math.floor(120 + 40 * k)},${Math.floor(190 + 30 * k)},255)`);
      gr.addColorStop(0.55, `rgb(${Math.floor(40 + 20 * k)},${Math.floor(110 + 30 * k)},${Math.floor(190 + 20 * k)})`);
      gr.addColorStop(1, '#173f70');
      g.fillStyle = gr; g.fillRect(x, y, pw, ph);
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.moveTo(x, y + ph); g.lineTo(x + pw * 0.45, y); g.lineTo(x + pw * 0.62, y); g.lineTo(x + pw * 0.1, y + ph); g.fill();
    }
  }),
  // 带窗的混凝土立面：一张贴图 = 0.6m 宽 × 0.6m 高 = 2 列 × 2 层窗
  facade: canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, 29, ['#cfd3d8', '#ffffff'], 2.4, 0.3);
    g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, h - 10, w, 10);
  }),
  asphalt: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#3b4048'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1800, 31, ['#222', '#666'], 1.6, 0.4); }),
  lawn: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#8fd06a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2400, 37, ['#7bc25a', '#a6e07d', '#6fb24f'], 2.2, 0.4); }),
};

// ---------- 材质 ----------
// tile：贴图一次重复对应的实际尺寸（米），可以是数字或 [宽, 高]
export function mat(color, o = {}) {
  const { tile, map, glass, ...rest } = o;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.03, ...(map ? { map } : {}), ...rest });
  if (tile) m.userData.tile = tile;
  if (glass) { m.roughness = 0.06; m.metalness = 0.35; m.envMapIntensity = 1.4; }
  return m;
}

// ---------- 零件箱 ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export function mkit(g) {
  const buckets = new Map();      // 材质 → 几何体列表
  const stack = [new THREE.Matrix4()];
  const cur = () => stack[stack.length - 1];

  // 放一个几何体。dims 是它沿 x/y/z 的实际大小（用来换算贴图重复次数）
  function put(geo, m, x = 0, y = 0, z = 0, rot = [0, 0, 0], sc = [1, 1, 1], dims) {
    const ge = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const n of Object.keys(ge.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') ge.deleteAttribute(n);
    if (!ge.attributes.uv) ge.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ge.attributes.position.count * 2), 2));
    const tile = m.userData.tile;
    if (tile && dims) {
      const tu = Array.isArray(tile) ? tile[0] : tile, tv = Array.isArray(tile) ? tile[1] : tile;
      const n = ge.attributes.normal, uv = ge.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
        let su, sv;
        if (az >= ax && az >= ay) { su = dims[0]; sv = dims[1]; }       // 前后面：宽 × 高
        else if (ax >= ay) { su = dims[2]; sv = dims[1]; }              // 左右面：深 × 高
        else { su = dims[0]; sv = dims[2]; }                            // 上下面：宽 × 深
        uv.setXY(i, uv.getX(i) * su / tu, uv.getY(i) * sv / tv);
      }
    }
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(sc[0], sc[1], sc[2]));
    ge.applyMatrix4(cur().clone().multiply(_m));
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(ge);
  }

  const api = {
    // 局部坐标：之后放的零件都相对 (x, y, z) 并绕 y 轴转 ry
    push(x = 0, y = 0, z = 0, ry = 0) {
      stack.push(cur().clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))));
    },
    pop() { stack.pop(); },
    // 方块：(w, h, d) 底面中心在 (x, y, z)，r 是倒角半径（0 = 直角）
    box(w, h, d, m, x, y, z, r = 0.02, rot) {
      // 小零件（倒角太小或自身太细）不做倒角，省面数；大块的墙体、屋面才倒角
      const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
      const geo = rr >= 0.012 && Math.min(w, h, d) > rr * 3 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
      put(geo, m, x, y + h / 2, z, rot, undefined, [w, h, d]);
    },
    // 圆柱/圆台：底面半径 r1、顶面半径 r2，底面中心在 (x, y, z)
    cyl(r1, r2, h, m, x, y, z, seg = 28, rot) {
      put(new THREE.CylinderGeometry(r2, r1, h, seg), m, x, y + h / 2, z, rot, undefined, [Math.max(r1, r2) * 2, h, Math.max(r1, r2) * 2]);
    },
    cone(r, h, m, x, y, z, seg = 28, rot) {
      put(new THREE.ConeGeometry(r, h, seg), m, x, y + h / 2, z, rot, undefined, [r * 2, h, r * 2]);
    },
    ball(r, m, x, y, z, sc = [1, 1, 1]) { put(new THREE.SphereGeometry(r, 24, 16), m, x, y, z, undefined, sc); },
    // 球冠（圆屋顶）：cover 0~1 是盖住球的多大比例
    dome(r, m, x, y, z, cover = 0.5, sc = [1, 1, 1]) { put(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * cover), m, x, y, z, undefined, sc); },
    torus(R, t, m, x, y, z, rot = [Math.PI / 2, 0, 0], arc = Math.PI * 2) { put(new THREE.TorusGeometry(R, t, 10, 32, arc), m, x, y, z, rot); },
    // 旋转曲面：pts 是 [半径, 高度] 的轮廓
    lathe(pts, m, x, y, z, seg = 32) { put(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), m, x, y, z); },
    // 任意几何体
    geo(geo, m, x = 0, y = 0, z = 0, rot, sc, dims) { put(geo, m, x, y, z, rot, sc, dims); },
    // 不参与合并的网格（会动的东西：闪烁灯、旗子）
    add(mesh, x = 0, y = 0, z = 0) {
      mesh.applyMatrix4(cur());
      mesh.position.add(new THREE.Vector3(x, y, z));
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    },
    // 合并并加进 group
    finish() {
      for (const [m, list] of buckets) {
        const merged = mergeGeometries(list, false);
        list.forEach(ge => ge.dispose());
        if (!merged) continue;
        const mesh = new THREE.Mesh(merged, m);
        mesh.castShadow = true; mesh.receiveShadow = true;
        g.add(mesh);
      }
      buckets.clear();
    },
  };
  return api;
}

// ---------- 可复用的建筑零件 ----------
export const PARTS = (() => {
  const glassMat = mat('#6aa9dc', { glass: true });
  const frameWhite = mat('#fbfaf6', { roughness: 0.5 });
  const frameDark = mat('#3a2f2a', { roughness: 0.55 });
  const sillMat = mat('#e8e2d4', { roughness: 0.7 });
  const curtainGlass = mat('#ffffff', { map: TEX.curtain, tile: [1, 1.2], roughness: 0.12, metalness: 0.35, envMapIntensity: 1.3 });

  // 一扇真窗：窗框 + 玻璃 + 十字窗棂 + 窗台；朝向 +z（用 push 转到别的墙面）
  //   o: { frame, arch（拱形上沿）, bars（窗棂数）, shutter（百叶窗颜色）, sill, box（窗台花箱）}
  function windowUnit(k, x, y, z, w, h, o = {}) {
    const fm = o.frame || frameWhite, t = 0.035;
    k.push(x, y, z, 0);
    // 外框（4 根）
    k.box(w + t * 2, t, 0.05, fm, 0, -t, 0.0, 0.008);
    k.box(w + t * 2, t, 0.05, fm, 0, h, 0.0, 0.008);
    k.box(t, h, 0.05, fm, -w / 2 - t / 2, 0, 0.0, 0.008);
    k.box(t, h, 0.05, fm, w / 2 + t / 2, 0, 0.0, 0.008);
    // 玻璃（略往里缩）
    k.box(w, h, 0.02, o.glass || glassMat, 0, 0, -0.005, 0);
    // 窗棂
    const bars = o.bars ?? 1;
    for (let i = 1; i <= bars; i++) k.box(0.018, h, 0.03, fm, -w / 2 + (w * i) / (bars + 1), 0, 0.004, 0.004);
    if (o.rows !== 0) k.box(w, 0.018, 0.03, fm, 0, h / 2 - 0.009, 0.004, 0.004);
    // 窗台
    if (o.sill !== false) k.box(w + 0.12, 0.03, 0.1, o.sillMat || sillMat, 0, -t - 0.03, 0.04, 0.008);
    // 百叶窗
    if (o.shutter) {
      const sm = o.shutterMat;
      k.box(w * 0.34, h + 0.03, 0.025, sm, -w / 2 - t - w * 0.17 - 0.005, -0.01, 0.0, 0.006);
      k.box(w * 0.34, h + 0.03, 0.025, sm, w / 2 + t + w * 0.17 + 0.005, -0.01, 0.0, 0.006);
    }
    k.pop();
  }

  // 门：门框 + 门板 + 门把手；w×h，朝 +z
  function door(k, x, y, z, w, h, doorMat, o = {}) {
    k.push(x, y, z, 0);
    k.box(w + 0.1, h + 0.05, 0.04, o.frame || frameWhite, 0, 0, 0, 0.01);
    k.box(w, h, 0.05, doorMat, 0, 0, 0.012, 0.008);
    if (o.panels !== false) {
      k.box(w * 0.34, h * 0.36, 0.012, o.panelMat || doorMat, -w * 0.2, h * 0.08, 0.04, 0.004);
      k.box(w * 0.34, h * 0.36, 0.012, o.panelMat || doorMat, w * 0.2, h * 0.08, 0.04, 0.004);
      k.box(w * 0.34, h * 0.26, 0.012, o.panelMat || doorMat, -w * 0.2, h * 0.52, 0.04, 0.004);
      k.box(w * 0.34, h * 0.26, 0.012, o.panelMat || doorMat, w * 0.2, h * 0.52, 0.04, 0.004);
    }
    k.ball(0.022, o.knob || mat('#e3b341', { metalness: 0.8, roughness: 0.25 }), w * 0.36, h * 0.46, 0.06);
    k.pop();
  }

  // 栏杆：长 len，沿 x 方向；立柱 + 扶手
  function railing(k, x, y, z, len, ry, m, h = 0.18) {
    k.push(x, y, z, ry);
    k.box(len, 0.022, 0.03, m, 0, h, 0, 0.006);
    k.box(len, 0.014, 0.025, m, 0, 0.02, 0, 0.004);
    const n = Math.max(2, Math.round(len / 0.07));
    for (let i = 0; i <= n; i++) k.box(0.014, h, 0.014, m, -len / 2 + (len * i) / n, 0, 0, 0.004);
    k.pop();
  }

  // 两坡屋顶：屋脊沿 z 方向（前后走向）。山墙三角面朝左右；屋面是两块有厚度的板，带出檐和屋脊盖
  function gableRoof(k, w, d, h, roofMat, wallMat, x, y, z, o = {}) {
    const ov = o.overhang ?? 0.09, th = o.thick ?? 0.055;
    const A = Math.atan2(h, w / 2), cA = Math.cos(A), sA = Math.sin(A);
    const ex = w / 2 + ov * cA, ey = -ov * sA;            // 屋檐末端（出檐后）
    const len = Math.hypot(ex, h - ey);                    // 屋面板沿坡度的长度
    k.push(x, y, z, 0);
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
    const tri = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    tri.translate(0, 0, -d / 2);
    k.geo(tri, wallMat, 0, 0, 0, undefined, undefined, [w, h, d]);
    for (const sx of [-1, 1]) {
      const cx = sx * ex / 2 + sx * sA * th / 2, cy = (h + ey) / 2 + cA * th / 2;
      k.geo(new RoundedBoxGeometry(len, th, d + ov * 2, 2, 0.014), roofMat, cx, cy, 0, [0, 0, -sx * A], undefined, [len, th, d + ov * 2]);
    }
    k.box(0.08, 0.05, d + ov * 2 + 0.02, o.ridgeMat || roofMat, 0, h + th * 0.55, 0, 0.02);
    k.pop();
  }

  // 烟囱
  function chimney(k, x, y, z, w, h, bodyMat, capMat) {
    k.box(w, h, w, bodyMat, x, y, z, 0.01);
    k.box(w + 0.06, 0.04, w + 0.06, capMat, x, y + h, z, 0.01);
  }

  // 遮阳篷（斜面）：宽 w，探出 d
  function awning(k, x, y, z, w, d, m, ry = 0) {
    k.push(x, y, z, ry);
    k.box(w, 0.025, d, m, 0, 0, d / 2, 0.01, [0.38, 0, 0]);
    k.box(w, 0.04, 0.02, m, 0, -0.1, d * 0.92, 0.008);
    k.pop();
  }

  return { windowUnit, door, railing, gableRoof, chimney, awning, glassMat, curtainGlass, frameWhite, frameDark, sillMat };
})();
