// 地产上的楼房：按所在片区的风格分四套，0~5 级越来越高大。
//   古城 old  ：程序生成的中式楼阁（亭子 → 四合院 → 两层小楼 → 三层楼阁 → 五层宝塔 → 七层宝塔），琉璃瓦屋顶是地主颜色
//   金融区 cbd：Kenney 商业楼（小店 → 写字楼 → 摩天楼）
//   海滨 beach：Kenney 郊区住宅和酒店式公寓
//   游乐园 fun：Kenney 城堡套件拼出的童话塔楼
// Kenney 模型的贴图整体往地主颜色偏一点，再插一面地主颜色的旗子。局部坐标 +z 是正面（朝马路）。
using UnityEngine;

namespace Monoplay
{
    public static class Buildings
    {
        const float Lot = BoardLayout.U * 0.74f; // 楼房最大占地

        static readonly (string kit, string model, float size)[] Cbd =
        {
            ("commercial", "building-c", 0.95f), ("commercial", "building-a", 1.05f), ("commercial", "building-g", 1.15f),
            ("commercial", "building-l", 1.35f), ("commercial", "building-skyscraper-a", 1.4f), ("commercial", "building-skyscraper-d", 1.45f),
        };
        static readonly (string kit, string model, float size)[] Beach =
        {
            ("suburban", "building-type-h", 1.05f), ("suburban", "building-type-a", 1.3f), ("suburban", "building-type-n", 1.45f),
            ("commercial", "building-i", 1.35f), ("commercial", "building-m", 1.35f), ("commercial", "building-skyscraper-c", 1.4f),
        };

        public static Transform Make(string style, int level, Color owner)
        {
            var root = new GameObject($"Building {style} L{level}").transform;
            float top;
            switch (style)
            {
                case "old": top = Chinese(root, level, Look.Lit(owner, 0.55f)); break;
                case "fun": top = Castle(root, level, owner); break;
                default:
                    {
                        var (kit, model, size) = (style == "beach" ? Beach : Cbd)[Mathf.Clamp(level, 0, 5)];
                        var b = Kenney.Spawn(kit, model, root, size: Mathf.Min(size, Lot));
                        Kenney.Tint(b, Kenney.KitTinted(kit, owner));
                        top = Kenney.Height(b);
                        if (level == 5) Beacon(root, top);
                        break;
                    }
            }
            Flag(root, owner);
            root.gameObject.AddComponent<BuildingInfo>().top = top;
            return root;
        }

        // 摩天楼顶上一闪一闪的航空灯
        static void Beacon(Transform root, float top)
        {
            var l = MeshKit.Sphere(root, 0.07f, new Vector3(0, top + 0.08f, 0), Look.Glow(new Color(1f, 0.2f, 0.2f), 4f), false);
            l.AddComponent<Blink>();
        }

        // 地块角上插一面地主颜色的旗子
        static void Flag(Transform root, Color owner)
        {
            var pole = MeshKit.Cylinder(root, 0.025f, 0.9f, new Vector3(0.62f, 0, 0.62f), Look.Lit("#5c636a", 0.4f, 0.5f));
            pole.name = "Flag";
            var cloth = MeshKit.Box(root, new Vector3(0.42f, 0.26f, 0.025f), new Vector3(0.84f, 0.76f, 0.62f), Look.Lit(owner, 0.3f));
            cloth.AddComponent<Wave>();
        }

        // ---------- 游乐园：城堡套件 ----------
        static float Castle(Transform root, int level, Color owner)
        {
            if (level == 0)
            {
                var s = Kenney.Spawn("fantasy-town", "stall-red", root, size: 1.05f);
                Kenney.Tint(s, Kenney.KitTinted("fantasy-town", owner, 0.3f));
                return Kenney.Height(s);
            }
            var tint = Kenney.KitTinted("castle", owner, 0.3f);
            // 从下往上一节一节摞起来
            float Stack(Transform parent, Vector3 at, float width, params string[] parts)
            {
                float y = 0f;
                foreach (var part in parts)
                {
                    var t = Kenney.Spawn("castle", part, parent, size: width);
                    t.localPosition = at + Vector3.up * y;
                    Kenney.Tint(t, tint);
                    y += Kenney.Height(t);
                }
                return y;
            }
            switch (level)
            {
                case 1: return Stack(root, Vector3.zero, 1.0f, "tower-square-base-color", "tower-square-top-roof-rounded");
                case 2: return Stack(root, Vector3.zero, 1.05f, "tower-square-base", "tower-square-mid-windows", "tower-square-top-roof-high");
                case 3:
                    Stack(root, new Vector3(-0.42f, 0, 0.3f), 0.55f, "tower-hexagon-base", "tower-hexagon-roof");
                    return Stack(root, new Vector3(0.12f, 0, -0.1f), 1.0f, "tower-square-base-color", "tower-square-mid-windows", "tower-square-top-roof");
                case 4:
                    Stack(root, new Vector3(-0.48f, 0, 0.42f), 0.5f, "tower-hexagon-base", "tower-hexagon-mid", "tower-hexagon-roof");
                    Stack(root, new Vector3(0.48f, 0, 0.42f), 0.5f, "tower-hexagon-base", "tower-hexagon-mid", "tower-hexagon-roof");
                    return Stack(root, new Vector3(0, 0, -0.15f), 1.0f, "tower-square-base", "tower-square-mid-door", "tower-square-mid-windows", "tower-square-roof");
                default:
                    Stack(root, new Vector3(-0.5f, 0, 0.45f), 0.48f, "tower-hexagon-base", "tower-hexagon-mid", "tower-hexagon-mid", "tower-hexagon-roof");
                    Stack(root, new Vector3(0.5f, 0, 0.45f), 0.48f, "tower-hexagon-base", "tower-hexagon-mid", "tower-hexagon-mid", "tower-hexagon-roof");
                    float h = Stack(root, new Vector3(0, 0, -0.15f), 1.0f, "tower-square-base-color", "tower-square-mid-windows", "tower-square-mid-windows", "tower-square-mid-windows", "tower-square-top-roof-high-windows");
                    Beacon(root, h);
                    return h;
            }
        }

        // ---------- 古城：程序生成的中式楼阁 ----------
        static Material wallMat, latticeMat, pillarMat, stoneMat, goldMat;
        static void ChineseMats()
        {
            if (wallMat) return;
            wallMat = Look.Lit("#f6efe2", 0.2f);
            latticeMat = Look.Lit("#6b3a1a", 0.35f);
            pillarMat = Look.Lit("#b8382a", 0.4f);
            stoneMat = Look.Lit("#a9a39a", 0.15f);
            goldMat = Look.Lit("#e8b630", 0.6f, 0.6f);
        }

        // 中式飞檐屋顶：出檐 + 四坡顶 + 四角翘起的檐角 + 宝顶。y 是屋顶底面高度
        public static void RoofCN(Transform p, float w, float d, float h, Material mat, float y, bool finial = true)
        {
            MeshKit.BoxOn(p, w + 0.26f, 0.05f, d + 0.26f, 0, y, 0, mat);
            MeshKit.Cone(p, (w + 0.2f) / 2f, h, (d + 0.2f) / 2f, new Vector3(0, y + 0.05f, 0), mat, 4);
            for (int sx = -1; sx <= 1; sx += 2)
                for (int sz = -1; sz <= 1; sz += 2)
                {
                    var tip = MeshKit.Cone(p, 0.05f, 0.14f, 0.05f, new Vector3(sx * (w / 2 + 0.12f), y + 0.04f, sz * (d / 2 + 0.12f)), mat, 6);
                    tip.transform.localRotation = Quaternion.Euler(sz * 33f, 0, -sx * 33f);
                }
            if (finial) MeshKit.Sphere(p, 0.06f, new Vector3(0, y + 0.05f + h, 0), goldMat);
        }

        static void Pillars(Transform p, float w, float d, float y, float h)
        {
            for (int sx = -1; sx <= 1; sx += 2)
                for (int sz = -1; sz <= 1; sz += 2)
                    MeshKit.Cylinder(p, 0.035f, h, new Vector3(sx * w / 2, y, sz * d / 2), pillarMat);
        }

        static float Chinese(Transform p, int level, Material roof)
        {
            ChineseMats();
            float Base(float w, float d, float h = 0.12f) { MeshKit.BoxOn(p, w, h, d, 0, 0, 0, stoneMat); return h; }
            if (level == 0)
            {
                float y = Base(0.85f, 0.85f, 0.1f);
                Pillars(p, 0.6f, 0.6f, y, 0.5f);
                MeshKit.BoxOn(p, 0.3f, 0.12f, 0.3f, 0, y, 0, stoneMat);
                RoofCN(p, 0.62f, 0.62f, 0.32f, roof, y + 0.5f);
                return 1.0f;
            }
            if (level == 1)
            {
                float y = Base(1.3f, 1.1f);
                MeshKit.BoxOn(p, 1.1f, 0.55f, 0.75f, 0, y, -0.12f, wallMat);
                MeshKit.BoxOn(p, 0.24f, 0.38f, 0.02f, 0, y, 0.26f, pillarMat);
                MeshKit.BoxOn(p, 0.24f, 0.16f, 0.02f, -0.34f, y + 0.22f, 0.26f, latticeMat);
                MeshKit.BoxOn(p, 0.24f, 0.16f, 0.02f, 0.34f, y + 0.22f, 0.26f, latticeMat);
                RoofCN(p, 1.1f, 0.75f, 0.32f, roof, y + 0.55f);
                for (int sx = -1; sx <= 1; sx += 2) MeshKit.BoxOn(p, 0.42f, 0.22f, 0.06f, sx * 0.43f, y, 0.5f, wallMat);
                return 1.0f;
            }
            if (level == 2)
            {
                float y = Base(1.35f, 1.25f);
                MeshKit.BoxOn(p, 1.0f, 0.55f, 0.8f, 0, y, 0, wallMat);
                Pillars(p, 1.12f, 0.95f, y, 0.55f);
                MeshKit.BoxOn(p, 0.24f, 0.38f, 0.02f, 0, y, 0.41f, pillarMat);
                RoofCN(p, 1.12f, 0.95f, 0.18f, roof, y + 0.55f, false);
                MeshKit.BoxOn(p, 0.8f, 0.5f, 0.64f, 0, y + 0.72f, 0, latticeMat);
                MeshKit.BoxOn(p, 0.92f, 0.06f, 0.76f, 0, y + 0.72f, 0, pillarMat);
                RoofCN(p, 0.84f, 0.68f, 0.36f, roof, y + 1.22f);
                return y + 1.65f;
            }
            if (level == 3)
            {
                float y = Base(1.4f, 1.4f, 0.18f);
                float[,] tiers = { { 1.05f, 0.6f }, { 0.85f, 0.5f }, { 0.65f, 0.45f } };
                for (int i = 0; i < 3; i++)
                {
                    float w = tiers[i, 0], h = tiers[i, 1];
                    bool last = i == 2;
                    MeshKit.BoxOn(p, w, h, w, 0, y, 0, i == 0 ? wallMat : latticeMat);
                    Pillars(p, w + 0.08f, w + 0.08f, y, h);
                    RoofCN(p, w + 0.08f, w + 0.08f, last ? 0.38f : 0.16f, roof, y + h, last);
                    y += h + (last ? 0.45f : 0.2f);
                }
                MeshKit.BoxOn(p, 0.26f, 0.38f, 0.02f, 0, 0.18f, 0.53f, pillarMat);
                return y;
            }
            // 宝塔：大厦 5 层、摩天楼 7 层
            int n = level == 4 ? 5 : 7;
            float yy = Base(1.5f, 1.5f, 0.22f);
            MeshKit.BoxOn(p, 1.25f, 0.12f, 1.25f, 0, yy, 0, stoneMat);
            yy += 0.12f;
            for (int i = 0; i < n; i++)
            {
                float s = 1 - i * (level == 4 ? 0.1f : 0.07f), w = 1.0f * s, h = (level == 4 ? 0.52f : 0.5f) * s;
                MeshKit.BoxOn(p, w, h, w, 0, yy, 0, i % 2 == 1 ? latticeMat : wallMat);
                Pillars(p, w + 0.06f, w + 0.06f, yy, h);
                RoofCN(p, w + 0.06f, w + 0.06f, 0.16f * s, roof, yy + h, false);
                yy += h + 0.2f * s;
            }
            MeshKit.Cylinder(p, 0.05f, 0.7f, new Vector3(0, yy, 0), goldMat);
            for (int i = 0; i < 3; i++) MeshKit.Cylinder(p, 0.08f - i * 0.015f, 0.03f, new Vector3(0, yy + 0.15f + i * 0.15f, 0), goldMat);
            if (level == 5) Beacon(p, yy + 0.72f);
            else MeshKit.Sphere(p, 0.08f, new Vector3(0, yy + 0.74f, 0), goldMat);
            MeshKit.BoxOn(p, 0.26f, 0.38f, 0.02f, 0, 0.34f, 0.51f, pillarMat);
            return yy + 0.7f;
        }
    }

    public class BuildingInfo : MonoBehaviour { public float top; }

    // 一闪一闪
    public class Blink : MonoBehaviour
    {
        Renderer r;
        void Awake() => r = GetComponent<Renderer>();
        void Update() { if (r) r.enabled = Mathf.Sin(Time.time * 4f) > 0f; }
    }
    // 旗子轻轻摆动
    public class Wave : MonoBehaviour
    {
        Quaternion baseRot; float phase;
        void Awake() { baseRot = transform.localRotation; phase = Random.value * 6f; }
        void Update() => transform.localRotation = baseRot * Quaternion.Euler(0, Mathf.Sin(Time.time * 3f + phase) * 12f, 0);
    }
}
