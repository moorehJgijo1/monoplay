// 用电脑玩家自动对局大量模拟，检查引擎不会卡死或出现非法状态。
const test = require('node:test');
const assert = require('node:assert');
const E = require('../public/engine.js');
const AI = require('../public/ai.js');

function play(seed, n, maxRounds) {
  const players = Array.from({ length: n }, (_, k) => ({ id: 'p' + k, name: '玩家' + k, isBot: true }));
  const s = E.createGame(players, { seed, maxRounds });
  let steps = 0;
  while (s.phase !== 'over') {
    assert.ok(++steps < 20000, 'game should terminate');
    const actor = s.players[E.pendingActor(s)];
    assert.ok(!actor.bankrupt, 'actor must not be bankrupt');
    const a = AI.decide(s, actor.id);
    assert.ok(a, `AI returned no action in phase ${s.phase}`);
    const r = E.applyAction(s, actor.id, a);
    assert.ok(r.ok, `action ${JSON.stringify(a)} failed: ${r.error}`);
    s.players.forEach(p => {
      assert.ok(Number.isFinite(p.cash) && p.cash >= 0, `bad cash ${p.cash}`);
      assert.ok(p.pos >= 0 && p.pos < E.N);
      assert.ok(p.cards.length <= E.MAX_CARDS + 1);
    });
    E.LANDS.forEach(c => {
      const ld = s.lands[c];
      assert.ok(ld.level >= 0 && ld.level <= E.MAX_LEVEL);
      if (ld.owner !== null) assert.ok(!s.players[ld.owner].bankrupt, 'bankrupt players own nothing');
    });
    JSON.stringify(s);
  }
  assert.ok(s.winner !== null);
  return s;
}

test('AI-only games run to completion', () => {
  for (let seed = 1; seed <= 150; seed++) play(seed, 2 + (seed % 3), seed % 3 ? 30 : 0);
});

test('same seed gives same game', () => {
  const a = play(42, 4, 20), b = play(42, 4, 20);
  assert.deepStrictEqual(a.log, b.log);
});

test('rejects acting out of turn', () => {
  const s = E.createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { seed: 1, shuffleOrder: false });
  assert.ok(E.applyAction(s, 'b', { type: 'roll' }).error);
  assert.ok(E.applyAction(s, 'a', { type: 'roll' }).ok);
});

test('remote dice sets the roll', () => {
  const s = E.createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { seed: 3, shuffleOrder: false });
  s.players[0].cards = ['remote'];
  assert.ok(E.applyAction(s, 'a', { type: 'useCard', index: 0, target: 9 }).ok);
  E.applyAction(s, 'a', { type: 'roll' });
  assert.strictEqual(s.dice[0] + s.dice[1], 9);
});

test('walking into an intersection asks which way to go', () => {
  const s = E.createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { seed: 9, shuffleOrder: false });
  // 起点向右第 6 格是岔路口（顶部大街与南北大街交汇）
  s.players[0].cards = ['remote'];
  E.applyAction(s, 'a', { type: 'useCard', index: 0, target: 9 });
  E.applyAction(s, 'a', { type: 'roll' });
  assert.strictEqual(s.phase, 'fork');
  assert.strictEqual(s.fork.left, 3);
  assert.strictEqual(s.fork.options.length, 2);
  const down = s.fork.options.find(c => E.BOARD[c].z > 0);
  assert.ok(E.applyAction(s, 'a', { type: 'chooseFork', to: 12345 }).error);
  assert.ok(E.applyAction(s, 'a', { type: 'chooseFork', to: down }).ok);
  assert.strictEqual(s.players[0].pos === down || E.BOARD[s.players[0].pos].x === 6, true);
});

test('every cell is reachable and the map has intersections', () => {
  E.BOARD.forEach((_, c) => assert.ok(Number.isFinite(E.dist(E.START, c))));
  assert.strictEqual(E.ADJ.filter(a => a.length > 2).length, 5);
});
