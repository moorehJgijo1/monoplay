// 大富翁联机服务器：零依赖。静态文件 + 房间 API（HTTP POST）+ 状态推送（Server-Sent Events）。
// 游戏逻辑由服务器权威执行；电脑玩家和托管玩家也在服务器上行动。
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('./public/engine.js');
const AI = require('./public/ai.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_SEATS = 6;
const BOT_NAMES = ['电脑·小强', '电脑·阿财', '电脑·旺旺', '电脑·多多', '电脑·招财', '电脑·发发'];

const rooms = new Map();

const newId = n => crypto.randomBytes(n).toString('hex');
function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join(''); } while (rooms.has(c));
  return c;
}

function makeRoom(hostName, hostChar) {
  const room = {
    id: roomCode(),
    seats: [],
    hostId: null,
    settings: { maxRounds: 30, startingCash: 20000 },
    state: null,
    clients: new Set(),
    chat: [],
    botTimer: null,
    lastActive: Date.now(),
  };
  const host = addHuman(room, hostName, hostChar);
  room.hostId = host.id;
  rooms.set(room.id, room);
  return { room, seat: host };
}

function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || '玩家';
}

function addHuman(room, name, char) {
  const seat = { id: newId(6), token: newId(16), name: cleanName(name), char: E.CHARACTERS[char] ? char : null, isBot: false, online: 0 };
  if (seat.char && room.seats.some(s => s.char === seat.char)) seat.char = null;
  room.seats.push(seat);
  return seat;
}

// 发给客户端的房间信息（不含 token）
function lobbyView(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    settings: room.settings,
    started: !!room.state,
    seats: room.seats.map(s => ({ id: s.id, name: s.name, char: s.char, isBot: s.isBot, online: s.isBot || s.online > 0 })),
  };
}
function publicState(state) {
  if (!state) return null;
  const { rng, ...rest } = state; // 去掉随机种子，防止预测骰子
  return rest;
}

function broadcast(room) {
  const base = { room: lobbyView(room), state: publicState(room.state), chat: room.chat.slice(-50) };
  for (const c of room.clients) c.res.write(`data: ${JSON.stringify({ you: c.seatId, ...base })}\n\n`);
}

// ---------- 电脑/托管玩家 ----------
function needsAutoplay(room, idx) {
  const p = room.state.players[idx];
  return p.isBot || p.auto;
}

function scheduleBots(room) {
  clearTimeout(room.botTimer);
  const s = room.state;
  if (!s || s.phase === 'over') return;
  const idx = E.pendingActor(s);
  if (idx === null || !needsAutoplay(room, idx)) return;
  // 给客户端留出播放走路动画的时间
  const lastMove = s.moves[s.moves.length - 1];
  const fresh = lastMove && lastMove.n > (room.lastAnimatedSeq || 0);
  const delay = 700 + (fresh ? Math.min(lastMove.path.length, 12) * 180 : 0);
  if (lastMove) room.lastAnimatedSeq = lastMove.n;
  room.botTimer = setTimeout(() => {
    if (!room.state || room.state !== s) return;
    const cur = E.pendingActor(s);
    if (cur === null || !needsAutoplay(room, cur)) return;
    const p = s.players[cur];
    const action = AI.decide(s, p.id);
    if (!action) return;
    const r = E.applyAction(s, p.id, action);
    if (r.error) E.applyAction(s, p.id, { type: s.phase === 'roll' ? 'roll' : 'skip' });
    broadcast(room);
    scheduleBots(room);
  }, delay);
}

// 断线超过 30 秒自动托管，重连后解除
function onDisconnect(room, seat) {
  setTimeout(() => {
    if (!room.state || seat.online > 0 || seat.isBot) return;
    const p = room.state.players.find(x => x.id === seat.id);
    if (p && !p.auto && !p.bankrupt) {
      E.applyAction(room.state, seat.id, { type: 'setAuto', value: true });
      p.autoByDisconnect = true;
      broadcast(room);
      scheduleBots(room);
    }
  }, 30000);
}
function onReconnect(room, seat) {
  if (!room.state) return;
  const p = room.state.players.find(x => x.id === seat.id);
  if (p && p.autoByDisconnect) {
    p.autoByDisconnect = false;
    E.applyAction(room.state, seat.id, { type: 'setAuto', value: false });
  }
}

// ---------- HTTP ----------
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e5) { reject(new Error('请求太大')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON 格式错误')); }
    });
    req.on('error', reject);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

function seatByToken(room, token) {
  return room.seats.find(s => !s.isBot && s.token === token);
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'rooms', id, action]
  if (parts[1] !== 'rooms') return sendJSON(res, 404, { error: '未知接口' });

  if (req.method === 'POST' && parts.length === 2) {
    const body = await readBody(req);
    const { room, seat } = makeRoom(body.name, body.char);
    broadcast(room);
    return sendJSON(res, 200, { roomId: room.id, token: seat.token, playerId: seat.id });
  }

  const room = rooms.get(String(parts[2] || '').toUpperCase());
  if (!room) return sendJSON(res, 404, { error: '房间不存在或已解散' });
  room.lastActive = Date.now();
  const action = parts[3];

  if (req.method === 'GET' && action === 'status') {
    const seat = seatByToken(room, url.searchParams.get('token'));
    return seat ? sendJSON(res, 200, { ok: true }) : sendJSON(res, 403, { error: '身份无效' });
  }

  if (req.method === 'GET' && action === 'stream') {
    const seat = seatByToken(room, url.searchParams.get('token'));
    if (!seat) return sendJSON(res, 403, { error: '身份无效，请重新加入' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    const client = { res, seatId: seat.id };
    room.clients.add(client);
    seat.online++;
    onReconnect(room, seat);
    broadcast(room);
    scheduleBots(room);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      room.clients.delete(client);
      seat.online--;
      room.lastActive = Date.now();
      if (seat.online === 0) onDisconnect(room, seat);
      broadcast(room);
    });
    return;
  }

  if (req.method !== 'POST') return sendJSON(res, 405, { error: '方法不支持' });
  const body = await readBody(req);

  if (action === 'join') {
    if (room.state) return sendJSON(res, 400, { error: '游戏已经开始，无法加入' });
    if (room.seats.length >= MAX_SEATS) return sendJSON(res, 400, { error: '房间已满' });
    const seat = addHuman(room, body.name, body.char);
    broadcast(room);
    return sendJSON(res, 200, { roomId: room.id, token: seat.token, playerId: seat.id });
  }

  const seat = seatByToken(room, body.token);
  if (!seat) return sendJSON(res, 403, { error: '身份无效，请重新加入' });
  const isHost = seat.id === room.hostId;

  switch (action) {
    case 'chat': {
      const text = String(body.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
      if (!text) return sendJSON(res, 400, { error: '消息为空' });
      room.chat.push({ n: Date.now(), from: seat.name, text });
      if (room.chat.length > 100) room.chat.shift();
      broadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    case 'char': {
      if (room.state) return sendJSON(res, 400, { error: '游戏已开始' });
      const target = body.seatId && isHost ? room.seats.find(s => s.id === body.seatId && s.isBot) : seat;
      if (!target) return sendJSON(res, 400, { error: '无效座位' });
      if (body.char && !E.CHARACTERS[body.char]) return sendJSON(res, 400, { error: '无效角色' });
      if (body.char && room.seats.some(s => s !== target && s.char === body.char)) return sendJSON(res, 400, { error: '这个角色已经被选了' });
      target.char = body.char || null;
      broadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    case 'addBot': {
      if (!isHost) return sendJSON(res, 403, { error: '只有房主可以添加电脑' });
      if (room.state) return sendJSON(res, 400, { error: '游戏已开始' });
      if (room.seats.length >= MAX_SEATS) return sendJSON(res, 400, { error: '房间已满' });
      const name = BOT_NAMES.find(n => !room.seats.some(s => s.name === n)) || '电脑';
      room.seats.push({ id: newId(6), name, char: null, isBot: true, online: 1 });
      broadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    case 'kick': {
      if (!isHost) return sendJSON(res, 403, { error: '只有房主可以移除玩家' });
      if (room.state) return sendJSON(res, 400, { error: '游戏已开始' });
      if (body.seatId === seat.id) return sendJSON(res, 400, { error: '不能移除自己' });
      const k = room.seats.findIndex(s => s.id === body.seatId);
      if (k < 0) return sendJSON(res, 400, { error: '无效座位' });
      const [gone] = room.seats.splice(k, 1);
      for (const c of room.clients) if (c.seatId === gone.id) { c.res.write(`event: kicked\ndata: {}\n\n`); c.res.end(); }
      broadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    case 'settings': {
      if (!isHost) return sendJSON(res, 403, { error: '只有房主可以修改设置' });
      if (room.state) return sendJSON(res, 400, { error: '游戏已开始' });
      const mr = Number(body.maxRounds), sc = Number(body.startingCash);
      if ([0, 20, 30, 50].includes(mr)) room.settings.maxRounds = mr;
      if ([10000, 20000, 30000, 50000].includes(sc)) room.settings.startingCash = sc;
      broadcast(room);
      return sendJSON(res, 200, { ok: true });
    }
    case 'start': {
      if (!isHost) return sendJSON(res, 403, { error: '只有房主可以开始游戏' });
      if (room.state && room.state.phase !== 'over') return sendJSON(res, 400, { error: '游戏已开始' });
      if (room.seats.length < 2) return sendJSON(res, 400, { error: '至少需要 2 名玩家' });
      room.state = E.createGame(room.seats.map(s => ({ id: s.id, name: s.name, char: s.char, isBot: s.isBot })), room.settings);
      room.lastAnimatedSeq = 0;
      broadcast(room);
      scheduleBots(room);
      return sendJSON(res, 200, { ok: true });
    }
    case 'action': {
      if (!room.state) return sendJSON(res, 400, { error: '游戏还没开始' });
      const r = E.applyAction(room.state, seat.id, body.action);
      if (r.error) return sendJSON(res, 400, r);
      if (body.action && body.action.type === 'setAuto') {
        const p = room.state.players.find(x => x.id === seat.id);
        if (p) p.autoByDisconnect = false;
      }
      broadcast(room);
      scheduleBots(room);
      return sendJSON(res, 200, { ok: true });
    }
  }
  return sendJSON(res, 404, { error: '未知操作' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else if (req.method === 'GET') serveStatic(req, res, decodeURIComponent(url.pathname));
    else { res.writeHead(405); res.end(); }
  } catch (e) {
    if (!res.headersSent) sendJSON(res, 400, { error: e.message || '请求错误' });
  }
});

// 清理长时间无人的房间
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.clients.size === 0 && now - room.lastActive > 30 * 60 * 1000) {
      clearTimeout(room.botTimer);
      rooms.delete(id);
    }
  }
}, 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`大富翁服务器已启动：http://localhost:${PORT}`);
    console.log('同一局域网内的朋友可以用你的 IP 地址访问，例如 http://192.168.1.x:' + PORT);
  });
}

module.exports = { server, rooms };
