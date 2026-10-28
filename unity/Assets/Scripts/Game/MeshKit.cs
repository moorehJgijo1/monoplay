// 程序生成的网格和几何体小工具：圆角平台、盒子、圆柱、合并静态网格。
using System.Collections.Generic;
using UnityEngine;

namespace Monoplay
{
    public static class MeshKit
    {
        // 圆角矩形的厚平台（岛屿、沙滩、地块），顶面和侧面分成两个子网格，方便用不同材质
        public static Mesh RoundedSlab(float hw, float hd, float r, float height, int seg = 10)
        {
            var outline = new List<Vector2>();
            void Corner(float cx, float cz, float a0)
            {
                for (int k = 0; k <= seg; k++)
                {
                    float a = a0 + k / (float)seg * Mathf.PI / 2f;
                    outline.Add(new Vector2(cx + Mathf.Cos(a) * r, cz + Mathf.Sin(a) * r));
                }
            }
            Corner(hw - r, hd - r, 0f);
            Corner(-hw + r, hd - r, Mathf.PI / 2f);
            Corner(-hw + r, -hd + r, Mathf.PI);
            Corner(hw - r, -hd + r, Mathf.PI * 1.5f);

            var v = new List<Vector3>(); var n = new List<Vector3>(); var uv = new List<Vector2>();
            var top = new List<int>(); var side = new List<int>();
            // 顶面：中心点 + 一圈扇形（轮廓是凸的）
            v.Add(new Vector3(0, height, 0)); n.Add(Vector3.up); uv.Add(new Vector2(0.5f, 0.5f));
            foreach (var p in outline) { v.Add(new Vector3(p.x, height, p.y)); n.Add(Vector3.up); uv.Add(new Vector2(p.x / (hw * 2) + 0.5f, p.y / (hd * 2) + 0.5f)); }
            int m = outline.Count;
            for (int k = 0; k < m; k++) { top.Add(0); top.Add(1 + (k + 1) % m); top.Add(1 + k); }
            // 侧面
            int b0 = v.Count;
            for (int k = 0; k <= m; k++)
            {
                var p = outline[k % m];
                var dir = new Vector3(p.x, 0, p.y).normalized;
                v.Add(new Vector3(p.x, height, p.y)); n.Add(dir); uv.Add(new Vector2(k / (float)m * 8f, 1));
                v.Add(new Vector3(p.x, 0, p.y)); n.Add(dir); uv.Add(new Vector2(k / (float)m * 8f, 0));
            }
            for (int k = 0; k < m; k++)
            {
                int a = b0 + k * 2;
                side.Add(a); side.Add(a + 2); side.Add(a + 1);
                side.Add(a + 1); side.Add(a + 2); side.Add(a + 3);
            }
            var mesh = new Mesh { name = "RoundedSlab" };
            mesh.SetVertices(v); mesh.SetNormals(n); mesh.SetUVs(0, uv);
            mesh.subMeshCount = 2;
            mesh.SetTriangles(top, 0);
            mesh.SetTriangles(side, 1);
            mesh.RecalculateBounds();
            return mesh;
        }

        static readonly System.Collections.Generic.Dictionary<int, Mesh> coneCache = new();
        // 圆锥 / 棱锥（seg=4 就是四棱锥，旋转 45° 后底面和坐标轴对齐），底面在 y=0，半径 1、高 1，用缩放调整大小
        public static Mesh ConeMesh(int seg)
        {
            if (coneCache.TryGetValue(seg, out var cached)) return cached;
            var v = new List<Vector3>(); var t = new List<int>();
            float a0 = seg == 4 ? Mathf.PI / 4f : 0f;
            for (int k = 0; k < seg; k++)
            {
                float a = a0 + k * Mathf.PI * 2f / seg, b = a0 + (k + 1) * Mathf.PI * 2f / seg;
                var p = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)); var q = new Vector3(Mathf.Cos(b), 0, Mathf.Sin(b));
                int i = v.Count;
                v.Add(Vector3.up); v.Add(q); v.Add(p);
                t.Add(i); t.Add(i + 1); t.Add(i + 2);
                i = v.Count;
                v.Add(Vector3.zero); v.Add(p); v.Add(q);
                t.Add(i); t.Add(i + 1); t.Add(i + 2);
            }
            var mesh = new Mesh { name = "Cone" + seg };
            mesh.SetVertices(v); mesh.SetTriangles(t, 0);
            mesh.RecalculateNormals(); mesh.RecalculateBounds();
            coneCache[seg] = mesh;
            return mesh;
        }
        // 底面中心在 basePos 的圆锥/棱锥。seg=4 时 rx、rz 是半边长
        public static GameObject Cone(Transform parent, float rx, float h, float rz, Vector3 basePos, Material mat, int seg = 16, bool shadows = true)
        {
            var go = MeshObject(parent, ConeMesh(seg), new[] { mat }, "Cone");
            float k = seg == 4 ? Mathf.Sqrt(2f) : 1f;
            go.transform.localPosition = basePos;
            go.transform.localScale = new Vector3(rx * k, h, rz * k);
            go.GetComponent<MeshRenderer>().shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        public static GameObject Box(Transform parent, Vector3 size, Vector3 pos, Material mat, bool shadows = true, string name = "Box")
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }
        // 底部放在 y 上的盒子
        public static GameObject BoxOn(Transform parent, float w, float h, float d, float x, float y, float z, Material mat, bool shadows = true)
            => Box(parent, new Vector3(w, h, d), new Vector3(x, y + h / 2f, z), mat, shadows);

        public static GameObject Cylinder(Transform parent, float radius, float h, Vector3 basePos, Material mat, bool shadows = true)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = basePos + Vector3.up * h / 2f;
            go.transform.localScale = new Vector3(radius * 2f, h / 2f, radius * 2f);
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        public static GameObject Sphere(Transform parent, float radius, Vector3 pos, Material mat, bool shadows = true)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = Vector3.one * radius * 2f;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        public static GameObject MeshObject(Transform parent, Mesh mesh, Material[] mats, string name = "Mesh")
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterials = mats;
            return go;
        }

        // 把 parent 下所有用同一材质的静态网格合并成一个，减少绘制次数（马路、人行道这类成百上千的小块）
        public static void MergeStatic(Transform parent)
        {
            var groups = new Dictionary<Material, List<CombineInstance>>();
            var toKill = new List<GameObject>();
            var inv = parent.worldToLocalMatrix;
            foreach (var mf in parent.GetComponentsInChildren<MeshFilter>())
            {
                var r = mf.GetComponent<MeshRenderer>();
                if (!r || r.sharedMaterials.Length != 1 || !mf.sharedMesh) continue;
                var mat = r.sharedMaterial;
                if (!groups.TryGetValue(mat, out var list)) groups[mat] = list = new List<CombineInstance>();
                list.Add(new CombineInstance { mesh = mf.sharedMesh, transform = inv * mf.transform.localToWorldMatrix });
                toKill.Add(mf.gameObject);
            }
            foreach (var go in toKill) { go.SetActive(false); Object.Destroy(go); }
            foreach (var kv in groups)
            {
                var mesh = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32, name = "Merged" };
                mesh.CombineMeshes(kv.Value.ToArray(), true, true);
                var go = MeshObject(parent, mesh, new[] { kv.Key }, "Merged " + kv.Key.name);
                go.GetComponent<MeshRenderer>().receiveShadows = true;
            }
        }
    }
}
