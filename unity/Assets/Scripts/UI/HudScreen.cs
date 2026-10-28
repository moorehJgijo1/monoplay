// 游戏中的界面（参考《大富翁 11》）：左上当前玩家、右边玩家列表、左下记录、
// 底部是掷骰子大按钮和道具卡栏；买地、盖楼、选路、进店等决定在底部弹出对话框；事件在屏幕中间弹出。
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Monoplay.Core;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Monoplay
{
    public class HudScreen : MonoBehaviour
    {
        UiRoot ui;
        IGameSession S;
        GameView V;
        GameConstants C => App.I.C;
        RulesHost R => S.Rules;

        // 常驻部件
        Image curPanel, curStripe;
        TextMeshProUGUI curName, curCash, roundLabel, logText, waitPill;
        RectTransform playerList, cardBar, actionRow;
        Button rollBtn, stockBtn, viewBtn, speedBtn, autoBtn;
        // 弹出部件
        Image decision, fxPanel, banner, cellInfo, stockPanel, menuPanel, overPanel;
        TextMeshProUGUI decTitle, decBody, fxTitle, fxText, bannerText, cellText;
        RectTransform decButtons, decExtra, stockRows;
        string decisionKey = "", actKey = "";
        // 让操作区和对话框下一帧重新生成（操作失败、点了“算了”之后）
        void Invalidate() { decisionKey = ""; actKey = ""; }
        // 刚发出操作、局面还没更新（联机要等服务器回音）时先把按钮藏起来，免得连点两次
        int actedSeq = -1; float actedAt;
        float bannerUntil;

        public static HudScreen Create(UiRoot ui)
        {
            var rt = UiKit.Rect(ui.Root, "Hud");
            UiKit.Fill(rt);
            var h = rt.gameObject.AddComponent<HudScreen>();
            h.ui = ui;
            h.Build(rt);
            rt.gameObject.SetActive(false);
            return h;
        }

        // ---------- 搭界面 ----------
        void Build(RectTransform rt)
        {
            // 左上：当前回合
            curPanel = UiKit.Panel(rt, UiKit.Glass, "Current");
            UiKit.Place(curPanel.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(24, -24), new Vector2(470, 130));
            curStripe = UiKit.Panel(curPanel.transform, UiKit.Red, "Stripe", false);
            UiKit.Place(curStripe.rectTransform, new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(14, 0), new Vector2(14, 100));
            curName = UiKit.Label(curPanel.transform, "", 34, UiKit.Ink);
            curName.fontStyle = FontStyles.Bold;
            UiKit.Place(curName.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(44, -16), new Vector2(410, 50));
            curCash = UiKit.Label(curPanel.transform, "", 30, UiKit.Hex("#d9480f"));
            UiKit.Place(curCash.rectTransform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(44, 16), new Vector2(410, 48));

            roundLabel = UiKit.Label(rt, "", 30, Color.white, TextAlignmentOptions.Center, "Round");
            roundLabel.outlineWidth = 0.25f; roundLabel.outlineColor = new Color32(0, 0, 0, 160);
            UiKit.Place(roundLabel.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -24), new Vector2(500, 50));

            // 右上：按钮
            var tr = UiKit.Rect(rt, "TopRight");
            UiKit.Place(tr, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-24, -24), new Vector2(560, 60));
            UiKit.HStack(tr, 10);
            viewBtn = UiKit.Button(tr, "全景", UiKit.Glass, ToggleView, 24, UiKit.Ink); UiKit.Size(viewBtn, 120, 56);
            speedBtn = UiKit.Button(tr, "", UiKit.Glass, CycleSpeed, 24, UiKit.Ink); UiKit.Size(speedBtn, 120, 56);
            autoBtn = UiKit.Button(tr, "托管", UiKit.Glass, ToggleAuto, 24, UiKit.Ink); UiKit.Size(autoBtn, 120, 56);
            UiKit.Size(UiKit.Button(tr, "菜单", UiKit.Glass, () => menuPanel.gameObject.SetActive(true), 24, UiKit.Ink), 120, 56);

            // 右：玩家列表
            playerList = UiKit.Rect(rt, "Players");
            UiKit.Place(playerList, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-24, -100), new Vector2(400, 600));
            UiKit.VStack(playerList, 12);

            // 左下：记录
            var log = UiKit.Panel(rt, UiKit.DarkGlass, "Log", false);
            UiKit.Place(log.rectTransform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(24, 24), new Vector2(560, 300));
            logText = UiKit.Label(log.transform, "", 21, Color.white, TextAlignmentOptions.BottomLeft);
            UiKit.Fill(logText.rectTransform, 18, 18, 14, 14);
            logText.overflowMode = TextOverflowModes.Truncate;

            // 底部：行动区
            actionRow = UiKit.Rect(rt, "Actions");
            UiKit.Place(actionRow, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(60, 30), new Vector2(900, 180));
            rollBtn = UiKit.Button(actionRow, "掷骰子", UiKit.Gold, Roll, 40, UiKit.Ink);
            ((RectTransform)rollBtn.transform).GetComponent<Image>().sprite = UiKit.Circle;
            UiKit.Place((RectTransform)rollBtn.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), Vector2.zero, new Vector2(180, 180));
            rollBtn.gameObject.AddComponent<Pulse>();
            stockBtn = UiKit.Button(actionRow, "股市", UiKit.Blue, ToggleStocks, 28);
            UiKit.Place((RectTransform)stockBtn.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(170, 40), new Vector2(130, 70));
            cardBar = UiKit.Rect(rt, "Cards");
            UiKit.Place(cardBar, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(60, 222), new Vector2(1000, 120));
            UiKit.HStack(cardBar, 10);
            waitPill = UiKit.Label(rt, "", 28, Color.white, TextAlignmentOptions.Center, "Wait");
            waitPill.outlineWidth = 0.25f; waitPill.outlineColor = new Color32(0, 0, 0, 180);
            UiKit.Place(waitPill.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(60, 40), new Vector2(700, 60));

            // 决定对话框
            decision = UiKit.Panel(rt, UiKit.Glass, "Decision");
            UiKit.Place(decision.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(60, 30), new Vector2(860, 330));
            decTitle = UiKit.Label(decision.transform, "", 36, UiKit.Ink);
            decTitle.fontStyle = FontStyles.Bold;
            UiKit.Place(decTitle.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(36, -22), new Vector2(790, 50));
            decBody = UiKit.Label(decision.transform, "", 26, UiKit.InkSoft);
            UiKit.Place(decBody.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(36, -76), new Vector2(790, 70));
            decExtra = UiKit.Rect(decision.transform, "Extra");
            UiKit.Place(decExtra, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -150), new Vector2(790, 80));
            decButtons = UiKit.Rect(decision.transform, "Buttons");
            UiKit.Place(decButtons, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 24), new Vector2(790, 70));
            UiKit.HStack(decButtons, 14);
            decision.gameObject.SetActive(false);

            // 股市面板
            stockPanel = UiKit.Panel(rt, UiKit.Glass, "Stocks");
            UiKit.Place(stockPanel.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 60), new Vector2(900, 620));
            var st = UiKit.Label(stockPanel.transform, "股市 · 每手 100 股", 34, UiKit.Ink);
            st.fontStyle = FontStyles.Bold;
            UiKit.Place(st.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(30, -20), new Vector2(700, 50));
            var close = UiKit.Button(stockPanel.transform, "关闭", UiKit.Grey, ToggleStocks, 24);
            UiKit.Place((RectTransform)close.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-20, -18), new Vector2(110, 52));
            stockRows = UiKit.Rect(stockPanel.transform, "Rows");
            UiKit.Fill(stockRows, 24, 24, 90, 24);
            UiKit.VStack(stockRows, 8);
            stockPanel.gameObject.SetActive(false);

            // 事件弹窗（点一下跳过）
            fxPanel = UiKit.Panel(rt, UiKit.Cream, "Fx");
            UiKit.Place(fxPanel.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 120), new Vector2(720, 260));
            fxPanel.gameObject.AddComponent<Button>().onClick.AddListener(() => V?.SkipAnimation());
            fxTitle = UiKit.Label(fxPanel.transform, "", 44, UiKit.Red, TextAlignmentOptions.Center);
            fxTitle.fontStyle = FontStyles.Bold;
            UiKit.Place(fxTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -26), new Vector2(680, 64));
            fxText = UiKit.Label(fxPanel.transform, "", 30, UiKit.Ink, TextAlignmentOptions.Center);
            UiKit.Place(fxText.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 30), new Vector2(660, 140));
            fxPanel.gameObject.SetActive(false);

            // 轮到谁的横幅
            banner = UiKit.Panel(rt, UiKit.Blue, "Banner");
            UiKit.Place(banner.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 140), new Vector2(640, 130));
            bannerText = UiKit.Label(banner.transform, "", 60, Color.white, TextAlignmentOptions.Center);
            bannerText.fontStyle = FontStyles.Bold;
            UiKit.Fill(bannerText.rectTransform);
            banner.raycastTarget = false;
            banner.gameObject.SetActive(false);

            // 格子信息
            cellInfo = UiKit.Panel(rt, UiKit.Cream, "CellInfo");
            UiKit.Place(cellInfo.rectTransform, new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(24, 60), new Vector2(520, 420));
            cellText = UiKit.Label(cellInfo.transform, "", 24, UiKit.Ink, TextAlignmentOptions.TopLeft);
            UiKit.Fill(cellText.rectTransform, 28, 28, 24, 80);
            var cc = UiKit.Button(cellInfo.transform, "关闭", UiKit.Grey, () => cellInfo.gameObject.SetActive(false), 24);
            UiKit.Place((RectTransform)cc.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 18), new Vector2(140, 50));
            cellInfo.gameObject.SetActive(false);

            // 菜单
            menuPanel = UiKit.Panel(rt, new Color(0, 0, 0, 0.55f), "Menu", false);
            UiKit.Fill(menuPanel.rectTransform);
            var mp = UiKit.Panel(menuPanel.transform, UiKit.Cream, "Box");
            UiKit.Place(mp.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(440, 380));
            UiKit.VStack(mp, 16, 30);
            UiKit.Size(UiKit.Button(mp.transform, "继续游戏", UiKit.Green, () => menuPanel.gameObject.SetActive(false), 30), -1, 80);
            UiKit.Size(UiKit.Button(mp.transform, "认输", UiKit.Grey, Resign, 30), -1, 80);
            UiKit.Size(UiKit.Button(mp.transform, "保存并回到主菜单", UiKit.Red, () => App.I.QuitToMenu(), 30), -1, 80);
            menuPanel.gameObject.SetActive(false);

            // 游戏结束
            overPanel = UiKit.Panel(rt, new Color(0, 0, 0, 0.6f), "Over", false);
            UiKit.Fill(overPanel.rectTransform);
            overPanel.gameObject.SetActive(false);
        }

        public void Bind(IGameSession s, GameView v)
        {
            S = s; V = v;
            S.Error += e => { ui.Toast(e); actedSeq = -1; Invalidate(); };
            Invalidate();
            foreach (var p in new[] { decision, fxPanel, banner, cellInfo, stockPanel, menuPanel, overPanel }) p.gameObject.SetActive(false);
            UiKit.SetText(speedBtn, SpeedName);
            UiKit.SetText(viewBtn, "全景");
        }

        // ---------- 刷新 ----------
        public void Refresh(GameState s)
        {
            if (s == null) return;
            var cur = s.players[s.current];
            curStripe.color = UiKit.Hex(cur.color);
            curName.text = UiKit.Clean(cur.name) + " 的回合";
            curCash.text = "现金 " + UiKit.Money(cur.cash);
            roundLabel.text = s.maxRounds > 0 ? $"第 {s.round} / {s.maxRounds} 回合" : $"第 {s.round} 回合";
            RefreshPlayers(s);
            logText.text = string.Join("\n", s.log.Skip(Mathf.Max(0, s.log.Count - 10)).Select(l => UiKit.Clean(l.text)));
            var me = S.IsOnline ? S.Me : s.current;
            autoBtn.GetComponent<Image>().color = me >= 0 && me < s.players.Count && s.players[me].auto ? UiKit.Gold : UiKit.Glass;
            if (stockPanel.gameObject.activeSelf) RefreshStocks(s);
            RefreshActions(s);
        }

        void RefreshPlayers(GameState s)
        {
            UiKit.Clear(playerList);
            for (int i = 0; i < s.players.Count; i++)
            {
                var p = s.players[i];
                bool cur = i == s.current;
                var card = UiKit.Panel(playerList, p.bankrupt ? new Color(0.85f, 0.85f, 0.85f, 0.9f) : cur ? UiKit.Hex("#fff3c4") : UiKit.Glass, "Player");
                UiKit.Size(card, -1, 132);
                var stripe = UiKit.Panel(card.transform, UiKit.Hex(p.color), "Stripe", false);
                UiKit.Place(stripe.rectTransform, new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(10, 0), new Vector2(12, 110));
                string chName = C.characters.TryGetValue(p.@char, out var ci) ? ci.name : "";
                var n = UiKit.Label(card.transform, $"{UiKit.Clean(p.name)}  <size=20><color=#7a6a55>{chName}{(p.isBot ? " · 电脑" : p.auto ? " · 托管" : "")}</color></size>", 28, UiKit.Ink);
                n.fontStyle = FontStyles.Bold;
                UiKit.Place(n.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(34, -10), new Vector2(350, 40));
                var cash = UiKit.Label(card.transform, p.bankrupt ? "已破产" : UiKit.Money(p.cash), 30, p.bankrupt ? UiKit.Grey : UiKit.Hex("#d9480f"));
                cash.fontStyle = FontStyles.Bold;
                UiKit.Place(cash.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(34, -50), new Vector2(350, 40));
                int lands = s.lands.Values.Count(l => l.owner == i);
                string st = p.stay > 0 ? (p.stayAt == "jail" ? $" · 坐牢{p.stay}天" : p.stayAt == "hospital" ? $" · 住院{p.stay}天" : $" · 冬眠") : "";
                if (p.god != null && C.gods.TryGetValue(p.god.key, out var g)) st += $" · {g.name}";
                var info = UiKit.Label(card.transform, $"总资产 {UiKit.Short(R.NetWorth(i))} · 地产 {lands} · 卡 {p.cards.Count} · 点券 {p.points}{st}", 19, UiKit.InkSoft);
                UiKit.Place(info.rectTransform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(34, 10), new Vector2(360, 34));
            }
        }

        bool MyTurn(GameState s) => s.phase != "over" && S.Controls(s.current) && !s.players[s.current].auto;

        void RefreshActions(GameState s)
        {
            bool pending = s.seq == actedSeq && Time.unscaledTime - actedAt < 3f;
            bool mine = MyTurn(s) && !V.Busy && !pending;
            var stamp = $"{mine}|{s.turn}|{s.phase}|{s.seq}|{string.Join(",", s.players[s.current].cards)}";
            if (stamp == actKey) return;
            actKey = stamp;
            rollBtn.gameObject.SetActive(mine && s.phase == "roll");
            stockBtn.gameObject.SetActive(mine && (s.phase == "roll" || s.phase == "exchange"));
            waitPill.text = !mine && s.phase != "over" ? $"{UiKit.Clean(s.players[s.current].name)} 行动中…" : "";
            // 道具卡栏
            UiKit.Clear(cardBar);
            if (mine && s.phase == "roll")
            {
                var p = s.players[s.current];
                for (int k = 0; k < p.cards.Count; k++)
                {
                    var key = p.cards[k];
                    if (!C.cards.TryGetValue(key, out var info)) continue;
                    int idx = k;
                    var cat = C.cardCats[info.cat];
                    var b = UiKit.Button(cardBar, info.name, UiKit.Hex(cat.color), () => UseCard(idx), 24);
                    UiKit.Size(b, 116, 110);
                }
            }
            UpdateDecision(s, mine);
        }

        // ---------- 决定对话框 ----------
        void UpdateDecision(GameState s, bool mine)
        {
            string key = mine ? $"{s.turn}|{s.phase}|{s.seq}" : "";
            if (key == decisionKey) return;
            decisionKey = key;
            decision.gameObject.SetActive(false);
            if (!mine) return;
            var p = s.players[s.current];
            var cell = C.board[p.pos];
            switch (s.phase)
            {
                case "buy":
                    {
                        int price = R.BuyPrice(s.current, p.pos);
                        Ask($"买下 {cell.name}？", $"{C.groups[cell.group].name}片区 · 地价 {UiKit.Money(price)} · 你有 {UiKit.Money(p.cash)}",
                            ("买下", UiKit.Red, () => Act(new JObject { ["type"] = "buy" })), ("不买", UiKit.Grey, Skip));
                        break;
                    }
                case "upgrade":
                    {
                        var ld = s.Land(p.pos);
                        int cost = R.UpgradeCost(p.pos);
                        var opts = new List<(string, Color, System.Action)>();
                        for (int n = 1; ld.level + n <= C.maxLevel && n <= 3; n++)
                        {
                            int levels = n;
                            if (p.cash < cost * n) break;
                            opts.Add(($"盖到{C.levels[ld.level + n]} {UiKit.Short(cost * n)}", n == 1 ? UiKit.Red : UiKit.Hex("#e8590c"), () => Act(new JObject { ["type"] = "upgrade", ["levels"] = levels })));
                        }
                        opts.Add(("不盖", UiKit.Grey, Skip));
                        Ask($"在 {cell.name} 加盖？", $"现在是{C.levels[ld.level]}，每层 {UiKit.Money(cost)}", opts.ToArray());
                        break;
                    }
                case "shop": ShowShop(s); break;
                case "casino":
                    {
                        var opts = new List<(string, Color, System.Action)>();
                        foreach (int amt in new[] { 1000, 3000, 5000 })
                        {
                            if (p.cash < amt) continue;
                            int a = amt;
                            opts.Add(($"押大 {UiKit.Short(a)}", UiKit.Red, () => Act(new JObject { ["type"] = "bet", ["amount"] = a, ["pick"] = "big" })));
                            opts.Add(($"押小 {UiKit.Short(a)}", UiKit.Blue, () => Act(new JObject { ["type"] = "bet", ["amount"] = a, ["pick"] = "small" })));
                        }
                        opts.Add(("离开", UiKit.Grey, Skip));
                        Ask("赌场：押大小", "三颗骰子，11 点以上为大，豹子庄家通吃", opts.Take(7).ToArray());
                        break;
                    }
                case "exchange":
                    Ask("证券交易所", "在这里买卖股票免手续费，还打听到了一支股票的内幕", ("打开股市", UiKit.Blue, () => { stockPanel.gameObject.SetActive(true); RefreshStocks(S.State); }), ("离开", UiKit.Grey, Skip));
                    break;
                case "fork":
                    {
                        var opts = s.fork.options.Select(o =>
                        {
                            var ends = R.Landings(s.current, p.pos, p.prev, s.fork.left, o).Select(e => C.board[e].name).Distinct().Take(3);
                            int to = o;
                            return ($"往{Direction(p.pos, o)} → {string.Join("/", ends)}", UiKit.Gold, (System.Action)(() => Act(new JObject { ["type"] = "chooseFork", ["to"] = to })));
                        }).ToArray();
                        Ask("走到岔路口了", $"还要走 {s.fork.left} 步。点地图上的金色箭头，或者选一个方向：", opts);
                        break;
                    }
            }
        }

        string Direction(int from, int to)
        {
            int dx = C.board[to].x - C.board[from].x, dz = C.board[to].z - C.board[from].z;
            return dx > 0 ? "东" : dx < 0 ? "西" : dz > 0 ? "南" : "北";
        }

        void Ask(string title, string body, params (string label, Color color, System.Action act)[] buttons)
        {
            decision.gameObject.SetActive(true);
            decTitle.text = title;
            decBody.text = body;
            UiKit.Clear(decExtra);
            UiKit.Clear(decButtons);
            foreach (var (label, color, act) in buttons)
            {
                var b = UiKit.Button(decButtons, label, color, () => { decision.gameObject.SetActive(false); act(); }, buttons.Length > 4 ? 20 : 26, color == UiKit.Gold ? UiKit.Ink : (Color?)null);
                UiKit.Size(b, -1, 64, 1);
            }
        }

        void ShowShop(GameState s)
        {
            var p = s.players[s.current];
            Ask("道具店", $"你有 {p.points} 点券，最多持有 {C.maxCards} 张卡", ("离开", UiKit.Grey, Skip));
            UiKit.Place(decExtra, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -130), new Vector2(790, 100));
            var grid = decExtra.gameObject.GetComponent<GridLayoutGroup>();
            if (!grid) grid = decExtra.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(150, 44);
            grid.spacing = new Vector2(8, 8);
            UiKit.Place(decision.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(60, 30), new Vector2(860, 470));
            foreach (var key in C.cardKeys)
            {
                var info = C.cards[key];
                int price = R.CardPrice(s.current, key);
                string k = key;
                var b = UiKit.Button(decExtra, $"{info.name} {price}", UiKit.Hex(C.cardCats[info.cat].color), () => Act(new JObject { ["type"] = "shopBuy", ["card"] = k }), 19);
                b.interactable = p.points >= price && p.cards.Count < C.maxCards;
            }
        }

        // ---------- 行动 ----------
        void Act(JObject a)
        {
            UiKit.Place(decision.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(60, 30), new Vector2(860, 330));
            UiKit.Place(decExtra, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -150), new Vector2(790, 80));
            var grid = decExtra.GetComponent<GridLayoutGroup>();
            if (grid) Destroy(grid);
            Invalidate();
            actedSeq = S.State.seq;
            actedAt = Time.unscaledTime;
            S.Act(S.State.current, a);
        }
        void Skip() => Act(new JObject { ["type"] = "skip" });
        void Roll() { rollBtn.gameObject.SetActive(false); UiKit.Clear(cardBar); Act(new JObject { ["type"] = "roll" }); }

        void UseCard(int index)
        {
            var s = S.State;
            var p = s.players[s.current];
            var key = p.cards[index];
            var info = C.cards[key];
            var targets = R.CardTargets(s.current, key);
            if (targets == null || targets.Type == JTokenType.Null) { ui.Toast($"现在不能使用{info.name}"); return; }
            void Use(JToken target) => Act(new JObject { ["type"] = "useCard", ["index"] = index, ["target"] = target });
            switch (info.target)
            {
                case "none":
                    Ask($"使用{info.name}？", info.desc, ("使用", UiKit.Red, () => Use(null)), ("算了", UiKit.Grey, () => Invalidate()));
                    break;
                case "dice":
                    Ask(info.name, "选一个点数：", targets.Select(t => ((string)$"{(int)t}", UiKit.Gold, (System.Action)(() => Use(t)))).Append(("算了", UiKit.Grey, () => Invalidate())).ToArray());
                    break;
                case "player":
                    Ask(info.name, info.desc, targets.Select(t =>
                    {
                        var who = s.players.First(x => x.id == (string)t);
                        return (UiKit.Clean(who.name), UiKit.Hex(who.color), (System.Action)(() => Use(t)));
                    }).Append(("算了", UiKit.Grey, () => Invalidate())).ToArray());
                    break;
                case "stock":
                    Ask(info.name, info.desc, targets.Select(t => (C.stocks[(string)t].name, UiKit.Blue, (System.Action)(() => Use(t)))).Append(("算了", UiKit.Grey, () => Invalidate())).ToArray());
                    break;
                case "cell":
                    Ask(info.name, info.desc + "\n点地图上闪红光的格子。", ("算了", UiKit.Grey, () => { V.ClearSelect(); Invalidate(); }));
                    V.SelectCells(targets.Select(t => (int)t), c => { decision.gameObject.SetActive(false); Use(c); });
                    break;
            }
        }

        void ToggleView()
        {
            bool overview = App.I.Cam.Follow;
            App.I.Cam.SetOverview(overview);
            UiKit.SetText(viewBtn, overview ? "跟随" : "全景");
        }
        string SpeedName => App.I.Settings.speed == 0 ? "慢速" : App.I.Settings.speed == 2 ? "快速" : "中速";
        void CycleSpeed()
        {
            App.I.Settings.speed = (App.I.Settings.speed + 1) % 3;
            App.I.Settings.Save();
            UiKit.SetText(speedBtn, SpeedName);
        }
        void ToggleAuto()
        {
            var s = S.State;
            int me = S.IsOnline ? S.Me : s.current;
            if (me < 0 || !S.Controls(me)) return;
            S.Act(me, new JObject { ["type"] = "setAuto", ["value"] = !s.players[me].auto });
        }
        void Resign()
        {
            menuPanel.gameObject.SetActive(false);
            var s = S.State;
            int me = S.IsOnline ? S.Me : s.current;
            if (me >= 0 && S.Controls(me)) S.Act(me, new JObject { ["type"] = "resign" });
        }

        // ---------- 股市 ----------
        void ToggleStocks()
        {
            bool on = !stockPanel.gameObject.activeSelf;
            stockPanel.gameObject.SetActive(on);
            if (on) RefreshStocks(S.State);
        }

        void RefreshStocks(GameState s)
        {
            UiKit.Clear(stockRows);
            if (s.market == null) return;
            int me = S.IsOnline ? S.Me : s.current;
            var p = me >= 0 ? s.players[me] : null;
            bool canTrade = MyTurn(s) && (s.phase == "roll" || s.phase == "exchange");
            foreach (var k in C.stockKeys)
            {
                var info = C.stocks[k];
                var m = s.market[k];
                double prev = m.hist != null && m.hist.Count > 1 ? m.hist[m.hist.Count - 2] : m.price;
                double chg = prev > 0 ? m.price / prev - 1 : 0;
                var row = UiKit.Panel(stockRows, Color.white, "Stock");
                UiKit.Size(row, -1, 70);
                UiKit.HStack(row, 12, 10).childAlignment = TextAnchor.MiddleLeft;
                var n = UiKit.Label(row.transform, info.name, 26, UiKit.Ink);
                n.fontStyle = FontStyles.Bold;
                UiKit.Size(n, 170, 50);
                // 中国习惯：红涨绿跌
                var pr = UiKit.Label(row.transform, $"{m.price:0.0}  <color={(chg > 0.0005 ? "#e03131" : chg < -0.0005 ? "#2f9e44" : "#868e96")}>{(chg >= 0 ? "▲" : "▼")}{System.Math.Abs(chg * 100):0.0}%</color>", 26, UiKit.Ink);
                UiKit.Size(pr, 220, 50);
                int held = p?.stocks != null && p.stocks.TryGetValue(k, out var h) ? h : 0;
                string tip = p?.tips != null && p.tips.TryGetValue(k, out var tp) ? (tp > 0 ? " · 内幕：看涨" : tp < 0 ? " · 内幕：看跌" : "") : "";
                var hl = UiKit.Label(row.transform, $"持有 {held} 股{tip}", 22, UiKit.InkSoft);
                UiKit.Size(hl, -1, 50, 1);
                if (canTrade)
                {
                    string kk = k;
                    UiKit.Size(UiKit.Button(row.transform, "买 1 手", UiKit.Red, () => Trade(kk, 1), 22), 110, 50);
                    var sell = UiKit.Button(row.transform, "卖 1 手", UiKit.Hex("#2f9e44"), () => Trade(kk, -1), 22);
                    sell.interactable = held >= C.lot;
                    UiKit.Size(sell, 110, 50);
                }
            }
        }
        void Trade(string k, int lots) => Act(new JObject { ["type"] = "trade", ["stock"] = k, ["lots"] = lots });

        // ---------- 弹窗和横幅 ----------
        public void ShowFx(FxEntry f, string kind)
        {
            if (kind == "toast") { ui.Toast($"{f.title}：{f.text}", 1.6f); return; }
            fxPanel.gameObject.SetActive(true);
            fxPanel.transform.SetAsLastSibling();
            fxTitle.text = UiKit.Clean(f.title);
            fxTitle.color = f.tone == "good" ? UiKit.Hex("#2b8a3e") : f.tone == "bad" ? UiKit.Hex("#c92a2a") : UiKit.Hex("#1864ab");
            fxText.text = UiKit.Clean(f.text);
            fxPanel.gameObject.GetComponent<RectTransform>().localScale = Vector3.one * 0.8f;
            StartCoroutine(PopIn(fxPanel.transform));
        }
        public void HideFx() => fxPanel.gameObject.SetActive(false);

        IEnumerator PopIn(Transform t)
        {
            for (float k = 0; k < 1f; k += Time.deltaTime / 0.18f)
            {
                float c = 1.7f, x = k - 1f;
                t.localScale = Vector3.one * (1 + (c + 1) * x * x * x + c * x * x);
                yield return null;
            }
            t.localScale = Vector3.one;
        }

        public void TurnBanner(PlayerState p)
        {
            banner.color = UiKit.Hex(p.color);
            bannerText.text = S.Controls(S.State.IndexOf(p.id)) && !p.isBot ? (S.IsOnline ? "轮到你了！" : $"轮到 {UiKit.Clean(p.name)} 了！") : $"{UiKit.Clean(p.name)} 的回合";
            banner.gameObject.SetActive(true);
            banner.transform.SetAsLastSibling();
            bannerUntil = Time.unscaledTime + 1.3f / App.I.Settings.SpeedMul;
            StartCoroutine(PopIn(banner.transform));
        }

        // 开局：所有玩家的卡片依次亮相
        public IEnumerator IntroCards(GameState s)
        {
            var box = UiKit.Rect(transform, "Intro");
            UiKit.Place(box, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 60), new Vector2(1200, 300));
            UiKit.HStack(box, 24);
            foreach (var p in s.players)
            {
                var card = UiKit.Panel(box, UiKit.Hex(p.color), "Card");
                UiKit.Size(card, 260, 280);
                var n = UiKit.Label(card.transform, UiKit.Clean(p.name), 36, Color.white, TextAlignmentOptions.Center);
                n.fontStyle = FontStyles.Bold;
                UiKit.Place(n.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 30), new Vector2(240, 60));
                var c = UiKit.Label(card.transform, C.characters.TryGetValue(p.@char, out var ci) ? ci.name : "", 28, new Color(1, 1, 1, 0.85f), TextAlignmentOptions.Center);
                UiKit.Place(c.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -30), new Vector2(240, 50));
                card.transform.localScale = Vector3.zero;
                StartCoroutine(PopIn(card.transform));
                Sfx.Play("click");
                yield return new WaitForSeconds(0.25f);
            }
            yield return new WaitForSeconds(1.2f);
            Destroy(box.gameObject);
        }

        public void ShowCellInfo(int cell, GameState s)
        {
            var c = C.board[cell];
            var sb = new System.Text.StringBuilder();
            sb.Append($"<size=34><b>{c.name}</b></size>");
            if (c.type == "land")
            {
                var ld = s.Land(cell);
                var g = C.groups[c.group];
                sb.Append($"  <color=#7a6a55>{g.name}片区</color>\n");
                sb.Append(ld.owner != null ? $"地主：{UiKit.Clean(s.players[ld.owner.Value].name)} · {C.levels[ld.level]}\n当前过路费 {UiKit.Money(R.RentFor(cell))}\n" : $"无主空地 · 地价 {UiKit.Money(c.price)}\n");
                sb.Append($"每层加盖 {UiKit.Money(R.UpgradeCost(cell))}\n\n<b>基础过路费</b>\n");
                for (int k = 0; k <= C.maxLevel; k++) sb.Append($"{C.levels[k]}：{UiKit.Money((int)(System.Math.Round(c.price / 10.0 * C.levelMult[k] / 10.0) * 10))}\n");
                sb.Append("<size=20><color=#7a6a55>同片区每多拥有一块地，过路费 +60%</color></size>");
            }
            else sb.Append("\n" + c.type switch
            {
                "chance" => "抽一张机会卡", "destiny" => "抽一张命运卡", "news" => "全城新闻，影响所有人", "shop" => "用点券买道具卡",
                "wheel" => "转一次幸运转盘", "casino" => "押大小", "points" => "领取点券", "tax" => "缴税", "exchange" => "免手续费买卖股票，还能打听内幕",
                "police" => "被抓进监狱", "jail" => "监狱", "hospital" => "医院", "park" => "中央公园，歇一歇", "start" => "经过领工资和点券", _ => "",
            });
            cellText.text = sb.ToString();
            cellInfo.gameObject.SetActive(true);
        }

        public void ShowGameOver(GameState s)
        {
            UiKit.Clear(overPanel.transform);
            overPanel.gameObject.SetActive(true);
            overPanel.transform.SetAsLastSibling();
            var box = UiKit.Panel(overPanel.transform, UiKit.Cream, "Box");
            UiKit.Place(box.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(760, 640));
            UiKit.VStack(box, 14, 36);
            var w = s.winner.HasValue ? s.players[s.winner.Value] : null;
            var t = UiKit.Label(box.transform, w != null ? $"{UiKit.Clean(w.name)} 成为大富翁！" : "游戏结束", 52, UiKit.Red, TextAlignmentOptions.Center);
            t.fontStyle = FontStyles.Bold;
            UiKit.Size(t, -1, 80);
            var rank = s.players.Select((p, i) => (p, i, worth: p.bankrupt ? -1 : R.NetWorth(i))).OrderByDescending(x => x.worth).ToList();
            int place = 1;
            foreach (var (p, i, worth) in rank)
            {
                var row = UiKit.Label(box.transform, $"{place++}. <color={p.color}>■</color> {UiKit.Clean(p.name)}　{(worth < 0 ? "已破产" : "总资产 " + UiKit.Money(worth))}", 32, UiKit.Ink);
                UiKit.Size(row, -1, 56);
            }
            UiKit.Size(UiKit.Button(box.transform, "回到主菜单", UiKit.Red, () => App.I.QuitToMenu(), 32), -1, 80);
            Sfx.Play("good");
        }

        void Update()
        {
            if (banner.gameObject.activeSelf && Time.unscaledTime > bannerUntil) banner.gameObject.SetActive(false);
            if (S?.State != null && V != null && !V.Busy) RefreshActions(S.State);
        }
    }

    // 掷骰子按钮一呼一吸，提醒“该你了”
    public class Pulse : MonoBehaviour
    {
        void Update() => transform.localScale = Vector3.one * (1f + Mathf.Sin(Time.unscaledTime * 4f) * 0.04f);
    }
}
