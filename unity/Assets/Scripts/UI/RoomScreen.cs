// 联机房间：大字显示房间号，4 个座位卡片。房主可以加电脑、改设置、开始游戏；每个人可以换自己的角色。
using System.Linq;
using Monoplay.Core;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Monoplay
{
    public class RoomScreen : MonoBehaviour
    {
        UiRoot ui;
        OnlineClient c;
        TextMeshProUGUI code, info;
        RectTransform seats, hostRow;
        Button startBtn;

        public static RoomScreen Create(UiRoot ui)
        {
            var rt = UiKit.Rect(ui.Root, "Room");
            UiKit.Fill(rt);
            var r = rt.gameObject.AddComponent<RoomScreen>();
            r.ui = ui;
            r.Build(rt);
            rt.gameObject.SetActive(false);
            return r;
        }

        void Build(RectTransform rt)
        {
            var p = UiKit.Panel(rt, UiKit.Glass, "Panel");
            UiKit.Place(p.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -20), new Vector2(1100, 780));
            var t = UiKit.Label(p.transform, "房间号", 30, UiKit.InkSoft, TextAlignmentOptions.Center);
            UiKit.Place(t.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -30), new Vector2(400, 44));
            code = UiKit.Label(p.transform, "", 96, UiKit.Red, TextAlignmentOptions.Center);
            code.fontStyle = FontStyles.Bold;
            code.characterSpacing = 30;
            UiKit.Place(code.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -76), new Vector2(600, 120));
            info = UiKit.Label(p.transform, "", 24, UiKit.InkSoft, TextAlignmentOptions.Center);
            UiKit.Place(info.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -200), new Vector2(1000, 40));
            seats = UiKit.Rect(p.transform, "Seats");
            UiKit.Place(seats, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -260), new Vector2(1000, 300));
            var grid = seats.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(235, 290);
            grid.spacing = new Vector2(20, 0);
            hostRow = UiKit.Rect(p.transform, "Host");
            UiKit.Place(hostRow, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 130), new Vector2(1000, 64));
            UiKit.HStack(hostRow, 16);
            UiKit.Size(UiKit.Button(hostRow, "＋ 电脑", UiKit.Blue, () => c.Send("addBot", null, Err), 26), 200, 64);
            UiKit.Size(UiKit.Button(hostRow, "回合上限", UiKit.CreamDim, () => Cycle("maxRounds", new[] { 20, 30, 50, 0 }), 24, UiKit.Ink), 220, 64);
            UiKit.Size(UiKit.Button(hostRow, "起始资金", UiKit.CreamDim, () => Cycle("startingCash", new[] { 10000, 20000, 30000, 50000 }), 24, UiKit.Ink), 220, 64);
            var row = UiKit.Rect(p.transform, "Bottom");
            UiKit.Place(row, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(1000, 76));
            UiKit.HStack(row, 16);
            UiKit.Size(UiKit.Button(row, "换角色", UiKit.Gold, NextChar, 28, UiKit.Ink), 240, 76);
            startBtn = UiKit.Button(row, "开始游戏", UiKit.Red, () => c.Send("start", null, Err), 32);
            UiKit.Size(startBtn, 360, 76);
            UiKit.Size(UiKit.Button(row, "离开房间", UiKit.Grey, Leave, 28), 240, 76);
        }

        void Err(string e) { if (e != null) ui.Toast(e); }

        public void Bind(OnlineClient client)
        {
            c = client;
            c.Updated += OnUpdate;
            c.Kicked += () => { ui.Toast("你被房主移出了房间"); ui.ShowMenu(); };
            code.text = c.RoomId;
            OnUpdate();
        }

        void OnDisable() { if (c != null) c.Updated -= OnUpdate; }

        void OnUpdate()
        {
            if (c == null || c.Room == null || !isActiveAndEnabled) return;
            if ((bool)c.Room["started"] && c.StateJson != null)
            {
                c.Updated -= OnUpdate;
                App.I.StartOnline(new OnlineSession(c, App.I.Rules));
                return;
            }
            bool host = (string)c.Room["hostId"] == c.You;
            var st = c.Room["settings"];
            int mr = (int)st["maxRounds"];
            info.text = $"把房间号发给朋友 · 服务器 {c.BaseUrl} · {(mr == 0 ? "不限回合" : mr + " 回合")} · 起始资金 {UiKit.Money((int)st["startingCash"])}";
            hostRow.gameObject.SetActive(host);
            startBtn.gameObject.SetActive(host);
            UiKit.Clear(seats);
            var list = (JArray)c.Room["seats"];
            for (int i = 0; i < 4; i++)
            {
                var card = UiKit.Panel(seats, i < list.Count ? Color.white : new Color(1, 1, 1, 0.45f), "Seat");
                if (i >= list.Count)
                {
                    var w = UiKit.Label(card.transform, "等待加入……", 26, UiKit.InkSoft, TextAlignmentOptions.Center);
                    UiKit.Fill(w.rectTransform);
                    continue;
                }
                var s = list[i];
                string ch = (string)s["char"];
                var dot = UiKit.Panel(card.transform, ch != null && MenuScreen.CharColors.ContainsKey(ch) ? UiKit.Hex(MenuScreen.CharColors[ch]) : UiKit.Grey, "Face", false, UiKit.Circle);
                UiKit.Place(dot.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -24), new Vector2(110, 110));
                var n = UiKit.Label(card.transform, (string)s["name"] + ((string)s["id"] == c.You ? "（你）" : ""), 28, UiKit.Ink, TextAlignmentOptions.Center);
                n.fontStyle = FontStyles.Bold;
                UiKit.Place(n.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -146), new Vector2(225, 40));
                var chName = ch != null && App.I.C.characters.TryGetValue(ch, out var ci) ? ci.name : "随机角色";
                var sub = UiKit.Label(card.transform, chName + ((bool)s["isBot"] ? " · 电脑" : (bool)s["online"] ? " · 在线" : " · 离线"), 22, UiKit.InkSoft, TextAlignmentOptions.Center);
                UiKit.Place(sub.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -190), new Vector2(225, 34));
                string sid = (string)s["id"];
                if ((string)c.Room["hostId"] == sid)
                {
                    var hb = UiKit.Label(card.transform, "房主", 20, UiKit.Gold, TextAlignmentOptions.Center);
                    UiKit.Place(hb.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -224), new Vector2(225, 30));
                }
                if (host && sid != c.You)
                {
                    var k = UiKit.Button(card.transform, "移除", UiKit.Hex("#ffe3e3"), () => c.Send("kick", new JObject { ["seatId"] = sid }, Err), 20, UiKit.Red);
                    UiKit.Place((RectTransform)k.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 12), new Vector2(120, 40));
                }
            }
        }

        void Cycle(string key, int[] values)
        {
            int cur = (int)c.Room["settings"][key];
            int next = values[(System.Array.IndexOf(values, cur) + 1) % values.Length];
            var body = new JObject { ["maxRounds"] = (int)c.Room["settings"]["maxRounds"], ["startingCash"] = (int)c.Room["settings"]["startingCash"] };
            body[key] = next;
            c.Send("settings", body, Err);
        }

        void NextChar()
        {
            var me = ((JArray)c.Room["seats"]).FirstOrDefault(s => (string)s["id"] == c.You);
            var keys = App.I.C.charKeys;
            var taken = ((JArray)c.Room["seats"]).Where(s => (string)s["id"] != c.You).Select(s => (string)s["char"]).ToHashSet();
            int k = keys.IndexOf((string)me?["char"]);
            for (int n = 1; n <= keys.Count; n++)
            {
                var cand = keys[(k + n + keys.Count) % keys.Count];
                if (!taken.Contains(cand)) { App.I.Settings.character = cand; App.I.Settings.Save(); c.Send("char", new JObject { ["char"] = cand }, Err); return; }
            }
        }

        void Leave()
        {
            if (c != null) { c.Updated -= OnUpdate; c.Close(); c = null; }
            ui.ShowMenu();
        }
    }
}
