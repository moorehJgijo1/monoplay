// 电脑玩家：每次调用返回一个行动（或 null 表示无需行动），由调用方按节奏逐步执行。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.MonopolyAI = factory(root.MonopolyEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const { BOARD, GROUP_CELLS, LANDS } = E;

  // 由局面决定的伪随机数，让同一局面下电脑的选择可复现
  function rnd(s, salt) {
    let h = Math.imul(s.seq + 1, 2654435761) ^ Math.imul(s.turn + salt, 40503);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  }

  const others = (s, i) => s.players.map((_, j) => j).filter(j => j !== i && !s.players[j].bankrupt);

  // 需要预留的现金：对手地产最高过路费的一部分
  function reserve(s, i) {
    let max = 0;
    LANDS.forEach(c => {
      const o = s.lands[c].owner;
      if (o !== null && o !== i) max = Math.max(max, E.rentFor(s, c));
    });
    return Math.max(1000, Math.min(8000, max * 0.5));
  }

  // 走到 cell 的“好坏”估计（正数为好）
  function cellScore(s, i, cell) {
    const p = s.players[i], c = BOARD[cell];
    if (s.obstacles[cell] === 'mine' && p.char !== 'ninja') return -3000;
    if (s.gods[cell]) return E.GODS[s.gods[cell]].good ? 1500 : -1500;
    switch (c.type) {
      case 'land': {
        const ld = s.lands[cell];
        if (ld.owner === null) return p.cash >= E.buyPrice(s, i, cell) ? 600 : 0;
        if (ld.owner === i) return ld.level < E.MAX_LEVEL && p.cash >= E.upgradeCost(cell) ? 800 : 100;
        return s.players[ld.owner].stay > 0 ? 0 : -E.rentFor(s, cell);
      }
      case 'police': return -1200;
      case 'tax': return -p.cash * 0.1;
      case 'shop': return p.points >= 40 ? 400 : 0;
      case 'points': case 'wheel': case 'destiny': return 300;
      case 'chance': return 200;
      default: return 0;
    }
  }

  // 从 pos（上一步在 prev）出发恰好走 steps 步能到的所有格子；岔路口电脑可以自己选
  function endpoints(pos, prev, steps, out = new Set()) {
    if (steps === 0) { out.add(pos); return out; }
    let f = E.ADJ[pos].filter(n => n !== prev);
    if (!f.length) f = E.ADJ[pos];
    f.forEach(n => endpoints(n, pos, steps - 1, out));
    return out;
  }
  const bestLanding = (s, i, pos, prev, steps) => Math.max(...[...endpoints(pos, prev, steps)].map(c => cellScore(s, i, c)));
  // 掷两颗骰子时，按概率加权的落点好坏
  function expectedRoll(s, i, pos, prev) {
    let v = 0;
    for (let t = 2; t <= 12; t++) v += bestLanding(s, i, pos, prev, t) * (6 - Math.abs(t - 7)) / 36;
    return v;
  }

  function leader(s, i) {
    return others(s, i).sort((a, b) => E.netWorth(s, b) - E.netWorth(s, a))[0];
  }

  function chooseCard(s, i) {
    const p = s.players[i];
    if (s.cardsUsed >= 2) return null;
    const lead = leader(s, i);
    if (lead === undefined) return null;
    const leadId = s.players[lead].id;
    const myWorth = E.netWorth(s, i), leadWorth = E.netWorth(s, lead);
    const behind = leadWorth > myWorth;
    const opts = [];
    p.cards.forEach((key, index) => {
      const targets = E.cardTargets(s, i, key);
      if (!targets) return;
      const add = (score, target) => opts.push({ score, action: { type: 'useCard', index, target } });
      switch (key) {
        case 'dismiss': if (!E.GODS[p.god.key].good) add(90); break;
        case 'blame': if (!E.GODS[p.god.key].good) add(95, leadId); break;
        case 'buyland': if (p.cash - E.landValue(s, p.pos) > reserve(s, i)) add(85); break;
        case 'monster': case 'demolish': {
          const best = targets.filter(c => s.lands[c].owner !== i && s.lands[c].owner !== null)
            .sort((a, b) => E.rentFor(s, b) - E.rentFor(s, a))[0];
          if (best !== undefined && s.lands[best].level >= (key === 'monster' ? 3 : 2)) add(70, best);
          break;
        }
        case 'devilcard': {
          let best = null, bestV = 0;
          targets.forEach(c => {
            let v = 0;
            GROUP_CELLS[BOARD[c].group].forEach(x => { const ld = s.lands[x]; if (ld.owner !== null) v += (ld.owner === i ? -1 : 1) * ld.level; });
            if (v > bestV) { bestV = v; best = c; }
          });
          if (bestV >= 4) add(75, best);
          break;
        }
        case 'angelcard': {
          let best = null, bestV = 0;
          targets.forEach(c => {
            let v = 0;
            GROUP_CELLS[BOARD[c].group].forEach(x => { const ld = s.lands[x]; if (ld.owner !== null && ld.level < E.MAX_LEVEL) v += ld.owner === i ? 1 : -1; });
            if (v > bestV) { bestV = v; best = c; }
          });
          if (best !== null) add(65, best);
          break;
        }
        case 'average': {
          const al = [i, ...others(s, i)];
          const avg = al.reduce((a, j) => a + s.players[j].cash, 0) / al.length;
          if (p.cash < avg * 0.6) add(80);
          break;
        }
        case 'tax': if (s.players[lead].cash > 8000) add(behind ? 55 : 35, leadId); break;
        case 'frame': if (behind) add(50, leadId); break;
        case 'sleep': if (behind && rnd(s, 1) < 0.4) add(45); break;
        case 'turtle': if (behind && rnd(s, 2) < 0.5) add(40, leadId); break;
        case 'rob': if (s.players[lead].cards.length && p.cards.length < E.MAX_CARDS) add(40, targets.includes(leadId) ? leadId : targets[0]); break;
        case 'robot': {
          if (Object.keys(s.obstacles).some(c => E.dist(p.pos, Number(c)) <= 10)) add(60);
          break;
        }
        case 'mine': case 'roadblock': {
          // 放在领先对手前方、且自己暂时不会经过的地方
          const lp = s.players[lead];
          const cand = targets.filter(c => {
            const d = E.dist(lp.pos, c);
            return d >= 2 && d <= 9 && E.dist(p.pos, c) > 2;
          }).filter(c => !(key === 'roadblock' && BOARD[c].type === 'land' && s.lands[c].owner !== i));
          const best = key === 'roadblock'
            ? cand.find(c => BOARD[c].type === 'land' && s.lands[c].owner === i && s.lands[c].level > 0) ?? cand.find(c => BOARD[c].type === 'police')
            : cand[Math.floor(rnd(s, 3) * cand.length)];
          if (best !== undefined && lp.char !== 'ninja' && rnd(s, 4) < 0.6) add(key === 'mine' ? 45 : 35, best);
          break;
        }
        case 'remote': {
          if (s.forcedDice) break;
          let best = null, bestScore = -Infinity, avg = 0;
          for (let t = 2; t <= 12; t++) {
            const sc = bestLanding(s, i, p.pos, p.prev, t);
            avg += sc * (6 - Math.abs(t - 7)) / 36;
            if (sc > bestScore) { bestScore = sc; best = t; }
          }
          if (bestScore - avg > 900) add(60, best);
          break;
        }
        case 'turn': {
          // 掉头后的预期落点明显更好，就给自己用
          if (p.prev === null) break;
          const back = E.ADJ[p.pos].find(n => n !== p.prev);
          if (back !== undefined && expectedRoll(s, i, p.pos, back) - expectedRoll(s, i, p.pos, p.prev) > 1200) add(50, p.id);
          break;
        }
        case 'stay': if (cellScore(s, i, p.pos) >= 800 && BOARD[p.pos].type === 'land') add(30); break;
        case 'missile': {
          const tgt = targets.find(c => BOARD[c].type === 'land' && s.lands[c].owner !== null && s.lands[c].owner !== i && s.lands[c].level >= 4);
          if (tgt !== undefined) add(70, tgt);
          break;
        }
      }
    });
    opts.sort((a, b) => b.score - a.score);
    return opts.length ? opts[0].action : null;
  }

  function completesGroup(s, i, cell) {
    return GROUP_CELLS[BOARD[cell].group].every(c => c === cell || s.lands[c].owner === i);
  }

  const SHOP_PREF = ['remote', 'free', 'monster', 'tax', 'mine', 'angelcard', 'buyland', 'robot', 'average', 'frame', 'turtle', 'dismiss', 'roadblock', 'missile'];

  function decide(s, playerId) {
    const i = s.players.findIndex(p => p.id === playerId);
    if (i < 0 || s.phase === 'over' || s.current !== i) return null;
    const p = s.players[i];
    const res = reserve(s, i);
    switch (s.phase) {
      case 'roll':
        return chooseCard(s, i) || { type: 'roll' };
      case 'fork': {
        const { options, left } = s.fork;
        let best = options[0], bestV = -Infinity;
        options.forEach(o => {
          const v = bestLanding(s, i, o, p.pos, left - 1);
          if (v > bestV) { bestV = v; best = o; }
        });
        return { type: 'chooseFork', to: best };
      }
      case 'buy': {
        const price = E.buyPrice(s, i, p.pos);
        const ok = p.cash - price >= res * 0.6 || (completesGroup(s, i, p.pos) && p.cash - price >= 500);
        return { type: ok ? 'buy' : 'skip' };
      }
      case 'upgrade':
      {
        const lv = s.lands[p.pos].level, cost = E.upgradeCost(p.pos);
        const levels = Math.min(E.MAX_LEVEL - lv, Math.floor((p.cash - res * 0.5) / cost));
        return levels > 0 ? { type: 'upgrade', levels } : { type: 'skip' };
      }
      case 'shop': {
        if (p.cards.length >= 6) return { type: 'skip' };
        const buy = SHOP_PREF.find(k => E.cardPrice(s, i, k) <= p.points && p.cards.filter(c => c === k).length < 2);
        return buy ? { type: 'shopBuy', card: buy } : { type: 'skip' };
      }
      case 'casino': {
        if (p.cash > 20000 && rnd(s, 5) < 0.6) return { type: 'bet', amount: p.cash > 40000 ? 5000 : 3000, pick: rnd(s, 6) < 0.5 ? 'big' : 'small' };
        if (p.cash > 8000 && rnd(s, 7) < 0.4) return { type: 'bet', amount: 1000, pick: rnd(s, 8) < 0.5 ? 'big' : 'small' };
        return { type: 'skip' };
      }
    }
    return null;
  }

  return { decide };
});
