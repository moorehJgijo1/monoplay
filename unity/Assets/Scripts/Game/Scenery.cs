// 场景装饰：四个主题街区的地标 + 棋盘外的郊区 + 环岛路上的车流 + 各片区风格的树。
// 只是装饰，不影响规则。镜头在南边（-z），南边一圈只放矮的东西，免得挡住棋盘。
// 世界坐标：x 向东，z 向北。
using System.Collections.Generic;
using UnityEngine;

namespace Monoplay
{
    public static class Scenery
    {
        static Transform root;
        static System.Random rng;
        static readonly List<Rect> reserved = new();
        static float R() => (float)rng.NextDouble();
        static float Range(float a, float b) => a + (b - a) * R();

        public static void Build(BoardView b)
        {
            root = new GameObject("Scenery").transform;
            root.SetParent(b.transform, false);
            rng = new System.Random(12345);
            reserved.Clear();
            var L = b.L;
            foreach (var blk in L.Blocks) BuildDistrict(L, blk);
            var ring = RingRoad.Build(root, b.IsleW, b.IsleD);
            Suburbs(b, ring);
            Trees(b, ring);
            Islands();
        }

        static void Reserve(float x0, float z0, float x1, float z1) => reserved.Add(Rect.MinMaxRect(Mathf.Min(x0, x1), Mathf.Min(z0, z1), Mathf.Max(x0, x1), Mathf.Max(z0, z1)));
        static bool Blocked(float x, float z, float pad = 0.4f)
        {
            foreach (var r in reserved) if (x > r.xMin - pad && x < r.xMax + pad && z > r.yMin - pad && z < r.yMax + pad) return true;
            return false;
        }

        static Transform Put(string kit, string model, Vector3 pos, float yaw = 0, float size = 0, float height = 0, Transform parent = null)
        {
            var t = Kenney.Spawn(kit, model, parent ? parent : root, size, height);
            t.localPosition = pos;
            t.localRotation = Quaternion.Euler(0, yaw, 0);
            return t;
        }
        static Transform Group(string name, Vector3 pos, float yaw = 0)
        {
            var g = new GameObject(name).transform;
            g.SetParent(root, false);
            g.localPosition = pos;
            g.localRotation = Quaternion.Euler(0, yaw, 0);
            return g;
        }

        // ---------- 四个主题街区 ----------
        static void BuildDistrict(BoardLayout L, BoardLayout.Block blk)
        {
            // 整个街区铺主题地面（比街区略小一圈，留出路边绿化带）
            var a = L.World(blk.x0, blk.z0); var c = L.World(blk.x1, blk.z1);
            float gw = Mathf.Abs(c.x - a.x) + BoardLayout.U * 0.78f, gd = Mathf.Abs(c.z - a.z) + BoardLayout.U * 0.78f;
            var ctr = (a + c) / 2f;
            var groundColor = blk.theme switch { "old" => "#d9c8a2", "cbd" => "#d5dae2", "beach" => "#f0dca8", _ => "#9ad97a" };
            var tex = Noise.Paving(blk.theme == "fun" ? "cbd" : blk.theme, Look.Hex(groundColor));
            var gm = Look.Textured(tex, 0.1f);
            gm.SetTextureScale("_BaseMap", new Vector2(gw / 2.5f, gd / 2.5f));
            MeshKit.BoxOn(root, gw, 0.03f, gd, ctr.x, 0, ctr.z, gm, false);
            var (fc, W, D) = L.FreeArea(blk);
            var g = Group("District " + blk.theme, fc);
            switch (blk.theme)
            {
                case "old": OldTown(g, W, D); break;
                case "cbd": Finance(g, W, D); break;
                case "beach": Beach(g, W, D); break;
                default: FunPark(g, W, D); break;
            }
        }

        // 西北古城：七层宝塔、城墙城楼、牌坊、荷花池、灯笼
        static void OldTown(Transform g, float W, float D)
        {
            var tile = Look.Lit("#3e4b5e", 0.45f);
            var wall = Look.Lit("#efe3c8", 0.2f); var red = Look.Lit("#b8382a", 0.4f); var grey = Look.Lit("#9aa0a6", 0.15f);
            var brick = Look.Lit("#8d8a83", 0.1f); var lattice = Look.Lit("#6b3a1a", 0.3f); var gold = Look.Lit("#e8b630", 0.6f, 0.6f);
            // 宝塔：南侧偏西
            var pg = new GameObject("Pagoda").transform; pg.SetParent(g, false); pg.localPosition = new Vector3(-W / 2 + 1.2f, 0, -D / 2 + 1.2f);
            MeshKit.BoxOn(pg, 1.7f, 0.16f, 1.7f, 0, 0, 0, grey);
            MeshKit.BoxOn(pg, 1.45f, 0.14f, 1.45f, 0, 0.16f, 0, grey);
            float y = 0.3f;
            for (int k = 0; k < 7; k++)
            {
                float s = 1 - k * 0.075f, bw = 1.0f * s, bh = 0.5f * s;
                MeshKit.BoxOn(pg, bw, bh, bw, 0, y, 0, k % 2 == 1 ? lattice : wall);
                for (int sx = -1; sx <= 1; sx += 2) for (int sz = -1; sz <= 1; sz += 2) MeshKit.Cylinder(pg, 0.035f, bh, new Vector3(sx * bw * 0.52f, y, sz * bw * 0.52f), red);
                Buildings.RoofCN(pg, bw + 0.06f, bw + 0.06f, 0.16f * s, tile, y + bh, false);
                y += bh + 0.21f * s;
            }
            MeshKit.Cylinder(pg, 0.06f, 0.8f, new Vector3(0, y, 0), gold);
            MeshKit.Sphere(pg, 0.08f, new Vector3(0, y + 0.85f, 0), gold);
            // 城墙 + 城楼：南侧中间
            var gt = new GameObject("Gate").transform; gt.SetParent(g, false); gt.localPosition = new Vector3(-0.1f, 0, -D / 2 + 0.55f);
            float wl = 3.4f, wh = 0.62f, wd = 0.7f;
            MeshKit.BoxOn(gt, wl, wh, wd, 0, 0, 0, brick);
            for (float x = -wl / 2 + 0.1f; x <= wl / 2 - 0.05f; x += 0.24f) { MeshKit.BoxOn(gt, 0.12f, 0.12f, 0.06f, x, wh, -wd / 2 + 0.03f, brick); MeshKit.BoxOn(gt, 0.12f, 0.12f, 0.06f, x, wh, wd / 2 - 0.03f, brick); }
            MeshKit.BoxOn(gt, 0.42f, 0.42f, 0.02f, 0, 0, -wd / 2 - 0.005f, Look.Lit("#2a221c"));
            float ty = wh + 0.06f;
            MeshKit.BoxOn(gt, 1.3f, 0.42f, 0.5f, 0, ty, 0, wall);
            for (int k = 0; k < 5; k++) for (int sz = -1; sz <= 1; sz += 2) MeshKit.Cylinder(gt, 0.03f, 0.42f, new Vector3(-0.68f + k * 0.34f, ty, sz * 0.3f), red);
            Buildings.RoofCN(gt, 1.42f, 0.66f, 0.14f, tile, ty + 0.42f, false);
            MeshKit.BoxOn(gt, 1.0f, 0.32f, 0.4f, 0, ty + 0.6f, 0, lattice);
            Buildings.RoofCN(gt, 1.1f, 0.5f, 0.3f, tile, ty + 0.92f);
            // 牌坊：东侧
            var ar = new GameObject("Archway").transform; ar.SetParent(g, false); ar.localPosition = new Vector3(W / 2 - 1.6f, 0, -0.45f);
            foreach (float sx in new[] { -1.5f, -0.5f, 0.5f, 1.5f }) { MeshKit.Cylinder(ar, 0.075f, 1.3f, new Vector3(sx * 0.55f, 0, 0), red); MeshKit.BoxOn(ar, 0.24f, 0.16f, 0.24f, sx * 0.55f, 0, 0, grey); }
            MeshKit.BoxOn(ar, 1.8f, 0.12f, 0.16f, 0, 1.05f, 0, red);
            Buildings.RoofCN(ar, 0.8f, 0.22f, 0.18f, tile, 1.3f);
            // 荷花池 + 柳树（用 Kenney 的树）
            var pond = MeshKit.Cylinder(g, 1f, 0.03f, new Vector3(-0.6f, 0.02f, 0.7f), Look.Lit("#5cc3d6", 0.9f), false);
            pond.transform.localScale = new Vector3(2.5f, 0.015f, 1.3f);
            for (int k = 0; k < 5; k++) MeshKit.Cylinder(g, 0.1f, 0.01f, new Vector3(-0.6f + Range(-0.9f, 0.9f), 0.05f, 0.7f + Range(-0.4f, 0.4f)), Look.Lit("#4caf50"), false);
            Put("nature", "tree_default", new Vector3(0.95f, 0, 0.5f) + g.localPosition, size: 0.9f);
            Put("nature", "tree_default", new Vector3(-2.2f, 0, 1.0f) + g.localPosition, size: 0.9f);
            // 青瓦小院：北侧东边
            for (int k = 0; k < 2; k++)
            {
                var h = new GameObject("House").transform; h.SetParent(g, false); h.localPosition = new Vector3(W / 2 - 0.95f - k * 1.4f, 0, D / 2 - 0.7f); h.localRotation = Quaternion.Euler(0, 180, 0);
                MeshKit.BoxOn(h, 1.2f, 0.08f, 0.85f, 0, 0, 0, grey);
                MeshKit.BoxOn(h, 1.05f, 0.5f, 0.7f, 0, 0.08f, 0, wall);
                MeshKit.BoxOn(h, 0.22f, 0.34f, 0.02f, 0, 0.08f, 0.36f, red);
                Buildings.RoofCN(h, 1.05f, 0.7f, 0.3f, tile, 0.58f);
            }
            // 路边一排灯笼
            for (int k = 0; k < 4; k++) Put("fantasy-town", "lantern", new Vector3(W / 2 - 0.6f - k * 0.75f, 0, -D / 2 + 0.25f) + g.localPosition, height: 1.0f);
            foreach (var (x, z) in new[] { (-W / 2 + 0.6f, D / 2 - 0.5f), (-W / 2 + 1.5f, D / 2 - 0.45f), (-W / 2 + 2.3f, -D / 2 + 0.35f) })
                Put("nature", "tree_pineRoundB", new Vector3(x, 0, z) + g.localPosition, height: 1.1f);
        }

        // 东北金融区：证券交易所（古典柱廊）、摩天楼群、喷泉、金牛
        static void Finance(Transform g, float W, float D)
        {
            var white = Look.Lit("#f4f1ea", 0.3f); var stone = Look.Lit("#d8d2c4", 0.2f); var gold = Look.Lit("#f2c230", 0.75f, 0.8f);
            var ex = new GameObject("Exchange").transform; ex.SetParent(g, false); ex.localPosition = new Vector3(-W / 2 + 1.75f, 0, -D / 2 + 1.15f);
            MeshKit.BoxOn(ex, 2.8f, 0.12f, 1.7f, 0, 0, 0, stone);
            MeshKit.BoxOn(ex, 2.6f, 0.1f, 1.55f, 0, 0.12f, -0.04f, stone);
            for (int k = 0; k < 3; k++) MeshKit.BoxOn(ex, 1.2f, 0.07f, 0.12f, 0, k * 0.07f, -0.91f + k * 0.1f, stone);
            MeshKit.BoxOn(ex, 2.3f, 1.15f, 1.1f, 0, 0.22f, 0.15f, white);
            for (int k = 0; k < 6; k++)
            {
                MeshKit.Cylinder(ex, 0.075f, 1.05f, new Vector3(-1.05f + k * 0.42f, 0.22f, -0.6f), white);
                MeshKit.BoxOn(ex, 0.2f, 0.06f, 0.2f, -1.05f + k * 0.42f, 1.21f, -0.6f, white);
            }
            MeshKit.BoxOn(ex, 2.5f, 0.14f, 1.5f, 0, 1.27f, -0.05f, white);
            var ped = MeshKit.Cone(ex, 1.25f, 0.4f, 0.12f, new Vector3(0, 1.41f, -0.68f), white, 4);
            ped.transform.localScale = new Vector3(1.25f * Mathf.Sqrt(2f), 0.4f, 0.1f);
            MeshKit.BoxOn(ex, 0.36f, 0.6f, 0.02f, 0, 0.22f, -0.41f, Look.Lit("#5a3b1c"));
            // 楼群：北侧
            Put("commercial", "building-skyscraper-b", new Vector3(W / 2 - 1.0f, 0, D / 2 - 0.9f) + g.localPosition, size: 1.3f);
            Put("commercial", "building-skyscraper-e", new Vector3(W / 2 - 2.4f, 0, D / 2 - 0.8f) + g.localPosition, size: 1.2f);
            Put("commercial", "building-l", new Vector3(-W / 2 + 1.1f, 0, D / 2 - 0.8f) + g.localPosition, size: 1.2f);
            Put("fantasy-town", "fountain-round-detail", new Vector3(0.55f, 0, -D / 2 + 0.85f) + g.localPosition, size: 1.3f);
            // 金牛
            var bull = new GameObject("Bull").transform; bull.SetParent(g, false); bull.localPosition = new Vector3(W / 2 - 1.1f, 0, -D / 2 + 0.55f); bull.localRotation = Quaternion.Euler(0, 30, 0);
            MeshKit.BoxOn(bull, 0.7f, 0.25f, 0.5f, 0, 0, 0, stone);
            MeshKit.BoxOn(bull, 0.55f, 0.26f, 0.24f, 0, 0.42f, 0, gold);
            MeshKit.BoxOn(bull, 0.2f, 0.2f, 0.2f, 0.34f, 0.5f, 0, gold);
            foreach (var (lx, lz) in new[] { (0.2f, 0.08f), (0.2f, -0.08f), (-0.2f, 0.08f), (-0.2f, -0.08f) }) MeshKit.BoxOn(bull, 0.07f, 0.18f, 0.07f, lx, 0.25f, lz, gold);
            for (int k = 0; k < 3; k++) Put("roads", "light-square", new Vector3(-0.6f + k * 1.3f, 0, -D / 2 + 0.2f) + g.localPosition, 180, height: 0.95f);
            foreach (var x in new[] { -W / 2 + 2.6f, 0.3f }) Put("suburban", "planter", new Vector3(x, 0, D / 2 - 0.4f) + g.localPosition, size: 0.5f);
        }

        // 西南海滨：泻湖、帆船、灯塔、椰子树、沙滩伞
        static void Beach(Transform g, float W, float D)
        {
            float lw = W * 0.62f, ld = D * 0.6f;
            var lagoonPos = new Vector3(-W / 2 + lw / 2 + 0.3f, 0.03f, D / 2 - ld / 2 - 0.35f);
            var foam = MeshKit.Cylinder(g, 1f, 0.02f, lagoonPos, Look.Lit("#e9f8ff", 0.4f), false);
            foam.transform.localScale = new Vector3(lw * 1.06f, 0.01f, ld * 1.08f);
            var water = MeshKit.Cylinder(g, 1f, 0.02f, lagoonPos + Vector3.up * 0.01f, Look.Lit("#3fb6e8", 0.95f), false);
            water.transform.localScale = new Vector3(lw, 0.01f, ld);
            for (int k = 0; k < 2; k++)
            {
                var boat = Put("pirate", "boat-row-small", lagoonPos + g.localPosition + new Vector3(k == 0 ? -0.7f : 0.8f, 0, k == 0 ? 0.2f : -0.3f), Range(0, 360), size: 0.55f);
                boat.gameObject.AddComponent<Bob>().amp = 0.03f;
            }
            // 灯塔：红白相间，顶上的光束会转
            var lh = new GameObject("Lighthouse").transform; lh.SetParent(g, false); lh.localPosition = new Vector3(W / 2 - 0.85f, 0, -D / 2 + 0.9f);
            for (int k = 0; k < 5; k++) MeshKit.Cylinder(lh, 0.3f - k * 0.03f, 0.5f, new Vector3(0, 0.35f + k * 0.5f, 0), Look.Lit(k % 2 == 0 ? "#e8452c" : "#ffffff", 0.3f));
            MeshKit.Cylinder(lh, 0.42f, 0.35f, Vector3.zero, Look.Lit("#8d8a83"));
            MeshKit.Cylinder(lh, 0.34f, 0.05f, new Vector3(0, 2.8f, 0), Look.Lit("#2b3442"));
            MeshKit.Cylinder(lh, 0.13f, 0.28f, new Vector3(0, 2.86f, 0), Look.Glow(new Color(1f, 0.95f, 0.6f), 3f), false);
            MeshKit.Cone(lh, 0.2f, 0.25f, 0.2f, new Vector3(0, 3.14f, 0), Look.Lit("#e8452c"), 12);
            var beam = new GameObject("Beam").transform; beam.SetParent(lh, false); beam.localPosition = new Vector3(0, 3.0f, 0);
            var cone = MeshKit.Cone(beam, 0.35f, 2.4f, 0.35f, Vector3.zero, Look.Transparent(new Color(1f, 0.95f, 0.6f, 0.22f)), 16, false);
            cone.transform.localRotation = Quaternion.Euler(0, 0, 90);
            beam.gameObject.AddComponent<Spin>().speed = 70f;
            foreach (var (x, z, yaw) in new[] { (W / 2 - 0.75f, D / 2 - 0.85f, 20f), (W / 2 - 1.6f, D / 2 - 0.4f, 120f), (-W / 2 + 0.5f, -D / 2 + 0.5f, 200f), (W / 2 - 2.2f, -D / 2 + 0.45f, 300f) })
                Put("pirate", "palm-detailed-bend", new Vector3(x, 0, z) + g.localPosition, yaw, height: 1.6f);
            foreach (var (x, z) in new[] { (W / 2 - 1.9f, D / 2 - 1.7f), (-W / 2 + 1.4f, -D / 2 + 0.6f), (0.4f, -D / 2 + 0.6f) })
                Put("commercial", Range(0, 1) < 0.5f ? "detail-parasol-a" : "detail-parasol-b", new Vector3(x, 0, z) + g.localPosition, size: 0.6f);
        }

        // 东南游乐园：城堡、摩天轮、旋转木马、马戏帐篷、小吃摊、气球
        static void FunPark(Transform g, float W, float D)
        {
            // 城堡（北侧中间）
            var castle = new GameObject("Castle").transform; castle.SetParent(g, false); castle.localPosition = new Vector3(0.2f, 0, D / 2 - 1.1f);
            float CastleTower(Vector3 at, float w, params string[] parts)
            {
                float y = 0;
                foreach (var part in parts) { var t = Kenney.Spawn("castle", part, castle, size: w); t.localPosition = at + Vector3.up * y; y += Kenney.Height(t); }
                return y;
            }
            CastleTower(new Vector3(-0.9f, 0, 0), 0.7f, "tower-hexagon-base", "tower-hexagon-mid", "tower-hexagon-roof");
            CastleTower(new Vector3(0.9f, 0, 0), 0.7f, "tower-hexagon-base", "tower-hexagon-mid", "tower-hexagon-roof");
            CastleTower(new Vector3(0, 0, 0.2f), 1.1f, "tower-square-base-color", "tower-square-mid-windows", "tower-square-mid-windows", "tower-square-top-roof-high-windows");
            // 摩天轮：南侧东边，轮子绕 x 轴转、座舱始终朝下
            var fw = new GameObject("FerrisWheel").transform; fw.SetParent(g, false); fw.localPosition = new Vector3(W / 2 - 1.4f, 0, -D / 2 + 0.9f); fw.localRotation = Quaternion.Euler(0, 20, 0);
            var steel = Look.Lit("#e8ecf2", 0.5f, 0.4f);
            float RW = 1.35f, H = 1.75f;
            for (int sx = -1; sx <= 1; sx += 2) for (int sz = -1; sz <= 1; sz += 2)
                {
                    var leg = MeshKit.Box(fw, new Vector3(0.07f, Mathf.Sqrt(0.75f * 0.75f + H * H), 0.07f), new Vector3(sx * 0.375f, H / 2, sz * 0.28f), steel);
                    leg.transform.localRotation = Quaternion.Euler(0, 0, -sx * Mathf.Atan2(0.75f, H) * Mathf.Rad2Deg);
                }
            var wheel = new GameObject("Wheel").transform; wheel.SetParent(fw, false); wheel.localPosition = new Vector3(0, H, 0);
            var ringMat = Look.Lit("#f03e3e", 0.4f, 0.3f);
            for (int k = 0; k < 24; k++)
            {
                float a = k / 24f * Mathf.PI * 2f, b2 = (k + 1) / 24f * Mathf.PI * 2f;
                foreach (float sz in new[] { -0.14f, 0.14f })
                {
                    var p1 = new Vector3(Mathf.Cos(a) * RW, Mathf.Sin(a) * RW, sz); var p2 = new Vector3(Mathf.Cos(b2) * RW, Mathf.Sin(b2) * RW, sz);
                    var seg = MeshKit.Box(wheel, new Vector3(0.06f, (p2 - p1).magnitude + 0.02f, 0.06f), (p1 + p2) / 2f, ringMat);
                    seg.transform.localRotation = Quaternion.FromToRotation(Vector3.up, p2 - p1);
                }
            }
            var colors = new[] { "#ff6b6b", "#ffd34d", "#4dabf7", "#51cf66", "#cc5de8", "#ff922b", "#22b8cf", "#f06595" };
            var cars = new List<Transform>();
            for (int k = 0; k < 8; k++)
            {
                float a = k / 8f * Mathf.PI * 2f;
                var spoke = MeshKit.Box(wheel, new Vector3(0.03f, RW, 0.03f), new Vector3(Mathf.Cos(a) * RW / 2, Mathf.Sin(a) * RW / 2, 0), steel, false);
                spoke.transform.localRotation = Quaternion.Euler(0, 0, a * Mathf.Rad2Deg - 90f);
                var car = new GameObject("Car").transform; car.SetParent(wheel, false); car.localPosition = new Vector3(Mathf.Cos(a) * RW, Mathf.Sin(a) * RW, 0);
                MeshKit.Box(car, new Vector3(0.26f, 0.22f, 0.24f), new Vector3(0, -0.2f, 0), Look.Lit(colors[k], 0.4f));
                MeshKit.Box(car, new Vector3(0.3f, 0.04f, 0.28f), new Vector3(0, -0.07f, 0), Look.Lit("#ffffff"));
                cars.Add(car);
            }
            wheel.gameObject.AddComponent<FerrisSpin>().cars = cars.ToArray();
            // 旋转木马：南侧西边
            var cr = new GameObject("Carousel").transform; cr.SetParent(g, false); cr.localPosition = new Vector3(-W / 2 + 1.25f, 0, -D / 2 + 1.1f);
            MeshKit.Cylinder(cr, 1.0f, 0.16f, Vector3.zero, Look.Lit("#ffe8a3", 0.3f));
            MeshKit.Cylinder(cr, 0.08f, 1.2f, new Vector3(0, 0.16f, 0), Look.Lit("#ffd34d", 0.5f));
            MeshKit.Cone(cr, 1.08f, 0.55f, 1.08f, new Vector3(0, 1.36f, 0), Look.Lit("#ff6b6b", 0.4f), 16);
            MeshKit.Cylinder(cr, 1.06f, 0.14f, new Vector3(0, 1.22f, 0), Look.Lit("#ff7aa8", 0.4f));
            var spin = new GameObject("Spin").transform; spin.SetParent(cr, false);
            for (int k = 0; k < 6; k++)
            {
                float a = k / 6f * Mathf.PI * 2f;
                var h = new GameObject("Horse").transform; h.SetParent(spin, false); h.localPosition = new Vector3(Mathf.Cos(a) * 0.68f, 0.45f, Mathf.Sin(a) * 0.68f); h.localRotation = Quaternion.Euler(0, -a * Mathf.Rad2Deg, 0);
                var hm = Look.Lit(colors[k], 0.4f);
                MeshKit.Box(h, new Vector3(0.08f, 0.14f, 0.32f), Vector3.zero, hm);
                MeshKit.Box(h, new Vector3(0.07f, 0.16f, 0.08f), new Vector3(0, 0.12f, 0.17f), hm);
                MeshKit.Box(spin, new Vector3(0.015f, 1.1f, 0.015f), new Vector3(Mathf.Cos(a) * 0.68f, 0.71f, Mathf.Sin(a) * 0.68f), steel, false);
                h.gameObject.AddComponent<Bob>().amp = 0.08f;
            }
            spin.gameObject.AddComponent<Spin>().speed = 40f;
            // 马戏帐篷、小吃摊、气球
            var tent = new GameObject("Tent").transform; tent.SetParent(g, false); tent.localPosition = new Vector3(-W / 2 + 1.0f, 0, D / 2 - 0.9f);
            MeshKit.Cylinder(tent, 0.75f, 0.55f, Vector3.zero, Look.Lit("#4dabf7", 0.3f));
            MeshKit.Cone(tent, 0.85f, 0.75f, 0.85f, new Vector3(0, 0.55f, 0), Look.Lit("#ffffff", 0.3f), 12);
            MeshKit.BoxOn(tent, 0.3f, 0.4f, 0.02f, 0, 0, -0.75f, Look.Lit("#3b2614"));
            Put("fantasy-town", "stall-red", new Vector3(W / 2 - 0.6f, 0, D / 2 - 0.7f) + g.localPosition, 180, size: 0.8f);
            Put("fantasy-town", "stall-green", new Vector3(-0.9f, 0, -D / 2 + 0.6f) + g.localPosition, 0, size: 0.8f);
            var bal = new GameObject("Balloons").transform; bal.SetParent(g, false); bal.localPosition = new Vector3(0.6f, 0, -0.4f);
            for (int k = 0; k < 7; k++)
            {
                float a = k / 7f * Mathf.PI * 2f;
                var ball = MeshKit.Sphere(bal, 0.13f, new Vector3(Mathf.Cos(a) * 0.22f, 1.25f + (k % 3) * 0.16f, Mathf.Sin(a) * 0.22f), Look.Lit(colors[k], 0.5f));
                ball.transform.localScale = new Vector3(0.26f, 0.3f, 0.26f);
                ball.AddComponent<Bob>().amp = 0.05f;
            }
            MeshKit.BoxOn(bal, 0.35f, 0.4f, 0.3f, 0, 0, 0, Look.Lit("#ffe8a3"));
        }

        // 空地上的小摆设：看一眼就知道是哪个片区
        public static void EmptyLotDecor(Transform holder, string style)
        {
            var at = new Vector3(-0.45f, 0, -0.45f);
            switch (style)
            {
                case "old": { var t = Kenney.Spawn("fantasy-town", "lantern", holder, height: 0.55f); t.localPosition = at; break; }
                case "cbd": { var t = Kenney.Spawn("suburban", "planter", holder, size: 0.42f); t.localPosition = at; break; }
                case "beach": { var t = Kenney.Spawn("commercial", "detail-parasol-a", holder, size: 0.45f); t.localPosition = at; break; }
                default: { var t = Kenney.Spawn("holiday", "present-a-cube", holder, size: 0.3f); t.localPosition = at; break; }
            }
        }

        // ---------- 郊区 ----------
        static void Suburbs(BoardView b, RingRoad ring)
        {
            var L = b.L;
            float IW = b.IsleW, ID = b.IsleD;
            float inW = L.HalfW + BoardLayout.U * 1.6f + 0.4f, inD = L.HalfD + BoardLayout.U * 1.6f + 0.4f;
            float outW = IW - RingRoad.Inset - 0.9f, outD = ID - RingRoad.Inset - 0.9f;
            float midN = (inD + outD) / 2f, midE = (inW + outW) / 2f;

            // 西北：稻田 + 农家 + 风车 + 小山（北边是 +z）
            {
                var crops = new[] { "crops_cornStageD", "crops_wheatStageB", "crops_leafsStageB", "crops_cornStageC" };
                for (float x = -inW + 0.3f; x < -6f; x += 1.1f)
                    for (float z = inD + 0.3f; z < outD - 0.3f; z += 1.1f)
                    {
                        if (x < -inW + 3.5f && z > outD - 3f) continue; // 西北角留给小山
                        MeshKit.BoxOn(root, 1.0f, 0.06f, 1.0f, x + 0.5f, 0, z + 0.5f, Look.Lit("#9c7a52", 0.05f), false);
                        var model = crops[(int)((x + z) * 7) & 3];
                        for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) Put("nature", model, new Vector3(x + 0.2f + i * 0.3f, 0.06f, z + 0.2f + j * 0.3f), Range(0, 360), size: 0.28f);
                    }
                Reserve(-inW, inD, -6f, outD);
                foreach (var (x, z) in new[] { (-4.6f, midN + 0.5f), (-3.0f, midN - 0.6f) })
                {
                    var h = Group("Farmhouse", new Vector3(x, 0, z), 180);
                    MeshKit.BoxOn(h, 1.0f, 0.45f, 0.62f, 0, 0, 0, Look.Lit("#f3ece0", 0.2f));
                    MeshKit.BoxOn(h, 0.2f, 0.3f, 0.02f, 0, 0, 0.32f, Look.Lit("#b8382a"));
                    Buildings.RoofCN(h, 1.0f, 0.62f, 0.26f, Look.Lit("#3e4b5e", 0.45f), 0.45f);
                    Put("survival", "barrel", new Vector3(x + 0.7f, 0, z + 0.4f), size: 0.2f);
                }
                Put("industrial", "windmill", new Vector3(-1.2f, 0, midN), 30, height: 2.4f);
                Reserve(-5.5f, inD, 0f, outD);
                // 小山：用岩石和松树堆出来，山顶一座亭子
                var hill = Group("Hill", new Vector3(-outW + 2.2f, 0, outD - 2.0f));
                var hm = MeshKit.Sphere(hill, 2.2f, Vector3.zero, Look.Lit("#6fae5a", 0.05f));
                hm.transform.localScale = new Vector3(4.4f, 2.6f, 3.8f);
                for (int k = 0; k < 6; k++) Put("nature", "tree_pineRoundC", hill.position + new Vector3(Mathf.Cos(k * 1.1f) * 1.4f, 0.6f, Mathf.Sin(k * 1.1f) * 1.2f), size: 0.7f);
                Put("nature", "rock_largeA", hill.position + new Vector3(1.3f, 0, -0.8f), size: 1.2f);
                var pav = Group("Pavilion", hill.position + new Vector3(0, 1.25f, 0));
                for (int sx = -1; sx <= 1; sx += 2) for (int sz = -1; sz <= 1; sz += 2) MeshKit.Cylinder(pav, 0.03f, 0.4f, new Vector3(sx * 0.22f, 0, sz * 0.22f), Look.Lit("#b8382a"));
                Buildings.RoofCN(pav, 0.5f, 0.5f, 0.3f, Look.Lit("#3e4b5e", 0.45f), 0.4f);
                Reserve(-outW, outD - 4.2f, -outW + 4.6f, outD);
            }

            // 东北：住宅区（Kenney 郊区小楼 + 栅栏 + 车道 + 树）
            {
                var houses = new[] { "building-type-a", "building-type-c", "building-type-e", "building-type-j", "building-type-o", "building-type-r", "building-type-s", "building-type-u" };
                int k = 0;
                for (float x = 2.5f; x < outW - 1f; x += 2.0f)
                    for (int row = 0; row < 2; row++)
                    {
                        float z = row == 0 ? inD + 1.0f : outD - 1.0f;
                        float yaw = row == 0 ? 180f : 0f; // 第一排面朝南（棋盘），第二排面朝北（环岛路）
                        var lot = Group("Home", new Vector3(x, 0, z), yaw);
                        MeshKit.BoxOn(lot, 1.9f, 0.03f, 1.7f, 0, 0, 0, Look.Lit("#9ad97a", 0.05f), false);
                        var h = Kenney.Spawn("suburban", houses[k++ % houses.Length], lot, size: 1.3f); h.localPosition = new Vector3(-0.15f, 0.03f, -0.15f);
                        var d = Kenney.Spawn("suburban", "driveway-long", lot, size: 0.7f); d.localPosition = new Vector3(0.6f, 0.03f, 0.55f);
                        var f = Kenney.Spawn("suburban", "fence-1x4", lot, size: 1.5f); f.localPosition = new Vector3(-0.2f, 0.03f, 0.8f);
                        var t = Kenney.Spawn("suburban", "tree-large", lot, height: 0.9f); t.localPosition = new Vector3(0.75f, 0.03f, -0.6f);
                        if (k % 2 == 0) { var c = Kenney.Spawn("car", k % 4 == 0 ? "suv" : "sedan", lot, size: 0.55f); c.localPosition = new Vector3(0.6f, 0.03f, 0.45f); }
                    }
                Reserve(1.5f, inD, outW, outD);
                // 东边北段：体育场
                var st = Group("Stadium", new Vector3(midE, 0, 5f));
                var seatA = Look.Lit("#1c7ed6", 0.3f); var seatB = Look.Lit("#e9ecef", 0.3f);
                for (int i = 0; i < 4; i++)
                {
                    var tier = MeshKit.Cylinder(st, 1f, 0.22f, new Vector3(0, i * 0.22f, 0), i % 2 == 0 ? seatA : seatB);
                    tier.transform.localScale = new Vector3(2 * (1.55f + i * 0.1f), 0.11f, 2 * (1.55f + i * 0.1f) * 1.42f);
                }
                var pitch = MeshKit.Box(st, new Vector3(1.9f, 0.02f, 3.0f), new Vector3(0, 0.9f, 0), Look.Lit("#4caf50", 0.1f));
                MeshKit.Box(st, new Vector3(0.05f, 0.025f, 3.0f * 0.9f), new Vector3(0, 0.915f, 0), Look.Lit("#ffffff"));
                pitch.name = "Pitch";
                foreach (var (x, z) in new[] { (-1.5f, -1.9f), (1.5f, -1.9f), (-1.5f, 1.9f), (1.5f, 1.9f) })
                {
                    MeshKit.Cylinder(st, 0.04f, 1.9f, new Vector3(x, 0, z), Look.Lit("#adb5bd", 0.5f, 0.5f));
                    MeshKit.Box(st, new Vector3(0.36f, 0.2f, 0.05f), new Vector3(x, 1.95f, z), Look.Glow(new Color(1f, 0.97f, 0.85f), 1.6f));
                }
                Reserve(midE - 2.0f, 2.2f, midE + 2.0f, 7.8f);
            }

            // 西边：渔村 + 港口（集装箱、油罐、仓库）+ 海里的码头和船
            {
                float mw = -(inW + outW) / 2f;
                var homes = new[] { "building-type-h", "building-type-g", "building-type-p", "building-type-i" };
                for (int k = 0; k < 4; k++)
                {
                    float z = -0.5f - k * 1.9f;
                    var h = Put("suburban", homes[k], new Vector3(mw + 0.6f, 0, z), 90, size: 1.2f);
                    Put("pirate", "palm-straight", new Vector3(mw - 1.0f, 0, z - 0.8f), Range(0, 360), height: 1.5f);
                }
                Reserve(mw - 2f, -7.8f, mw + 2f, 0.6f);
                // 港口平台（在海里）
                var port = Group("Port", new Vector3(-IW - 2.2f, 0, -3.5f));
                MeshKit.BoxOn(port, 4.0f, 0.3f, 10f, 0, -0.55f, 0, Look.Lit("#cfcac0", 0.1f));
                for (int i = 0; i < 4; i++) for (int j = 0; j < 6; j++) for (int h = 0; h < 1 + ((i * 7 + j * 3) % 3); h++)
                            Put("industrial", "shipping-container-" + "abc"[(i + j + h) % 3], port.position + new Vector3(-0.9f + i * 0.5f, -0.25f + h * 0.36f, -2.5f + j * 0.9f), 0, size: 0.85f);
                Put("industrial", "detail-tank-large", port.position + new Vector3(0.6f, -0.25f, 3.3f), 0, size: 1.6f);
                Put("industrial", "building-a", port.position + new Vector3(0.5f, -0.25f, 1.5f), 90, size: 1.9f);
                Put("industrial", "water-tower", port.position + new Vector3(1.3f, -0.25f, -4.3f), 0, height: 1.8f);
                MeshKit.BoxOn(root, 2.4f, 0.08f, 1.0f, -IW + 0.4f, -0.33f, -3.5f, Look.Lit("#cfcac0", 0.1f));
                var ship = Put("pirate", "ship-large", new Vector3(-IW - 5.4f, -0.8f, -3.0f), 0, size: 5.5f);
                ship.gameObject.AddComponent<Bob>().amp = 0.04f;
                var sailing = Put("pirate", "ship-medium", Vector3.zero, 0, size: 4.5f);
                sailing.gameObject.AddComponent<SeaLoop>().Setup(IW + 9f, ID + 10f, -0.8f);
            }

            // 东边南段：露营地 + 热气球；海上的风车
            {
                var camp = Group("Camp", new Vector3(midE, 0, -4.3f));
                MeshKit.BoxOn(camp, 3.6f, 0.025f, 3.6f, 0, 0, 0, Look.Lit("#a3dc7f", 0.05f), false);
                foreach (var (x, z) in new[] { (-1.1f, 1.0f), (-1.1f, -0.9f), (0.8f, 1.0f), (0.8f, -0.9f) }) Put("survival", "tent", camp.position + new Vector3(x, 0, z), Range(0, 360), size: 0.75f);
                Put("survival", "campfire-pit", camp.position + new Vector3(-0.2f, 0, 0.1f), 0, size: 0.4f);
                Put("car", "van", camp.position + new Vector3(1.2f, 0, -1.5f), 90, size: 0.9f);
                for (int s = 0; s < 4; s++)
                {
                    var f = Kenney.Spawn("nature", "fence_simple", root, size: 0.9f);
                    f.localPosition = camp.position + new Vector3(-1.8f + s * 0.9f + 0.45f, 0, 1.8f);
                }
                Reserve(midE - 1.9f, -6.2f, midE + 1.9f, -2.4f);
                var colors = new[] { ("#ff6b6b", "#ffd34d"), ("#4dabf7", "#ffffff"), ("#51cf66", "#ff922b") };
                for (int k = 0; k < 3; k++)
                {
                    var bl = Group("Balloon", new Vector3(midE - 1f + k * 1.1f, 4.4f + k * 1.1f, -3f + k * 1.1f));
                    var env = MeshKit.Sphere(bl, 0.55f, new Vector3(0, 0.75f, 0), Look.Lit(colors[k].Item1, 0.4f));
                    env.transform.localScale = new Vector3(1.1f, 1.25f, 1.1f);
                    var band = MeshKit.Cylinder(bl, 0.57f, 0.2f, new Vector3(0, 0.62f, 0), Look.Lit(colors[k].Item2, 0.4f));
                    MeshKit.Cone(bl, 0.32f, 0.45f, 0.32f, new Vector3(0, 0.2f, 0), Look.Lit(colors[k].Item1, 0.4f), 12).transform.localRotation = Quaternion.Euler(180, 0, 0);
                    MeshKit.BoxOn(bl, 0.22f, 0.16f, 0.22f, 0, -0.62f, 0, Look.Lit("#8a5a2b"));
                    bl.gameObject.AddComponent<Bob>().amp = 0.5f;
                    bl.GetComponent<Bob>().speed = 0.4f;
                }
                foreach (var (x, z) in new[] { (IW + 5f, 9f), (IW + 7f, 1f), (IW + 5f, -7f) })
                {
                    var t = Group("Turbine", new Vector3(x, -0.8f, z), -90);
                    MeshKit.Cylinder(t, 0.3f, 0.5f, Vector3.zero, Look.Lit("#cfcac0"));
                    MeshKit.Cylinder(t, 0.08f, 4.6f, new Vector3(0, 0.5f, 0), Look.Lit("#ffffff", 0.4f));
                    MeshKit.Box(t, new Vector3(0.2f, 0.18f, 0.45f), new Vector3(0, 5.15f, -0.05f), Look.Lit("#ffffff", 0.4f));
                    var rotor = new GameObject("Rotor").transform; rotor.SetParent(t, false); rotor.localPosition = new Vector3(0, 5.15f, 0.22f);
                    for (int k = 0; k < 3; k++)
                    {
                        var arm = new GameObject("Arm").transform; arm.SetParent(rotor, false); arm.localRotation = Quaternion.Euler(0, 0, k * 120f);
                        MeshKit.Box(arm, new Vector3(0.1f, 1.6f, 0.03f), new Vector3(0, 0.8f, 0), Look.Lit("#ffffff", 0.4f));
                    }
                    rotor.gameObject.AddComponent<Spin>().axis = Vector3.forward;
                    rotor.GetComponent<Spin>().speed = 70f + x * 2f;
                }
            }

            // 南边（镜头这一侧）：全是矮的——沙滩、欢迎花坛、停车场、游艇码头
            {
                float z = -(inD + outD) / 2f;
                var sand = MeshKit.BoxOn(root, 7f, 0.04f, outD - inD - 0.2f, -9.6f, 0, z, Look.Lit("#f1dca6", 0.05f), false);
                foreach (var (x, c) in new[] { (-11.5f, "a"), (-10.5f, "b"), (-9.5f, "a"), (-8.5f, "b") })
                {
                    Put("commercial", "detail-parasol-" + c, new Vector3(x, 0.04f, z + 0.4f), 0, size: 0.7f);
                }
                Put("pirate", "palm-bend", new Vector3(-13.4f, 0, z - 0.6f), 40, height: 1.6f);
                Put("pirate", "palm-straight", new Vector3(-6.4f, 0, z + 0.9f), 0, height: 1.5f);
                Reserve(-13.1f, z - 2f, -6.1f, z + 2f);
                // 欢迎花坛
                var w = Group("Welcome", new Vector3(0, 0, z));
                MeshKit.Cylinder(w, 1.3f, 0.08f, Vector3.zero, Look.Lit("#ffffff", 0.3f));
                var flowers = new[] { "flower_redA", "flower_yellowA", "flower_purpleA" };
                for (int r = 0; r < 3; r++)
                {
                    float rr = 1.1f - r * 0.3f; int cnt = Mathf.RoundToInt(rr * 14);
                    for (int k = 0; k < cnt; k++)
                    {
                        float a = k / (float)cnt * Mathf.PI * 2f;
                        Put("nature", flowers[r], new Vector3(Mathf.Cos(a) * rr, 0.08f, z + Mathf.Sin(a) * rr * 0.8f), Range(0, 360), size: 0.22f);
                    }
                }
                Put("fantasy-town", "fountain-round", new Vector3(0, 0.08f, z), 0, size: 0.7f);
                var sign = Group("Sign", new Vector3(0, 0, z + 1.45f));
                MeshKit.BoxOn(sign, 3.2f, 0.75f, 0.08f, 0, 0.3f, 0, Look.Lit("#ff6b6b", 0.3f));
                MeshKit.BoxOn(sign, 0.14f, 0.32f, 0.14f, -1.45f, 0, 0, Look.Lit("#b5b0a5"));
                MeshKit.BoxOn(sign, 0.14f, 0.32f, 0.14f, 1.45f, 0, 0, Look.Lit("#b5b0a5"));
                var txt = Marker.Text(sign, App.I.Font, "欢迎来到 欢乐城", 4.2f, Color.white, new Vector3(0, 0.68f, -0.05f), false);
                txt.rectTransform.sizeDelta = new Vector2(3f, 0.7f);
                Reserve(-1.7f, z - 1.4f, 1.7f, z + 1.6f);
                // 停车场
                var lotP = Group("Parking", new Vector3(4.6f, 0, z));
                MeshKit.BoxOn(lotP, 3.0f, 0.035f, 2.4f, 0, 0, 0, Look.Lit("#4d5866", 0.15f), false);
                for (int k = 0; k <= 5; k++) for (int s = -1; s <= 1; s += 2) MeshKit.BoxOn(lotP, 0.03f, 0.01f, 0.7f, -1.25f + k * 0.5f, 0.035f, s * 0.75f, Look.Lit("#ffffff"), false);
                var parked = new[] { ("sedan", -1.0f, -1), ("taxi", -0.5f, -1), ("suv", 0.5f, -1), ("police", 0f, 1), ("van", 1.0f, 1) };
                foreach (var (m, x, s) in parked) Put("car", m, lotP.position + new Vector3(x, 0.035f, s * 0.75f), s < 0 ? 0 : 180, size: 0.55f);
                Reserve(3.0f, z - 1.3f, 6.2f, z + 1.3f);
                // 游艇码头（海里）
                MeshKit.BoxOn(root, 0.45f, 0.06f, 3.4f, -9f, -0.62f, -ID - 1.8f, Look.Lit("#b98a55", 0.1f));
                for (int k = 0; k < 4; k++)
                {
                    var boat = Put("pirate", "boat-row-large", new Vector3(-9f + (k % 2 == 0 ? -1.1f : 1.1f), -0.75f, -ID - 0.9f - (k / 2) * 1.3f), 90, size: 0.9f);
                    boat.gameObject.AddComponent<Bob>().amp = 0.03f;
                }
            }
        }

        // ---------- 树：按片区风格，避开已经占用的地方 ----------
        static void Trees(BoardView b, RingRoad ring)
        {
            var L = b.L;
            for (int z = -6; z < L.C.mapH + 6; z++)
                for (int x = -6; x < L.C.mapW + 6; x++)
                {
                    var c = new Vector2Int(x, z);
                    if (L.IsRoad(c) || L.IsLot(c) || L.InBlock(c)) continue;
                    var p = L.World(x, z);
                    bool inside = x >= 0 && x < L.C.mapW && z >= 0 && z < L.C.mapH;
                    if (Mathf.Abs(p.x) > b.IsleW - 1f || Mathf.Abs(p.z) > b.IsleD - 1f || Blocked(p.x, p.z) || ring.Near(p.x, p.z, 0.9f)) continue;
                    // 棋盘以内、紧挨着路的地方只种矮灌木和花
                    bool nearRoad = L.IsRoad(c + Vector2Int.right) || L.IsRoad(c + Vector2Int.left) || L.IsRoad(c + Vector2Int.up) || L.IsRoad(c + Vector2Int.down);
                    if (inside || nearRoad)
                    {
                        if (R() < 0.5f) Put("nature", R() < 0.5f ? "plant_bush" : "plant_bushSmall", p + new Vector3(Range(-0.5f, 0.5f), 0, Range(-0.5f, 0.5f)), Range(0, 360), size: 0.45f);
                        if (R() < 0.3f) Put("nature", new[] { "flower_redA", "flower_yellowB", "flower_purpleC" }[rng.Next(3)], p + new Vector3(Range(-0.5f, 0.5f), 0, Range(-0.5f, 0.5f)), 0, size: 0.3f);
                        continue;
                    }
                    // 镜头一侧（南边）只种花和矮树
                    if (z >= L.C.mapH) { if (R() < 0.35f) Put("nature", "flower_redB", p, 0, size: 0.3f); continue; }
                    int n = R() < 0.7f ? 2 : 1;
                    for (int k = 0; k < n; k++)
                    {
                        var q = p + new Vector3(Range(-0.8f, 0.8f), 0, Range(-0.8f, 0.8f));
                        if (Blocked(q.x, q.z, 0.2f) || ring.Near(q.x, q.z, 0.7f)) continue;
                        Tree(L.StyleAt(q), q, Range(0.8f, 1.3f));
                    }
                }
        }

        static void Tree(string style, Vector3 p, float s)
        {
            string model = style switch
            {
                "old" => new[] { "tree_pineRoundA", "tree_pineRoundD", "tree_pineTallA", "tree_cone" }[rng.Next(4)],
                "beach" => new[] { "tree_palmTall", "tree_palmDetailedShort", "tree_palmBend" }[rng.Next(3)],
                "fun" => new[] { "tree_oak", "tree_fat", "tree_default", "tree_blocks" }[rng.Next(4)],
                _ => new[] { "tree_default", "tree_detailed", "tree_oak", "tree_simple" }[rng.Next(4)],
            };
            Put("nature", model, p, Range(0, 360), height: 1.4f * s);
        }

        // 远处海面上的几座小岛
        static void Islands()
        {
            for (int k = 0; k < 9; k++)
            {
                float ang = k / 9f * Mathf.PI * 2f + Range(0, 0.4f), r = 70f + Range(0, 30f);
                var p = new Vector3(Mathf.Cos(ang) * r * 1.3f, -0.8f, Mathf.Sin(ang) * r);
                float s = Range(3f, 7f);
                var isle = MeshKit.Sphere(root, 1f, p, Look.Lit("#8ccf68", 0.05f), false);
                isle.transform.localScale = new Vector3(s * 2.2f, s * Range(0.5f, 1f), s * 2.2f);
                var beach = MeshKit.Cylinder(root, s * 1.2f, 0.4f, p + Vector3.down * 0.2f, Look.Lit("#f1dca6"), false);
                for (int t = 0; t < 3; t++) Put("nature", "tree_palmTall", p + new Vector3(Range(-s, s) * 0.5f, s * 0.35f, Range(-s, s) * 0.5f), Range(0, 360), height: 2.5f);
            }
        }
    }

    // 摩天轮：轮子转，座舱始终朝下
    public class FerrisSpin : MonoBehaviour
    {
        public Transform[] cars;
        void Update()
        {
            transform.Rotate(0, 0, 15f * Time.deltaTime, Space.Self);
            foreach (var c in cars) c.rotation = Quaternion.LookRotation(transform.parent.forward, Vector3.up);
        }
    }

    // 绕岛航行的船
    public class SeaLoop : MonoBehaviour
    {
        float rx, rz, y, t;
        public void Setup(float rx, float rz, float y) { this.rx = rx; this.rz = rz; this.y = y; t = Random.value * 6f; }
        void Update()
        {
            t += Time.deltaTime * 0.025f;
            var p = new Vector3(Mathf.Cos(t) * rx, y + Mathf.Sin(Time.time * 1.3f) * 0.03f, Mathf.Sin(t) * rz);
            var next = new Vector3(Mathf.Cos(t + 0.01f) * rx, y, Mathf.Sin(t + 0.01f) * rz);
            transform.position = p;
            transform.rotation = Quaternion.LookRotation(next - p) * Quaternion.Euler(0, 0, Mathf.Sin(Time.time) * 2f);
        }
    }
}
