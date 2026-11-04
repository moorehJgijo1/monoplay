// 东边的体育场：椭圆形的看台（四层台阶、蓝白相间、过道）、外墙和立柱、半透明环形顶棚、
// 红色跑道和带草纹的球场（球门、角旗）、四座灯架、大屏幕记分牌、南面入口。
import * as THREE from 'three';
import { mkit, mat, TEX, canvasTex } from './modeling.js';

const fieldTex = canvasTex(256, 384, (c, w, h) => {
  c.fillStyle = '#3f9e4a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#48ad53'; for (let y = 0; y < h; y += 48) c.fillRect(0, y, w, 24);
  c.strokeStyle = '#ffffff'; c.lineWidth = 3;
  c.strokeRect(14, 14, w - 28, h - 28);
  c.beginPath(); c.moveTo(14, h / 2); c.lineTo(w - 14, h / 2); c.stroke();
  c.beginPath(); c.arc(w / 2, h / 2, 34, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(w / 2, h / 2, 3, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  c.strokeRect(w / 2 - 50, 14, 100, 46); c.strokeRect(w / 2 - 50, h - 60, 100, 46);
  c.strokeRect(w / 2 - 24, 14, 48, 20); c.strokeRect(w / 2 - 24, h - 34, 48, 20);
});
const trackTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#c4573a'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } });
const boardTex = canvasTex(256, 96, (c, w, h) => {
  c.fillStyle = '#10141c'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffd43b'; c.font = 'bold 56px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('2 : 1', w / 2, h / 2 + 3);
  c.fillStyle = '#ff6b6b'; c.fillRect(8, 8, 44, 6); c.fillStyle = '#4dabf7'; c.fillRect(w - 52, 8, 44, 6);
});

const M = {
  seatA: mat('#1c7ed6', { roughness: 0.55 }),
  seatB: mat('#eef1f4', { roughness: 0.55 }),
  concrete: mat('#d9d5cb', { map: TEX.plaster, tile: 1, roughness: 0.85 }),
  wall: mat('#f5f6f8', { roughness: 0.5 }),
  grey: mat('#aeb4bb', { metalness: 0.5, roughness: 0.4 }),
  dark: mat('#2b3442', { roughness: 0.5 }),
  field: mat('#ffffff', { map: fieldTex, roughness: 0.95 }),
  track: mat('#ffffff', { map: trackTex, tile: 1, roughness: 0.9 }),
  roof: mat('#f2f6fb', { roughness: 0.3, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  lampOn: mat('#fff8d6', { emissive: '#fff3b0', emissiveIntensity: 0.9, roughness: 0.4 }),
  board: new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }),
  red: mat('#e03131', { roughness: 0.5 }),
  glassD: mat('#2a3a50', { roughness: 0.2, metalness: 0.3 }),
};

// 椭圆环（外半轴 ao×bo，内半轴 ai×bi）挤出成台阶，底面在 y0，高 h
function ellipseRing(ao, bo, ai, bi, h) {
  const s = new THREE.Shape(); s.absellipse(0, 0, ao, bo, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path(); hole.absellipse(0, 0, ai, bi, 0, Math.PI * 2, true, 0); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 64 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function buildStadium(root, { x, z }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
  const k = mkit(g);
  const ax = 1.0, bz = 1.55;                       // 球场半宽 / 半长
  // 红色跑道（球场外的一圈）和球场
  k.geo(ellipseRing(ax + 0.38, bz + 0.38, ax, bz, 0.02), M.track, 0, 0.0, 0, undefined, undefined, [3, 0.02, 3]);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(ax * 2, bz * 2), M.field);
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0.025, 0); pitch.receiveShadow = true; g.add(pitch);
  // 球门
  for (const sz of [-1, 1]) {
    k.push(0, 0, sz * (bz - 0.04), sz > 0 ? Math.PI : 0);
    for (const sx of [-1, 1]) k.cyl(0.01, 0.01, 0.12, M.wall, sx * 0.12, 0.025, 0, 6);
    k.box(0.25, 0.012, 0.012, M.wall, 0, 0.145, 0, 0);
    k.box(0.25, 0.1, 0.002, M.grey, 0, 0.03, -0.08, 0);
    k.pop();
  }
  for (const [cx, cz] of [[-ax, -bz], [ax, -bz], [-ax, bz], [ax, bz]]) { k.cyl(0.004, 0.004, 0.08, M.wall, cx, 0.025, cz, 4); k.box(0.04, 0.025, 0.002, M.red, cx + 0.02, 0.08, cz, 0); }

  // 看台：四层台阶，蓝白相间，越往外越高；每隔一段有一道过道
  const r0 = 0.42, steps = 4, dr = 0.17, base = 0.02;
  for (let i = 0; i < steps; i++) {
    const ai = ax + r0 + i * dr, bi = bz + r0 + i * dr, h = 0.14 + i * 0.13;
    k.geo(ellipseRing(ai + dr, bi + dr, ai, bi, h), i % 2 ? M.seatB : M.seatA, 0, base, 0, undefined, undefined, [3, h, 3]);
    // 座椅的横向分隔线（细椭圆环）
    k.geo(ellipseRing(ai + dr * 0.55, bi + dr * 0.55, ai + dr * 0.5, bi + dr * 0.5, 0.004), M.wall, 0, base + h + 0.002, 0, undefined, undefined, [3, 0.01, 3]);
  }
  const aOut = ax + r0 + steps * dr, bOut = bz + r0 + steps * dr;   // 看台最外沿
  for (let i = 0; i < 20; i++) {                                    // 放射状过道
    const a = (i / 20) * Math.PI * 2;
    const px = Math.cos(a) * (aOut - 0.28), pz = Math.sin(a) * (bOut - 0.28);
    k.box(0.05, 0.5, 0.3, M.concrete, px, base, pz, 0.005, [0, Math.PI / 2 - a, 0]);
  }
  // 外墙：一圈白墙 + 竖向肋 + 立柱，南北两端各一个拱形入口
  k.geo(ellipseRing(aOut + 0.06, bOut + 0.06, aOut, bOut, 0.9), M.wall, 0, base, 0, undefined, undefined, [3, 0.9, 3]);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2, px = Math.cos(a) * (aOut + 0.09), pz = Math.sin(a) * (bOut + 0.09);
    k.cyl(0.018, 0.02, 1.05, M.grey, px, base, pz, 8);
  }
  for (const sz of [-1, 1]) {
    const ez = sz * (bOut + 0.08);
    k.box(0.42, 0.45, 0.1, M.glassD, 0, base, ez, 0);
    k.cyl(0.21, 0.21, 0.1, M.glassD, 0, base + 0.45, ez, 20, [Math.PI / 2, 0, 0]);
    k.torus(0.24, 0.025, M.wall, 0, base + 0.45, ez + sz * 0.05, [0, 0, 0], Math.PI);
  }

  // 顶棚：环形半透明板，悬在看台上方，外沿由立柱撑起，下面有放射状的肋
  {
    const ro = 0.4;
    const roof = ellipseRing(aOut + 0.12, bOut + 0.12, aOut - ro, bOut - ro, 0.03);
    k.geo(roof, M.roof, 0, 1.06, 0, undefined, undefined, [3, 0.03, 3]);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const x1 = ca * (aOut - ro), z1 = sa * (bOut - ro), x2 = ca * (aOut + 0.1), z2 = sa * (bOut + 0.1);
      k.box(Math.hypot(x2 - x1, z2 - z1), 0.025, 0.02, M.grey, (x1 + x2) / 2, 1.03, (z1 + z2) / 2, 0, [0, -Math.atan2(z2 - z1, x2 - x1), 0]);
    }
    k.geo(new THREE.TorusGeometry(1, 0.012, 6, 64), M.grey, 0, 1.08, 0, [Math.PI / 2, 0, 0], [aOut - ro, bOut - ro, 1]);
  }

  // 灯架：四个角各一座，顶上一排发光灯
  for (const [lx, lz] of [[-1.55, -2.4], [1.55, -2.4], [-1.55, 2.4], [1.55, 2.4]]) {
    k.cyl(0.03, 0.045, 1.5, M.grey, lx, 0, lz, 8);
    k.push(lx, 1.5, lz, Math.atan2(-lx, -lz) + Math.PI);
    k.box(0.4, 0.26, 0.04, M.dark, 0, 0, 0, 0.005);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) k.box(0.05, 0.05, 0.02, M.lampOn, -0.16 + c * 0.08, 0.02 + r * 0.08, -0.025, 0);
    k.pop();
  }
  // 记分牌（北端，立在顶棚外）：两根立柱 + 大屏
  k.box(0.06, 0.5, 0.06, M.dark, -0.4, 0, -bOut - 0.35, 0); k.box(0.06, 0.5, 0.06, M.dark, 0.4, 0, -bOut - 0.35, 0);
  k.box(1.0, 0.36, 0.06, M.dark, 0, 0.5, -bOut - 0.35, 0.01);
  k.finish();
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.3), M.board);
  sb.position.set(0, 0.68, -bOut - 0.35 + 0.032); g.add(sb);
  return { x0: x - 2.1, z0: z - bOut - 0.5, x1: x + 2.1, z1: z + bOut + 0.5 };
}
