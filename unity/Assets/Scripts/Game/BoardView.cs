// 3D 棋盘：小岛、海、路网、格子卡片、地块和楼房、神仙/路障标记、棋子。
// 只负责“画”，不含规则。GameView 把局面和动画指令交给它。
using System.Collections.Generic;
using Monoplay.Core;
using TMPro;
using UnityEngine;

namespace Monoplay
{
    public class BoardView : MonoBehaviour
    {
        public BoardLayout L { get; private set; }
        public GameConstants C => L.C;
        public float IsleW { get; private set; }
        public float IsleD { get; private set; }

        public readonly List<TileView> Tiles = new();
        public readonly Dictionary<int, LotView> Lots = new();
        public readonly List<PieceView> Pieces = new();
        readonly Dictionary<string, GameObject> markers = new();
        Material water;
        Transform pieceRoot, markerRoot;

        public static BoardView Create(GameConstants c)
        {
            var go = new GameObject("Board");
            DontDestroyOnLoad(go);
            var b = go.AddComponent<BoardView>();
            b.Build(c);
            return b;
        }

        void Build(GameConstants c)
        {
            L = new BoardLayout(c);
            IsleW = L.HalfW + 10f;
            IsleD = L.HalfD + 10f;
            BuildGround();
            BuildRoads();
            var tiles = new GameObject("Tiles").transform;
            tiles.SetParent(transform, false);
            for (int i = 0; i < c.board.Count; i++) Tiles.Add(TileView.Create(tiles, this, i));
            var lots = new GameObject("Lots").transform;
            lots.SetParent(transform, false);
            foreach (int i in c.lands) Lots[i] = LotView.Create(lots, this, i);
            Scenery.Build(this);
            pieceRoot = new GameObject("Pieces").transform;
            pieceRoot.SetParent(transform, false);
            markerRoot = new GameObject("Markers").transform;
            markerRoot.SetParent(transform, false);
        }

        // ---------- 地面：圆角小岛 + 沙滩 + 海 + 天空 ----------
        void BuildGround()
        {
            var g = new GameObject("Ground").transform;
            g.SetParent(transform, false);
            var grass = Look.Textured(Noise.Grass(), 0.05f);
            grass.SetTextureScale("_BaseMap", new Vector2(IsleW / 3f, IsleD / 3f));
            var isle = MeshKit.MeshObject(g, MeshKit.RoundedSlab(IsleW, IsleD, 5f, 1.4f), new[] { grass, Look.Lit("#b98a55", 0.05f) }, "Island");
            isle.transform.localPosition = new Vector3(0, -1.4f, 0);
            isle.GetComponent<MeshRenderer>().receiveShadows = true;
            var sand = MeshKit.MeshObject(g, MeshKit.RoundedSlab(IsleW + 1.8f, IsleD + 1.8f, 6.5f, 1.0f), new[] { Look.Lit("#f1dca6", 0.05f), Look.Lit("#e2c68a") }, "Beach");
            sand.transform.localPosition = new Vector3(0, -1.6f, 0);

            water = Look.Textured(Noise.Water(), 0.85f);
            water.SetTextureScale("_BaseMap", new Vector2(40, 40));
            var sea = GameObject.CreatePrimitive(PrimitiveType.Plane);
            Destroy(sea.GetComponent<Collider>());
            sea.name = "Sea";
            sea.transform.SetParent(g, false);
            sea.transform.localPosition = new Vector3(0, -0.75f, 0);
            sea.transform.localScale = new Vector3(60, 1, 60);
            sea.GetComponent<MeshRenderer>().sharedMaterial = water;
            sea.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // 天空：一个很大的球，里面贴上下渐变
            var sky = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(sky.GetComponent<Collider>());
            sky.name = "Sky";
            sky.transform.SetParent(g, false);
            sky.transform.localScale = Vector3.one * 380f;
            var skyMat = new Material(Look.Unlit(Color.white)) { name = "Sky" };
            skyMat.SetTexture("_BaseMap", Noise.SkyGradient());
            skyMat.SetFloat("_Cull", 0f);
            var sr = sky.GetComponent<MeshRenderer>();
            sr.sharedMaterial = skyMat;
            sr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            sr.receiveShadows = false;
        }

        // ---------- 路网：人行道 + 沥青路面 + 车道虚线，合并成少量网格 ----------
        void BuildRoads()
        {
            const float U = BoardLayout.U, RH = U * 0.5f, SW = U * 0.57f;
            var r = new GameObject("Roads").transform;
            r.SetParent(transform, false);
            var walk = Look.Lit("#e4ddcf", 0.1f);
            var asphalt = Look.Lit("#4d5866", 0.15f);
            var dash = Look.Lit("#fff6d8", 0.2f);
            for (int a = 0; a < C.board.Count; a++)
            {
                var pa = L.Cell(a);
                MeshKit.BoxOn(r, SW * 2, 0.12f, SW * 2, pa.x, 0, pa.z, walk, false);
                MeshKit.BoxOn(r, RH * 2, 0.13f, RH * 2, pa.x, 0, pa.z, asphalt, false);
                foreach (int b in C.adj[a])
                {
                    if (b < a) continue;
                    var pb = L.Cell(b);
                    var mid = (pa + pb) / 2f;
                    bool horiz = C.board[a].z == C.board[b].z;
                    MeshKit.BoxOn(r, horiz ? U : SW * 2, 0.12f, horiz ? SW * 2 : U, mid.x, 0, mid.z, walk, false);
                    MeshKit.BoxOn(r, horiz ? U : RH * 2, 0.13f, horiz ? RH * 2 : U, mid.x, 0, mid.z, asphalt, false);
                    MeshKit.BoxOn(r, horiz ? 0.22f : 0.07f, 0.01f, horiz ? 0.07f : 0.22f, mid.x, 0.13f, mid.z, dash, false);
                }
            }
            MeshKit.MergeStatic(r);
        }

        void Update()
        {
            if (water) water.SetTextureOffset("_BaseMap", new Vector2(Time.time * 0.004f, Time.time * 0.002f));
        }

        // ---------- 局面同步 ----------
        public void SyncStatic(GameState s, RulesHost rules)
        {
            for (int i = 0; i < Tiles.Count; i++) Tiles[i].Sync(s, rules);
            foreach (var kv in Lots) kv.Value.Sync(s);
            SyncMarkers(s);
        }

        // 空棋盘（主菜单背景、退出一局之后）：格子和地块回到无主状态，不显示神仙和路障
        public void ShowBlank(GameState blank, RulesHost rules)
        {
            for (int i = 0; i < Tiles.Count; i++) Tiles[i].Sync(blank, rules);
            foreach (var kv in Lots) kv.Value.Sync(blank);
            ResetPieces();
        }

        void SyncMarkers(GameState s)
        {
            var want = new Dictionary<string, (int cell, string kind, string key)>();
            if (s.gods != null) foreach (var kv in s.gods) want[kv.Key + ":god:" + kv.Value] = (int.Parse(kv.Key), "god", kv.Value);
            if (s.obstacles != null) foreach (var kv in s.obstacles) want[kv.Key + ":ob:" + kv.Value] = (int.Parse(kv.Key), "ob", kv.Value);
            foreach (var k in new List<string>(markers.Keys))
                if (!want.ContainsKey(k)) { Destroy(markers[k]); markers.Remove(k); }
            foreach (var kv in want)
            {
                if (markers.ContainsKey(kv.Key)) continue;
                var (cell, kind, key) = kv.Value;
                var p = L.Cell(cell);
                GameObject m;
                if (kind == "god")
                {
                    var g = C.gods[key];
                    m = Marker.God(markerRoot, g.name, g.good, App.I.Font);
                    m.transform.position = p + new Vector3(0.35f, 0.3f, 0.1f);
                }
                else
                {
                    m = key == "mine" ? Marker.Mine(markerRoot) : Marker.Roadblock(markerRoot);
                    m.transform.position = p + new Vector3(-0.35f, 0.3f, -0.2f);
                }
                markers[kv.Key] = m;
            }
        }

        // ---------- 棋子 ----------
        public void ResetPieces(GameState s = null)
        {
            foreach (var pc in Pieces) if (pc) Destroy(pc.gameObject);
            Pieces.Clear();
            foreach (var kv in markers) Destroy(kv.Value);
            markers.Clear();
            if (s == null) return;
            for (int i = 0; i < s.players.Count; i++) Pieces.Add(PieceView.Create(pieceRoot, s.players[i], App.I.Font));
        }

        // 同一格上有几个棋子时错开站位
        static readonly Vector2[][] Offsets =
        {
            new[] { Vector2.zero },
            new[] { new Vector2(-0.22f, 0), new Vector2(0.22f, 0) },
            new[] { new Vector2(-0.22f, 0.18f), new Vector2(0.22f, 0.18f), new Vector2(0, -0.22f) },
            new[] { new Vector2(-0.22f, 0.2f), new Vector2(0.22f, 0.2f), new Vector2(-0.22f, -0.22f), new Vector2(0.22f, -0.22f) },
        };
        public Vector3 PieceSpot(GameState s, int k, int cell)
        {
            var same = new List<int>();
            for (int j = 0; j < s.players.Count; j++) if (!s.players[j].bankrupt && s.players[j].pos == cell) same.Add(j);
            int idx = Mathf.Max(0, same.IndexOf(k));
            var offs = Offsets[Mathf.Clamp(same.Count - 1, 0, 3)];
            var o = offs[Mathf.Min(idx, offs.Length - 1)] * BoardLayout.U;
            return L.Cell(cell) + new Vector3(o.x, 0.3f, o.y);
        }

        // 从屏幕射线找到点中的格子（点到地块也算那块地）
        public int PickCell(Ray ray)
        {
            if (Physics.Raycast(ray, out var hit, 500f))
            {
                var t = hit.collider.GetComponentInParent<TileView>();
                if (t) return t.Index;
                var l = hit.collider.GetComponentInParent<LotView>();
                if (l) return l.Cell;
            }
            return -1;
        }
    }

    // ---------- 一个格子 ----------
    public class TileView : MonoBehaviour
    {
        public int Index { get; private set; }
        BoardView board;
        MeshRenderer card, header, glow;
        TextMeshPro title, sub, value, stars;
        string key = "";
        public Color GlowColor;
        public float GlowAlpha;

        static readonly Dictionary<string, (string color, string mark)> TypeStyle = new()
        {
            ["start"] = ("#ffd34d", "GO"), ["chance"] = ("#ffb340", "?"), ["destiny"] = ("#b388ff", "命"), ["news"] = ("#74b9ff", "报"),
            ["shop"] = ("#55efc4", "店"), ["wheel"] = ("#fd79a8", "转"), ["casino"] = ("#ff7675", "赌"), ["points"] = ("#ffeaa7", "券"),
            ["tax"] = ("#b2bec3", "税"), ["exchange"] = ("#ff6b6b", "股"), ["police"] = ("#7f9cf5", "警"), ["jail"] = ("#a4a4a4", "狱"),
            ["hospital"] = ("#ffffff", "医"), ["park"] = ("#7bed9f", "园"),
        };

        public static TileView Create(Transform parent, BoardView board, int i)
        {
            var go = new GameObject("Tile " + i);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = board.L.Cell(i);
            var t = go.AddComponent<TileView>();
            t.board = board;
            t.Index = i;
            t.Build();
            return t;
        }

        void Build()
        {
            float T = BoardLayout.Tile;
            MeshKit.BoxOn(transform, T, 0.17f, T, 0, 0.13f, 0, Look.Lit("#d8cdb4", 0.1f));
            card = MeshKit.BoxOn(transform, T - 0.08f, 0.012f, T - 0.08f, 0, 0.3f, 0, Look.Lit("#fffaf0", 0.15f)).GetComponent<MeshRenderer>();
            header = MeshKit.BoxOn(transform, T - 0.08f, 0.014f, T * 0.3f, 0, 0.301f, (T - 0.08f) / 2f - T * 0.15f, Look.Lit("#5b6472")).GetComponent<MeshRenderer>();
            var col = gameObject.AddComponent<BoxCollider>();
            col.center = new Vector3(0, 0.2f, 0);
            col.size = new Vector3(T, 0.4f, T);
            var font = App.I.Font;
            title = Label(font, new Vector2(T * 0.95f, T * 0.28f), new Vector3(0, 0.32f, (T - 0.08f) / 2f - T * 0.15f), 3.2f);
            sub = Label(font, new Vector2(T * 0.95f, T * 0.18f), new Vector3(0, 0.32f, 0.12f), 1.8f);
            value = Label(font, new Vector2(T * 0.95f, T * 0.28f), new Vector3(0, 0.32f, -0.2f), 3.4f);
            stars = Label(font, new Vector2(T * 0.95f, T * 0.18f), new Vector3(0, 0.32f, -0.55f), 2.2f);
            // 高亮层（可选目标、走过的轨迹）
            var g = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(g.GetComponent<Collider>());
            g.transform.SetParent(transform, false);
            g.transform.localPosition = new Vector3(0, 0.33f, 0);
            g.transform.localRotation = Quaternion.Euler(90, 0, 0);
            g.transform.localScale = new Vector3(T, T, 1);
            glow = g.GetComponent<MeshRenderer>();
            glow.sharedMaterial = Look.Transparent(new Color(1, 0.18f, 0.33f, 0f));
            glow.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            glow.enabled = false;
        }

        TextMeshPro Label(TMP_FontAsset font, Vector2 size, Vector3 pos, float maxSize)
        {
            var go = new GameObject("Text");
            go.transform.SetParent(transform, false);
            go.transform.localPosition = pos;
            go.transform.localRotation = Quaternion.Euler(90, 0, 0);
            var t = go.AddComponent<TextMeshPro>();
            t.font = font;
            t.rectTransform.sizeDelta = size;
            t.alignment = TextAlignmentOptions.Center;
            t.enableAutoSizing = true;
            t.fontSizeMin = 0.6f;
            t.fontSizeMax = maxSize;
            t.textWrappingMode = TextWrappingModes.NoWrap;
            t.color = Color.black;
            return t;
        }

        static string Money(int v) => v >= 10000 ? "¥" + (v / 10000f).ToString("0.#") + "万" : "¥" + v.ToString("N0");

        public void Sync(GameState s, RulesHost rules)
        {
            var c = board.C.board[Index];
            string k;
            if (c.type == "land")
            {
                var ld = s.Land(Index);
                var owner = ld?.owner != null ? s.players[ld.owner.Value] : null;
                int v = owner != null ? rules.RentFor(Index) : c.price;
                k = $"{owner?.color}|{ld?.level}|{v}";
                if (k == key) return;
                key = k;
                var grp = board.C.groups[c.group];
                var oc = owner != null ? Look.Hex(owner.color) : Color.white;
                card.sharedMaterial = owner != null ? Look.Lit(oc, 0.2f) : Look.Lit("#fffaf0", 0.15f);
                header.sharedMaterial = owner != null ? Look.Lit(oc * 0.75f, 0.2f) : Look.Lit(grp.color, 0.2f);
                header.enabled = true;
                title.text = c.name; title.color = Color.white;
                sub.text = $"{grp.name} · {(owner != null ? "过路费" : "地价")}";
                sub.color = owner != null ? new Color(1, 1, 1, 0.85f) : Look.Hex("#8a7a63");
                value.text = Money(v);
                value.color = owner != null ? Color.white : Look.Hex("#3b2f22");
                stars.text = owner != null ? new string('★', ld.level) + new string('☆', 5 - ld.level) : "";
                stars.color = Look.Hex("#fff3a0");
            }
            else
            {
                if (key == c.type) return;
                key = c.type;
                var (col, mark) = TypeStyle.TryGetValue(c.type, out var st) ? st : ("#eeeeee", "?");
                card.sharedMaterial = Look.Lit(Color.Lerp(Look.Hex("#fffaf0"), Look.Hex(col), 0.35f), 0.15f);
                header.enabled = false;
                title.text = ""; stars.text = "";
                sub.text = c.name; sub.color = Look.Hex("#3b2f22");
                sub.transform.localPosition = new Vector3(0, 0.32f, -0.5f);
                value.text = mark; value.color = Look.Hex(col) * 0.75f;
                value.fontSizeMax = 6f;
                value.transform.localPosition = new Vector3(0, 0.32f, 0.12f);
            }
        }

        void Update()
        {
            if (!glow) return;
            glow.enabled = GlowAlpha > 0.01f;
            if (glow.enabled)
            {
                var c = GlowColor; c.a = GlowAlpha;
                glow.material.SetColor("_BaseColor", c);
            }
        }
    }

    // ---------- 一块地产旁边的地块（放楼房） ----------
    public class LotView : MonoBehaviour
    {
        public int Cell { get; private set; }
        public string Style { get; private set; }
        BoardView board;
        MeshRenderer paving;
        Material baseMat;
        Transform holder;
        string key;
        LandState prev;

        static readonly Dictionary<string, (string curb, string pave)> StyleColors = new()
        {
            ["old"] = ("#8f8a80", "#cbbf9f"), ["cbd"] = ("#b9c1cc", "#dde2e9"), ["beach"] = ("#d9c18a", "#f0dca8"), ["fun"] = ("#ff9fb8", "#ffe9c9"),
        };

        public static LotView Create(Transform parent, BoardView board, int cell)
        {
            var go = new GameObject("Lot " + cell);
            go.transform.SetParent(parent, false);
            var lc = board.L.LotCenter(cell);
            go.transform.localPosition = lc;
            var l = go.AddComponent<LotView>();
            l.board = board;
            l.Cell = cell;
            l.Style = board.L.StyleAt(lc);
            var (curb, pave) = StyleColors[l.Style];
            float U = BoardLayout.U;
            MeshKit.BoxOn(go.transform, U * 0.84f, 0.1f, U * 0.84f, 0, 0, 0, Look.Lit(curb, 0.1f));
            l.baseMat = Look.Textured(Noise.Paving(l.Style, Look.Hex(pave)), 0.1f);
            l.paving = MeshKit.BoxOn(go.transform, U * 0.74f, 0.06f, U * 0.74f, 0, 0.08f, 0, l.baseMat).GetComponent<MeshRenderer>();
            var col = go.AddComponent<BoxCollider>();
            col.center = new Vector3(0, 0.1f, 0);
            col.size = new Vector3(U * 0.84f, 0.2f, U * 0.84f);
            l.holder = new GameObject("Holder").transform;
            l.holder.SetParent(go.transform, false);
            l.holder.localPosition = new Vector3(0, 0.14f, 0);
            var d = BoardLayout.Dir(board.L.LotDir[cell]);
            l.holder.localRotation = Quaternion.LookRotation(-d, Vector3.up); // 正面（+z）朝向马路
            return l;
        }

        public float Top { get; private set; }

        public void Sync(GameState s)
        {
            var ld = s.Land(Cell);
            var owner = ld?.owner != null ? s.players[ld.owner.Value] : null;
            var k = owner != null ? $"{owner.color}|{ld.level}" : "none";
            if (k == key) return;
            bool grew = key != null && owner != null && (prev == null || ld.level > prev.level || prev.owner != ld.owner);
            key = k;
            prev = ld == null ? null : new LandState { owner = ld.owner, level = ld.level };
            foreach (Transform t in holder) Destroy(t.gameObject);
            if (owner != null)
            {
                var oc = Look.Hex(owner.color);
                var tinted = new Material(baseMat);
                tinted.SetColor("_BaseColor", Color.Lerp(Color.white, oc, 0.45f));
                paving.sharedMaterial = tinted;
                var b = Buildings.Make(Style, ld.level, oc);
                b.SetParent(holder, false);
                Top = b.GetComponent<BuildingInfo>().top;
                if (grew) b.gameObject.AddComponent<Grow>();
            }
            else
            {
                paving.sharedMaterial = baseMat;
                Top = 0f;
                Marker.SaleSign(holder, App.I.Font);
                Scenery.EmptyLotDecor(holder, Style);
            }
        }
    }

    // 新楼“长”出来
    public class Grow : MonoBehaviour
    {
        float t;
        void Awake() => transform.localScale = new Vector3(1, 0.01f, 1);
        void Update()
        {
            t += Time.deltaTime / 0.7f;
            float c = 1.7f, x = Mathf.Clamp01(t) - 1f;
            transform.localScale = new Vector3(1, Mathf.Max(0.01f, 1 + (c + 1) * x * x * x + c * x * x), 1);
            if (t >= 1f) { transform.localScale = Vector3.one; Destroy(this); }
        }
    }
}
