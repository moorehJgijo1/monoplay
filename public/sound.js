// 音效：全部用 Web Audio 实时合成，不需要音频文件。
// 总线：各音色 → 主音量 → 压缩器（更饱满有力）→ 扬声器；另有一路短混响让高音更清亮。
let ctx = null, master = null, verb = null, noiseBuf = null;
let enabled = true;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(comp);
  // 合成一段衰减噪声当作房间混响
  const len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  verb = ctx.createGain();
  verb.gain.value = 0.22;
  verb.connect(conv);
  conv.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}

// 浏览器要求用户交互后才能出声：第一次点击时解锁
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => {
  if (!enabled) return;
  const c = init();
  if (c && c.state === 'suspended') c.resume();
}, { passive: true }));

function out(wet) {
  const g = ctx.createGain();
  g.connect(master);
  if (wet) {
    const s = ctx.createGain();
    s.gain.value = wet;
    g.connect(s);
    s.connect(verb);
  }
  return g;
}

// 带包络的音调：可滑音
function tone({ t = 0, freq, type = 'sine', dur = 0.2, gain = 0.2, attack = 0.004, glide, wet = 0.15, lowpass }) {
  const c = ctx, t0 = c.currentTime + t;
  const o = c.createOscillator(), g = out(wet), env = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o;
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    o.connect(f);
    node = f;
  }
  node.connect(env);
  env.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// 滤波噪声：撞击、沙沙声、爆炸
function noise({ t = 0, dur = 0.05, freq = 3000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.001, sweep, wet = 0.1 }) {
  const c = ctx, t0 = c.currentTime + t;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), env = c.createGain(), g = out(wet);
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
  f.Q.value = q;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(env);
  env.connect(g);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.05);
}

// 调频铃声：清脆的金属感
function bell({ t = 0, freq = 1760, dur = 1.0, gain = 0.12, wet = 0.35 }) {
  const c = ctx, t0 = c.currentTime + t;
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), env = c.createGain(), g = out(wet);
  car.frequency.value = freq;
  mod.frequency.value = freq * 3.5;
  mg.gain.setValueAtTime(freq * 1.2, t0);
  mg.gain.exponentialRampToValueAtTime(1, t0 + dur);
  mod.connect(mg);
  mg.connect(car.frequency);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  car.connect(env);
  env.connect(g);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + dur + 0.05);
  mod.stop(t0 + dur + 0.05);
}

// 骰子撞击桌面：高频的“咔”加一点木头共鸣
function clack(t, loud = 1) {
  noise({ t, dur: 0.045, freq: 3200 + Math.random() * 2200, q: 2.5, gain: 0.32 * loud, wet: 0.12 });
  tone({ t, freq: 1900 + Math.random() * 900, type: 'triangle', dur: 0.05, gain: 0.08 * loud, wet: 0.1 });
  tone({ t, freq: 190, type: 'sine', dur: 0.07, gain: 0.12 * loud, wet: 0 });
}

const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1567.98, A6: 1760, C7: 2093 };

const sounds = {
  // 摇骰子：越摇越慢的连续碰撞声
  diceShake(ms = 600) {
    let t = 0;
    while (t < ms / 1000) {
      clack(t, 0.45 + Math.random() * 0.3);
      t += 0.035 + Math.random() * 0.03 + t * 0.08;
    }
    noise({ dur: ms / 1000, freq: 5000, q: 0.7, gain: 0.05, attack: 0.05, wet: 0 });
  },
  // 落桌：两声清脆的“咔哒”
  diceLand() { clack(0, 1.1); clack(0.06, 0.9); },
  diceBounce() { clack(0, 0.7); },
  // 点数揭晓：亮晶晶的上行琶音；对子更华丽
  diceReveal(doubles) {
    [N.C6, N.E6, N.G6].forEach((f, k) => bell({ t: k * 0.06, freq: f, dur: 0.7, gain: 0.08 }));
    if (doubles) [N.C6, N.E6, N.G6, N.C7].forEach((f, k) => tone({ t: 0.2 + k * 0.07, freq: f, type: 'square', dur: 0.12, gain: 0.05, lowpass: 4000 }));
  },
  // 走一步：轻轻的“哒”
  step() {
    tone({ freq: 640 + Math.random() * 80, glide: 380, type: 'sine', dur: 0.09, gain: 0.16, wet: 0.05 });
    noise({ dur: 0.03, freq: 2500, q: 1.5, gain: 0.05, wet: 0 });
  },
  // 金币：经典的“叮—叮”
  coin() {
    tone({ freq: N.B5 * 2, type: 'square', dur: 0.08, gain: 0.06, lowpass: 6000 });
    tone({ t: 0.07, freq: N.E6 * 2, type: 'square', dur: 0.35, gain: 0.06, lowpass: 6000, wet: 0.25 });
    bell({ t: 0.07, freq: N.E6 * 2, dur: 0.6, gain: 0.04 });
  },
  // 买地：收银机“叮当”+ 盖章“咚”
  buy() {
    noise({ dur: 0.08, freq: 1800, q: 1, gain: 0.15 });
    [N.E6, N.G6, N.C7].forEach((f, k) => bell({ t: 0.05 + k * 0.05, freq: f, dur: 0.9, gain: 0.09 }));
    tone({ t: 0.05, freq: N.C7, type: 'square', dur: 0.25, gain: 0.04, lowpass: 7000, wet: 0.3 });
    tone({ t: 0.38, freq: 120, glide: 55, type: 'sine', dur: 0.25, gain: 0.35, wet: 0.05 });
    noise({ t: 0.38, dur: 0.12, freq: 700, q: 0.8, type: 'lowpass', gain: 0.25 });
  },
  // 盖楼：三下锤子 + 上行和弦
  build() {
    [0, 0.13, 0.26].forEach(t => {
      noise({ t, dur: 0.06, freq: 1400, q: 3, gain: 0.3 });
      tone({ t, freq: 320, glide: 160, type: 'triangle', dur: 0.08, gain: 0.18, wet: 0.05 });
    });
    [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, k) => tone({ t: 0.42 + k * 0.06, freq: f, type: 'triangle', dur: 0.5, gain: 0.1, wet: 0.3 }));
    bell({ t: 0.72, freq: N.G6, dur: 1.0, gain: 0.07 });
  },
  // 付钱：硬币往下掉 + 低沉的“哇哦”
  pay() {
    [N.G6, N.E6, N.C6, N.A5].forEach((f, k) => tone({ t: k * 0.07, freq: f, type: 'triangle', dur: 0.12, gain: 0.08, wet: 0.2 }));
    tone({ t: 0.3, freq: 260, glide: 140, type: 'sawtooth', dur: 0.45, gain: 0.09, lowpass: 900, wet: 0.15 });
  },
  // 好事：明亮的大三和弦琶音
  good() {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, k) => tone({ t: k * 0.07, freq: f, type: 'triangle', dur: 0.4, gain: 0.12, wet: 0.3 }));
    bell({ t: 0.28, freq: N.E6, dur: 0.9, gain: 0.08 });
    bell({ t: 0.34, freq: N.G6, dur: 0.9, gain: 0.06 });
  },
  // 坏事：下行的“哇——哇——”
  bad() {
    tone({ freq: 330, glide: 300, type: 'sawtooth', dur: 0.28, gain: 0.1, lowpass: 1200 });
    tone({ t: 0.3, freq: 300, glide: 190, type: 'sawtooth', dur: 0.55, gain: 0.1, lowpass: 1000, wet: 0.2 });
  },
  info() { bell({ freq: N.A5, dur: 0.6, gain: 0.08 }); bell({ t: 0.08, freq: N.E6, dur: 0.7, gain: 0.06 }); },
  // 换人：两声柔和的提示铃
  turn() { bell({ freq: N.G5, dur: 0.8, gain: 0.1 }); bell({ t: 0.14, freq: N.C6, dur: 1.0, gain: 0.1 }); },
  // 翻牌：呼的一声
  whoosh() { noise({ dur: 0.35, freq: 500, sweep: 4500, q: 1.2, gain: 0.18, attack: 0.08, wet: 0.2 }); },
  tick() { noise({ dur: 0.02, freq: 5000, q: 4, gain: 0.25, wet: 0 }); tone({ freq: 2400, type: 'square', dur: 0.015, gain: 0.03, wet: 0 }); },
  boom() {
    noise({ dur: 1.2, freq: 900, sweep: 80, type: 'lowpass', q: 0.7, gain: 0.7, attack: 0.005, wet: 0.3 });
    tone({ freq: 90, glide: 35, type: 'sine', dur: 0.8, gain: 0.5, wet: 0 });
  },
  win() {
    const seq = [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6, N.E6, N.G6];
    seq.forEach((f, k) => tone({ t: k * 0.1, freq: f, type: 'square', dur: 0.18, gain: 0.06, lowpass: 5000, wet: 0.3 }));
    [N.C6, N.E6, N.G6, N.C7].forEach((f, k) => bell({ t: 0.85 + k * 0.03, freq: f, dur: 1.6, gain: 0.08 }));
  },
};

export const sfx = {};
Object.keys(sounds).forEach(k => {
  sfx[k] = (...a) => {
    if (!enabled) return;
    try {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      sounds[k](...a);
    } catch (e) { console.warn('音效播放失败', k, e); }
  };
});
export function setSoundEnabled(v) { enabled = !!v; }
