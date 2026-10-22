// 大富翁游戏引擎：纯状态机，浏览器（单机）与 Node 服务器（联机）共用。
// 玩法参考《大富翁 11》：角色技能、道具卡、神仙附身、道具店/点券、新闻、转盘、赌场、医院/监狱、地产逐级升级。
// 状态是可 JSON 序列化的普通对象；所有改动都通过 applyAction 进行。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MonopolyEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 地图 ----------
  const GROUPS = {
    brown:     { name: '西北', color: '#a0522d' },
    lightblue: { name: '西南', color: '#4fb3e8' },
    pink:      { name: '华中', color: '#d64d9b' },
    orange:    { name: '中原', color: '#f39c12' },
    red:       { name: '巴蜀', color: '#e53935' },
    yellow:    { name: '江淮', color: '#e1b12c' },
    green:     { name: '岭南', color: '#27ae60' },
    darkblue:  { name: '京沪', color: '#3949ab' },
  };
  const L = (name, group, price) => ({ type: 'land', name, group, price });
  const BOARD = [
    { type: 'start', name: '起点' },
    L('拉萨', 'brown', 600), L('西宁', 'brown', 600), { type: 'destiny', name: '命运' }, L('兰州', 'brown', 800),
    { type: 'shop', name: '道具店' }, L('昆明', 'lightblue', 1000), L('贵阳', 'lightblue', 1000), { type: 'chance', name: '机会' }, L('南宁', 'lightblue', 1200),
    { type: 'jail', name: '监狱' }, L('长沙', 'pink', 1400), { type: 'wheel', name: '幸运转盘' }, L('南昌', 'pink', 1400), L('福州', 'pink', 1600),
    { type: 'points', name: '点券站' }, L('合肥', 'orange', 1800), { type: 'news', name: '新闻' }, L('郑州', 'orange', 1800), L('武汉', 'orange', 2000),
    { type: 'hospital', name: '医院' }, L('西安', 'red', 2200), { type: 'chance', name: '机会' }, L('成都', 'red', 2200), L('重庆', 'red', 2400),
    { type: 'shop', name: '道具店' }, L('天津', 'yellow', 2600), L('南京', 'yellow', 2600), { type: 'casino', name: '赌场' }, L('苏州', 'yellow', 2800),
    { type: 'police', name: '警察局' }, L('杭州', 'green', 3000), L('广州', 'green', 3000), { type: 'destiny', name: '命运' }, L('深圳', 'green', 3200),
    { type: 'points', name: '点券站' }, { type: 'news', name: '新闻' }, L('上海', 'darkblue', 3500), { type: 'tax', name: '税务局' }, L('北京', 'darkblue', 4000),
  ];
  const N = BOARD.length;
  const JAIL = 10, HOSPITAL = 20;
  const LANDS = BOARD.map((c, i) => (c.type === 'land' ? i : -1)).filter(i => i >= 0);
  const GROUP_CELLS = {};
  LANDS.forEach(i => (GROUP_CELLS[BOARD[i].group] = GROUP_CELLS[BOARD[i].group] || []).push(i));
  const CORNERS = [0, JAIL, HOSPITAL, 30];

  const LEVELS = ['空地', '平房', '洋房', '公寓', '大厦', '摩天楼'];
  const LEVEL_EMOJI = ['', '🏠', '🏡', '🏢', '🏬', '🏙️'];
  const LEVEL_MULT = [1, 4, 10, 22, 36, 52];
  const MAX_LEVEL = 5;
  const MAX_CARDS = 8;

  // ---------- 角色 ----------
  const CHARACTERS = {
    atubo:   { name: '阿土伯', emoji: '👴', skill: '买地打 8 折' },
    xiaomei: { name: '孙小美', emoji: '👧', skill: '道具店买卡打 7 折' },
    qian:    { name: '钱夫人', emoji: '💃', skill: '收取过路费 +25%' },
    beibei:  { name: '金贝贝', emoji: '👦', skill: '经过起点领 ¥3000（常人 ¥2000）' },
    ninja:   { name: '忍太郎', emoji: '🥷', skill: '不会被路障拦下，也不会踩中地雷' },
    laoqian: { name: '大老千', emoji: '🎩', skill: '赌场输了可以出千重来一次；点券站收入翻倍' },
  };
  const CHAR_KEYS = Object.keys(CHARACTERS);

  // ---------- 神仙 ----------
  const GODS = {
    caishen: { name: '财神', emoji: '💰', good: true, turns: 5, desc: '每回合开始获得 ¥1000' },
    fushen:  { name: '福神', emoji: '🍀', good: true, turns: 5, desc: '免付过路费' },
    tudi:    { name: '土地公', emoji: '🧓', good: true, turns: 3, desc: '停留的空地或他人地产直接归你' },
    angel:   { name: '天使', emoji: '👼', good: true, turns: 5, desc: '停在自己的地产上免费升一级' },
    shuai:   { name: '衰神', emoji: '😩', good: false, turns: 5, desc: '过路费加倍' },
    qiong:   { name: '穷神', emoji: '💸', good: false, turns: 5, desc: '每回合开始损失 10% 现金' },
    devil:   { name: '恶魔', emoji: '😈', good: false, turns: 4, desc: '停留地块上的建筑全部被摧毁（包括自己的）' },
  };
  const GOD_KEYS = Object.keys(GODS);

  // ---------- 道具卡 ----------
  const CARDS = {
    remote:    { name: '遥控骰子', emoji: '🎯', price: 30, target: 'dice', desc: '指定本回合掷出的点数（2–12）' },
    roadblock: { name: '路障', emoji: '🚧', price: 20, target: 'cell', desc: '在前后 8 格内放路障，经过的人会被拦下' },
    mine:      { name: '地雷', emoji: '💣', price: 40, target: 'cell', desc: '在前后 8 格内埋地雷，踩中的人住院 3 天' },
    robot:     { name: '机器娃娃', emoji: '🤖', price: 20, target: 'none', desc: '清除前方 10 格内的路障和地雷' },
    turn:      { name: '转向卡', emoji: '🔄', price: 20, target: 'player', self: true, desc: '让一位玩家（可以是自己）掉头走' },
    stay:      { name: '停留卡', emoji: '⏸️', price: 30, target: 'none', desc: '本回合原地不动，再次触发脚下格子' },
    turtle:    { name: '乌龟卡', emoji: '🐢', price: 30, target: 'player', self: true, desc: '目标接下来 3 回合每次只走 1 步' },
    average:   { name: '均富卡', emoji: '⚖️', price: 80, target: 'none', desc: '所有玩家的现金重新平分' },
    tax:       { name: '查税卡', emoji: '🧾', price: 40, target: 'player', desc: '目标被查税，缴纳现金的 30%' },
    rob:       { name: '抢夺卡', emoji: '🦹', price: 40, target: 'player', desc: '随机抢走目标一张道具卡' },
    free:      { name: '免费卡', emoji: '🎫', price: 30, target: 'passive', desc: '被动生效：自动免付一次过路费' },
    buyland:   { name: '购地卡', emoji: '💵', price: 60, target: 'none', desc: '按总价强行买下脚下的对手地产' },
    demolish:  { name: '拆屋卡', emoji: '🏚️', price: 40, target: 'cell', desc: '拆掉对手一块地产的一层建筑' },
    monster:   { name: '怪兽卡', emoji: '🦖', price: 70, target: 'cell', desc: '怪兽出没！一块地产的建筑全部被毁' },
    angelcard: { name: '天使卡', emoji: '😇', price: 60, target: 'cell', desc: '一整个片区的已有主地产各升一级' },
    devilcard: { name: '恶魔卡', emoji: '👿', price: 80, target: 'cell', desc: '一整个片区的建筑全部摧毁' },
    frame:     { name: '陷害卡', emoji: '👮', price: 50, target: 'player', desc: '诬告目标，让其入狱 2 天' },
    sleep:     { name: '冬眠卡', emoji: '💤', price: 80, target: 'none', desc: '其他所有玩家冬眠 1 回合' },
    dismiss:   { name: '送神符', emoji: '📿', price: 20, target: 'none', desc: '送走附在你身上的神仙' },
    blame:     { name: '嫁祸卡', emoji: '🎭', price: 40, target: 'player', desc: '把你身上的神仙转嫁给目标' },
    missile:   { name: '导弹', emoji: '🚀', price: 70, target: 'cell', desc: '轰炸任意格子：建筑清零，格子上的玩家住院 2 天' },
  };
  const CARD_KEYS = Object.keys(CARDS);

  const PLAYER_COLORS = ['#e53935', '#1e88e5', '#43a047', '#f9a825', '#8e24aa', '#00897b'];

  // ---------- 随机数（种子存在状态里，可序列化/可复现） ----------
  function rand(s) {
    let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function pickWeighted(s, items) {
    const total = items.reduce((a, x) => a + x.w, 0);
    let r = rand(s) * total;
    for (const x of items) if ((r -= x.w) < 0) return x;
    return items[items.length - 1];
  }

  // ---------- 创建 ----------
  function createGame(players, opts = {}) {
    if (players.length < 2 || players.length > 6) throw new Error('需要 2–6 名玩家');
    const s = {
      rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
      players: [],
      lands: {},
      obstacles: {},
      gods: {},
      current: 0,
      phase: 'roll',
      dice: null,
      forcedDice: null,
      cardsUsed: 0,
      moves: [],
      fx: [],
      log: [],
      seq: 0,
      round: 1,
      turn: 1,
      maxRounds: opts.maxRounds ?? 30,
      salary: 2000,
      winner: null,
    };
    const cash = opts.startingCash || 20000;
    const taken = new Set(players.map(p => p.char).filter(c => CHARACTERS[c]));
    players.forEach(p => {
      let ch = CHARACTERS[p.char] && !s.players.some(x => x.char === p.char) ? p.char : null;
      if (!ch) {
        const free = CHAR_KEYS.filter(k => !taken.has(k));
        ch = free.length ? pick(s, free) : pick(s, CHAR_KEYS);
        taken.add(ch);
      }
      s.players.push({
        id: p.id, name: p.name, char: ch, isBot: !!p.isBot, auto: false, color: '',
        cash, points: 60, pos: 0, dir: 1, cards: [], god: null,
        stay: 0, stayAt: null, turtle: 0, bankrupt: false,
      });
    });
    if (opts.shuffleOrder !== false) {
      for (let i = s.players.length - 1; i > 0; i--) {
        const j = randInt(s, 0, i);
        [s.players[i], s.players[j]] = [s.players[j], s.players[i]];
      }
    }
    s.players.forEach((p, i) => {
      p.color = PLAYER_COLORS[i];
      p.cards = [pick(s, ['remote', 'roadblock', 'turn', 'robot']), pick(s, ['free', 'tax', 'stay', 'turtle'])];
    });
    LANDS.forEach(i => { s.lands[i] = { owner: null, level: 0 }; });
    spawnGod(s);
    spawnGod(s);
    log(s, `游戏开始！每人 ${money(cash)}、60 点券和 2 张道具卡。${s.players[0].name} 先走。`);
    return s;
  }

  // ---------- 工具 ----------
  const money = n => '¥' + Math.round(n).toLocaleString('en-US');
  const round10 = n => Math.round(n / 10) * 10;
  const pn = (s, i) => s.players[i].name;
  const alive = s => s.players.map((_, i) => i).filter(i => !s.players[i].bankrupt);
  const ringDist = (a, b) => { const d = Math.abs(a - b) % N; return Math.min(d, N - d); };

  function log(s, text) {
    s.log.push({ n: ++s.seq, text });
    if (s.log.length > 150) s.log.splice(0, s.log.length - 150);
  }
  // 给界面弹出的特效消息
  function fx(s, emoji, title, text, tone = 'info', player = null) {
    s.fx.push({ n: ++s.seq, emoji, title, text, tone, player });
    if (s.fx.length > 30) s.fx.shift();
  }
  function recordMove(s, i, path, jump = false) {
    if (!path.length) return;
    s.moves.push({ n: ++s.seq, player: i, path, jump });
    if (s.moves.length > 20) s.moves.shift();
  }

  // ---------- 地产 ----------
  function upgradeCost(cell) { return round10(BOARD[cell].price * 0.4); }
  function landValue(s, cell) { return BOARD[cell].price + s.lands[cell].level * upgradeCost(cell); }
  function buyPrice(s, i, cell) { return s.players[i].char === 'atubo' ? round10(BOARD[cell].price * 0.8) : BOARD[cell].price; }
  function cardPrice(s, i, key) { return s.players[i].char === 'xiaomei' ? Math.ceil(CARDS[key].price * 0.7) : CARDS[key].price; }
  function ownedBy(s, i) { return LANDS.filter(c => s.lands[c].owner === i); }

  function rentFor(s, cell) {
    const ld = s.lands[cell];
    if (ld.owner === null) return 0;
    const c = BOARD[cell];
    const chain = GROUP_CELLS[c.group].filter(x => x !== cell && s.lands[x].owner === ld.owner).length;
    let r = (c.price / 10) * LEVEL_MULT[ld.level] * (1 + 0.5 * chain);
    if (s.players[ld.owner].char === 'qian') r *= 1.25;
    return round10(r);
  }

  function netWorth(s, i) {
    const p = s.players[i];
    if (p.bankrupt) return 0;
    return p.cash + ownedBy(s, i).reduce((a, c) => a + landValue(s, c), 0);
  }

  // ---------- 付款与破产 ----------
  // 现金不够时自动把地产按半价卖回银行（便宜的先卖）；仍不够则破产。返回是否付清。
  function pay(s, from, to, amount, reason) {
    amount = Math.round(amount);
    if (amount <= 0) return true;
    const p = s.players[from];
    if (p.cash < amount) {
      const own = ownedBy(s, from).sort((a, b) => landValue(s, a) - landValue(s, b));
      for (const c of own) {
        if (p.cash >= amount) break;
        const v = round10(landValue(s, c) / 2);
        p.cash += v;
        s.lands[c] = { owner: null, level: 0 };
        log(s, `${p.name} 变卖 ${BOARD[c].name}，换得 ${money(v)}`);
      }
    }
    if (p.cash >= amount) {
      p.cash -= amount;
      if (to !== null) s.players[to].cash += amount;
      return true;
    }
    if (to !== null) s.players[to].cash += p.cash;
    log(s, `${p.name} 付不起 ${money(amount)}（${reason}）`);
    bankrupt(s, from);
    return false;
  }

  function bankrupt(s, i) {
    const p = s.players[i];
    ownedBy(s, i).forEach(c => { s.lands[c] = { owner: null, level: 0 }; });
    p.cash = 0;
    p.cards = [];
    p.god = null;
    p.stay = 0;
    p.bankrupt = true;
    fx(s, '💥', '破产', `${p.name} 破产出局了！`, 'bad', i);
    log(s, `💥 ${p.name} 破产出局！`);
    const left = alive(s);
    if (left.length === 1) finish(s, left[0], '其他玩家全部破产');
  }

  function finish(s, winner, why) {
    s.phase = 'over';
    s.winner = winner;
    log(s, `🏆 游戏结束（${why}），${pn(s, winner)} 获胜！`);
    fx(s, '🏆', '游戏结束', `${pn(s, winner)} 成为大富翁！`, 'good', winner);
  }

  // ---------- 状态变化 ----------
  function sendTo(s, i, where, days, why) {
    const p = s.players[i];
    p.pos = where === 'jail' ? JAIL : HOSPITAL;
    p.stay = days;
    p.stayAt = where;
    recordMove(s, i, [p.pos], true);
    const place = where === 'jail' ? '监狱' : '医院';
    log(s, `${where === 'jail' ? '🚔' : '🚑'} ${p.name} ${why}，${where === 'jail' ? '入狱' : '住院'} ${days} 天`);
    fx(s, where === 'jail' ? '🚔' : '🚑', place, `${p.name} ${why}，要在${place}待 ${days} 天`, 'bad', i);
  }

  function attachGod(s, i, key, why) {
    const p = s.players[i], g = GODS[key];
    p.god = { key, turns: g.turns };
    log(s, `${g.emoji} ${p.name} ${why || '遇到了'}${g.name}（${g.desc}，${g.turns} 回合）`);
    fx(s, g.emoji, `${g.name}附身`, `${p.name}：${g.desc}`, g.good ? 'good' : 'bad', i);
  }

  function spawnGod(s) {
    if (Object.keys(s.gods).length >= 3) return;
    const busy = new Set([...Object.keys(s.gods), ...Object.keys(s.obstacles)].map(Number));
    s.players.forEach(p => busy.add(p.pos));
    const cells = [];
    for (let c = 0; c < N; c++) if (!CORNERS.includes(c) && !busy.has(c)) cells.push(c);
    if (!cells.length) return;
    const cell = pick(s, cells), key = pick(s, GOD_KEYS);
    s.gods[cell] = key;
    log(s, `✨ ${GODS[key].emoji}${GODS[key].name}出现在「${BOARD[cell].name}」`);
  }

  function giveCard(s, i, key) {
    const p = s.players[i];
    if (p.cards.length >= MAX_CARDS) { log(s, `${p.name} 的道具卡已满，${CARDS[key].name}作废`); return false; }
    p.cards.push(key);
    return true;
  }
  const randomCard = s => pick(s, CARD_KEYS);

  // ---------- 移动 ----------
  // 逐格行走：经过起点领工资、经过神仙被附身、遇路障停下、踩地雷住院。返回 false 表示走路途中被送进医院。
  function walk(s, i, steps, dir) {
    const p = s.players[i];
    dir = dir || p.dir;
    const path = [];
    for (let k = 1; k <= steps; k++) {
      p.pos = (p.pos + dir + N) % N;
      path.push(p.pos);
      if (p.pos === 0) {
        const sal = p.char === 'beibei' ? 3000 : s.salary;
        p.cash += sal;
        p.points += 10;
        log(s, `${p.name} 经过起点，领取工资 ${money(sal)} 和 10 点券`);
      }
      if (s.gods[p.pos]) {
        attachGod(s, i, s.gods[p.pos]);
        delete s.gods[p.pos];
      }
      const ob = s.obstacles[p.pos];
      if (ob) {
        if (p.char === 'ninja') {
          log(s, `🥷 ${p.name} 轻松越过了${ob === 'mine' ? '地雷' : '路障'}`);
        } else if (ob === 'mine') {
          delete s.obstacles[p.pos];
          recordMove(s, i, path);
          fx(s, '💥', '轰！', `${p.name} 踩中了地雷`, 'bad', i);
          sendTo(s, i, 'hospital', 3, '踩中地雷');
          return false;
        } else {
          delete s.obstacles[p.pos];
          log(s, `🚧 ${p.name} 被路障拦了下来`);
          break;
        }
      }
    }
    recordMove(s, i, path);
    return true;
  }

  function teleport(s, i, cell) {
    const p = s.players[i];
    p.pos = cell;
    recordMove(s, i, [cell], true);
  }

  // ---------- 落地结算 ----------
  function land(s, i) {
    const p = s.players[i];
    const c = BOARD[p.pos];
    if (p.bankrupt || p.stay > 0) return;
    switch (c.type) {
      case 'land': return landOnLand(s, i, p.pos);
      case 'chance': return drawChance(s, i);
      case 'destiny': return drawDestiny(s, i);
      case 'news': return news(s);
      case 'wheel': return wheel(s, i);
      case 'shop':
        s.phase = 'shop';
        log(s, `${p.name} 走进道具店（点券 ${p.points}）`);
        return;
      case 'points': {
        let pts = randInt(s, 2, 6) * 10;
        if (p.char === 'laoqian') pts *= 2;
        p.points += pts;
        log(s, `🎟️ ${p.name} 在点券站领取 ${pts} 点券`);
        fx(s, '🎟️', '点券站', `${p.name} 获得 ${pts} 点券`, 'good', i);
        return;
      }
      case 'casino':
        if (p.cash >= 1000) { s.phase = 'casino'; log(s, `🎰 ${p.name} 走进了赌场`); }
        else log(s, `${p.name} 太穷了，被赌场保安拦在门外`);
        return;
      case 'tax': {
        const t = round10(p.cash * 0.1);
        log(s, `🧾 ${p.name} 在税务局缴税 ${money(t)}`);
        fx(s, '🧾', '税务局', `${p.name} 缴纳所得税 ${money(t)}`, 'bad', i);
        pay(s, i, null, t, '所得税');
        return;
      }
      case 'police':
        sendTo(s, i, 'jail', 2, '被警察带走');
        return;
      default:
        log(s, `${p.name} 来到「${c.name}」`);
    }
  }

  function landOnLand(s, i, cell) {
    const p = s.players[i], c = BOARD[cell], ld = s.lands[cell];
    const god = p.god && p.god.key;
    if (god === 'devil' && ld.level > 0) {
      ld.level = 0;
      fx(s, '😈', '恶魔作祟', `${c.name} 的建筑被恶魔摧毁了`, 'bad', i);
      log(s, `😈 恶魔摧毁了 ${c.name} 上的建筑`);
    }
    if (god === 'tudi' && ld.owner !== i) {
      const from = ld.owner === null ? '' : `从 ${pn(s, ld.owner)} 手里`;
      ld.owner = i;
      fx(s, '🧓', '土地公显灵', `${p.name} ${from}白得了 ${c.name}`, 'good', i);
      log(s, `🧓 土地公显灵！${p.name} ${from}白得了 ${c.name}`);
      return;
    }
    if (ld.owner === null) {
      log(s, `${p.name} 来到空地「${c.name}」`);
      if (p.cash >= buyPrice(s, i, cell)) s.phase = 'buy';
      return;
    }
    if (ld.owner === i) {
      log(s, `${p.name} 来到自己的「${c.name}」`);
      if (ld.level >= MAX_LEVEL) return;
      if (god === 'angel') {
        ld.level++;
        fx(s, '👼', '天使祝福', `${c.name} 免费升级为${LEVELS[ld.level]}`, 'good', i);
        log(s, `👼 天使让 ${c.name} 免费升级为${LEVELS[ld.level]}`);
        return;
      }
      if (p.cash >= upgradeCost(cell)) s.phase = 'upgrade';
      return;
    }
    const owner = s.players[ld.owner];
    let rent = rentFor(s, cell);
    log(s, `${p.name} 来到 ${owner.name} 的「${c.name}」`);
    if (owner.stay > 0) {
      log(s, `${owner.name} ${owner.stayAt === 'jail' ? '在坐牢' : owner.stayAt === 'hospital' ? '在住院' : '在冬眠'}，收不了过路费`);
      fx(s, '😅', '逃过一劫', `${owner.name} 不在，${p.name} 免付过路费`, 'good', i);
      return;
    }
    if (god === 'fushen') {
      fx(s, '🍀', '福神保佑', `${p.name} 免付过路费 ${money(rent)}`, 'good', i);
      log(s, `🍀 福神保佑，${p.name} 免付过路费`);
      return;
    }
    const fc = p.cards.indexOf('free');
    if (fc >= 0) {
      p.cards.splice(fc, 1);
      fx(s, '🎫', '免费卡', `${p.name} 用免费卡抵掉了 ${money(rent)} 过路费`, 'good', i);
      log(s, `🎫 ${p.name} 使用免费卡，免付过路费`);
      return;
    }
    if (god === 'shuai') rent *= 2;
    log(s, `💸 ${p.name} 支付过路费 ${money(rent)} 给 ${owner.name}${god === 'shuai' ? '（衰神附身，翻倍）' : ''}`);
    if (rent >= 3000) fx(s, '💸', '高额过路费', `${p.name} 付给 ${owner.name} ${money(rent)}`, 'bad', i);
    pay(s, i, ld.owner, rent, `${c.name} 的过路费`);
  }

  // ---------- 机会 / 命运 / 新闻 / 转盘 ----------
  function nearestAhead(s, i, type) {
    const p = s.players[i];
    for (let k = 1; k <= N; k++) {
      const c = (p.pos + p.dir * k + N) % N;
      if (BOARD[c].type === type) return k;
    }
    return 0;
  }

  const CHANCE = [
    { text: '搭上顺风车，再前进 3 格', run: (s, i) => { if (walk(s, i, 3)) land(s, i); } },
    { text: '被狗追，向后跑 3 格', run: (s, i) => { if (walk(s, i, 3, -s.players[i].dir)) land(s, i); } },
    { text: '迷路了，从此掉头走', run: (s, i) => { s.players[i].dir *= -1; } },
    { text: '前往最近的道具店', run: (s, i) => { if (walk(s, i, nearestAhead(s, i, 'shop'))) land(s, i); } },
    { text: '前往赌场碰碰运气', run: (s, i) => { if (walk(s, i, nearestAhead(s, i, 'casino'))) land(s, i); } },
    { text: '乘坐时光机回到起点，领取工资', run: (s, i) => { teleport(s, i, 0); const p = s.players[i]; p.cash += p.char === 'beibei' ? 3000 : s.salary; } },
    { text: '被外星人绑架，随机传送', run: (s, i) => { teleport(s, i, randInt(s, 0, N - 1)); land(s, i); } },
    { text: '获得 2 张随机道具卡', run: (s, i) => { giveCard(s, i, randomCard(s)); giveCard(s, i, randomCard(s)); } },
    { text: '获得 1 张随机道具卡', run: (s, i) => { giveCard(s, i, randomCard(s)); } },
    { text: '获得 50 点券', run: (s, i) => { s.players[i].points += 50; } },
    { text: '闯红灯被抓，入狱 2 天', run: (s, i) => sendTo(s, i, 'jail', 2, '闯红灯') },
    { text: '吃坏肚子，住院 2 天', run: (s, i) => sendTo(s, i, 'hospital', 2, '吃坏肚子') },
    { text: '财神爷来串门', run: (s, i) => attachGod(s, i, 'caishen', '迎来了') },
    { text: '土地公来串门', run: (s, i) => attachGod(s, i, 'tudi', '迎来了') },
    { text: '天使降临', run: (s, i) => attachGod(s, i, 'angel', '迎来了') },
    { text: '衰神缠上了你', run: (s, i) => attachGod(s, i, 'shuai', '被缠上') },
    { text: '踩到香蕉皮，下回合只能走 1 步', run: (s, i) => { s.players[i].turtle = Math.max(s.players[i].turtle, 1); } },
  ];

  const DESTINY = [
    { text: '中了彩票，获得 ¥3000', run: (s, i) => { s.players[i].cash += 3000; }, tone: 'good' },
    { text: '股票大涨，获得 ¥1500', run: (s, i) => { s.players[i].cash += 1500; }, tone: 'good' },
    { text: '捡到钱包，获得 ¥500', run: (s, i) => { s.players[i].cash += 500; }, tone: 'good' },
    { text: '继承远房亲戚遗产 ¥5000', run: (s, i) => { s.players[i].cash += 5000; }, tone: 'good' },
    { text: '今天是你生日，每人送你 ¥500', run: (s, i) => { alive(s).filter(j => j !== i).forEach(j => pay(s, j, i, 500, '生日红包')); }, tone: 'good' },
    { text: '请大家吃饭，每人 ¥500', run: (s, i) => { alive(s).filter(j => j !== i).forEach(j => { if (!s.players[i].bankrupt) pay(s, i, j, 500, '请客'); }); }, tone: 'bad' },
    { text: '超速罚款 ¥800', run: (s, i) => pay(s, i, null, 800, '罚款'), tone: 'bad' },
    { text: '看牙医花掉 ¥1500', run: (s, i) => pay(s, i, null, 1500, '医药费'), tone: 'bad' },
    { text: '房屋维修：每层建筑付 ¥300', run: (s, i) => pay(s, i, null, ownedBy(s, i).reduce((a, c) => a + s.lands[c].level * 300, 0), '维修费'), tone: 'bad' },
    { text: '遭遇小偷，丢了 20% 现金', run: (s, i) => { const p = s.players[i]; p.cash -= round10(p.cash * 0.2); }, tone: 'bad' },
    { text: '你的一块地产免费升一级', run: (s, i) => {
      const own = ownedBy(s, i).filter(c => s.lands[c].level < MAX_LEVEL);
      if (!own.length) { log(s, '可惜你没有可以升级的地产'); return; }
      const c = pick(s, own); s.lands[c].level++;
      log(s, `${BOARD[c].name} 升级为${LEVELS[s.lands[c].level]}`);
    }, tone: 'good' },
    { text: '年终分红：每块地产 ¥400', run: (s, i) => { s.players[i].cash += ownedBy(s, i).length * 400; }, tone: 'good' },
    { text: '做慈善：捐 ¥1000 给最穷的玩家', run: (s, i) => {
      const poor = alive(s).filter(j => j !== i).sort((a, b) => s.players[a].cash - s.players[b].cash)[0];
      if (poor !== undefined) pay(s, i, poor, 1000, '慈善捐款');
    }, tone: 'info' },
    { text: '获得 30 点券', run: (s, i) => { s.players[i].points += 30; }, tone: 'good' },
    { text: '穷神找上门', run: (s, i) => attachGod(s, i, 'qiong', '被找上了：'), tone: 'bad' },
    { text: '福神保佑', run: (s, i) => attachGod(s, i, 'fushen', '得到'), tone: 'good' },
  ];

  function drawChance(s, i) {
    const card = pick(s, CHANCE);
    log(s, `❓ ${pn(s, i)} 抽到机会：${card.text}`);
    fx(s, '❓', '机会', `${pn(s, i)}：${card.text}`, 'info', i);
    card.run(s, i);
  }
  function drawDestiny(s, i) {
    const card = pick(s, DESTINY);
    log(s, `🔮 ${pn(s, i)} 抽到命运：${card.text}`);
    fx(s, '🔮', '命运', `${pn(s, i)}：${card.text}`, card.tone, i);
    card.run(s, i);
  }

  const NEWS = [
    { text: '政府发放消费券，每人获得 ¥1000', run: s => alive(s).forEach(j => { s.players[j].cash += 1000; }) },
    { text: '股市崩盘，每人损失 15% 现金', run: s => alive(s).forEach(j => { const p = s.players[j]; p.cash -= round10(p.cash * 0.15); }) },
    { text: '全民纳税，每人缴纳 10% 现金', run: s => alive(s).forEach(j => { const p = s.players[j]; p.cash -= round10(p.cash * 0.1); }) },
    { text: '劫富济贫：首富把 20% 现金分给最穷的人', run: s => {
      const order = alive(s).sort((a, b) => netWorth(s, b) - netWorth(s, a));
      const rich = order[0], poor = order[order.length - 1];
      const amt = round10(s.players[rich].cash * 0.2);
      s.players[rich].cash -= amt; s.players[poor].cash += amt;
      log(s, `${pn(s, rich)} 给了 ${pn(s, poor)} ${money(amt)}`);
    } },
    { text: '地震！一个片区的建筑全部降一级', run: s => {
      const g = pick(s, Object.keys(GROUP_CELLS));
      GROUP_CELLS[g].forEach(c => { if (s.lands[c].level > 0) s.lands[c].level--; });
      log(s, `受灾片区：${GROUPS[g].name}`);
    } },
    { text: '房价上涨！一个片区已有主的地产各升一级', run: s => {
      const g = pick(s, Object.keys(GROUP_CELLS));
      GROUP_CELLS[g].forEach(c => { const ld = s.lands[c]; if (ld.owner !== null && ld.level < MAX_LEVEL) ld.level++; });
      log(s, `受益片区：${GROUPS[g].name}`);
    } },
    { text: '台风来袭，一位玩家受伤住院 2 天', run: s => { const j = pick(s, alive(s)); sendTo(s, j, 'hospital', 2, '被台风刮伤'); } },
    { text: '圣诞老人来了，每人获得一张道具卡', run: s => alive(s).forEach(j => giveCard(s, j, randomCard(s))) },
    { text: '点券大派送，每人获得 40 点券', run: s => alive(s).forEach(j => { s.players[j].points += 40; }) },
    { text: '神仙下凡，地图上出现了新的神仙', run: s => { spawnGod(s); spawnGod(s); } },
    { text: '城管大扫除，清除了所有路障和地雷', run: s => { s.obstacles = {}; } },
    { text: '地产大亨评选：拥有地产最多的玩家获奖 ¥3000', run: s => {
      const best = alive(s).sort((a, b) => ownedBy(s, b).length - ownedBy(s, a).length)[0];
      s.players[best].cash += 3000;
      log(s, `获奖者：${pn(s, best)}`);
    } },
  ];

  function news(s) {
    const n = pick(s, NEWS);
    log(s, `📰 新闻快报：${n.text}`);
    fx(s, '📰', '新闻快报', n.text, 'info');
    n.run(s);
  }

  const WHEEL = [
    { w: 3, emoji: '💎', text: '头奖！获得 ¥5000', run: (s, i) => { s.players[i].cash += 5000; }, tone: 'good' },
    { w: 8, emoji: '💰', text: '获得 ¥2000', run: (s, i) => { s.players[i].cash += 2000; }, tone: 'good' },
    { w: 10, emoji: '🪙', text: '获得 ¥800', run: (s, i) => { s.players[i].cash += 800; }, tone: 'good' },
    { w: 8, emoji: '🎟️', text: '获得 60 点券', run: (s, i) => { s.players[i].points += 60; }, tone: 'good' },
    { w: 8, emoji: '🃏', text: '获得 2 张道具卡', run: (s, i) => { giveCard(s, i, randomCard(s)); giveCard(s, i, randomCard(s)); }, tone: 'good' },
    { w: 4, emoji: '💰', text: '财神附身', run: (s, i) => attachGod(s, i, 'caishen', '转出了'), tone: 'good' },
    { w: 4, emoji: '🧓', text: '土地公附身', run: (s, i) => attachGod(s, i, 'tudi', '转出了'), tone: 'good' },
    { w: 8, emoji: '🫥', text: '谢谢参与', run: () => {}, tone: 'info' },
    { w: 7, emoji: '🧨', text: '损失 ¥1500', run: (s, i) => pay(s, i, null, 1500, '转盘'), tone: 'bad' },
    { w: 4, emoji: '😩', text: '衰神附身', run: (s, i) => attachGod(s, i, 'shuai', '转出了'), tone: 'bad' },
    { w: 3, emoji: '🚑', text: '转盘飞出来砸到头，住院 1 天', run: (s, i) => sendTo(s, i, 'hospital', 1, '被转盘砸到'), tone: 'bad' },
  ];
  function wheel(s, i) {
    const r = pickWeighted(s, WHEEL);
    log(s, `🎡 ${pn(s, i)} 转动幸运转盘：${r.text}`);
    fx(s, r.emoji, '幸运转盘', `${pn(s, i)}：${r.text}`, r.tone, i);
    r.run(s, i);
  }

  // ---------- 道具卡 ----------
  // 返回 null 表示当前不能用；否则返回可选目标（玩家 id / 格子号 / 点数），无目标卡返回 []
  function cardTargets(s, i, key) {
    const p = s.players[i], card = CARDS[key];
    if (!card) return null;
    const others = alive(s).filter(j => j !== i);
    const lands = cond => LANDS.filter(cond);
    let t;
    switch (key) {
      case 'remote': t = s.players[i].turtle > 0 ? [] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; if (!t.length) return null; return t;
      case 'roadblock': case 'mine': {
        t = [];
        for (let c = 0; c < N; c++) if (c !== p.pos && ringDist(c, p.pos) <= 8 && !s.obstacles[c]) t.push(c);
        return t;
      }
      case 'robot': return [];
      case 'stay': return [];
      case 'free': return null;
      case 'average': return [];
      case 'sleep': return others.length ? [] : null;
      case 'dismiss': return p.god ? [] : null;
      case 'buyland': {
        const ld = s.lands[p.pos];
        return ld && ld.owner !== null && ld.owner !== i && p.cash >= landValue(s, p.pos) ? [] : null;
      }
      case 'turn': case 'turtle': t = alive(s).map(j => s.players[j].id); break;
      case 'tax': case 'frame': t = others.map(j => s.players[j].id); break;
      case 'rob': t = others.filter(j => s.players[j].cards.length).map(j => s.players[j].id); break;
      case 'blame': if (!p.god) return null; t = others.map(j => s.players[j].id); break;
      case 'demolish': t = lands(c => s.lands[c].owner !== null && s.lands[c].owner !== i && s.lands[c].level > 0); break;
      case 'monster': t = lands(c => s.lands[c].level > 0); break;
      case 'angelcard': t = lands(c => GROUP_CELLS[BOARD[c].group].some(x => s.lands[x].owner !== null && s.lands[x].level < MAX_LEVEL)); break;
      case 'devilcard': t = lands(c => GROUP_CELLS[BOARD[c].group].some(x => s.lands[x].level > 0)); break;
      case 'missile': t = Array.from({ length: N }, (_, c) => c); break;
    }
    return t && t.length ? t : null;
  }

  function useCard(s, i, key, target) {
    const p = s.players[i], card = CARDS[key];
    const tj = typeof target === 'string' ? s.players.findIndex(x => x.id === target) : -1;
    const tp = tj >= 0 ? s.players[tj] : null;
    const say = (text, tone = 'info') => {
      log(s, `${card.emoji} ${p.name} 使用${card.name}：${text}`);
      fx(s, card.emoji, card.name, `${p.name}：${text}`, tone, i);
    };
    switch (key) {
      case 'remote': s.forcedDice = target; say(`本回合将掷出 ${target} 点`); break;
      case 'roadblock': s.obstacles[target] = 'block'; say(`在「${BOARD[target].name}」放了路障`); break;
      case 'mine': s.obstacles[target] = 'mine'; log(s, `💣 ${p.name} 偷偷埋下了地雷`); fx(s, '💣', '地雷', `${p.name} 偷偷埋了一颗地雷……`, 'info', i); break;
      case 'robot': {
        let n = 0;
        for (let k = 1; k <= 10; k++) { const c = (p.pos + p.dir * k + N) % N; if (s.obstacles[c]) { delete s.obstacles[c]; n++; } }
        say(n ? `清除了 ${n} 个障碍` : '前方一片坦途');
        break;
      }
      case 'turn': tp.dir *= -1; say(`${tp.name} 掉头了`); break;
      case 'turtle': tp.turtle = 3; say(`${tp.name} 变成了乌龟`, 'bad'); break;
      case 'average': {
        const al = alive(s), avg = round10(al.reduce((a, j) => a + s.players[j].cash, 0) / al.length);
        al.forEach(j => { s.players[j].cash = avg; });
        say(`所有人现金变为 ${money(avg)}`);
        break;
      }
      case 'tax': { const t = round10(tp.cash * 0.3); tp.cash -= t; say(`${tp.name} 被查税 ${money(t)}`, 'bad'); break; }
      case 'rob': {
        const k = randInt(s, 0, tp.cards.length - 1), got = tp.cards.splice(k, 1)[0];
        p.cards.push(got);
        say(`从 ${tp.name} 手里抢到了${CARDS[got].name}`);
        break;
      }
      case 'buyland': {
        const v = landValue(s, p.pos), ld = s.lands[p.pos], owner = ld.owner;
        p.cash -= v; s.players[owner].cash += v; ld.owner = i;
        say(`花 ${money(v)} 强行买下了 ${pn(s, owner)} 的 ${BOARD[p.pos].name}`);
        break;
      }
      case 'demolish': s.lands[target].level--; say(`拆掉了 ${BOARD[target].name} 的一层楼`); break;
      case 'monster': s.lands[target].level = 0; say(`怪兽踏平了 ${BOARD[target].name}`, 'bad'); break;
      case 'angelcard': {
        const g = BOARD[target].group;
        GROUP_CELLS[g].forEach(c => { const ld = s.lands[c]; if (ld.owner !== null && ld.level < MAX_LEVEL) ld.level++; });
        say(`${GROUPS[g].name}片区的地产全部升级`, 'good');
        break;
      }
      case 'devilcard': {
        const g = BOARD[target].group;
        GROUP_CELLS[g].forEach(c => { s.lands[c].level = 0; });
        say(`${GROUPS[g].name}片区的建筑全部化为乌有`, 'bad');
        break;
      }
      case 'missile': {
        say(`导弹落在「${BOARD[target].name}」`, 'bad');
        if (s.lands[target]) s.lands[target].level = 0;
        delete s.obstacles[target];
        delete s.gods[target];
        alive(s).forEach(j => { if (s.players[j].pos === target && s.players[j].stay === 0) sendTo(s, j, 'hospital', 2, '被导弹炸伤'); });
        break;
      }
      case 'frame': say(`诬告了 ${tp.name}`); sendTo(s, tj, 'jail', 2, '被人陷害'); break;
      case 'sleep':
        alive(s).filter(j => j !== i).forEach(j => { const q = s.players[j]; q.stay += 1; if (!q.stayAt) q.stayAt = 'sleep'; });
        say('其他玩家都睡着了');
        break;
      case 'dismiss': say(`送走了${GODS[p.god.key].name}`); p.god = null; break;
      case 'blame': {
        const g = p.god; p.god = null; tp.god = g;
        say(`把${GODS[g.key].name}转嫁给了 ${tp.name}`);
        break;
      }
      case 'stay':
        say('原地不动');
        land(s, i);
        settle(s);
        break;
    }
  }

  // ---------- 回合流转 ----------
  const WAIT_PHASES = ['buy', 'upgrade', 'shop', 'casino'];

  function settle(s) {
    if (s.phase === 'over') return;
    const p = s.players[s.current];
    if (!p.bankrupt && p.stay === 0 && WAIT_PHASES.includes(s.phase)) return;
    finishTurn(s);
  }

  function finishTurn(s) {
    const p = s.players[s.current];
    if (p.god && !p.bankrupt && --p.god.turns <= 0) {
      log(s, `${GODS[p.god.key].emoji} ${GODS[p.god.key].name}离开了 ${p.name}`);
      p.god = null;
    }
    nextTurn(s);
  }

  function nextTurn(s) {
    let n = s.current;
    for (let guard = 0; guard < 100; guard++) {
      const prev = n;
      do { n = (n + 1) % s.players.length; } while (s.players[n].bankrupt);
      if (n <= prev) {
        s.round++;
        if (s.maxRounds && s.round > s.maxRounds) {
          const best = alive(s).sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
          finish(s, best, `${s.maxRounds} 回合结束，按总资产排名`);
          return;
        }
        log(s, `===== 第 ${s.round} 回合 =====`);
        if (rand(s) < 0.6) spawnGod(s);
      }
      const q = s.players[n];
      if (q.stay > 0) {
        q.stay--;
        const where = q.stayAt === 'jail' ? '在监狱里' : q.stayAt === 'hospital' ? '在医院里' : '在冬眠';
        log(s, q.stay ? `${q.name} ${where}（还剩 ${q.stay} 天）` : `${q.name} ${where}，下回合恢复自由`);
        if (!q.stay) q.stayAt = null;
        continue;
      }
      break;
    }
    s.current = n;
    s.turn++;
    s.phase = 'roll';
    s.forcedDice = null;
    s.cardsUsed = 0;
    const p = s.players[n];
    log(s, `—— 轮到 ${p.name} ——`);
    if (p.god && p.god.key === 'caishen') { p.cash += 1000; log(s, `💰 财神送给 ${p.name} ${money(1000)}`); }
    if (p.god && p.god.key === 'qiong') { const l = round10(p.cash * 0.1); p.cash -= l; log(s, `💸 穷神让 ${p.name} 损失了 ${money(l)}`); }
  }

  // ---------- 行动入口 ----------
  function pendingActor(s) { return s.phase === 'over' ? null : s.current; }

  function applyAction(s, playerId, a) {
    const i = s.players.findIndex(p => p.id === playerId);
    if (i < 0) return { error: '你不在这局游戏中' };
    if (!a || typeof a.type !== 'string') return { error: '无效操作' };
    const p = s.players[i];

    if (a.type === 'setAuto') {
      p.auto = !!a.value;
      log(s, `${p.name} ${p.auto ? '开启' : '关闭'}了托管`);
      return { ok: true };
    }
    if (s.phase === 'over') return { error: '游戏已结束' };
    if (p.bankrupt) return { error: '你已经出局了' };
    if (a.type === 'resign') {
      log(s, `🏳️ ${p.name} 认输了`);
      bankrupt(s, i);
      if (s.phase !== 'over' && i === s.current) nextTurn(s);
      return { ok: true };
    }
    if (i !== s.current) return { error: '还没轮到你' };

    switch (a.type) {
      case 'useCard': {
        if (s.phase !== 'roll') return { error: '只能在掷骰子前使用道具' };
        const key = p.cards[a.index];
        if (!key) return { error: '没有这张卡' };
        const targets = cardTargets(s, i, key);
        if (!targets) return { error: '现在不能使用这张卡' };
        const tgt = CARDS[key].target;
        let target = null;
        if (tgt !== 'none') {
          target = tgt === 'player' ? String(a.target) : Number(a.target);
          if (!targets.includes(target)) return { error: '目标无效' };
        }
        p.cards.splice(a.index, 1);
        s.cardsUsed++;
        const turn = s.turn;
        useCard(s, i, key, target);
        if (s.turn === turn && s.phase === 'roll' && (p.stay > 0 || p.bankrupt)) finishTurn(s);
        return { ok: true };
      }
      case 'roll': {
        if (s.phase !== 'roll') return { error: '现在不能掷骰子' };
        let d = [randInt(s, 1, 6), randInt(s, 1, 6)];
        if (s.forcedDice) {
          const t = s.forcedDice, a1 = Math.max(1, Math.min(6, t - Math.ceil(t / 2)));
          d = [a1, t - a1];
        }
        s.dice = d;
        s.diceSeq = (s.diceSeq || 0) + 1;
        let steps = d[0] + d[1];
        if (p.turtle > 0) { p.turtle--; steps = 1; }
        log(s, `🎲 ${p.name} 掷出 ${d[0]} + ${d[1]} = ${d[0] + d[1]}${steps === 1 && d[0] + d[1] !== 1 ? '，但像乌龟一样只走 1 步 🐢' : ''}`);
        s.phase = 'moving';
        if (walk(s, i, steps)) land(s, i);
        settle(s);
        return { ok: true };
      }
      case 'buy': {
        if (s.phase !== 'buy') return { error: '现在不能买地' };
        const price = buyPrice(s, i, p.pos);
        if (p.cash < price) return { error: '现金不足' };
        p.cash -= price;
        s.lands[p.pos].owner = i;
        log(s, `🏷️ ${p.name} 花 ${money(price)} 买下 ${BOARD[p.pos].name}`);
        s.phase = 'done';
        settle(s);
        return { ok: true };
      }
      case 'upgrade': {
        if (s.phase !== 'upgrade') return { error: '现在不能升级' };
        const ld = s.lands[p.pos], levels = Math.floor(Number(a.levels) || 1);
        if (levels < 1 || ld.level + levels > MAX_LEVEL) return { error: '升级层数无效' };
        const cost = upgradeCost(p.pos) * levels;
        if (p.cash < cost) return { error: '现金不足' };
        p.cash -= cost;
        ld.level += levels;
        log(s, `🔨 ${p.name} 花 ${money(cost)} 把 ${BOARD[p.pos].name} 升级为${LEVELS[ld.level]}`);
        if (ld.level === MAX_LEVEL) fx(s, '🏙️', '摩天楼落成', `${p.name} 的 ${BOARD[p.pos].name} 盖起了摩天楼！`, 'good', i);
        s.phase = 'done';
        settle(s);
        return { ok: true };
      }
      case 'shopBuy': {
        if (s.phase !== 'shop') return { error: '你不在道具店' };
        const key = a.card;
        if (!CARDS[key]) return { error: '没有这种卡' };
        const price = cardPrice(s, i, key);
        if (p.points < price) return { error: '点券不足' };
        if (p.cards.length >= MAX_CARDS) return { error: `最多持有 ${MAX_CARDS} 张卡` };
        p.points -= price;
        p.cards.push(key);
        log(s, `🛒 ${p.name} 花 ${price} 点券买了${CARDS[key].name}`);
        return { ok: true };
      }
      case 'bet': {
        if (s.phase !== 'casino') return { error: '你不在赌场' };
        const amt = Number(a.amount);
        if (![1000, 3000, 5000].includes(amt)) return { error: '下注金额无效' };
        if (p.cash < amt) return { error: '现金不足' };
        const big = a.pick === 'big';
        const throwDice = () => [randInt(s, 1, 6), randInt(s, 1, 6), randInt(s, 1, 6)];
        const wins = d => !(d[0] === d[1] && d[1] === d[2]) && (d[0] + d[1] + d[2] >= 11) === big;
        let d = throwDice();
        let cheated = false;
        if (!wins(d) && p.char === 'laoqian') { d = throwDice(); cheated = true; }
        const sum = d[0] + d[1] + d[2];
        const desc = `${d.join('·')}=${sum}${d[0] === d[1] && d[1] === d[2] ? '（豹子，庄家通吃）' : sum >= 11 ? '（大）' : '（小）'}`;
        s.casinoDice = d;
        if (wins(d)) {
          p.cash += amt;
          log(s, `🎰 ${p.name} 押${big ? '大' : '小'} ${money(amt)}，开出 ${desc}，赢了！${cheated ? '（出千成功 🎩）' : ''}`);
          fx(s, '🎰', '赌场', `${p.name} 开出 ${desc}，赢了 ${money(amt)}！`, 'good', i);
        } else {
          p.cash -= amt;
          log(s, `🎰 ${p.name} 押${big ? '大' : '小'} ${money(amt)}，开出 ${desc}，输了`);
          fx(s, '🎰', '赌场', `${p.name} 开出 ${desc}，输掉 ${money(amt)}`, 'bad', i);
        }
        s.phase = 'done';
        settle(s);
        return { ok: true };
      }
      case 'skip': {
        if (!WAIT_PHASES.includes(s.phase)) return { error: '现在不能这样做' };
        if (s.phase === 'buy') log(s, `${p.name} 没有买 ${BOARD[p.pos].name}`);
        s.phase = 'done';
        settle(s);
        return { ok: true };
      }
    }
    return { error: '未知操作' };
  }

  return {
    BOARD, N, GROUPS, GROUP_CELLS, LANDS, LEVELS, LEVEL_EMOJI, LEVEL_MULT, MAX_LEVEL, MAX_CARDS, JAIL, HOSPITAL,
    CHARACTERS, CHAR_KEYS, GODS, CARDS, CARD_KEYS, PLAYER_COLORS,
    createGame, applyAction, pendingActor, cardTargets,
    rentFor, netWorth, ownedBy, landValue, upgradeCost, buyPrice, cardPrice, money, ringDist,
  };
});
