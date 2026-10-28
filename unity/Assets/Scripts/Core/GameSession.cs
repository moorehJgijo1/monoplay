// 一局游戏的“会话”：界面只和它打交道，不关心是单机还是联机。
// LocalSession：本地用 RulesHost 跑规则，电脑玩家和托管玩家等画面动画播完再行动。
// 联机会话（OnlineSession）在 Scripts/Net 里，实现同一个接口。
using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Monoplay.Core
{
    public interface IGameSession
    {
        RulesHost Rules { get; }
        GameState State { get; }
        // 本客户端可以替谁操作（单机同屏时是所有真人玩家，联机时只有自己）
        bool Controls(int playerIndex);
        // 联机时“我”是谁（单机返回 -1）
        int Me { get; }
        bool IsOnline { get; }
        event Action StateChanged;
        event Action<string> Error;
        void Act(int playerIndex, JObject action);
        // 每帧调用。viewBusy：画面还在播动画（走棋、骰子、事件弹窗）时电脑先等着
        void Tick(double nowMs, bool viewBusy);
    }

    public sealed class LocalSession : IGameSession
    {
        public RulesHost Rules { get; }
        public GameState State { get; private set; }
        public int Me => -1;
        public bool IsOnline => false;
        public event Action StateChanged;
        public event Action<string> Error;
        // 画面空闲后电脑再“想一想”的时间
        public double ThinkMs = 900;

        double idleSince = -1;

        public LocalSession(RulesHost rules) { Rules = rules; }

        public sealed class Seat { public string id, name, @char; public bool isBot; }

        public void Start(IList<Seat> seats, int maxRounds, int startingCash, int? seed = null)
        {
            var opts = new Dictionary<string, object> { ["maxRounds"] = maxRounds, ["startingCash"] = startingCash };
            if (seed.HasValue) opts["seed"] = seed.Value;
            Rules.NewGame(seats, opts);
            Refresh();
        }
        public void Resume(string stateJson) { Rules.LoadState(stateJson); Refresh(); }
        public string Save() => Rules.StateJson();

        public bool Controls(int i) => State != null && i >= 0 && i < State.players.Count && !State.players[i].isBot;

        public void Act(int i, JObject action)
        {
            var err = Rules.Apply(State.players[i].id, action);
            if (err != null) { Error?.Invoke(err); return; }
            Refresh();
        }

        public void Tick(double nowMs, bool viewBusy)
        {
            if (State == null || State.phase == "over") return;
            if (viewBusy) { idleSince = -1; return; }
            if (idleSince < 0) idleSince = nowMs;
            if (nowMs - idleSince < ThinkMs) return;
            StepBot();
        }

        // 如果轮到电脑或托管玩家，让它走一步；返回是否走了
        public bool StepBot()
        {
            int i = Rules.PendingActor();
            if (i < 0) return false;
            var p = State.players[i];
            if (!p.isBot && !p.auto) return false;
            var a = Rules.BotDecide(p.id);
            if (a == null) return false;
            if (Rules.Apply(p.id, a) != null) Rules.Apply(p.id, new JObject { ["type"] = State.phase == "roll" ? "roll" : "skip" });
            idleSince = -1;
            Refresh();
            return true;
        }

        void Refresh()
        {
            State = Rules.State();
            StateChanged?.Invoke();
        }
    }
}
