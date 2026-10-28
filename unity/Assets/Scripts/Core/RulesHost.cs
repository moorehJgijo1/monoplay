// 规则宿主：用 Jint（C# 里的 JavaScript 解释器）运行仓库里的 engine.js 和 ai.js。
// 单机时局面保存在这里；联机时服务器下发的局面也会塞进来，只用来做查询（过路费、落点预览等）。
// 这样单机、联机、Node 服务器都跑同一份规则代码，不会出现两边规则不一致。
// 这个文件不依赖 UnityEngine，可以在 CoreTests~ 里用 dotnet 直接测试。
using System;
using Jint;
using Jint.Native;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Monoplay.Core
{
    public sealed class RulesHost
    {
        readonly Engine js;

        // 在 JS 里跑的一层薄胶水：局面放在 __s 里，进出都用 JSON 字符串
        const string Glue = @"
var __E = MonopolyEngine, __AI = MonopolyAI, __s = null;
function __new(players, opts) { __s = __E.createGame(JSON.parse(players), JSON.parse(opts)); }
function __load(json) { __s = JSON.parse(json); }
function __state() { return JSON.stringify(__s); }
function __apply(id, action) { return JSON.stringify(__E.applyAction(__s, id, JSON.parse(action))); }
function __pending() { var i = __E.pendingActor(__s); return i === null ? -1 : i; }
function __decide(id) { var a = __AI.decide(__s, id); return a ? JSON.stringify(a) : null; }
function __mark() { return JSON.stringify(__E.paceMark(__s)); }
function __paceMs(mark) { return __E.paceMs(__s, JSON.parse(mark)); }
function __call(name, args) { var r = __E[name].apply(null, [__s].concat(JSON.parse(args))); return JSON.stringify(r === undefined ? null : r); }
function __consts() {
  return JSON.stringify({
    board: __E.BOARD, adj: __E.ADJ, mapW: __E.MAP_W, mapH: __E.MAP_H, start: __E.START, jail: __E.JAIL, hospital: __E.HOSPITAL,
    groups: __E.GROUPS, characters: __E.CHARACTERS, charKeys: __E.CHAR_KEYS, gods: __E.GODS, cards: __E.CARDS, cardKeys: __E.CARD_KEYS,
    cardCats: __E.CARD_CATS, stocks: __E.STOCKS, stockKeys: __E.STOCK_KEYS, levels: __E.LEVELS, levelMult: __E.LEVEL_MULT,
    maxLevel: __E.MAX_LEVEL, maxCards: __E.MAX_CARDS, lot: __E.LOT, stockFee: __E.STOCK_FEE, playerColors: __E.PLAYER_COLORS,
    pace: __E.PACE, wheelFaces: __E.WHEEL_FACES, lands: __E.LANDS
  });
}
function __fxKind(f) { return __E.fxKind(JSON.parse(f)); }
function __upgradeCost(cell) { return __E.upgradeCost(cell); }
";

        public RulesHost(string engineSource, string aiSource)
        {
            js = new Engine(o => o.LimitRecursion(512).TimeoutInterval(TimeSpan.FromSeconds(5)));
            js.Execute(engineSource, "engine.js");
            js.Execute(aiSource, "ai.js");
            js.Execute(Glue, "glue.js");
            Constants = JsonConvert.DeserializeObject<GameConstants>(Str(Call("__consts")));
        }

        public GameConstants Constants { get; }

        JsValue Call(string fn, params object[] args)
        {
            var jsArgs = new JsValue[args.Length];
            for (int k = 0; k < args.Length; k++) jsArgs[k] = JsValue.FromObject(js, args[k]);
            return js.Invoke(fn, jsArgs);
        }
        static string Str(JsValue v) => v.IsNull() || v.IsUndefined() ? null : v.AsString();

        // ---------- 局面 ----------
        public void NewGame(object players, object opts) => Call("__new", JsonConvert.SerializeObject(players), JsonConvert.SerializeObject(opts));
        public void LoadState(string json) => Call("__load", json);
        public string StateJson() => Str(Call("__state"));
        public GameState State() => JsonConvert.DeserializeObject<GameState>(StateJson());

        // ---------- 行动 ----------
        // 返回 null 表示成功，否则是错误信息
        public string Apply(string playerId, object action)
        {
            var r = JObject.Parse(Str(Call("__apply", playerId, JsonConvert.SerializeObject(action))));
            return r["error"]?.ToString();
        }
        public int PendingActor() => (int)Call("__pending").AsNumber();
        public JObject BotDecide(string playerId)
        {
            var s = Str(Call("__decide", playerId));
            return s == null ? null : JObject.Parse(s);
        }

        // ---------- 动画节奏（和服务器安排电脑行动用的是同一套） ----------
        public string PaceMark() => Str(Call("__mark"));
        public double PaceMs(string mark) => Call("__paceMs", mark).AsNumber();
        public string FxKind(FxEntry f) => Str(Call("__fxKind", JsonConvert.SerializeObject(f)));

        // ---------- 规则查询：调用 engine.js 导出的、第一个参数是局面的函数 ----------
        public T Query<T>(string fn, params object[] args) => JsonConvert.DeserializeObject<T>(Str(Call("__call", fn, JsonConvert.SerializeObject(args))));
        public int RentFor(int cell) => Query<int>("rentFor", cell);
        public int BuyPrice(int player, int cell) => Query<int>("buyPrice", player, cell);
        public int UpgradeCost(int cell) => (int)Call("__upgradeCost", cell).AsNumber();
        public int CardPrice(int player, string card) => Query<int>("cardPrice", player, card);
        public int NetWorth(int player) => Query<int>("netWorth", player);
        public JToken CardTargets(int player, string card) => Query<JToken>("cardTargets", player, card);
        public int[] Landings(int player, int pos, int? prev, int steps, int? first) =>
            first.HasValue ? Query<int[]>("landings", player, pos, prev, steps, first.Value) : Query<int[]>("landings", player, pos, prev, steps);
    }
}
