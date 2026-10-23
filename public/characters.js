// Q 版 3D 角色：全部用基本几何体拼出来，不需要外部模型文件。
// 局部坐标：+z 是正面，脚底在 y=0，总高约 1.6。返回可做动画的部件（手臂、腿、头）。
import * as THREE from 'three';

const SKIN = '#ffd9b8';
const mats = new Map();
// 同色材质共用，减少显卡切换
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...opts }));
  return mats.get(key);
}
function mesh(geo, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
// 设置旋转后返回网格本身（Object3D.add 返回的是父节点，不能链式设置子节点）
const rot = (m, axis, v) => { m.rotation[axis] = v; return m; };
const sphere = (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
// 只盖住头顶的一块“头发帽”：thetaLength 控制往下盖多少
const cap = (r, cover = 0.55) => new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI * cover);

// 所有角色共用的骨架：头、眼睛、腮红、嘴、身体、四肢
function skeleton({ shirt, pants, shoes = '#4a3426', skin = SKIN, dress = null, masked = false }) {
  const root = new THREE.Group();
  const add = (o, parent = root) => { parent.add(o); return o; };

  // 腿
  const legs = [-1, 1].map(s => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.1, 0.42, 0);
    leg.add(mesh(cyl(0.07, 0.07, 0.32), pants, 0, -0.18, 0));
    const shoe = mesh(sphere(0.095), shoes, 0, -0.36, 0.04);
    shoe.scale.set(1, 0.6, 1.35);
    leg.add(shoe);
    return add(leg);
  });

  // 身体：普通上衣是圆柱，裙装是下摆张开的圆台
  if (dress) add(mesh(cyl(0.17, 0.36, 0.62, 20), dress, 0, 0.62, 0));
  else add(mesh(cyl(0.19, 0.25, 0.5, 20), shirt, 0, 0.7, 0));
  add(mesh(sphere(0.2), dress || shirt, 0, 0.93, 0)).scale.set(1, 0.55, 0.9);

  // 手臂：肩膀处是转轴，方便摆动
  const arms = [-1, 1].map(s => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.25, 0.92, 0);
    arm.rotation.z = s * 0.18;
    arm.add(mesh(cyl(0.055, 0.06, 0.34), dress || shirt, 0, -0.17, 0));
    arm.add(mesh(sphere(0.07), skin, 0, -0.36, 0));
    return add(arm);
  });

  // 头
  const head = add(new THREE.Group());
  head.position.y = 1.3;
  const face = mesh(sphere(0.36, 28, 20), skin);
  face.scale.set(1, 0.95, 0.97);
  head.add(face);
  [-1, 1].forEach(s => {
    const eye = mesh(sphere(0.052, 14, 10), '#1d1d1d', s * 0.125, 0.02, 0.315);
    eye.scale.set(1, 1.25, 0.6);
    head.add(eye);
    head.add(mesh(sphere(0.017, 8, 6), '#ffffff', s * 0.125 + 0.015, 0.045, 0.345));
    if (!masked) {
      const blush = mesh(sphere(0.06, 12, 8), '#ff9a9a', s * 0.21, -0.08, 0.27, { transparent: true, opacity: 0.7 });
      blush.scale.set(1, 0.5, 0.3);
      head.add(blush);
    }
    const ear = mesh(sphere(0.07, 10, 8), skin, s * 0.35, -0.02, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  });
  if (!masked) {
    const mouth = mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 14, Math.PI), '#b0413e', 0, -0.12, 0.33);
    mouth.rotation.z = Math.PI;
    head.add(mouth);
  }

  root.traverse(o => { o.castShadow = true; });
  return { root, head, arms, legs };
}

const BUILDERS = {
  // 阿土伯：草帽、白胡子白眉毛、背心、拐杖
  atubo() {
    const c = skeleton({ shirt: '#f4efe2', pants: '#6b4f2e' });
    const { head, root, arms } = c;
    const vest = mesh(cyl(0.2, 0.26, 0.42, 20), '#8a5a2b', 0, 0.7, 0);
    vest.scale.set(1.04, 1, 1.04);
    root.add(vest);
    const beard = mesh(sphere(0.2), '#f5f5f0', 0, -0.2, 0.22);
    beard.scale.set(1.1, 0.9, 0.6);
    head.add(beard);
    [-1, 1].forEach(s => {
      const mus = mesh(sphere(0.07), '#f5f5f0', s * 0.07, -0.08, 0.33);
      mus.scale.set(1.5, 0.6, 0.6);
      head.add(mus);
      const brow = mesh(sphere(0.05), '#f5f5f0', s * 0.13, 0.12, 0.32);
      brow.scale.set(1.6, 0.6, 0.6);
      head.add(brow);
      const side = mesh(sphere(0.1), '#e8e8e2', s * 0.3, 0.05, -0.05);
      side.scale.set(0.6, 1, 1);
      head.add(side);
    });
    head.add(mesh(cyl(0.58, 0.58, 0.035, 28), '#e3c27a', 0, 0.22, 0));
    head.add(mesh(cyl(0.25, 0.3, 0.2, 24), '#e3c27a', 0, 0.33, 0));
    head.add(mesh(cyl(0.305, 0.305, 0.06, 24), '#b5442f', 0, 0.26, 0));
    const cane = mesh(cyl(0.025, 0.025, 0.8, 8), '#6b3f1d', 0, -0.62, 0.05);
    arms[1].add(cane);
    return c;
  },
  // 孙小美：双马尾、蝴蝶结、粉色连衣裙
  xiaomei() {
    const c = skeleton({ shirt: '#ff8fb8', pants: '#ffd9b8', shoes: '#d6336c', dress: '#ff8fb8' });
    const { head } = c;
    const hair = '#5a3220';
    head.add(mesh(cap(0.38, 0.5), hair, 0, 0.02, -0.02));
    const bangs = mesh(sphere(0.2), hair, 0, 0.22, 0.2);
    bangs.scale.set(1.5, 0.45, 0.6);
    head.add(bangs);
    [-1, 1].forEach(s => {
      const tail = mesh(sphere(0.16), hair, s * 0.42, -0.05, -0.08);
      tail.scale.set(0.8, 1.3, 0.8);
      head.add(tail);
      const bow = mesh(new THREE.ConeGeometry(0.08, 0.16, 4), '#ff4d8d', s * 0.36, 0.14, -0.05);
      bow.rotation.z = s * Math.PI / 2;
      head.add(bow);
    });
    c.root.add(rot(mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), '#ffffff', 0, 0.87, 0), 'x', Math.PI / 2));
    return c;
  },
  // 钱夫人：发髻、红旗袍金边、珍珠项链、折扇
  qian() {
    const c = skeleton({ shirt: '#d62828', pants: '#ffd9b8', shoes: '#7a1010', dress: '#d62828' });
    const { head, root, arms } = c;
    const hair = '#1c1c1c';
    head.add(mesh(cap(0.38, 0.52), hair, 0, 0.02, -0.02));
    head.add(mesh(sphere(0.17), hair, 0, 0.36, -0.12));
    head.add(rot(mesh(cyl(0.012, 0.012, 0.45, 6), '#f2c94c', 0.1, 0.4, -0.12), 'z', 1.2));
    [-1, 1].forEach(s => head.add(mesh(sphere(0.035), '#f2c94c', s * 0.35, -0.13, 0.02)));
    root.add(rot(mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), '#fffaf0', 0, 0.94, 0.02), 'x', Math.PI / 2));
    root.add(mesh(cyl(0.355, 0.36, 0.04, 24), '#f2c94c', 0, 0.32, 0));
    const lips = head.children.find(o => o.geometry && o.geometry.type === 'TorusGeometry');
    if (lips) lips.material = mat('#c1121f');
    const fan = mesh(new THREE.CircleGeometry(0.25, 16, 0, Math.PI * 0.75), '#f2c94c', 0, -0.4, 0.12, { side: THREE.DoubleSide });
    fan.rotation.set(0.3, 0, 1.2);
    arms[1].add(fan);
    return c;
  },
  // 金贝贝：反戴棒球帽、刺猬头、T 恤短裤
  beibei() {
    const c = skeleton({ shirt: '#ffd23f', pants: '#2f6fd6', shoes: '#ffffff' });
    const { head } = c;
    const hair = '#e07a1f';
    head.add(mesh(cap(0.375, 0.45), hair, 0, 0.02, 0));
    for (let k = 0; k < 6; k++) {
      const spike = mesh(new THREE.ConeGeometry(0.08, 0.2, 6), hair, Math.sin(k) * 0.2, 0.3, 0.1 - k * 0.06);
      spike.rotation.set(-0.5, 0, Math.sin(k * 2) * 0.6);
      head.add(spike);
    }
    head.add(mesh(cap(0.39, 0.42), '#1f5fbf', 0, 0.05, -0.02));
    const brim = mesh(cyl(0.2, 0.2, 0.03, 20), '#1f5fbf', 0, 0.17, -0.38);
    brim.scale.set(1, 1, 0.8);
    head.add(brim);
    return c;
  },
  // 忍太郎：黑色忍者装、只露眼睛、红头带、背后武士刀
  ninja() {
    const c = skeleton({ shirt: '#262b33', pants: '#262b33', shoes: '#14161a', masked: true });
    const { head, root } = c;
    const hood = mesh(sphere(0.375, 28, 20), '#262b33');
    hood.scale.set(1, 0.97, 0.97);
    head.add(hood);
    const slit = mesh(new THREE.BoxGeometry(0.46, 0.13, 0.08), SKIN, 0, 0.02, 0.32);
    head.add(slit);
    [-1, 1].forEach(s => {
      const eye = mesh(sphere(0.05, 14, 10), '#1d1d1d', s * 0.12, 0.02, 0.37);
      eye.scale.set(1, 1.1, 0.5);
      head.add(eye);
      const brow = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), '#1d1d1d', s * 0.12, 0.08, 0.37);
      brow.rotation.z = s * -0.35;
      head.add(brow);
    });
    const band = mesh(new THREE.TorusGeometry(0.37, 0.035, 8, 28), '#e53935', 0, 0.16, 0);
    band.rotation.x = Math.PI / 2;
    head.add(band);
    [-1, 1].forEach(s => {
      const tail = mesh(new THREE.BoxGeometry(0.06, 0.28, 0.02), '#e53935', s * 0.06, 0.02, -0.38);
      tail.rotation.z = s * 0.4;
      head.add(tail);
    });
    const sword = new THREE.Group();
    sword.add(mesh(new THREE.BoxGeometry(0.05, 0.75, 0.02), '#cfd6dd', 0, 0.1, 0, { metalness: 0.7, roughness: 0.3 }));
    sword.add(mesh(cyl(0.03, 0.03, 0.22, 8), '#5b2c1a', 0, -0.37, 0));
    sword.add(mesh(new THREE.BoxGeometry(0.14, 0.03, 0.05), '#d4a017', 0, -0.25, 0));
    sword.position.set(0, 0.78, -0.24);
    sword.rotation.z = 0.6;
    root.add(sword);
    root.add(rot(mesh(new THREE.TorusGeometry(0.235, 0.03, 8, 20), '#e53935', 0, 0.55, 0), 'x', Math.PI / 2));
    return c;
  },
  // 大老千：高礼帽、燕尾服、红领结、八字胡、单片眼镜
  laoqian() {
    const c = skeleton({ shirt: '#1f1f24', pants: '#1f1f24', shoes: '#0d0d0d' });
    const { head, root } = c;
    const shirtFront = mesh(new THREE.ConeGeometry(0.1, 0.32, 3), '#ffffff', 0, 0.78, 0.2);
    shirtFront.rotation.x = Math.PI;
    root.add(shirtFront);
    [-1, 1].forEach(s => {
      const bow = mesh(new THREE.ConeGeometry(0.06, 0.12, 4), '#d62828', s * 0.06, 0.93, 0.21);
      bow.rotation.z = s * Math.PI / 2;
      root.add(bow);
      const mus = mesh(sphere(0.06), '#2b1d14', s * 0.08, -0.07, 0.33);
      mus.scale.set(1.8, 0.5, 0.6);
      mus.rotation.z = s * -0.3;
      head.add(mus);
    });
    head.add(mesh(cap(0.37, 0.4), '#2b1d14', 0, 0, -0.03));
    head.add(mesh(cyl(0.45, 0.45, 0.04, 28), '#16161a', 0, 0.26, 0));
    head.add(mesh(cyl(0.26, 0.27, 0.42, 24), '#16161a', 0, 0.48, 0));
    head.add(mesh(cyl(0.275, 0.275, 0.07, 24), '#d62828', 0, 0.32, 0));
    const mono = mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20), '#f2c94c', 0.125, 0.02, 0.35, { metalness: 0.8, roughness: 0.3 });
    head.add(mono);
    head.add(rot(mesh(cyl(0.004, 0.004, 0.3, 4), '#f2c94c', 0.19, -0.13, 0.33), 'z', 0.3));
    return c;
  },
};

export function buildCharacter(key) {
  const c = (BUILDERS[key] || BUILDERS.atubo)();
  c.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return c;
}
