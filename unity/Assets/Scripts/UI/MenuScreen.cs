// 主菜单：背后是慢慢旋转的 3D 欢乐城。左边选角色、填昵称；右边选玩法：单机/同屏（加电脑、加同屏玩家）或联机。
using System.Collections.Generic;
using System.Linq;
using Monoplay.Core;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Monoplay
{
    public class MenuScreen : MonoBehaviour
    {
        UiRoot ui;
        TMP_InputField nameInput, serverInput, codeInput;
        RectTransform charGrid, seatList, soloBody, onlineBody;
        Button resumeBtn, roundsBtn, cashBtn, tabSolo, tabOnline;
        TextMeshProUGUI onlineHint;
        readonly Dictionary<string, Image> charCards = new();

        class SeatDraft { public string name, ch; public bool bot, me; }
        readonly List<SeatDraft> seats = new();
        static readonly int[] Rounds = { 20, 30, 50, 0 };
        static readonly int[] Cash = { 10000, 20000, 30000, 50000 };
        int roundsIdx = 1, cashIdx = 1;
        static readonly string[] BotNames = { "电脑·小强", "电脑·阿财", "电脑·旺旺", "电脑·多多" };

        public static readonly Dictionary<string, string> CharColors = new()
        {
            ["atubo"] = "#e8845c", ["xiaomei"] = "#f06595", ["qian"] = "#cc5de8", ["beibei"] = "#4dabf7", ["ninja"] = "#495057", ["laoqian"] = "#7950f2",
        };

        App A => App.I;
        Settings St => App.I.Settings;

        public static MenuScreen Create(UiRoot ui)
        {
            var rt = UiKit.Rect(ui.Root, "Menu");
            UiKit.Fill(rt);
            var m = rt.gameObject.AddComponent<MenuScreen>();
            m.ui = ui;
            m.Build(rt);
            return m;
        }

        void Build(RectTransform rt)
        {
            var shade = UiKit.Panel(rt, new Color(0.05f, 0.1f, 0.18f, 0.25f), "Shade", false, Texture2DSprite());
            UiKit.Fill(shade.rectTransform);
            shade.raycastTarget = false;

            var title = UiKit.Label(rt, "大富翁 · 欢乐城", 96, UiKit.Gold, TextAlignmentOptions.Center, "Title");
            title.fontStyle = FontStyles.Bold;
            title.outlineWidth = 0.22f;
            title.outlineColor = new Color32(140, 40, 20, 255);
            UiKit.Place(title.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0, -50), new Vector2(1200, 130));
            var tag = UiKit.Label(rt, "买地盖楼 · 道具整人 · 神仙附身 · 股市翻身 —— 看谁笑到最后！", 30, Color.white, TextAlignmentOptions.Center);
            tag.outlineWidth = 0.2f; tag.outlineColor = new Color32(0, 0, 0, 140);
            UiKit.Place(tag.rectTransform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0, -180), new Vector2(1200, 50));

            // 左：角色
            var left = UiKit.Panel(rt, UiKit.Glass, "Characters");
            UiKit.Place(left.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-20, -60), new Vector2(760, 720));
            var lt = UiKit.Label(left.transform, "① 选择你的角色", 34, UiKit.Ink);
            lt.fontStyle = FontStyles.Bold;
            UiKit.Place(lt.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(36, -26), new Vector2(600, 50));
            charGrid = UiKit.Rect(left.transform, "Grid");
            UiKit.Place(charGrid, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -96), new Vector2(690, 470));
            var grid = charGrid.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(220, 225);
            grid.spacing = new Vector2(15, 18);
            foreach (var key in A.C.charKeys) MakeCharCard(key);
            var nl = UiKit.Label(left.transform, "昵称", 28, UiKit.InkSoft);
            UiKit.Place(nl.rectTransform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(36, 54), new Vector2(100, 60));
            nameInput = UiKit.Input(left.transform, "给自己起个名字", St.name);
            UiKit.Place((RectTransform)nameInput.transform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(130, 50), new Vector2(590, 64));
            nameInput.onEndEdit.AddListener(v => { St.name = v; St.Save(); RefreshSeats(); });

            // 右：玩法
            var right = UiKit.Panel(rt, UiKit.Glass, "Modes");
            UiKit.Place(right.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0f, 0.5f), new Vector2(20, -60), new Vector2(760, 720));
            var rt2 = UiKit.Label(right.transform, "② 选择玩法", 34, UiKit.Ink);
            rt2.fontStyle = FontStyles.Bold;
            UiKit.Place(rt2.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(36, -26), new Vector2(600, 50));
            tabSolo = UiKit.Button(right.transform, "单机 / 同屏", UiKit.Red, () => Tab(true), 28);
            UiKit.Place((RectTransform)tabSolo.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(36, -90), new Vector2(334, 64));
            tabOnline = UiKit.Button(right.transform, "联机对战", UiKit.Grey, () => Tab(false), 28);
            UiKit.Place((RectTransform)tabOnline.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-36, -90), new Vector2(334, 64));

            // 单机
            soloBody = UiKit.Rect(right.transform, "Solo");
            UiKit.Fill(soloBody, 36, 36, 172, 30);
            seatList = UiKit.Rect(soloBody, "Seats");
            UiKit.Place(seatList, new Vector2(0.5f, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(688, 300));
            UiKit.VStack(seatList, 8);
            var addRow = UiKit.Rect(soloBody, "Add");
            UiKit.Place(addRow, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -312), new Vector2(688, 56));
            UiKit.HStack(addRow, 12);
            UiKit.Size(UiKit.Button(addRow, "＋ 电脑玩家", UiKit.Blue, () => AddSeat(true), 24), 330, 56);
            UiKit.Size(UiKit.Button(addRow, "＋ 同屏玩家", UiKit.Green, () => AddSeat(false), 24), 330, 56);
            var setRow = UiKit.Rect(soloBody, "Settings");
            UiKit.Place(setRow, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -384), new Vector2(688, 56));
            UiKit.HStack(setRow, 12);
            roundsBtn = UiKit.Button(setRow, "", UiKit.CreamDim, () => { roundsIdx = (roundsIdx + 1) % Rounds.Length; RefreshSettings(); }, 24, UiKit.Ink);
            UiKit.Size(roundsBtn, 330, 56);
            cashBtn = UiKit.Button(setRow, "", UiKit.CreamDim, () => { cashIdx = (cashIdx + 1) % Cash.Length; RefreshSettings(); }, 24, UiKit.Ink);
            UiKit.Size(cashBtn, 330, 56);
            var start = UiKit.Button(soloBody, "开始游戏", UiKit.Red, StartSolo, 36);
            UiKit.Place((RectTransform)start.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 76), new Vector2(688, 84));
            resumeBtn = UiKit.Button(soloBody, "继续上一局", UiKit.Gold, () => A.ResumeLocal(), 28, UiKit.Ink);
            UiKit.Place((RectTransform)resumeBtn.transform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 0), new Vector2(688, 60));

            // 联机
            onlineBody = UiKit.Rect(right.transform, "Online");
            UiKit.Fill(onlineBody, 36, 36, 172, 30);
            var hint = UiKit.Label(onlineBody, "一个人创建房间，把房间号发给朋友；朋友填同一个服务器地址和房间号加入。服务器就是仓库里的 server.js（node server.js）。", 24, UiKit.InkSoft);
            UiKit.Place(hint.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(688, 100));
            var sl = UiKit.Label(onlineBody, "服务器", 26, UiKit.InkSoft);
            UiKit.Place(sl.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, -120), new Vector2(120, 64));
            serverInput = UiKit.Input(onlineBody, "http://192.168.1.x:3000", St.server, 24, 80);
            UiKit.Place((RectTransform)serverInput.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(0, -120), new Vector2(560, 64));
            serverInput.onEndEdit.AddListener(v => { St.server = v.Trim(); St.Save(); });
            var create = UiKit.Button(onlineBody, "创建房间", UiKit.Red, CreateRoom, 32);
            UiKit.Place((RectTransform)create.transform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -220), new Vector2(688, 80));
            codeInput = UiKit.Input(onlineBody, "房间号", "", 30, 4);
            UiKit.Place((RectTransform)codeInput.transform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, -330), new Vector2(330, 72));
            var join = UiKit.Button(onlineBody, "加入房间", UiKit.Blue, JoinRoom, 30);
            UiKit.Place((RectTransform)join.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(0, -330), new Vector2(340, 72));
            onlineHint = UiKit.Label(onlineBody, "", 24, UiKit.Red);
            UiKit.Place(onlineHint.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -430), new Vector2(688, 80));

            var quit = UiKit.Button(rt, "退出游戏", new Color(0, 0, 0, 0.35f), Application.Quit, 24);
            UiKit.Place((RectTransform)quit.transform, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-30, 30), new Vector2(180, 56));

            seats.Add(new SeatDraft { me = true });
            for (int k = 0; k < 3; k++) seats.Add(new SeatDraft { bot = true, name = BotNames[k] });
            Tab(true);
        }

        static Sprite Texture2DSprite()
        {
            var t = Texture2D.whiteTexture;
            return Sprite.Create(t, new Rect(0, 0, t.width, t.height), new Vector2(0.5f, 0.5f));
        }

        void MakeCharCard(string key)
        {
            var info = A.C.characters[key];
            var card = UiKit.Panel(charGrid, Color.white, "Char " + key);
            var b = card.gameObject.AddComponent<Button>();
            b.onClick.AddListener(() => { Sfx.Play("click"); St.character = key; St.Save(); RefreshChars(); RefreshSeats(); });
            var face = UiKit.Panel(card.transform, UiKit.Hex(CharColors[key]), "Face", false, UiKit.Circle);
            UiKit.Place(face.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -16), new Vector2(96, 96));
            var initial = UiKit.Label(face.transform, info.name.Substring(info.name.Length - 1), 46, Color.white, TextAlignmentOptions.Center);
            initial.fontStyle = FontStyles.Bold;
            UiKit.Fill(initial.rectTransform);
            var n = UiKit.Label(card.transform, info.name, 30, UiKit.Ink, TextAlignmentOptions.Center);
            n.fontStyle = FontStyles.Bold;
            UiKit.Place(n.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -118), new Vector2(210, 40));
            var sk = UiKit.Label(card.transform, info.skill, 19, UiKit.InkSoft, TextAlignmentOptions.Top);
            UiKit.Place(sk.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -160), new Vector2(196, 60));
            charCards[key] = card;
        }

        void RefreshChars()
        {
            foreach (var kv in charCards)
            {
                bool on = kv.Key == St.character;
                kv.Value.color = on ? UiKit.Hex("#fff3c4") : Color.white;
                var o = kv.Value.GetComponent<Outline>();
                if (!o) o = kv.Value.gameObject.AddComponent<Outline>();
                o.effectColor = UiKit.Gold;
                o.effectDistance = new Vector2(4, -4);
                o.enabled = on;
            }
        }

        public void Refresh()
        {
            RefreshChars();
            RefreshSeats();
            RefreshSettings();
            resumeBtn.gameObject.SetActive(A.HasSave);
        }

        void RefreshSettings()
        {
            UiKit.SetText(roundsBtn, "回合上限：" + (Rounds[roundsIdx] == 0 ? "不限" : Rounds[roundsIdx] + " 回合"));
            UiKit.SetText(cashBtn, "起始资金：" + UiKit.Money(Cash[cashIdx]));
        }

        void Tab(bool solo)
        {
            soloBody.gameObject.SetActive(solo);
            onlineBody.gameObject.SetActive(!solo);
            tabSolo.GetComponent<Image>().color = solo ? UiKit.Red : UiKit.Grey;
            tabOnline.GetComponent<Image>().color = solo ? UiKit.Grey : UiKit.Red;
        }

        string MyName => string.IsNullOrWhiteSpace(St.name) ? "我" : St.name.Trim();

        void AddSeat(bool bot)
        {
            if (seats.Count >= 4) { ui.Toast("最多 4 名玩家"); return; }
            string name = bot ? BotNames.First(n => seats.All(s => s.name != n)) : "玩家" + (seats.Count(s => !s.bot) + 1);
            seats.Add(new SeatDraft { bot = bot, name = name });
            RefreshSeats();
        }

        void RefreshSeats()
        {
            UiKit.Clear(seatList);
            for (int i = 0; i < seats.Count; i++)
            {
                var s = seats[i];
                int idx = i;
                var row = UiKit.Panel(seatList, Color.white, "Seat");
                UiKit.Size(row, -1, 66);
                UiKit.HStack(row, 12, 10).childAlignment = TextAnchor.MiddleLeft;
                string ch = s.me ? St.character : s.ch;
                var dot = UiKit.Panel(row.transform, ch != null && CharColors.ContainsKey(ch) ? UiKit.Hex(CharColors[ch]) : UiKit.Grey, "Dot", false, UiKit.Circle);
                UiKit.Size(dot, 44, 44);
                var label = UiKit.Label(row.transform, s.me ? MyName + "（你）" : s.name, 26, UiKit.Ink);
                label.fontStyle = FontStyles.Bold;
                UiKit.Size(label, -1, 44, 1);
                var tag = UiKit.Label(row.transform, s.me ? A.C.characters[St.character].name : s.bot ? "电脑" : "同屏", 22, UiKit.InkSoft, TextAlignmentOptions.Center);
                UiKit.Size(tag, 90, 44);
                if (!s.me)
                {
                    var chBtn = UiKit.Button(row.transform, ch == null ? "随机角色" : A.C.characters[ch].name, UiKit.CreamDim, () => CycleChar(idx), 22, UiKit.Ink);
                    UiKit.Size(chBtn, 150, 46);
                    var x = UiKit.Button(row.transform, "×", UiKit.Hex("#ffe3e3"), () => { seats.RemoveAt(idx); RefreshSeats(); }, 26, UiKit.Red);
                    UiKit.Size(x, 46, 46);
                }
            }
        }

        void CycleChar(int idx)
        {
            var keys = new List<string> { null };
            keys.AddRange(A.C.charKeys);
            int k = keys.IndexOf(seats[idx].ch);
            seats[idx].ch = keys[(k + 1) % keys.Count];
            RefreshSeats();
        }

        void StartSolo()
        {
            if (seats.Count < 2) { ui.Toast("至少需要 2 名玩家"); return; }
            var list = seats.Select((s, i) => new LocalSession.Seat
            {
                id = "p" + i,
                name = s.me ? MyName : s.name,
                @char = s.me ? St.character : s.ch,
                isBot = s.bot,
            }).ToArray();
            // 同一个角色只能有一个人选
            var used = new HashSet<string>();
            foreach (var s in list) { if (s.@char != null && !used.Add(s.@char)) s.@char = null; }
            A.StartLocal(list, Rounds[roundsIdx], Cash[cashIdx]);
        }

        // ---------- 联机 ----------
        void CreateRoom()
        {
            onlineHint.text = "正在连接……";
            var c = OnlineClient.Create(St.server);
            c.CreateRoom(MyName, St.character, err => { if (err != null) { onlineHint.text = err; Destroy(c.gameObject); } else ui.ShowRoom(c); });
        }
        void JoinRoom()
        {
            var code = codeInput.text.Trim().ToUpperInvariant();
            if (code.Length != 4) { onlineHint.text = "请输入 4 位房间号"; return; }
            onlineHint.text = "正在连接……";
            var c = OnlineClient.Create(St.server);
            c.JoinRoom(code, MyName, St.character, err => { if (err != null) { onlineHint.text = err; Destroy(c.gameObject); } else ui.ShowRoom(c); });
        }
    }
}
