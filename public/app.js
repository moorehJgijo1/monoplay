// 大富翁前端：主页 / 联机房间 / 游戏界面。单机模式在浏览器里跑引擎和电脑玩家，联机模式连接服务器。
import { createBoard3D } from './board3d.js';
import { sfx, setSoundEnabled } from './sound.js';

(() => {
  'use strict';
  const E = window.MonopolyEngine, AI = window.MonopolyAI;
  const { BOARD, N, GROUPS, CHARACTERS, CHAR_KEYS, CARDS, CARD_KEYS, GODS, LEVELS, LEVEL_EMOJI, money } = E;

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式等 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 忽略 */ } },
  };
  const BOT_NAMES = ['电脑·小强', '电脑·阿财', '电脑·旺旺', '电脑·多多', '电脑·招财'];
  const CELL_ICONS = { park: '🌳', start: '🏁', destiny: '🔮', chance: '❓', shop: '🏪', jail: '🚔', wheel: '🎡', points: '🎟️', news: '📰', hospital: '🏥', casino: '🎰', police: '👮', tax: '🧾' };
  const CELL_DESC = {
    start: '经过或停在起点领取工资 ¥2000 和 10 点券（金贝贝 ¥3000）。',
    destiny: '抽一张命运卡：多半和钱有关，有好有坏。',
    chance: '抽一张机会卡：移动、道具、神仙……什么都可能发生。',
    shop: '用点券购买道具卡（孙小美 7 折）。',
    jail: '路过只是探监。被关进来的人要待满天数。',
    wheel: '转动幸运转盘，头奖 ¥5000！也可能转出衰神……',
    points: '领取 20–60 点券（大老千翻倍）。',
    news: '全城新闻事件，影响所有玩家。',
    hospital: '路过没事。受伤的人要在这里住院。',
    casino: '押大小，赢了翻倍；豹子庄家通吃。',
    police: '停在这里会被警察带走，入狱 2 天。',
    tax: '缴纳现金 10% 的所得税。',
    park: '在公园散步，获得 20 点券。这里也是全城最大的十字路口。',
  };
  const PHASE_TEXT = { fork: '选择岔路', roll: '准备掷骰子', buy: '考虑买地', upgrade: '考虑盖楼', shop: '在道具店购物', casino: '在赌场', moving: '移动中', done: '' };

  // ---------- 音效（见 sound.js） ----------
  let soundOn = store.get('mono.sound', true);
  setSoundEnabled(soundOn);

  // ---------- 提示 ----------
  function toast(emoji, title, text, cls = '') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = `<span class="em">${emoji}</span><div><b>${esc(title)}</b>${esc(text)}</div>`;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, cls === 'err' ? 2500 : 3600);
  }
  const showError = msg => toast('⚠️', '提示', msg, 'err');

  // ---------- 弹窗 ----------
  let modalKind = null;
  function openModal(kind, html) {
    modalKind = kind;
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal() {
    if (board) board.setHighlight(defaultHighlight());
    modalKind = null;
    $('#modal').classList.add('hidden');
    $('#modalBody').innerHTML = '';
  }
  $('#modalClose').onclick = () => {
    if (modalKind === 'shop' || modalKind === 'casino') dismissedVisit = visitKey();
    closeModal();
  };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modalClose').click(); });

  function show(screen) {
    ['home', 'lobby', 'game'].forEach(id => $('#' + id).classList.toggle('hidden', id !== screen));
  }

  // =====================================================================
  // 主页
  // =====================================================================
  const profile = store.get('mono.profile', { name: '', char: 'atubo' });
  if (!CHARACTERS[profile.char]) profile.char = 'atubo';
  $('#nameInput').value = profile.name;
  $('#nameInput').oninput = () => { profile.name = $('#nameInput').value.trim(); store.set('mono.profile', profile); };
  const myName = () => profile.name || '我';

  function renderCharPicker() {
    $('#charPicker').innerHTML = CHAR_KEYS.map(k => {
      const c = CHARACTERS[k];
      return `<button class="char ${k === profile.char ? 'sel' : ''}" data-char="${k}"><span class="em">${c.emoji}</span><span><b>${c.name}</b><small>${c.skill}</small></span></button>`;
    }).join('');
  }
  $('#charPicker').onclick = e => {
    const b = e.target.closest('[data-char]');
    if (!b) return;
    profile.char = b.dataset.char;
    store.set('mono.profile', profile);
    renderCharPicker();
    renderSoloSeats();
  };
  renderCharPicker();

  $$('.mode-tabs .tab').forEach(t => t.onclick = () => {
    $$('.mode-tabs .tab').forEach(x => x.classList.toggle('active', x === t));
    $('#tab-solo').classList.toggle('hidden', t.dataset.tab !== 'solo');
    $('#tab-online').classList.toggle('hidden', t.dataset.tab !== 'online');
  });

  // 单机座位
  let soloSeats = store.get('mono.soloSeats', null) || [{ kind: 'bot', char: '' }, { kind: 'bot', char: '' }, { kind: 'bot', char: '' }];
  const charOptions = (sel, exclude = []) => `<option value="">随机角色</option>` + CHAR_KEYS.map(k =>
    `<option value="${k}" ${k === sel ? 'selected' : ''} ${exclude.includes(k) && k !== sel ? 'disabled' : ''}>${CHARACTERS[k].emoji} ${CHARACTERS[k].name}</option>`).join('');
  function renderSoloSeats() {
    const used = [profile.char, ...soloSeats.map(s => s.char).filter(Boolean)];
    let botN = 0;
    $('#soloSeats').innerHTML =
      `<div class="seat"><span class="em">${CHARACTERS[profile.char].emoji}</span><span class="nm">${esc(myName())} <span class="tag host">你</span></span></div>` +
      soloSeats.map((s, k) => `<div class="seat">
        <span class="em">${s.char ? CHARACTERS[s.char].emoji : (s.kind === 'bot' ? '🤖' : '🙂')}</span>
        ${s.kind === 'bot' ? `<span class="nm">${BOT_NAMES[botN++]} <span class="tag">电脑</span></span>`
          : `<input class="nm" data-name="${k}" value="${esc(s.name || '')}" placeholder="同屏玩家 ${k + 2}" maxlength="12">`}
        <select data-char="${k}">${charOptions(s.char, used)}</select>
        <button class="btn small" data-del="${k}">✕</button></div>`).join('');
    $('#addBotBtn').disabled = $('#addLocalBtn').disabled = soloSeats.length >= 5;
    $('#soloStartBtn').disabled = soloSeats.length < 1;
    store.set('mono.soloSeats', soloSeats);
  }
  $('#soloSeats').onchange = e => {
    if (e.target.dataset.char !== undefined) { soloSeats[e.target.dataset.char].char = e.target.value; renderSoloSeats(); }
  };
  $('#soloSeats').oninput = e => {
    if (e.target.dataset.name !== undefined) { soloSeats[e.target.dataset.name].name = e.target.value; store.set('mono.soloSeats', soloSeats); }
  };
  $('#soloSeats').onclick = e => {
    const d = e.target.closest('[data-del]');
    if (d) { soloSeats.splice(Number(d.dataset.del), 1); renderSoloSeats(); }
  };
  $('#addBotBtn').onclick = () => { soloSeats.push({ kind: 'bot', char: '' }); renderSoloSeats(); };
  $('#addLocalBtn').onclick = () => { soloSeats.push({ kind: 'local', name: '', char: '' }); renderSoloSeats(); };
  $('#nameInput').addEventListener('input', renderSoloSeats);
  renderSoloSeats();

  // =====================================================================
  // 控制器：本地 / 联机，对界面暴露相同接口
  // =====================================================================
  let ctrl = null;

  function localPlayersFromSeats() {
    let botN = 0;
    const players = [{ id: 'me', name: myName(), char: profile.char }];
    soloSeats.forEach((s, k) => {
      if (s.kind === 'bot') players.push({ id: 'bot' + k, name: BOT_NAMES[botN++], char: s.char, isBot: true });
      else players.push({ id: 'local' + k, name: (s.name || '').trim() || `玩家${k + 2}`, char: s.char });
    });
    return players;
  }

  class LocalController {
    constructor(state, setup) {
      this.mode = 'local';
      this.state = state;
      this.setup = setup;
      this.gen = (LocalController.gen = (LocalController.gen || 0) + 1);
    }
    // 同屏模式下“你”是当前行动的真人；轮到电脑时显示第一个真人的视角
    you() {
      const s = this.state, a = E.pendingActor(s);
      if (a !== null && !s.players[a].isBot) return s.players[a].id;
      const human = s.players.find(p => !p.isBot && !p.bankrupt) || s.players.find(p => !p.isBot);
      return human ? human.id : null;
    }
    send(action) {
      const r = E.applyAction(this.state, this.you(), action);
      if (r.error) showError(r.error);
      this.changed();
    }
    changed() {
      store.set('mono.save', { state: this.state, setup: this.setup });
      onState();
      this.runBots();
    }
    async runBots() {
      if (this.botRunning) return;
      this.botRunning = true;
      const gen = this.gen;
      try {
        for (;;) {
          const s = this.state, a = E.pendingActor(s);
          if (a === null || ctrl !== this || this.gen !== gen) break;
          const p = s.players[a];
          if (!p.isBot && !p.auto) break;
          await animIdle();
          await sleep(E.PACE.think * SPEEDS[speedIdx].mul);
          if (ctrl !== this || E.pendingActor(s) !== a) continue;
          const action = AI.decide(s, p.id);
          if (!action) break;
          const r = E.applyAction(s, p.id, action);
          if (r.error) E.applyAction(s, p.id, { type: s.phase === 'roll' ? 'roll' : 'skip' });
          store.set('mono.save', { state: s, setup: this.setup });
          onState();
        }
      } finally { this.botRunning = false; }
    }
    restart() { startLocal(this.setup); }
    leave() { this.gen = -1; }
  }

  function startLocal(setup, saved) {
    if (ctrl) ctrl.leave();
    const state = saved || E.createGame(setup.players, { maxRounds: setup.maxRounds, startingCash: setup.startingCash });
    ctrl = new LocalController(state, setup);
    resetView();
    show('game');
    ctrl.changed();
  }

  $('#soloStartBtn').onclick = () => {
    const setup = { players: localPlayersFromSeats(), maxRounds: Number($('#soloRounds').value), startingCash: Number($('#soloCash').value) };
    startLocal(setup);
  };
  const saved = store.get('mono.save', null);
  if (saved && saved.state && saved.state.phase !== 'over' && saved.state.players) {
    $('#resumeBtn').classList.remove('hidden');
    $('#resumeBtn').textContent = `继续上一局（第 ${saved.state.round} 回合）`;
  }
  $('#resumeBtn').onclick = () => {
    const sv = store.get('mono.save', null);
    if (sv && sv.state) startLocal(sv.setup, sv.state);
  };

  // ---------- 联机 ----------
  class OnlineController {
    constructor(session) {
      this.mode = 'online';
      this.session = session;
      this.state = null;
      this.room = null;
      this.chat = [];
      this.youId = session.playerId;
      this.connect();
    }
    connect() {
      const es = new EventSource(`/api/rooms/${this.session.roomId}/stream?token=${encodeURIComponent(this.session.token)}`);
      this.es = es;
      es.onmessage = ev => {
        const d = JSON.parse(ev.data);
        this.room = d.room;
        this.youId = d.you;
        this.chat = d.chat || [];
        const fresh = d.state && (!this.state || d.state.turn < this.state.turn - 1);
        this.state = d.state;
        if (fresh) resetView();
        if (ctrl !== this) return;
        if (!this.state) { show('lobby'); renderLobby(); } else { show('game'); onState(); }
        renderChat();
      };
      es.addEventListener('kicked', () => { this.leave(); showError('你被房主移出了房间'); });
      // 连接被关闭时先问服务器房间是否还在：在就重连，不在才退出（页面刷新时旧连接也会触发这里）
      es.onerror = () => {
        if (es.readyState !== EventSource.CLOSED) return;
        setTimeout(async () => {
          if (ctrl !== this || this.es !== es) return;
          let status = 0;
          try { status = (await fetch(`/api/rooms/${this.session.roomId}/status?token=${encodeURIComponent(this.session.token)}`)).status; } catch { /* 网络断开 */ }
          if (ctrl !== this || this.es !== es) return;
          if (status === 403 || status === 404) { showError('无法回到房间（可能已解散）'); this.leave(); }
          else this.connect();
        }, 1500);
      };
    }
    you() { return this.youId; }
    async post(path, body) {
      try {
        const r = await fetch(`/api/rooms/${this.session.roomId}/${path}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this.session.token, ...body }),
        });
        const j = await r.json();
        if (j.error) showError(j.error);
        return j;
      } catch { showError('网络错误'); return { error: '网络错误' }; }
    }
    send(action) { return this.post('action', { action }); }
    restart() { return this.post('start', {}); }
    leave() {
      if (this.es) this.es.close();
      store.del('mono.online');
      if (ctrl === this) { ctrl = null; show('home'); }
      history.replaceState(null, '', location.pathname);
    }
  }

  function startOnline(session) {
    if (ctrl) ctrl.leave();
    store.set('mono.online', session);
    history.replaceState(null, '', `?room=${session.roomId}`);
    resetView();
    ctrl = new OnlineController(session);
  }

  async function postJSON(url, body) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return await r.json();
    } catch { return { error: '连接服务器失败（联机需要用 node server.js 启动）' }; }
  }
  $('#createRoomBtn').onclick = async () => {
    const j = await postJSON('/api/rooms', { name: myName(), char: profile.char });
    if (j.error) return showError(j.error);
    startOnline(j);
  };
  $('#joinRoomBtn').onclick = async () => {
    const code = $('#roomInput').value.trim().toUpperCase();
    if (code.length !== 4) return showError('请输入 4 位房间号');
    const j = await postJSON(`/api/rooms/${code}/join`, { name: myName(), char: profile.char });
    if (j.error) return showError(j.error);
    startOnline(j);
  };
  if (location.protocol === 'file:') {
    $('#onlineHint').textContent = '⚠️ 你是直接打开的本地文件，联机需要先运行 node server.js，再访问 http://localhost:3000';
  }

  // ---------- 房间（大厅） ----------
  function renderLobby() {
    const room = ctrl.room, me = ctrl.you(), isHost = room.hostId === me;
    $('#lobbyCode').textContent = room.id;
    const used = room.seats.map(s => s.char).filter(Boolean);
    $('#lobbySeats').innerHTML = room.seats.map(s => {
      const canPick = s.id === me || (isHost && s.isBot);
      return `<div class="seat">
        <span class="em">${s.char ? CHARACTERS[s.char].emoji : (s.isBot ? '🤖' : '❔')}</span>
        <span class="nm">${esc(s.name)}
          ${s.id === room.hostId ? '<span class="tag host">房主</span>' : ''}
          ${s.id === me ? '<span class="tag host">你</span>' : ''}
          ${s.isBot ? '<span class="tag">电脑</span>' : ''}
          ${!s.online ? '<span class="tag off">离线</span>' : ''}</span>
        ${canPick ? `<select data-seat-char="${s.id}">${charOptions(s.char, used)}</select>` : `<span class="hint">${s.char ? CHARACTERS[s.char].name : '随机角色'}</span>`}
        ${isHost && s.id !== me ? `<button class="btn small" data-kick="${s.id}">✕</button>` : ''}
      </div>`;
    }).join('');
    $('#hostControls').classList.toggle('hidden', !isHost);
    $('#lobbyWait').classList.toggle('hidden', isHost);
    $('#lobbyRounds').value = room.settings.maxRounds;
    $('#lobbyCash').value = room.settings.startingCash;
    $('#lobbyAddBot').disabled = room.seats.length >= 6;
    $('#lobbyStart').disabled = room.seats.length < 2;
    $('#lobbyStart').textContent = room.seats.length < 2 ? '至少需要 2 名玩家' : `开始游戏（${room.seats.length} 人）`;
  }
  $('#lobbySeats').onchange = e => {
    const id = e.target.dataset.seatChar;
    if (id) ctrl.post('char', { seatId: id === ctrl.you() ? undefined : id, char: e.target.value });
  };
  $('#lobbySeats').onclick = e => {
    const k = e.target.closest('[data-kick]');
    if (k) ctrl.post('kick', { seatId: k.dataset.kick });
  };
  $('#lobbyAddBot').onclick = () => ctrl.post('addBot', {});
  $('#lobbyStart').onclick = () => ctrl.post('start', {});
  $('#lobbyRounds').onchange = $('#lobbyCash').onchange = () =>
    ctrl.post('settings', { maxRounds: Number($('#lobbyRounds').value), startingCash: Number($('#lobbyCash').value) });
  $('#leaveLobbyBtn').onclick = () => ctrl && ctrl.leave();
  $('#copyLinkBtn').onclick = async () => {
    const link = `${location.origin}${location.pathname}?room=${ctrl.room.id}`;
    try { await navigator.clipboard.writeText(link); toast('📋', '已复制', link); }
    catch { toast('🔗', '邀请链接', link); }
  };

  // ---------- 聊天 ----------
  let chatSeen = 0;
  function renderChat() {
    if (!ctrl || ctrl.mode !== 'online') return;
    const html = ctrl.chat.map(m => `<div><b>${esc(m.from)}：</b>${esc(m.text)}</div>`).join('') || '<div class="hint">还没有人说话</div>';
    ['#lobbyChatLog', '#gameChatLog'].forEach(id => { const el = $(id); el.innerHTML = html; el.scrollTop = el.scrollHeight; });
    const last = ctrl.chat[ctrl.chat.length - 1];
    if (last && last.n > chatSeen) {
      if (chatSeen && $('#gameChat').classList.contains('hidden') && !$('#game').classList.contains('hidden')) toast('💬', last.from, last.text);
      chatSeen = last.n;
    }
  }
  $$('[data-chat]').forEach(f => f.onsubmit = e => {
    e.preventDefault();
    const inp = f.querySelector('input');
    if (inp.value.trim() && ctrl && ctrl.mode === 'online') ctrl.post('chat', { text: inp.value });
    inp.value = '';
  });
  $$('.log-tabs .tab').forEach(t => t.onclick = () => {
    $$('.log-tabs .tab').forEach(x => x.classList.toggle('active', x === t));
    $('#gameLog').classList.toggle('hidden', t.dataset.log !== 'log');
    $('#gameChat').classList.toggle('hidden', t.dataset.log !== 'chat');
  });

  // =====================================================================
  // 游戏界面
  // =====================================================================
  const { PACE } = E;
  const SPEEDS = [{ key: 'slow', label: '🐢 慢速', mul: 1.4 }, { key: 'normal', label: '⏩ 中速', mul: 1 }, { key: 'fast', label: '⚡ 快速', mul: 0.55 }];
  let speedIdx = Math.max(0, SPEEDS.findIndex(x => x.key === store.get('mono.speed', 'normal')));

  // shown：界面当前展示的状态（动画播完才更新）；pos：棋子当前所在格
  const view = { gen: 0, shown: null, mark: null, pos: [], queue: [], animating: false, idleWaiters: [], skipStage: null, cash: [], dice: null, logSeq: 0, overShown: null };
  let selectMode = null;
  let dismissedVisit = null;
  const visitKey = () => ctrl && ctrl.state ? `${ctrl.state.turn}-${ctrl.state.phase}` : '';
  const clone = o => JSON.parse(JSON.stringify(o));
  const shortMoney = n => n >= 10000 ? '¥' + (n / 10000).toFixed(1).replace(/\.0$/, '') + '万' : money(n);
  // 联机时动画积压太多就加速追上
  const speedMul = () => (view.queue.length > 8 ? Math.min(SPEEDS[speedIdx].mul, 0.35) : SPEEDS[speedIdx].mul);
  const wait = ms => sleep(ms * speedMul());

  function resetView() {
    view.gen++;
    Object.assign(view, { shown: null, mark: null, pos: [], queue: [], animating: false, cash: [], dice: null, logSeq: 0, overShown: null });
    if (view.skipStage) view.skipStage();
    view.idleWaiters.splice(0).forEach(r => r());
    selectMode = null;
    $('#selectBanner').classList.add('hidden');
    hideStage();
    closeModal();
    $('#floaters').innerHTML = '';
    view.forkKey = '';
    if (board) { board.setFork(null); board.setSelectable(null); }
  }

  function animIdle() {
    return view.animating || view.queue.length ? new Promise(r => view.idleWaiters.push(r)) : Promise.resolve();
  }

  // ---------- 3D 棋盘 ----------
  let board = null;
  function ensureBoard() {
    if (board) return board;
    try {
      board = createBoard3D($('#board3d'), E, { onCellClick });
    } catch (e) {
      console.error(e);
      $('#noWebgl').classList.remove('hidden');
    }
    return board;
  }
  // 把展示状态同步到 3D 场景（楼房、格子文字、神仙、棋子站位、当前玩家标记）
  function boardSync(reset) {
    const s = view.shown;
    if (!s || !ensureBoard()) return;
    if (reset) board.reset(s);
    const live = ctrl && ctrl.state, actor = live ? E.pendingActor(live) : null;
    const thinking = !view.animating && actor !== null && (live.players[actor].isBot || live.players[actor].auto) ? actor : null;
    board.update(s, view.pos, s.phase === 'over' ? null : s.current, thinking);
    board.setSelectable(selectMode ? selectMode.targets : null);
  }
  function floatMoney(k, d) {
    if (!board || view.shown.players[k].bankrupt) return;
    const p = board.screenOf(k);
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'floater ' + (d > 0 ? 'plus' : 'minus');
    el.textContent = (d > 0 ? '+' : '−') + money(Math.abs(d));
    el.style.left = p[0] + 'px';
    el.style.top = p[1] + 'px';
    $('#floaters').appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  // ---------- 骰子 ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHTML = (v, cls = '') => `<div class="die ${cls} ${v === 1 || v === 4 ? 'red' : ''}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;
  const rnd6 = () => 1 + Math.floor(Math.random() * 6);
  async function rollDiceInto(box, final, ms) {
    sfx.diceShake(ms * speedMul());
    const end = Date.now() + ms * speedMul();
    while (Date.now() < end) {
      box.innerHTML = final.map(() => dieHTML(rnd6(), 'rolling')).join('');
      await sleep(90);
    }
    box.innerHTML = final.map(v => dieHTML(v, 'land')).join('');
    sfx.diceLand();
  }

  // ---------- 中央 3D 骰子 ----------
  // 立方体六个面：正面 1、背面 6、右 3、左 4、上 5、下 2；把某个面转到正面需要的旋转
  const FACE_ROT = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
  const cubeFaces = () => [1, 2, 3, 4, 5, 6].map(v => `<div class="face f${v} ${v === 1 || v === 4 ? 'red' : ''}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`).join('');
  async function playDice(d) {
    // 有 3D 场景时把骰子直接扔进城市里（真实物理碰撞）；否则用中央的 CSS 骰子
    if (board && board.rollDice) {
      try {
        sfx.whoosh();
        await board.rollDice(d, { speed: 1 / speedMul(), onHit: v => sfx.diceHit(v), onReveal: () => sfx.diceReveal(d[0] === d[1]) });
        view.dice = d;
        return;
      } catch (e) { console.error(e); }
    }
    const T = PACE.dice * speedMul();
    const st = $('#diceStage');
    const doubles = d[0] === d[1];
    st.className = 'dice-stage';
    st.style.setProperty('--T', T + 'ms');
    st.innerHTML = `<div class="burst"></div><div class="glow"></div><div class="dice-pair">${d.map((_, k) => `<div class="die3d-wrap w${k}"><div class="die3d">${cubeFaces()}</div></div>`).join('')}</div><div class="dice-total"></div>`;
    const cubes = [...st.querySelectorAll('.die3d')];
    const wraps = [...st.querySelectorAll('.die3d-wrap')];
    st.classList.add('rolling');
    // 抛出 → 落桌 → 弹起 → 再落 → 停稳（用 Web Animations，等动画真正播完再亮出点数）
    const throwKF = k => {
      const sx = k ? 30 : -30, sy = k ? -70 : -60, h = k ? 11 : 9;
      return [
        { transform: `translate(${sx}cqmin, ${sy}cqmin) scale(1.5)`, offset: 0 },
        { transform: 'translate(0, 0) scale(1)', offset: 0.52 },
        { transform: `translate(0, -${h}cqmin) scale(1)`, offset: 0.66 },
        { transform: 'translate(0, 0) scale(1, .92)', offset: 0.8 },
        { transform: `translate(0, -${h / 4}cqmin) scale(1)`, offset: 0.88 },
        { transform: 'translate(0, 0) scale(1)', offset: 1 },
      ];
    };
    const anims = [];
    wraps.forEach((w, k) => anims.push(w.animate(throwKF(k), { duration: T * 0.72, easing: 'cubic-bezier(.35,0,.45,1)', fill: 'both' })));
    cubes.forEach((c, k) => {
      const [x, y] = FACE_ROT[d[k]];
      const spinX = 360 * (2 + Math.floor(Math.random() * 2)), spinY = 360 * (2 + Math.floor(Math.random() * 2));
      const from = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg) rotateZ(${Math.random() * 360}deg)`;
      anims.push(c.animate([{ transform: from }, { transform: `rotateX(${x + spinX}deg) rotateY(${y + spinY}deg) rotateZ(0deg)` }],
        { duration: T * 0.68, easing: 'cubic-bezier(.12,.62,.22,1)', fill: 'forwards' }));
    });
    sfx.diceShake(T * 0.36);
    const hits = [setTimeout(() => sfx.diceLand(), T * 0.38), setTimeout(() => sfx.diceBounce(), T * 0.58)];
    await Promise.all(anims.map(an => an.finished.catch(() => {})));
    hits.forEach(clearTimeout);
    const tot = st.querySelector('.dice-total');
    tot.textContent = d[0] + d[1];
    st.classList.add('reveal');
    sfx.diceReveal(doubles);
    view.dice = d;
    await sleep(T * 0.28 + 450 * speedMul());
    st.classList.add('out');
    await sleep(260);
    st.className = 'dice-stage hidden';
    st.innerHTML = '';
  }

  // ---------- 状态到达：排队播放动画 ----------
  function onState() {
    const s = ctrl && ctrl.state;
    if (!s) return;
    if (!view.shown) {
      view.shown = clone(s);
      view.mark = E.paceMark(s);
      view.pos = s.players.map(p => p.pos);
      view.cash = s.players.map(p => p.cash);
      view.dice = s.dice;
      boardSync(true);
      renderAll();
      return;
    }
    const items = [];
    if ((s.diceSeq || 0) !== view.mark.dice && s.dice) items.push({ n: s.diceN || 0, dice: s.dice.slice() });
    s.moves.forEach(m => { if (m.n > view.mark.seq) items.push({ n: m.n, move: m }); });
    s.fx.forEach(f => { if (f.n > view.mark.seq) items.push({ n: f.n, fx: f }); });
    items.sort((a, b) => a.n - b.n);
    const turnChanged = s.turn !== view.mark.turn;
    view.mark = E.paceMark(s);
    view.queue.push(...items, { sync: clone(s), turnChanged });
    playQueue();
  }

  async function playQueue() {
    if (view.animating) return;
    view.animating = true;
    const gen = view.gen;
    renderLive();
    boardSync();
    while (view.queue.length && gen === view.gen) {
      const it = view.queue.shift();
      try {
        if (it.dice) await playDice(it.dice);
        else if (it.move) await playMove(it.move);
        else if (it.fx) await playFx(it.fx);
        else if (it.sync) await applySync(it);
      } catch (e) { console.error(e); }
    }
    if (gen !== view.gen) return;
    view.animating = false;
    renderAll();
    view.idleWaiters.splice(0).forEach(r => r());
  }


  async function playMove(m) {
    const k = m.player, p = view.shown.players[k];
    const dest = m.path[m.path.length - 1];
    if (!board) { view.pos[k] = dest; return; }
    if (m.jump) {
      sfx.whoosh();
      view.pos[k] = dest;
      await board.jump(k, dest, PACE.jump * speedMul());
    } else {
      for (const c of m.path) {
        sfx.step();
        board.flash(c, 'trail', p.color);
        view.pos[k] = c;
        await board.step(k, c, PACE.step * speedMul());
      }
    }
    board.flash(dest, 'landed', p.color);
    renderPlayers(view.shown);
  }

  async function applySync(it) {
    const old = view.shown, s = it.sync;
    const changes = [];
    E.LANDS.forEach(c => {
      const a = old.lands[c], b = s.lands[c];
      if (b.owner !== null && a.owner !== b.owner) changes.push([c, 'stamp', s.players[b.owner].color]);
      else if (b.level > a.level) changes.push([c, 'build']);
      else if (b.level < a.level) changes.push([c, 'crash']);
    });
    const diffs = s.players.map((p, k) => (old.players[k] ? p.cash - old.players[k].cash : 0));
    view.shown = s;
    view.pos = s.players.map(p => p.pos);
    renderAll();
    if (board) changes.forEach(([c, cls, color]) => board.flash(c, cls, color));
    if (changes.some(x => x[1] === 'stamp')) sfx.buy();
    else if (changes.some(x => x[1] === 'build')) sfx.build();
    else if (changes.some(x => x[1] === 'crash')) sfx.boom();
    diffs.forEach((d, k) => { if (d) floatMoney(k, d); });
    if (diffs.some(d => d) && !changes.length) (diffs[old.current] < 0 ? sfx.pay : sfx.coin)();
    if (changes.length || diffs.some(d => d)) await wait(PACE.settle + 300);
    if (it.turnChanged && s.phase !== 'over') await turnBanner(s);
  }

  // ---------- 中央事件舞台 ----------
  function showStage(html) {
    const st = $('#stage');
    st.innerHTML = html + '<div class="skip">点击跳过 ▸</div>';
    st.classList.remove('hidden');
  }
  function hideStage() {
    $('#stage').classList.add('hidden');
    $('#stage').innerHTML = '';
  }
  function stageWait(ms) {
    return new Promise(res => {
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(t); view.skipStage = null; res(); };
      const t = setTimeout(fin, ms * speedMul());
      view.skipStage = fin;
    });
  }
  $('#stage').onclick = () => view.skipStage && view.skipStage();

  // 把“名字：内容”拆开
  function splitText(f) {
    const k = f.text.indexOf('：');
    return k > 0 ? [f.text.slice(0, k), f.text.slice(k + 1)] : ['', f.text];
  }

  async function playFx(f) {
    const kind = E.fxKind(f);
    if (kind === 'toast') {
      toast(f.emoji, f.title, f.text, f.tone);
      (sfx[f.tone] || sfx.info)();
      return wait(PACE.toast);
    }
    const [who, what] = splitText(f);
    const total = PACE[kind];
    if (kind === 'card') {
      const chance = f.title === '机会';
      showStage(`<div class="ev-card" style="--c1:${chance ? '#ffb340' : '#b388ff'};--c2:${chance ? '#e8452c' : '#6a3fd1'}"><div class="flip">
        <div class="face front"><div class="big">${chance ? '❓' : '🔮'}</div><div class="ttl">${f.title}</div></div>
        <div class="face back"><div class="ttl">${f.title}</div><div class="big">${f.tone === 'bad' ? '😱' : f.tone === 'good' ? '🤑' : '🎲'}</div><div class="hint">${esc(who)}</div><div class="txt">${esc(what)}</div></div>
      </div></div>`);
      sfx.whoosh();
      await stageWait(650);
      $('#stage .ev-card') && $('#stage .ev-card').classList.add('open');
      sfx.whoosh();
      (sfx[f.tone] || sfx.info)();
      await stageWait(total - 650);
    } else if (kind === 'news') {
      const r = view.shown ? view.shown.round : '';
      showStage(`<div class="ev-news"><div class="mast">欢乐城日报</div><div class="date"><span>第 ${r} 回合</span><span>号外！号外！</span></div><div class="head">${esc(f.text)}</div></div>`);
      sfx.turn();
      await stageWait(total);
    } else if (kind === 'wheel') {
      const faces = E.WHEEL_FACES, n = faces.length, seg = 360 / n;
      const colors = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d'];
      const grad = faces.map((_, i) => `${colors[i % colors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
      const spans = faces.map((x, i) => `<span style="transform: translate(-50%,-50%) rotate(${i * seg + seg / 2}deg) translateY(-17cqmin)">${x.emoji}</span>`).join('');
      showStage(`<div><div class="wheel-wrap"><div class="wheel-pointer">🔻</div><div class="wheel" style="background:conic-gradient(${grad})">${spans}</div><div class="wheel-hub">🎡</div></div>
        <div class="wheel-result">${esc(who)}：${esc(what)}</div></div>`);
      const face = f.extra && f.extra.face >= 0 ? f.extra.face : 0;
      const wheel = $('#stage .wheel');
      wheel.style.transitionDuration = (2.6 * speedMul()) + 's';
      await sleep(60);
      wheel.style.transform = `rotate(${360 * 5 - (face * seg + seg / 2)}deg)`;
      let alive = true;
      (async () => { let gap = 45; while (alive && gap < 400) { sfx.tick(); await sleep(gap * speedMul()); gap *= 1.07; } })();
      await stageWait(2700);
      alive = false;
      const res = $('#stage .wheel-result');
      if (res) res.classList.add('show');
      (sfx[f.tone] || sfx.info)();
      await stageWait(total - 2700);
    } else if (kind === 'casino') {
      const x = f.extra || {};
      const won = f.tone === 'good';
      showStage(`<div class="casino-box"><div class="ttl">🎰 押大小</div><div class="bet">${esc(who)} 押 <b>${x.big ? '大' : '小'}</b> ${money(x.amt || 0)}</div>
        <div class="dice" id="casinoDice"></div><div class="res">${won ? '🎉 赢了！' : '💸 输了……'}</div></div>`);
      if (x.dice) await rollDiceInto($('#casinoDice'), x.dice, 1300);
      const res = $('#stage .res');
      if (res) res.classList.add('show');
      (won ? sfx.good : sfx.bad)();
      await stageWait(total - 1300);
    } else {
      // god / item / big
      const glow = f.tone === 'good' ? '#8dffb1' : f.tone === 'bad' ? '#ff6b6b' : '#ffe066';
      showStage(`<div class="ev-pop ${f.tone} ${kind === 'item' ? 'small' : ''}" style="--glow:${glow}"><div class="big">${f.emoji}</div><div class="ttl">${esc(f.title)}</div><div class="txt">${esc(f.text)}</div></div>`);
      if (['轰！', '导弹', '怪兽卡', '恶魔卡'].includes(f.title)) sfx.boom();
      else if (f.title === '游戏结束') sfx.win();
      else (sfx[f.tone] || sfx.info)();
      await stageWait(total);
    }
    hideStage();
  }

  async function turnBanner(s) {
    const p = s.players[s.current];
    const mine = p.id === ctrl.you() && !p.isBot;
    showStage(`<div class="ev-turn" style="--pc:${p.color}"><span class="em">${CHARACTERS[p.char].emoji}</span>${mine ? '轮到你了！' : `轮到 ${esc(p.name)}`}</div>`);
    sfx.turn();
    await stageWait(PACE.turn);
    hideStage();
  }

  // ---------- 渲染 ----------
  function viewer(s) {
    const id = ctrl.you();
    return s.players.findIndex(p => p.id === id);
  }
  function canAct(s) {
    const a = E.pendingActor(s), me = viewer(s);
    return a !== null && a === me && !s.players[me].auto && !view.animating;
  }

  function renderAll() {
    if (!ctrl || !view.shown) return;
    const s = view.shown;
    boardSync();
    renderCenter(s);
    renderPlayers(s);
    renderLog(s);
    renderLive();
  }
  // 依赖实时状态的部分：操作面板、手牌、弹窗
  function renderLive() {
    const s = ctrl && ctrl.state;
    if (!s) return;
    renderActions(s);
    renderHand(s);
    const me = viewer(s);
    const auto = me >= 0 && s.players[me].auto;
    $('#autoBtn').classList.toggle('on', auto);
    $('#autoBtn').textContent = auto ? '🤖 托管中' : '🤖 托管';
    $('#autoBtn').disabled = me < 0 || s.phase === 'over';
    $('#soundBtn').textContent = soundOn ? '🔊' : '🔇';
    $('#speedBtn').textContent = SPEEDS[speedIdx].label;
    $('#chatTab').classList.toggle('hidden', ctrl.mode !== 'online');
    // 轮到自己在岔路口时，地图上显示可点的方向箭头
    const forkKey = canAct(s) && s.phase === 'fork' && s.fork ? `${s.turn}:${s.players[me].pos}:${s.fork.options}` : '';
    if (board && forkKey !== view.forkKey) {
      view.forkKey = forkKey;
      board.setFork(forkKey ? s.fork.options : null, forkKey ? s.players[me].pos : null, to => send({ type: 'chooseFork', to }), forkKey ? forkCellMap(s, me) : null);
      board.setHighlight(defaultHighlight());
    }
    syncModals(s);
  }

  function renderCenter(s) {
    const cur = s.players[s.current];
    $('#roundInfo').textContent = s.maxRounds ? `第 ${Math.min(s.round, s.maxRounds)} / ${s.maxRounds} 回合` : `第 ${s.round} 回合`;
    const hero = s.phase === 'over' ? s.players[s.winner] : cur;
    $('#nowAvatar').style.setProperty('--pc', hero.color);
    $('#nowAvatar').textContent = CHARACTERS[hero.char].emoji;
    $('#nowName').textContent = s.phase === 'over' ? `🏆 ${hero.name} 获胜！` : `${hero.name} 的回合`;
    $('#nowSub').innerHTML = `现金 <b>${money(hero.cash)}</b><br>📍 ${BOARD[hero.pos].name}${statusText(hero) ? ' · ' + statusText(hero) : ''}`;
    if (!view.animating || !$('#dice .rolling')) $('#dice').innerHTML = (view.dice || [6, 6]).map(v => dieHTML(v)).join('');
    $('#centerLog').innerHTML = s.log.slice(-4).map(l => `<div>${esc(l.text)}</div>`).join('');
  }

  function statusText(p) {
    const parts = [];
    if (p.stay > 0) parts.push(p.stayAt === 'jail' ? `🚔坐牢${p.stay}天` : p.stayAt === 'hospital' ? `🏥住院${p.stay}天` : `💤冬眠${p.stay}回合`);
    if (p.god) parts.push(`${GODS[p.god.key].emoji}${GODS[p.god.key].name}×${p.god.turns}`);
    if (p.turtle) parts.push(`🐢×${p.turtle}`);
    return parts.join(' ');
  }

  function renderPlayers(s) {
    const me = ctrl.state ? viewer(ctrl.state) : -1;
    const online = ctrl.mode === 'online' && ctrl.room ? Object.fromEntries(ctrl.room.seats.map(x => [x.id, x.online])) : null;
    $('#playersPanel').innerHTML = s.players.map((p, k) => {
      const ch = CHARACTERS[p.char];
      const tags = [k === me ? '你' : '', p.isBot ? '电脑' : '', p.auto ? '托管' : '', online && !p.isBot && !online[p.id] ? '离线' : ''].filter(Boolean);
      const shownCash = view.cash[k] ?? p.cash;
      return `<div class="pl ${k === s.current && s.phase !== 'over' ? 'cur' : ''} ${p.bankrupt ? 'dead' : ''}" style="--pc:${p.color}" data-player="${k}">
        <span class="av">${ch.emoji}</span>
        <span class="nm">${esc(p.name)} <small>${ch.name}${tags.length ? ' · ' + tags.join(' · ') : ''}</small></span>
        <span class="cash" data-cash="${k}">${p.bankrupt ? '破产' : money(shownCash)}</span>
        <span class="meta"><span>📍${BOARD[view.pos[k] ?? p.pos].name}</span><span>🎟️${p.points}</span><span>🃏${p.cards.length}</span><span>🏠${E.ownedBy(s, k).length}</span><span>总资产 ${shortMoney(E.netWorth(s, k))}</span>${statusText(p) ? `<span class="st">${statusText(p)}</span>` : ''}</span>
      </div>`;
    }).join('');
    s.players.forEach((p, k) => { if (!p.bankrupt && view.cash[k] !== p.cash) countCash(k, p.cash); });
  }

  // 现金数字滚动到新值
  function countCash(k, to) {
    const from = view.cash[k] ?? to;
    const t0 = performance.now(), dur = 700;
    const token = (view['cashTok' + k] = {});
    const step = now => {
      if (view['cashTok' + k] !== token) return;
      const t = Math.min(1, (now - t0) / dur), v = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      view.cash[k] = v;
      const el = document.querySelector(`[data-cash="${k}"]`);
      if (el) {
        el.textContent = money(v);
        el.classList.toggle('up', to > from && t < 1);
        el.classList.toggle('down', to < from && t < 1);
      }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderLog(s) {
    const el = $('#gameLog');
    const last = s.log.length ? s.log[s.log.length - 1].n : 0;
    if (last === view.logSeq) return;
    view.logSeq = last;
    el.innerHTML = s.log.map(l => `<div class="${l.text.startsWith('——') || l.text.startsWith('=====') ? 'turn' : ''}">${esc(l.text)}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  function renderActions(s) {
    // 操作区在游戏画面底部：轮到自己时是掷骰子按钮或带头像的对话框，别人的回合只显示一个小提示
    const el = $('#actionPanel');
    const me = viewer(s), cur = s.players[s.current];
    const pill = (p, text) => { el.className = 'action-panel waiting'; el.innerHTML = `<span class="pill-av" style="--pc:${p.color}">${CHARACTERS[p.char].emoji}</span><span>${text}</span>`; };
    if (s.phase === 'over' && !view.animating) {
      el.className = 'action-panel dialog';
      el.innerHTML = `<div class="dlg-av" style="--pc:${s.players[s.winner].color}">🏆</div><div class="dlg-body"><h3>游戏结束</h3><p>${esc(s.players[s.winner].name)} 成为了大富翁！</p>
        <div class="row"><button class="btn primary" data-act="ranking">查看排名</button></div></div>`;
      return;
    }
    if (me >= 0 && s.players[me].bankrupt) return pill(s.players[me], '你已破产，正在观战');
    if (!canAct(s)) {
      const who = view.shown ? view.shown.players[view.shown.current] : cur;
      if (me >= 0 && s.players[me].auto) return pill(s.players[me], '托管中，电脑会替你行动');
      return pill(view.animating ? who : cur, `<span class="wait-dots">${esc((view.animating ? who : cur).name)} ${view.animating ? '行动中' : PHASE_TEXT[s.phase] || '行动中'}</span>`);
    }
    const p = s.players[me], cell = BOARD[p.pos];
    let html = '';
    switch (s.phase) {
      case 'roll': {
        const notes = [];
        if (s.forcedDice) notes.push(`🎯 遥控骰子 ${s.forcedDice} 点`);
        if (p.turtle) notes.push(`🐢 只能走 1 步（剩 ${p.turtle} 次）`);
        el.className = 'action-panel roll-mode';
        el.innerHTML = `${notes.length ? `<div class="roll-notes">${notes.map(n => `<span>${n}</span>`).join('')}</div>` : ''}
          <button class="roll-btn" data-act="roll"><span class="die-ic">🎲</span><b>掷骰子</b></button>`;
        return;
      }
      case 'buy': {
        const price = E.buyPrice(s, me, p.pos);
        html = `<h3>🏷️ 买下「${cell.name}」？</h3>
          <p>${GROUPS[cell.group].name}片区 · 价格 <b>${money(price)}</b>${price !== cell.price ? '（阿土伯 8 折）' : ''}<br>
          买下后基础过路费 ${money(cell.price / 10)}，盖楼后最高可达 ${shortMoney(cell.price / 10 * E.LEVEL_MULT[5])}<br>你的现金 ${money(p.cash)}</p>
          <div class="row"><button class="btn primary big" data-act="buy">💰 买！</button><button class="btn big" data-act="skip">不买</button></div>`;
        break;
      }
      case 'upgrade': {
        const ld = s.lands[p.pos], cost = E.upgradeCost(p.pos);
        const maxLv = Math.min(E.MAX_LEVEL - ld.level, Math.floor(p.cash / cost));
        const btns = [];
        for (let k = 1; k <= maxLv; k++) btns.push(`<button class="btn ${k === 1 ? 'primary' : 'gold'}" data-act="upgrade" data-levels="${k}">${LEVEL_EMOJI[ld.level + k]} ${k === 1 ? '加盖 1 层' : `盖到${LEVELS[ld.level + k]}`} ${shortMoney(cost * k)}</button>`);
        html = `<h3>🔨 在「${cell.name}」盖楼？</h3>
          <p>现在是${LEVELS[ld.level]} ${LEVEL_EMOJI[ld.level]}，每层 ${money(cost)}，你的现金 ${money(p.cash)}</p>
          <div class="row upgrades">${btns.join('')}<button class="btn" data-act="skip">不盖</button></div>`;
        break;
      }
      case 'fork': {
        const f = s.fork, here = BOARD[p.pos];
        const btns = f.options.map(o => {
          const c = BOARD[o], dx = c.x - here.x, dz = c.z - here.z;
          const arrow = dz < 0 ? '⬆️' : dz > 0 ? '⬇️' : dx < 0 ? '⬅️' : '➡️';
          const ends = E.landings(s, me, p.pos, p.prev, f.left, o);
          return `<button class="btn fork-btn" data-act="fork" data-to="${o}" data-ends="${ends.join(',')}"><b>${arrow} 往${c.name}方向</b>${ends.length > 1 ? '<small>后面还有岔路，可能停在：</small>' : '<small>会停在：</small>'}${briefHTML(s, me, ends)}</button>`;
        });
        html = `<h3>🔀 岔路口，往哪走？</h3><p>还要走 <b>${f.left}</b> 步。地图上金色闪烁的是可能停下的格子，也可以直接点黄色箭头。</p><div class="fork-grid">${btns.join('')}</div>`;
        break;
      }
      case 'shop':
        html = `<h3>🏪 道具店</h3><p>你有 ${p.points} 点券。</p>
          <div class="row"><button class="btn primary big" data-act="openShop">进去逛逛</button><button class="btn big" data-act="skip">离开</button></div>`;
        break;
      case 'casino':
        html = `<h3>🎰 赌场</h3><p>押大小，赢了翻倍！你的现金 ${money(p.cash)}</p>
          <div class="row"><button class="btn primary big" data-act="openCasino">下注</button><button class="btn big" data-act="skip">离开</button></div>`;
        break;
      default:
        html = `<p>……</p>`;
    }
    el.className = 'action-panel dialog';
    el.innerHTML = `<div class="dlg-av" style="--pc:${p.color}">${CHARACTERS[p.char].emoji}</div><div class="dlg-body">${html}</div>`;
  }

  // 鼠标移到带落点的选项上时，地图上标出这些格子
  function hoverEnds(e) {
    const b = e.target.closest('[data-ends]');
    if (board) board.setHighlight(b ? b.dataset.ends.split(',').map(Number) : defaultHighlight());
  }
  // 每个方向沿路能走到的所有格子 → 该方向（用于在地图上点选方向）
  function forkCellMap(s, me) {
    const p = s.players[me], map = new Map();
    s.fork.options.forEach(o => map.set(o, o));
    s.fork.options.forEach(o => {
      const walk = (at, from, left) => {
        if (!map.has(at)) map.set(at, o);
        if (left <= 1) return;
        let f = E.ADJ[at].filter(n => n !== from);
        if (!f.length) f = E.ADJ[at];
        f.forEach(n => walk(n, at, left - 1));
      };
      walk(o, p.pos, s.fork.left);
    });
    map.delete(p.pos);
    return map;
  }
  function defaultHighlight() {
    const s = ctrl && ctrl.state;
    if (!s || !canAct(s) || s.phase !== 'fork' || !s.fork) return null;
    const me = viewer(s), p = s.players[me];
    return s.fork.options.flatMap(o => E.landings(s, me, p.pos, p.prev, s.fork.left, o));
  }
  $('#actionPanel').addEventListener('mouseover', hoverEnds);
  $('#actionPanel').addEventListener('mouseleave', hoverEnds);
  $('#modalBody').addEventListener('mouseover', hoverEnds);
  $('#modal').addEventListener('mouseleave', hoverEnds);

  $('#actionPanel').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b || !ctrl) return;
    const act = b.dataset.act;
    if (act === 'ranking') return showRanking();
    if (act === 'openShop') return openShop();
    if (act === 'openCasino') return openCasino();
    if (act === 'upgrade') return send({ type: 'upgrade', levels: Number(b.dataset.levels) });
    if (act === 'fork') return send({ type: 'chooseFork', to: Number(b.dataset.to) });
    send({ type: act });
  };

  function send(action) {
    if (!ctrl) return;
    selectMode = null;
    $('#selectBanner').classList.add('hidden');
    ctrl.send(action);
  }

  // ---------- 道具卡 ----------
  function renderHand(s) {
    // 手牌只在轮到自己掷骰前出现在画面底部（这时才能用），像大富翁 11 的道具栏
    const el = $('#handPanel'), me = viewer(s);
    const usable = me >= 0 && canAct(s) && s.phase === 'roll';
    if (!usable || !s.players[me].cards.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const p = s.players[me];
    el.innerHTML = p.cards.map((k, idx) => {
      const c = CARDS[k], ok = E.cardTargets(s, me, k);
      return `<button class="card-chip ${ok ? 'usable' : ''} ${c.target === 'passive' ? 'passive' : ''}" data-card="${idx}" title="${esc(c.desc)}"><span class="em">${c.emoji}</span>${c.name}</button>`;
    }).join('');
  }

  $('#handPanel').onclick = e => {
    const b = e.target.closest('[data-card]');
    if (!b) return;
    const s = ctrl.state, me = viewer(s), idx = Number(b.dataset.card);
    const key = s.players[me].cards[idx], c = CARDS[key];
    const targets = canAct(s) && s.phase === 'roll' ? E.cardTargets(s, me, key) : null;
    let reason = '';
    if (c.target === 'passive') reason = '这张卡会在需要时自动生效。';
    else if (!canAct(s)) reason = '轮到你时才能使用。';
    else if (s.phase !== 'roll') reason = '只能在掷骰子前使用。';
    else if (!targets) reason = '现在没有可用的目标。';
    openModal('card', `<h2>${c.emoji} ${c.name}</h2><p>${esc(c.desc)}</p>
      ${reason ? `<p class="hint">${reason}</p>` : `<div class="row"><button class="btn primary big" id="useCardBtn">使用</button></div>`}`);
    if (!reason) $('#useCardBtn').onclick = () => beginUseCard(idx, key, targets);
  };

  function beginUseCard(index, key, targets) {
    const c = CARDS[key], s = ctrl.state;
    if (c.target === 'none') { closeModal(); return send({ type: 'useCard', index }); }
    if (c.target === 'dice') {
      const me = viewer(s), p = s.players[me];
      openModal('target', `<h2>${c.emoji} 想掷出几点？</h2><div class="dice-pick">${targets.map(t => {
        const ends = E.landings(s, me, p.pos, p.prev, t);
        return `<button class="btn" data-t="${t}" data-ends="${ends.join(',')}"><b>${t} 点</b>${briefHTML(s, me, ends)}</button>`;
      }).join('')}</div>
        <p class="hint">有多个结果的，是因为途中有岔路口，到时候可以自己选。鼠标移到选项上，地图会标出落点。</p>`);
    } else if (c.target === 'player') {
      openModal('target', `<h2>${c.emoji} 选择目标</h2><div class="choice-grid">${targets.map(id => {
        const p = s.players.find(x => x.id === id);
        return `<button class="btn" data-t="${esc(id)}">${CHARACTERS[p.char].emoji} ${esc(p.name)}${id === ctrl.you() ? '（自己）' : ''}</button>`;
      }).join('')}</div>`);
    } else if (c.target === 'cell') {
      closeModal();
      selectMode = { index, key, targets };
      $('#selectBanner span').textContent = `${c.emoji} ${c.name}：点击棋盘上闪烁的格子`;
      $('#selectBanner').classList.remove('hidden');
      boardSync();
      return;
    }
    $('#modalBody').onclick = e => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      closeModal();
      $('#modalBody').onclick = null;
      send({ type: 'useCard', index, target: c.target === 'dice' ? Number(b.dataset.t) : b.dataset.t });
    };
  }
  $('#cancelSelect').onclick = () => { selectMode = null; $('#selectBanner').classList.add('hidden'); boardSync(); };

  // 一句话说明停在某格会发生什么（给选路、遥控骰子做预览）
  function cellBrief(s, me, c) {
    const cell = BOARD[c], p = s.players[me];
    if (s.obstacles[c] && p.char !== 'ninja') return s.obstacles[c] === 'mine' ? ['💣 地雷！会住院', 'bad'] : ['🚧 路障，会被拦下', 'info'];
    const god = s.gods[c] ? ` · ${GODS[s.gods[c]].emoji}${GODS[s.gods[c]].name}` : '';
    if (cell.type === 'land') {
      const ld = s.lands[c];
      if (ld.owner === null) return [`空地 ${money(E.buyPrice(s, me, c))}${god}`, 'good'];
      if (ld.owner === me) return [`自己的地${ld.level < E.MAX_LEVEL ? '，可盖楼' : ''}${god}`, 'good'];
      const o = s.players[ld.owner];
      if (o.stay > 0) return [`${o.name}的地，地主不在${god}`, 'good'];
      return [`${o.name}的地，过路费 ${money(E.rentFor(s, c) * (p.god && p.god.key === 'shuai' ? 2 : 1))}${god}`, 'bad'];
    }
    const tone = { police: 'bad', tax: 'bad', shop: 'good', points: 'good', park: 'good', wheel: 'good' }[cell.type] || 'info';
    return [`${CELL_ICONS[cell.type]}${cell.name}${god}`, tone];
  }
  const briefHTML = (s, me, cells) => cells.slice(0, 3).map(c => {
    const [txt, tone] = cellBrief(s, me, c);
    const named = BOARD[c].type === 'land' || (s.obstacles[c] && s.players[me].char !== 'ninja');
    return `<span class="land-note ${tone}">${named ? BOARD[c].name + '：' : ''}${esc(txt)}</span>`;
  }).join('') + (cells.length > 3 ? `<span class="land-note">……共 ${cells.length} 种可能</span>` : '');

  function onCellClick(i) {
    if (selectMode) {
      if (selectMode.targets.includes(i)) send({ type: 'useCard', index: selectMode.index, target: i });
      return;
    }
    const s = ctrl && ctrl.state;
    if (!s) return;
    const c = BOARD[i];
    const here = s.players.filter(p => !p.bankrupt && p.pos === i).map(p => `${CHARACTERS[p.char].emoji}${esc(p.name)}`).join('、');
    const extra = [];
    if (s.gods[i]) extra.push(`${GODS[s.gods[i]].emoji} ${GODS[s.gods[i]].name}在这里：${GODS[s.gods[i]].desc}`);
    if (s.obstacles[i]) extra.push(s.obstacles[i] === 'mine' ? '💣 这里埋着地雷！' : '🚧 这里有路障');
    if (here) extra.push(`这里的玩家：${here}`);
    if (c.type !== 'land') {
      openModal('info', `<h2>${CELL_ICONS[c.type]} ${c.name}</h2><p>${CELL_DESC[c.type] || ''}</p>${extra.map(x => `<p>${x}</p>`).join('')}`);
      return;
    }
    const ld = s.lands[i], owner = ld.owner !== null ? s.players[ld.owner] : null;
    const rows = LEVELS.map((name, L) => `<tr class="${owner && L === ld.level ? 'now' : ''}"><td>${LEVEL_EMOJI[L] || '🟩'} ${name}</td><td>${money(c.price / 10 * E.LEVEL_MULT[L])}</td></tr>`).join('');
    openModal('info', `<h2>${c.name} <small class="hint">${GROUPS[c.group].name}片区</small></h2>
      <p>地价 ${money(c.price)} · 每层加盖 ${money(E.upgradeCost(i))}<br>
      ${owner ? `地主：<b style="color:${owner.color}">${CHARACTERS[owner.char].emoji} ${esc(owner.name)}</b> · ${LEVELS[ld.level]} · 当前过路费 <b>${money(E.rentFor(s, i))}</b> · 总价 ${money(E.landValue(s, i))}` : '无主空地'}</p>
      <table class="info-table"><tr><td><b>建筑</b></td><td><b>基础过路费</b></td></tr>${rows}</table>
      <p class="hint">同片区每多拥有一块地，过路费 +60%；钱夫人收租再 +25%。</p>
      ${extra.map(x => `<p>${x}</p>`).join('')}`);
  }

  // ---------- 道具店 / 赌场 ----------
  function openShop() {
    const s = ctrl.state, me = viewer(s), p = s.players[me];
    openModal('shop', `<h2>🏪 道具店 <small class="hint">🎟️ ${p.points} 点券 · 手牌 ${p.cards.length}/${E.MAX_CARDS}</small></h2>
      <div class="shop-grid">${CARD_KEYS.map(k => {
        const c = CARDS[k], price = E.cardPrice(s, me, k);
        return `<div class="shop-item"><span class="em">${c.emoji}</span><b>${c.name}</b><small>${c.desc}</small>
          <button class="btn small ${price <= p.points ? 'primary' : ''}" data-buy="${k}" ${price > p.points || p.cards.length >= E.MAX_CARDS ? 'disabled' : ''}>🎟️ ${price}</button></div>`;
      }).join('')}</div>
      <div class="row"><button class="btn big" data-leave>离开道具店</button></div>`);
    $('#modalBody').onclick = e => {
      const b = e.target.closest('[data-buy]');
      if (b) { sfx.coin(); send({ type: 'shopBuy', card: b.dataset.buy }); }
      if (e.target.closest('[data-leave]')) { closeModal(); send({ type: 'skip' }); }
    };
  }
  let casinoBet = 1000;
  function openCasino() {
    const s = ctrl.state, p = s.players[viewer(s)];
    openModal('casino', `<h2>🎰 赌场 · 押大小</h2>
      <p>摇三颗骰子：11–18 为大，3–10 为小，豹子（三颗相同）庄家通吃。你的现金 ${money(p.cash)}</p>
      <div class="row">${[1000, 3000, 5000].map(a => `<button class="btn ${a === casinoBet ? 'gold' : ''}" data-amt="${a}" ${a > p.cash ? 'disabled' : ''}>${money(a)}</button>`).join('')}</div>
      <div class="casino-pick"><button class="btn primary huge" data-pick="big">押大</button><button class="btn primary huge" data-pick="small">押小</button></div>
      <div class="row"><button class="btn" data-leave>不赌了</button></div>`);
    $('#modalBody').onclick = e => {
      const a = e.target.closest('[data-amt]');
      if (a) { casinoBet = Number(a.dataset.amt); openCasino(); return; }
      const pk = e.target.closest('[data-pick]');
      if (pk) { closeModal(); send({ type: 'bet', amount: casinoBet <= p.cash ? casinoBet : 1000, pick: pk.dataset.pick }); }
      if (e.target.closest('[data-leave]')) { closeModal(); send({ type: 'skip' }); }
    };
  }

  // 根据状态自动打开/关闭道具店、赌场与结算弹窗
  function syncModals(s) {
    const mine = canAct(s);
    if (modalKind === 'shop') { if (!mine || s.phase !== 'shop') closeModal(); else openShop(); }
    if (modalKind === 'casino' && (!mine || s.phase !== 'casino')) closeModal();
    if ((modalKind === 'target' || modalKind === 'card') && (!mine || s.phase !== 'roll')) closeModal();
    if (!modalKind && mine && dismissedVisit !== visitKey()) {
      if (s.phase === 'shop') { dismissedVisit = visitKey(); openShop(); }
      if (s.phase === 'casino') { dismissedVisit = visitKey(); openCasino(); }
    }
    if (s.phase === 'over' && !view.animating && view.overShown !== s.turn && (!modalKind || modalKind === 'info')) {
      view.overShown = s.turn;
      showRanking();
    }
  }

  function showRanking() {
    const s = ctrl.state;
    const order = s.players.map((p, k) => k).sort((a, b) => (s.players[a].bankrupt - s.players[b].bankrupt) || E.netWorth(s, b) - E.netWorth(s, a));
    const medals = ['🥇', '🥈', '🥉'];
    const canRestart = ctrl.mode === 'local' || (ctrl.room && ctrl.room.hostId === ctrl.you());
    openModal('over', `<h2>🏆 ${esc(s.players[s.winner].name)} 成为大富翁！</h2>
      <ol class="ranking">${order.map((k, r) => {
        const p = s.players[k];
        return `<li><span>${medals[r] || r + 1}</span><span class="em">${CHARACTERS[p.char].emoji}</span><span>${esc(p.name)}</span>
          <span class="w">${p.bankrupt ? '破产' : money(E.netWorth(s, k))}</span></li>`;
      }).join('')}</ol>
      <div class="row">${canRestart ? '<button class="btn primary big" data-again>再来一局</button>' : '<span class="hint">等待房主开新局……</span>'}
      <button class="btn big" data-home>回到主页</button></div>`);
    $('#modalBody').onclick = e => {
      if (e.target.closest('[data-again]')) { closeModal(); resetView(); ctrl.restart(); }
      if (e.target.closest('[data-home]')) { closeModal(); goHome(); }
    };
  }

  function goHome() {
    if (ctrl) ctrl.leave();
    ctrl = null;
    resetView();
    show('home');
    const sv = store.get('mono.save', null);
    $('#resumeBtn').classList.toggle('hidden', !(sv && sv.state && sv.state.phase !== 'over'));
    if (sv && sv.state) $('#resumeBtn').textContent = `继续上一局（第 ${sv.state.round} 回合）`;
  }

  // ---------- 顶部按钮 ----------
  $('#soundBtn').onclick = () => { soundOn = !soundOn; setSoundEnabled(soundOn); store.set('mono.sound', soundOn); renderLive(); if (soundOn) sfx.coin(); };
  $('#viewBtn').onclick = () => {
    if (!board) return;
    const m = board.viewMode === 'follow' ? 'overview' : 'follow';
    board.setView(m);
    $('#viewBtn').textContent = m === 'follow' ? '🗺️ 全景' : '🎯 跟随';
  };
  $('#speedBtn').onclick = () => { speedIdx = (speedIdx + 1) % SPEEDS.length; store.set('mono.speed', SPEEDS[speedIdx].key); renderLive(); };
  $('#autoBtn').onclick = () => {
    const s = ctrl.state, me = viewer(s);
    if (me >= 0) send({ type: 'setAuto', value: !s.players[me].auto });
  };
  $('#menuBtn').onclick = () => {
    const s = ctrl.state;
    openModal('menu', `<h2>☰ 菜单</h2>
      ${ctrl.mode === 'online' ? `<p>房间号：<span class="room-code">${ctrl.room.id}</span></p>` : '<p class="hint">单机进度会自动保存，回到主页后可以继续。</p>'}
      <div class="row"><button class="btn" data-rules>📖 玩法说明</button><button class="btn" data-sounds>🔊 试听音效</button></div>
      <div class="row">${s.phase !== 'over' && viewer(s) >= 0 && !s.players[viewer(s)].bankrupt ? '<button class="btn" data-resign>🏳️ 认输</button>' : ''}
      <button class="btn primary" data-home>🏠 回到主页${ctrl.mode === 'online' ? '（退出房间）' : ''}</button></div>`);
    $('#modalBody').onclick = e => {
      if (e.target.closest('[data-home]')) { closeModal(); goHome(); }
      if (e.target.closest('[data-sounds]')) {
        const list = [['diceShake', '🎲 摇骰子'], ['diceLand', '💥 骰子落桌'], ['diceReveal', '✨ 亮出点数'], ['step', '👣 走一步'], ['buy', '🏷️ 买地'], ['build', '🔨 盖楼'],
          ['coin', '🪙 收钱'], ['pay', '💸 付过路费'], ['good', '🎉 好事'], ['bad', '😩 坏事'], ['turn', '🔔 换人'], ['whoosh', '🃏 翻牌'], ['tick', '🎡 转盘'], ['boom', '💣 爆炸'], ['win', '🏆 胜利']];
        openModal('sounds', `<h2>🔊 试听音效</h2><div class="choice-grid">${list.map(([k, n]) => `<button class="btn" data-snd="${k}">${n}</button>`).join('')}</div>
          <p class="hint">${soundOn ? '' : '⚠️ 音效目前是关闭的，先点右上角的 🔇 打开。'}哪个不好听可以告诉我，我再调。</p>`);
        $('#modalBody').onclick = ev => {
          const b = ev.target.closest('[data-snd]');
          if (!b) return;
          if (b.dataset.snd === 'diceShake') { sfx.diceShake(700); setTimeout(() => sfx.diceLand(), 700); setTimeout(() => sfx.diceBounce(), 1000); }
          else sfx[b.dataset.snd]();
        };
        return;
      }
      if (e.target.closest('[data-resign]') && confirm('确定认输吗？你的地产会收归银行。')) { closeModal(); send({ type: 'resign' }); }
      if (e.target.closest('[data-rules]')) openModal('rules', `<h2>📖 玩法说明</h2>${$('.rules ul').outerHTML}
        <h3>角色</h3><ul>${CHAR_KEYS.map(k => `<li>${CHARACTERS[k].emoji} <b>${CHARACTERS[k].name}</b>：${CHARACTERS[k].skill}</li>`).join('')}</ul>
        <h3>神仙</h3><ul>${Object.values(GODS).map(g => `<li>${g.emoji} <b>${g.name}</b>（${g.turns} 回合）：${g.desc}</li>`).join('')}</ul>
        <h3>道具卡</h3><ul>${CARD_KEYS.map(k => `<li>${CARDS[k].emoji} <b>${CARDS[k].name}</b>（${CARDS[k].price} 点券）：${CARDS[k].desc}</li>`).join('')}</ul>`);
    };
  };

  // ---------- 启动：处理邀请链接与断线重连 ----------
  const params = new URLSearchParams(location.search);
  const roomParam = (params.get('room') || '').toUpperCase();
  const session = store.get('mono.online', null);
  if (location.protocol !== 'file:' && session && session.roomId && (!roomParam || roomParam === session.roomId)) {
    startOnline(session);
  } else if (roomParam) {
    $('#roomInput').value = roomParam;
    $$('.mode-tabs .tab')[1].click();
    $('#onlineHint').textContent = `你收到了房间 ${roomParam} 的邀请，填好名字和角色后点“加入房间”。`;
  }
})();
