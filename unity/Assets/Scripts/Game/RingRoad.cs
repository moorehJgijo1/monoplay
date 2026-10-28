// 环岛路：沿着岛边一圈的双车道公路（路沿、白边线、黄色虚线、路灯、斑马线），Kenney 的小车在上面来回跑。
using System.Collections.Generic;
using UnityEngine;

namespace Monoplay
{
    public class RingRoad : MonoBehaviour
    {
        public const float Inset = 1.4f, Radius = 3.8f, Width = 0.95f;
        float rw, rd;
        readonly List<Vector3> pts = new();
        float length;
        readonly List<float> cum = new();

        public static RingRoad Build(Transform parent, float IW, float ID)
        {
            var go = new GameObject("RingRoad");
            go.transform.SetParent(parent, false);
            var r = go.AddComponent<RingRoad>();
            r.rw = IW - Inset; r.rd = ID - Inset;
            r.MakePath();
            r.MakeMeshes();
            r.MakeCars();
            return r;
        }

        void MakePath()
        {
            // 圆角矩形一圈，逆时针，按弧长均匀取点
            var raw = new List<Vector3>();
            void Arc(float cx, float cz, float a0)
            {
                for (int k = 0; k <= 16; k++) { float a = a0 + k / 16f * Mathf.PI / 2f; raw.Add(new Vector3(cx + Mathf.Cos(a) * Radius, 0, cz + Mathf.Sin(a) * Radius)); }
            }
            Arc(rw - Radius, -rd + Radius, -Mathf.PI / 2f);
            Arc(rw - Radius, rd - Radius, 0);
            Arc(-rw + Radius, rd - Radius, Mathf.PI / 2f);
            Arc(-rw + Radius, -rd + Radius, Mathf.PI);
            float total = 0; for (int k = 0; k < raw.Count; k++) total += (raw[(k + 1) % raw.Count] - raw[k]).magnitude;
            int n = 480; float step = total / n;
            int seg = 0; float segPos = 0;
            for (int i = 0; i < n; i++)
            {
                float want = i * step;
                while (true)
                {
                    float sl = (raw[(seg + 1) % raw.Count] - raw[seg]).magnitude;
                    if (segPos + sl >= want || seg >= raw.Count - 1) { pts.Add(Vector3.Lerp(raw[seg], raw[(seg + 1) % raw.Count], sl > 0 ? (want - segPos) / sl : 0)); break; }
                    segPos += sl; seg++;
                }
            }
            length = total;
        }

        (Vector3 p, Vector3 t, Vector3 n) Frame(int i)
        {
            int c = pts.Count;
            var t = (pts[(i + 1) % c] - pts[(i + c - 1) % c]).normalized;
            return (pts[i], t, new Vector3(t.z, 0, -t.x)); // n 指向路的右侧（逆时针走时是岛外）
        }

        void Ribbon(float offset, float width, float y, Material mat, string name)
        {
            var v = new List<Vector3>(); var tri = new List<int>(); var uv = new List<Vector2>();
            int c = pts.Count;
            for (int i = 0; i < c; i++)
            {
                var (p, _, n) = Frame(i);
                v.Add(p + n * (offset - width / 2) + Vector3.up * y);
                v.Add(p + n * (offset + width / 2) + Vector3.up * y);
                uv.Add(new Vector2(0, i)); uv.Add(new Vector2(1, i));
                int a = i * 2, b = ((i + 1) % c) * 2;
                tri.Add(a); tri.Add(b); tri.Add(a + 1);
                tri.Add(a + 1); tri.Add(b); tri.Add(b + 1);
            }
            var mesh = new Mesh { name = name };
            mesh.SetVertices(v); mesh.SetUVs(0, uv); mesh.SetTriangles(tri, 0);
            mesh.RecalculateNormals();
            // 法线朝下就翻过来
            if (mesh.normals[0].y < 0) { tri.Reverse(); mesh.SetTriangles(tri, 0); mesh.RecalculateNormals(); }
            mesh.RecalculateBounds();
            var go = MeshKit.MeshObject(transform, mesh, new[] { mat }, name);
            go.GetComponent<MeshRenderer>().receiveShadows = true;
            go.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        void MakeMeshes()
        {
            Ribbon(0, Width + 0.24f, 0.02f, Look.Lit("#e4ddcf", 0.1f), "Curb");
            Ribbon(0, Width, 0.03f, Look.Lit("#4d5866", 0.15f), "Asphalt");
            Ribbon(Width / 2 - 0.05f, 0.03f, 0.035f, Look.Lit("#fff6d8", 0.2f), "EdgeR");
            Ribbon(-Width / 2 + 0.05f, 0.03f, 0.035f, Look.Lit("#fff6d8", 0.2f), "EdgeL");
            var dashes = new GameObject("Dashes").transform; dashes.SetParent(transform, false);
            var yellow = Look.Lit("#ffd43b", 0.2f);
            for (int i = 0; i < pts.Count; i += 6)
            {
                var (p, t, _) = Frame(i);
                var d = MeshKit.Box(dashes, new Vector3(0.04f, 0.01f, 0.28f), p + Vector3.up * 0.036f, yellow, false);
                d.transform.rotation = Quaternion.LookRotation(t);
            }
            MeshKit.MergeStatic(dashes);
            // 路灯：装在路的内侧（岛中心那边），灯臂伸向路面
            for (int i = 0; i < pts.Count; i += 20)
            {
                var (p, t, n) = Frame(i);
                var lamp = Kenney.Spawn("roads", "light-curved", transform, height: 0.95f);
                lamp.position = p - n * (Width / 2 + 0.25f);
                lamp.rotation = Quaternion.LookRotation(-n);
            }
            // 斑马线：四条直边的中点
            var white = Look.Lit("#ffffff", 0.2f);
            foreach (var (x, z, horiz) in new[] { (0f, -rd, true), (0f, rd, true), (-rw, 0f, false), (rw, 0f, false) })
                for (int k = -3; k <= 3; k++)
                    MeshKit.Box(transform, horiz ? new Vector3(0.08f, 0.01f, Width * 0.85f) : new Vector3(Width * 0.85f, 0.01f, 0.08f), new Vector3(x + (horiz ? k * 0.16f : 0), 0.04f, z + (horiz ? 0 : k * 0.16f)), white, false);
        }

        // 位置 u（0~1，沿路一圈）的坐标和前进方向
        public (Vector3 p, Vector3 t) At(float u)
        {
            u = Mathf.Repeat(u, 1f) * pts.Count;
            int i = Mathf.FloorToInt(u) % pts.Count, j = (i + 1) % pts.Count;
            var p = Vector3.Lerp(pts[i], pts[j], u - Mathf.Floor(u));
            return (p, (pts[j] - pts[i]).normalized);
        }

        void MakeCars()
        {
            var models = new[] { "sedan", "taxi", "suv", "van", "police", "hatchback-sports", "truck", "delivery", "sedan-sports", "suv-luxury", "garbage-truck", "ambulance" };
            for (int k = 0; k < models.Length; k++)
            {
                var car = Kenney.Spawn("car", models[k], transform, size: models[k].Contains("truck") || models[k] == "delivery" || models[k] == "ambulance" ? 0.75f : 0.6f);
                var mover = car.gameObject.AddComponent<CarMover>();
                mover.road = this;
                mover.u = k / (float)models.Length;
                mover.dir = k % 2 == 0 ? 1 : -1;
                mover.speed = (1.6f + (k * 37 % 10) * 0.08f) / length;
            }
        }

        // 某点离路面中线是否太近（种树时避开）
        public bool Near(float x, float z, float pad)
        {
            float ox = Mathf.Max(0, Mathf.Abs(x) - (rw - Radius)), oz = Mathf.Max(0, Mathf.Abs(z) - (rd - Radius));
            float d = Mathf.Abs(x) > rw - Radius && Mathf.Abs(z) > rd - Radius ? Mathf.Sqrt(ox * ox + oz * oz) - Radius : Mathf.Max(Mathf.Abs(x) - rw, Mathf.Abs(z) - rd);
            return Mathf.Abs(d) < Width / 2 + pad;
        }
    }

    public class CarMover : MonoBehaviour
    {
        public RingRoad road;
        public float u, speed;
        public int dir = 1;
        void Update()
        {
            u = Mathf.Repeat(u + dir * speed * Time.deltaTime, 1f);
            var (p, t) = road.At(u);
            t *= dir;
            // 靠右行驶
            var right = new Vector3(t.z, 0, -t.x);
            transform.position = p + right * 0.22f + Vector3.up * 0.03f;
            transform.rotation = Quaternion.LookRotation(t);
        }
    }
}
