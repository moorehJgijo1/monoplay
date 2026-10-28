// 一局游戏的画面控制：拿到新局面后，和画面上显示的局面做比较，
// 按发生顺序播放 掷骰子 → 走棋 → 事件弹窗，播完再同步地产、楼房、神仙等静态内容。
// 也负责在 3D 场景里选格子（岔路、道具卡目标）和点格子看信息。
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Monoplay.Core;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Monoplay
{
    public class GameView : MonoBehaviour
    {
        public IGameSession S { get; private set; }
        public RulesHost Rules => S.Rules;
        BoardView B; CameraRig Cam; UiRoot Ui; DiceView dice;
        int lastSeq, lastDice, lastTurn = -1;
        bool dirty, skip;
        public bool Busy { get; private set; }
        public GameState Shown { get; private set; }

        // 选格子模式（岔路、道具卡目标）
        HashSet<int> selectable; Action<int> onSelect;
        readonly List<GameObject> forkArrows = new();

        public static GameView Create(IGameSession s, BoardView b, CameraRig cam, UiRoot ui)
        {
            var go = new GameObject("GameView");
            var v = go.AddComponent<GameView>();
            v.S = s; v.B = b; v.Cam = cam; v.Ui = ui;
            v.dice = DiceView.Create(go.transform, App.I.Font);
            return v;
        }

        public void Begin(bool fresh)
        {
            var s = S.State;
            B.ResetPieces(s);
            for (int k = 0; k < s.players.Count; k++)
            {
                B.Pieces[k].transform.position = B.PieceSpot(s, k, s.players[k].pos);
                B.Pieces[k].gameObject.SetActive(!s.players[k].bankrupt);
            }
            B.SyncStatic(s, Rules);
            lastSeq = s.seq; lastDice = s.diceSeq; lastTurn = s.turn;
            Shown = s;
            Cam.Follow = true;
            Cam.FollowTarget = B.Pieces[s.current].transform;
            if (fresh) { Cam.SwoopFromOverview(); StartCoroutine(Intro(s)); }
            UpdateTurnMarkers(s);
            Ui.Hud.Refresh(s);
            S.StateChanged += OnState;
            if (S.State != null && S.State.seq != lastSeq) dirty = true;
        }

        IEnumerator Intro(GameState s)
        {
            Busy = true;
            yield return Ui.Hud.IntroCards(s);
            Ui.Hud.TurnBanner(s.players[s.current]);
            Sfx.Play("turn");
            Busy = false;
        }

        void OnDestroy() { if (S != null) S.StateChanged -= OnState; }
        void OnState() => dirty = true;
        public void SkipAnimation() => skip = true;

        float Speed => App.I.Settings.SpeedMul;

        void Update()
        {
            if (dirty && !Busy && S.State != null)
            {
                dirty = false;
                StartCoroutine(Play(S.State));
            }
            UpdateFork();
            HandleClick();
            foreach (var t in B.Tiles) if (selectable == null || !selectable.Contains(t.Index)) t.GlowAlpha = Mathf.Max(0, t.GlowAlpha - Time.deltaTime * 0.6f);
            if (selectable != null) foreach (int c in selectable) { var t = B.Tiles[c]; t.GlowColor = new Color(1f, 0.18f, 0.33f); t.GlowAlpha = 0.35f + Mathf.Sin(Time.time * 6f) * 0.2f; }
        }

        // ---------- 播放一批变化 ----------
        IEnumerator Play(GameState s)
        {
            Busy = true;
            skip = false;
            var evs = new List<(int n, int kind, object o)>();
            if (s.diceSeq != lastDice && s.dice != null) evs.Add((s.diceN, 0, s.dice));
            if (s.moves != null) foreach (var m in s.moves) if (m.n > lastSeq) evs.Add((m.n, 1, m));
            if (s.fx != null) foreach (var f in s.fx) if (f.n > lastSeq) evs.Add((f.n, 2, f));
            evs.Sort((a, b) => a.n.CompareTo(b.n));
            bool synced = false;
            foreach (var ev in evs)
            {
                if (ev.kind == 0)
                {
                    var d = (int[])ev.o;
                    var who = B.Pieces[Mathf.Clamp(s.current, 0, B.Pieces.Count - 1)].transform.position;
                    yield return dice.Roll(d[0], d[1], who, Speed);
                    dice.Hide();
                }
                else if (ev.kind == 1)
                {
                    var m = (MoveEntry)ev.o;
                    var pc = B.Pieces[m.player];
                    Cam.FollowTarget = pc.transform;
                    var spots = new List<Vector3>();
                    for (int k = 0; k < m.path.Length; k++)
                    {
                        bool last = k == m.path.Length - 1;
                        spots.Add(last ? B.PieceSpot(s, m.player, m.path[k]) : B.L.Cell(m.path[k]) + Vector3.up * 0.3f);
                        B.Tiles[m.path[k]].GlowColor = Look.Hex(s.players[m.player].color);
                        B.Tiles[m.path[k]].GlowAlpha = 0.55f;
                    }
                    yield return pc.Hop(spots, 0.3f / Speed, m.jump);
                }
                else
                {
                    if (!synced) { B.SyncStatic(s, Rules); synced = true; }
                    var f = (FxEntry)ev.o;
                    string kind = Rules.FxKind(f);
                    Sfx.Play(f.tone == "good" ? "good" : f.tone == "bad" ? "bad" : "coin");
                    Ui.Hud.ShowFx(f, kind);
                    float wait = (C.pace.TryGetValue(kind, out var ms) ? ms : 1200) / 1000f / Speed;
                    if (kind == "toast") wait = Mathf.Max(wait, 0.9f / Speed);
                    for (float t = 0; t < wait && !skip; t += Time.deltaTime) yield return null;
                    skip = false;
                    Ui.Hud.HideFx();
                }
            }
            B.SyncStatic(s, Rules);
            for (int k = 0; k < s.players.Count; k++)
            {
                var pc = B.Pieces[k];
                pc.gameObject.SetActive(!s.players[k].bankrupt);
                if (!pc.Moving) pc.transform.position = B.PieceSpot(s, k, s.players[k].pos);
            }
            Ui.Hud.Refresh(s);
            if (s.turn != lastTurn && s.phase != "over")
            {
                Ui.Hud.TurnBanner(s.players[s.current]);
                Sfx.Play("turn");
                Cam.FollowTarget = B.Pieces[s.current].transform;
            }
            UpdateTurnMarkers(s);
            lastSeq = s.seq; lastDice = s.diceSeq; lastTurn = s.turn;
            Shown = s;
            if (s.phase == "over") Ui.Hud.ShowGameOver(s);
            Busy = false;
        }

        GameConstants C => Rules.Constants;

        void UpdateTurnMarkers(GameState s)
        {
            for (int k = 0; k < s.players.Count; k++)
            {
                var p = s.players[k];
                B.Pieces[k].SetActiveTurn(k == s.current && s.phase != "over");
                string st = p.stay > 0 ? (p.stayAt == "jail" ? $"坐牢 {p.stay}" : p.stayAt == "hospital" ? $"住院 {p.stay}" : $"冬眠 {p.stay}") : "";
                if (p.god != null && C.gods.TryGetValue(p.god.key, out var g)) st = (st.Length > 0 ? st + " · " : "") + g.name + "附身";
                if (p.turtle > 0) st = (st.Length > 0 ? st + " · " : "") + "乌龟";
                B.Pieces[k].SetStatus(st);
            }
        }

        // ---------- 岔路选方向 ----------
        bool forkShown;
        void UpdateFork()
        {
            var s = S.State;
            bool want = !Busy && s != null && s.phase == "fork" && s.fork != null && S.Controls(s.current) && !s.players[s.current].auto;
            if (want == forkShown) return;
            forkShown = want;
            foreach (var a in forkArrows) Destroy(a);
            forkArrows.Clear();
            if (!want) { if (onSelect != null && selectable != null && selectable.SetEquals(s?.fork?.options ?? new int[0])) ClearSelect(); return; }
            var from = B.L.Cell(s.players[s.current].pos);
            foreach (int o in s.fork.options)
            {
                var to = B.L.Cell(o);
                var arrow = new GameObject("ForkArrow");
                arrow.transform.position = to + Vector3.up * 1.1f;
                arrow.transform.rotation = Quaternion.LookRotation((to - from).normalized);
                var mat = Look.Glow(new Color(1f, 0.83f, 0.23f), 1.4f);
                MeshKit.Box(arrow.transform, new Vector3(0.35f, 0.18f, 0.7f), new Vector3(0, 0, -0.25f), mat);
                var head = MeshKit.Cone(arrow.transform, 0.45f, 0.6f, 0.45f, new Vector3(0, 0, 0.1f), mat, 4);
                head.transform.localRotation = Quaternion.Euler(90, 0, 0);
                arrow.transform.localScale = Vector3.one * 1.4f;
                arrow.AddComponent<Bob>().amp = 0.25f;
                forkArrows.Add(arrow);
            }
            SelectCells(s.fork.options, to => { S.Act(s.current, new Newtonsoft.Json.Linq.JObject { ["type"] = "chooseFork", ["to"] = to }); });
        }

        // ---------- 选格子 ----------
        public void SelectCells(IEnumerable<int> cells, Action<int> cb)
        {
            selectable = new HashSet<int>(cells);
            onSelect = cb;
        }
        public void ClearSelect() { selectable = null; onSelect = null; }

        void HandleClick()
        {
            bool clicked; Vector2 pos;
#if ENABLE_INPUT_SYSTEM
            var m = Mouse.current;
            if (m == null) return;
            clicked = m.leftButton.wasReleasedThisFrame;
            pos = m.position.ReadValue();
#else
            clicked = Input.GetMouseButtonUp(0);
            pos = Input.mousePosition;
#endif
            if (!clicked || UiRoot.PointerOverUi()) return;
            int cell = B.PickCell(Cam.Cam.ScreenPointToRay(pos));
            if (cell < 0) return;
            if (selectable != null)
            {
                if (!selectable.Contains(cell))
                {
                    // 岔路时点到那条路上的其它格子也算：选离它最近的方向
                    if (S.State.phase == "fork" && S.State.fork != null)
                    {
                        var p = S.State.players[S.State.current];
                        int best = -1, bd = int.MaxValue;
                        foreach (int o in S.State.fork.options)
                        {
                            var ends = Rules.Landings(S.State.current, p.pos, p.prev, S.State.fork.left, o);
                            if (ends.Contains(cell)) { best = o; break; }
                            int d = Mathf.Abs(C.board[o].x - C.board[cell].x) + Mathf.Abs(C.board[o].z - C.board[cell].z);
                            if (d < bd) { bd = d; best = o; }
                        }
                        if (best < 0) return;
                        cell = best;
                    }
                    else return;
                }
                var cb = onSelect;
                ClearSelect();
                Sfx.Play("click");
                cb?.Invoke(cell);
                return;
            }
            Ui.Hud.ShowCellInfo(cell, S.State);
        }
    }
}
