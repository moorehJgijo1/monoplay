// 大富翁前端：主页 / 联机房间 / 游戏界面。单机模式在浏览器里跑引擎和电脑玩家，联机模式连接服务器。
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
  const CELL_ICONS = { start: '🏁', destiny: '🔮', chance: '❓', shop: '🏪', jail: '🚔', wheel: '🎡', points: '🎟️', news: '📰', hospital: '🏥', casino: '🎰', police: '👮', tax: '🧾' };
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
  };
  const PHASE_TEXT = { roll: '准备掷骰子', buy: '考虑买地', upgrade: '考虑盖楼', shop: '在道具店购物', casino: '在赌场', moving: '移动中', done: '' };

  // ---------- 音效（WebAudio 合成，无需素材） ----------
  let soundOn = store.get('mono.sound', true);
  let audio = null;
  function tone(freq, dur = 0.08, type = 'square', vol = 0.05, when = 0) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + when, o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* 浏览器不支持就静音 */ }
  }
  const sfx = {
    step: () => tone(660, 0.04, 'triangle', 0.04),
    dice: () => { for (let k = 0; k < 6; k++) tone(300 + Math.random() * 400, 0.03, 'square', 0.03, k * 0.06); },
    good: () => { tone(660, 0.1, 'triangle', 0.06); tone(880, 0.12, 'triangle', 0.06, 0.1); tone(1320, 0.16, 'triangle', 0.05, 0.2); },
    bad: () => { tone(400, 0.15, 'sawtooth', 0.04); tone(260, 0.25, 'sawtooth', 0.04, 0.15); },
    info: () => tone(740, 0.1, 'sine', 0.06),
    turn: () => { tone(523, 0.08, 'sine', 0.06); tone(784, 0.12, 'sine', 0.06, 0.09); },
  };

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
          await sleep(650);
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
  const view = { dispPos: null, moveSeq: 0, fxSeq: 0, diceSeq: 0, logSeq: 0, queue: [], animating: false, idleWaiters: [], pendingFx: [] };
  let selectMode = null;
  let dismissedVisit = null;
  const visitKey = () => ctrl && ctrl.state ? `${ctrl.state.turn}-${ctrl.state.phase}` : '';

  function resetView() {
    Object.assign(view, { dispPos: null, moveSeq: 0, fxSeq: 0, diceSeq: 0, logSeq: 0, queue: [], animating: false, pendingFx: [] });
    view.idleWaiters.splice(0).forEach(r => r());
    selectMode = null;
    closeModal();
  }

  function animIdle() {
    return view.animating || view.queue.length ? new Promise(r => view.idleWaiters.push(r)) : Promise.resolve();
  }

  // 棋盘格子坐标（11×11 外圈，0 在右下角，逆时针排布）
  function gridPos(i) {
    if (i <= 10) return [11, 11 - i];
    if (i <= 20) return [11 - (i - 10), 1];
    if (i <= 30) return [1, 1 + (i - 20)];
    return [1 + (i - 30), 11];
  }
  const cellEls = [];
  (function buildBoard() {
    const board = $('#board');
    BOARD.forEach((c, i) => {
      const el = document.createElement('div');
      const [r, col] = gridPos(i);
      el.style.gridArea = `${r} / ${col}`;
      el.className = 'cell' + (c.type === 'land' ? ' land' : ' special') + (i % 10 === 0 ? ' corner' : '');
      el.dataset.cell = i;
      if (c.type === 'land') el.style.setProperty('--g', GROUPS[c.group].color);
      board.appendChild(el);
      cellEls.push(el);
    });
    board.onclick = e => {
      const el = e.target.closest('.cell');
      if (el) onCellClick(Number(el.dataset.cell));
    };
  })();

  function renderBoard(s) {
    const cur = s.players[s.current];
    BOARD.forEach((c, i) => {
      const el = cellEls[i];
      let html = '';
      const marks = [];
      if (s.obstacles[i]) marks.push(s.obstacles[i] === 'mine' ? '💣' : '🚧');
      if (s.gods[i]) marks.push(`<span class="god" title="${GODS[s.gods[i]].name}">${GODS[s.gods[i]].emoji}</span>`);
      if (c.type === 'land') {
        const ld = s.lands[i];
        const owner = ld.owner !== null ? s.players[ld.owner] : null;
        html = `<div class="band"></div><div class="nm">${c.name}</div>
          <div class="lvl">${LEVEL_EMOJI[ld.level] || ''}</div>
          <div class="sub">${owner ? money(E.rentFor(s, i)) : money(c.price)}</div>`;
        el.classList.toggle('owned', !!owner);
        if (owner) el.style.setProperty('--owner', owner.color);
      } else {
        html = `<div class="icon">${CELL_ICONS[c.type]}</div><div class="nm">${c.name}</div>`;
      }
      html += `<div class="marks">${marks.join('')}</div><div class="tokens"></div>`;
      el.innerHTML = html;
      el.classList.toggle('selectable', !!(selectMode && selectMode.targets.includes(i)));
      el.classList.toggle('here', s.phase !== 'over' && cur.pos === i && !view.animating);
    });
    renderTokens(s);
  }

  function renderTokens(s) {
    cellEls.forEach(el => { const t = el.querySelector('.tokens'); if (t) t.innerHTML = ''; });
    s.players.forEach((p, k) => {
      if (p.bankrupt) return;
      const pos = view.dispPos ? view.dispPos[k] : p.pos;
      const t = cellEls[pos].querySelector('.tokens');
      const el = document.createElement('div');
      el.className = 'token' + (k === s.current && s.phase !== 'over' ? ' active' : '');
      el.style.setProperty('--pc', p.color);
      el.title = p.name;
      el.textContent = CHARACTERS[p.char].emoji;
      t.appendChild(el);
    });
  }

  // 新状态到达：排队播放移动动画、骰子动画和特效提示
  function onState() {
    const s = ctrl && ctrl.state;
    if (!s) return;
    if (!view.dispPos) {
      view.dispPos = s.players.map(p => p.pos);
      view.moveSeq = s.moves.length ? s.moves[s.moves.length - 1].n : 0;
      view.fxSeq = s.fx.length ? s.fx[s.fx.length - 1].n : 0;
      view.diceSeq = s.diceSeq || 0;
      view.turnSeen = s.turn;
    }
    if ((s.diceSeq || 0) !== view.diceSeq) {
      view.diceSeq = s.diceSeq || 0;
      view.queue.push({ dice: s.dice });
    }
    s.moves.filter(m => m.n > view.moveSeq).forEach(m => view.queue.push({ move: m }));
    if (s.moves.length) view.moveSeq = Math.max(view.moveSeq, s.moves[s.moves.length - 1].n);
    s.fx.filter(f => f.n > view.fxSeq).forEach(f => view.queue.push({ fx: f }));
    if (s.fx.length) view.fxSeq = Math.max(view.fxSeq, s.fx[s.fx.length - 1].n);
    view.queue.push({ sync: true });
    if (view.turnSeen !== s.turn) {
      view.turnSeen = s.turn;
      const a = E.pendingActor(s);
      if (a !== null && s.players[a].id === ctrl.you() && !s.players[a].isBot) view.queue.push({ myTurn: true });
    }
    render();
    playQueue();
  }

  async function playQueue() {
    if (view.animating) return;
    view.animating = true;
    while (view.queue.length) {
      const item = view.queue.shift();
      const s = ctrl && ctrl.state;
      if (!s) break;
      if (item.dice) await animateDice(item.dice);
      else if (item.move) {
        const m = item.move, k = m.player;
        if (m.jump) { view.dispPos[k] = m.path[m.path.length - 1]; renderTokens(s); await sleep(250); }
        else for (const c of m.path) { view.dispPos[k] = c; renderTokens(s); sfx.step(); await sleep(170); }
      } else if (item.fx) {
        const f = item.fx;
        toast(f.emoji, f.title, f.text, f.tone);
        (sfx[f.tone] || sfx.info)();
        await sleep(350);
      } else if (item.sync) {
        view.dispPos = s.players.map(p => p.pos);
      } else if (item.myTurn) {
        sfx.turn();
      }
    }
    view.animating = false;
    if (ctrl && ctrl.state) render();
    view.idleWaiters.splice(0).forEach(r => r());
  }

  async function animateDice(d) {
    const box = $('#dice');
    box.innerHTML = '<span class="die rolling">?</span><span class="die rolling">?</span>';
    sfx.dice();
    const dies = box.querySelectorAll('.die');
    for (let k = 0; k < 6; k++) {
      dies.forEach(x => { x.textContent = 1 + Math.floor(Math.random() * 6); });
      await sleep(70);
    }
    renderDice(d);
    await sleep(200);
  }
  function renderDice(d) {
    $('#dice').innerHTML = d ? d.map(x => `<span class="die">${x}</span>`).join('') : '<span class="die">🎲</span>';
  }

  // ---------- 主渲染 ----------
  function viewer(s) {
    const id = ctrl.you();
    return s.players.findIndex(p => p.id === id);
  }
  function canAct(s) {
    const a = E.pendingActor(s), me = viewer(s);
    return a !== null && a === me && !s.players[me].auto && !view.animating;
  }

  function render() {
    const s = ctrl.state;
    if (!s) return;
    renderBoard(s);
    if (!view.animating) renderDice(s.dice);
    const cur = s.players[s.current];
    $('#roundInfo').textContent = s.maxRounds ? `第 ${Math.min(s.round, s.maxRounds)} / ${s.maxRounds} 回合` : `第 ${s.round} 回合`;
    $('#turnBanner').innerHTML = s.phase === 'over'
      ? `🏆 ${esc(s.players[s.winner].name)} 获胜！`
      : `${CHARACTERS[cur.char].emoji} ${esc(cur.name)} 的回合<span class="sub">${PHASE_TEXT[s.phase] || ''}</span>`;
    $('#centerLog').innerHTML = s.log.slice(-7).map(l => `<div>${esc(l.text)}</div>`).join('');
    renderPlayers(s);
    renderActions(s);
    renderHand(s);
    renderLog(s);
    const me = viewer(s);
    const auto = me >= 0 && s.players[me].auto;
    $('#autoBtn').classList.toggle('on', auto);
    $('#autoBtn').textContent = auto ? '🤖 托管中' : '🤖 托管';
    $('#autoBtn').disabled = me < 0 || s.phase === 'over';
    $('#soundBtn').textContent = soundOn ? '🔊' : '🔇';
    $('#chatTab').classList.toggle('hidden', ctrl.mode !== 'online');
    syncModals(s);
  }

  function statusText(p) {
    const parts = [];
    if (p.stay > 0) parts.push(p.stayAt === 'jail' ? `🚔 坐牢 ${p.stay} 天` : p.stayAt === 'hospital' ? `🏥 住院 ${p.stay} 天` : `💤 冬眠 ${p.stay} 回合`);
    if (p.god) parts.push(`${GODS[p.god.key].emoji}${GODS[p.god.key].name}×${p.god.turns}`);
    if (p.turtle) parts.push(`🐢×${p.turtle}`);
    return parts.join(' · ');
  }

  function renderPlayers(s) {
    const me = viewer(s);
    const online = ctrl.mode === 'online' && ctrl.room ? Object.fromEntries(ctrl.room.seats.map(x => [x.id, x.online])) : null;
    $('#playersPanel').innerHTML = s.players.map((p, k) => {
      const ch = CHARACTERS[p.char];
      const tags = [k === me ? '你' : '', p.isBot ? '电脑' : '', p.auto ? '托管' : '', online && !p.isBot && !online[p.id] ? '离线' : ''].filter(Boolean);
      return `<div class="pl ${k === s.current && s.phase !== 'over' ? 'cur' : ''} ${p.bankrupt ? 'dead' : ''}" style="--pc:${p.color}" data-player="${k}">
        <span class="em">${ch.emoji}</span>
        <span class="nm">${esc(p.name)} <small>${ch.name}${tags.length ? ' · ' + tags.join(' · ') : ''}</small></span>
        <span class="cash">${p.bankrupt ? '破产' : money(p.cash)}</span>
        <span class="meta">${p.dir === 1 ? '↻' : '↺'} 🎟️${p.points} · 🃏${p.cards.length} · 🏠${E.ownedBy(s, k).length} · 总资产 ${money(E.netWorth(s, k))}${statusText(p) ? '<br>' + statusText(p) : ''}</span>
      </div>`;
    }).join('');
  }

  function renderLog(s) {
    const el = $('#gameLog');
    const last = s.log.length ? s.log[s.log.length - 1].n : 0;
    if (last === view.logSeq) return;
    view.logSeq = last;
    el.innerHTML = s.log.map(l => `<div>${esc(l.text)}</div>`).join('');
    el.scrollTop = el.scrollHeight;
  }

  function renderActions(s) {
    const el = $('#actionPanel');
    const me = viewer(s), cur = s.players[s.current];
    if (s.phase === 'over') {
      el.innerHTML = `<h3>🏆 游戏结束</h3><p>${esc(s.players[s.winner].name)} 成为了大富翁！</p>
        <div class="row"><button class="btn primary" data-act="ranking">查看排名</button></div>`;
      return;
    }
    if (me >= 0 && s.players[me].bankrupt) {
      el.innerHTML = `<h3>😵 你已破产</h3><p>你可以继续观战，或者回到主页。</p>`;
      return;
    }
    if (!canAct(s)) {
      const waiting = me >= 0 && s.players[me].auto ? '托管中，电脑会替你行动。' : view.animating ? '……' : `等待 ${esc(cur.name)} ${PHASE_TEXT[s.phase] || '行动'}${cur.isBot ? '（电脑思考中）' : ''}`;
      el.innerHTML = `<h3>${CHARACTERS[cur.char].emoji} ${esc(cur.name)} 的回合</h3><p>${waiting}</p>`;
      return;
    }
    const p = s.players[me], cell = BOARD[p.pos];
    let html = '';
    switch (s.phase) {
      case 'roll': {
        const notes = [];
        if (s.forcedDice) notes.push(`🎯 遥控骰子：${s.forcedDice} 点`);
        if (p.turtle) notes.push(`🐢 乌龟状态，只能走 1 步（剩 ${p.turtle} 次）`);
        notes.push(`方向：${p.dir === 1 ? '顺时针 ↻' : '逆时针 ↺'}`);
        html = `<h3>🎲 轮到你了！</h3><p>${notes.join('<br>')}${p.cards.length ? '<br>掷骰前可以先使用下方的道具卡。' : ''}</p>
          <div class="row"><button class="btn primary big" data-act="roll">🎲 掷骰子</button></div>`;
        break;
      }
      case 'buy': {
        const price = E.buyPrice(s, me, p.pos);
        html = `<h3>🏷️ 买下「${cell.name}」？</h3>
          <p>${GROUPS[cell.group].name}片区 · 价格 <b>${money(price)}</b>${price !== cell.price ? '（阿土伯 8 折）' : ''}<br>你的现金 ${money(p.cash)}</p>
          <div class="row"><button class="btn primary" data-act="buy">买！</button><button class="btn" data-act="skip">不买</button></div>`;
        break;
      }
      case 'upgrade': {
        const ld = s.lands[p.pos], cost = E.upgradeCost(p.pos);
        const maxLv = Math.min(E.MAX_LEVEL - ld.level, Math.floor(p.cash / cost));
        const btns = [];
        for (let k = 1; k <= maxLv; k++) btns.push(`<button class="btn ${k === 1 ? 'primary' : 'gold'}" data-act="upgrade" data-levels="${k}">${k === 1 ? '加盖 1 层' : `盖到${LEVELS[ld.level + k]}`} ${money(cost * k)}</button>`);
        html = `<h3>🔨 在「${cell.name}」盖楼？</h3>
          <p>现在是${LEVELS[ld.level]} ${LEVEL_EMOJI[ld.level]}，每层 ${money(cost)}，你的现金 ${money(p.cash)}</p>
          <div class="row">${btns.join('')}<button class="btn" data-act="skip">不盖</button></div>`;
        break;
      }
      case 'shop':
        html = `<h3>🏪 道具店</h3><p>你有 ${p.points} 点券。</p>
          <div class="row"><button class="btn primary" data-act="openShop">逛逛</button><button class="btn" data-act="skip">离开</button></div>`;
        break;
      case 'casino':
        html = `<h3>🎰 赌场</h3><p>押大小，赢了翻倍！你的现金 ${money(p.cash)}</p>
          <div class="row"><button class="btn primary" data-act="openCasino">下注</button><button class="btn" data-act="skip">离开</button></div>`;
        break;
      default:
        html = `<p>……</p>`;
    }
    el.innerHTML = html;
  }

  $('#actionPanel').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b || !ctrl) return;
    const act = b.dataset.act;
    if (act === 'ranking') return showRanking();
    if (act === 'openShop') return openShop();
    if (act === 'openCasino') return openCasino();
    if (act === 'upgrade') return send({ type: 'upgrade', levels: Number(b.dataset.levels) });
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
    const el = $('#handPanel'), me = viewer(s);
    if (me < 0 || s.players[me].bankrupt || s.phase === 'over') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const p = s.players[me];
    const usable = canAct(s) && s.phase === 'roll';
    el.innerHTML = `<div class="hand-title"><span>🃏 我的道具卡（${p.cards.length}/${E.MAX_CARDS}）</span><span>🎟️ ${p.points} 点券</span></div>
      <div class="hand-cards">${p.cards.map((k, idx) => {
        const c = CARDS[k], ok = usable && E.cardTargets(s, me, k);
        return `<button class="card-chip ${ok ? 'usable' : ''} ${c.target === 'passive' ? 'passive' : ''}" data-card="${idx}" title="${esc(c.desc)}">${c.emoji} ${c.name}</button>`;
      }).join('') || '<span class="hint">还没有道具卡，去道具店看看吧</span>'}</div>`;
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
      openModal('target', `<h2>${c.emoji} 想掷出几点？</h2><div class="choice-grid">${targets.map(t => {
        const dest = BOARD[(s.players[viewer(s)].pos + s.players[viewer(s)].dir * t + N) % N];
        return `<button class="btn" data-t="${t}"><b>${t}</b> 点<br><small>${dest.name}</small></button>`;
      }).join('')}</div>`);
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
      render();
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
  $('#cancelSelect').onclick = () => { selectMode = null; $('#selectBanner').classList.add('hidden'); render(); };

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
    openModal('info', `<h2><span style="color:${GROUPS[c.group].color}">■</span> ${c.name} <small class="hint">${GROUPS[c.group].name}片区</small></h2>
      <p>地价 ${money(c.price)} · 每层加盖 ${money(E.upgradeCost(i))}<br>
      ${owner ? `地主：<b style="color:${owner.color}">${esc(owner.name)}</b> · ${LEVELS[ld.level]} · 当前过路费 <b>${money(E.rentFor(s, i))}</b> · 总价 ${money(E.landValue(s, i))}` : '无主空地'}</p>
      <table class="info-table"><tr><td><b>建筑</b></td><td><b>基础过路费</b></td></tr>${rows}</table>
      <p class="hint">同片区每多拥有一块地，过路费 +50%；钱夫人收租再 +25%。</p>
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
      if (b) send({ type: 'shopBuy', card: b.dataset.buy });
      if (e.target.closest('[data-leave]')) { closeModal(); send({ type: 'skip' }); }
    };
  }
  let casinoBet = 1000;
  function openCasino() {
    const s = ctrl.state, p = s.players[viewer(s)];
    openModal('casino', `<h2>🎰 赌场 · 押大小</h2>
      <p>摇三颗骰子：11–18 为大，3–10 为小，豹子（三颗相同）庄家通吃。你的现金 ${money(p.cash)}</p>
      <div class="row">${[1000, 3000, 5000].map(a => `<button class="btn ${a === casinoBet ? 'gold' : ''}" data-amt="${a}" ${a > p.cash ? 'disabled' : ''}>${money(a)}</button>`).join('')}</div>
      <div class="row"><button class="btn primary big" data-pick="big">押大</button><button class="btn primary big" data-pick="small">押小</button><button class="btn" data-leave>不赌了</button></div>`);
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
    if (s.phase === 'over' && !view.animating && view.shownOver !== s.turn && (!modalKind || modalKind === 'info')) {
      view.shownOver = s.turn;
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
    show('home');
    const sv = store.get('mono.save', null);
    $('#resumeBtn').classList.toggle('hidden', !(sv && sv.state && sv.state.phase !== 'over'));
    if (sv && sv.state) $('#resumeBtn').textContent = `继续上一局（第 ${sv.state.round} 回合）`;
  }

  // ---------- 顶部按钮 ----------
  $('#soundBtn').onclick = () => { soundOn = !soundOn; store.set('mono.sound', soundOn); render(); if (soundOn) sfx.info(); };
  $('#autoBtn').onclick = () => {
    const s = ctrl.state, me = viewer(s);
    if (me >= 0) send({ type: 'setAuto', value: !s.players[me].auto });
  };
  $('#menuBtn').onclick = () => {
    const s = ctrl.state;
    openModal('menu', `<h2>☰ 菜单</h2>
      ${ctrl.mode === 'online' ? `<p>房间号：<span class="room-code">${ctrl.room.id}</span></p>` : '<p class="hint">单机进度会自动保存，回到主页后可以继续。</p>'}
      <div class="row"><button class="btn" data-rules>📖 玩法说明</button></div>
      <div class="row">${s.phase !== 'over' && viewer(s) >= 0 && !s.players[viewer(s)].bankrupt ? '<button class="btn" data-resign>🏳️ 认输</button>' : ''}
      <button class="btn primary" data-home>🏠 回到主页${ctrl.mode === 'online' ? '（退出房间）' : ''}</button></div>`);
    $('#modalBody').onclick = e => {
      if (e.target.closest('[data-home]')) { closeModal(); goHome(); }
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
