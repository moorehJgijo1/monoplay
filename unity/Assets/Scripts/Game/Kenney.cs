// Kenney 免费素材（CC0）的加载器。模型放在 Resources/Kenney/<套装>/<模型>.fbx。
// 每套素材共用一张 colormap 贴图：这里统一换成 URP 材质，再按需要的占地大小缩放、把底部放到 y=0。
using System.Collections.Generic;
using UnityEngine;

namespace Monoplay
{
    public static class Kenney
    {
        static readonly Dictionary<string, Material> kitMats = new();
        static readonly Dictionary<Material, Material> converted = new();
        static readonly Dictionary<string, GameObject> prefabs = new();

        static Material KitMaterial(string kit)
        {
            if (kitMats.TryGetValue(kit, out var m)) return m;
            var tex = Resources.Load<Texture2D>($"Kenney/{kit}/Textures/colormap");
            if (tex)
            {
                tex.filterMode = FilterMode.Bilinear;
                tex.wrapMode = TextureWrapMode.Clamp;
                m = Look.Textured(tex, kit == "car" ? 0.45f : 0.15f);
            }
            kitMats[kit] = m;
            return m;
        }

        // 没有 colormap 的套装（nature）用的是材质颜色：转成 URP Lit，保留颜色
        static Material Convert(Material src)
        {
            if (!src) return Look.Lit(Color.white);
            if (src.shader && src.shader.name.StartsWith("Universal Render Pipeline")) return src;
            if (converted.TryGetValue(src, out var m)) return m;
            var c = src.HasProperty("_Color") ? src.color : Color.white;
            m = Look.Lit(c, 0.15f);
            converted[src] = m;
            return m;
        }

        public static bool Has(string kit, string model) => Prefab(kit, model) != null;

        static GameObject Prefab(string kit, string model)
        {
            var key = kit + "/" + model;
            if (!prefabs.TryGetValue(key, out var p)) prefabs[key] = p = Resources.Load<GameObject>("Kenney/" + key);
            return p;
        }

        // 生成一个模型。size>0 时等比缩放，让占地（x、z 中较大的一边）等于 size；
        // height>0 时改为按高度缩放。返回的根节点在原点，模型底部中心对齐原点。
        public static Transform Spawn(string kit, string model, Transform parent = null, float size = 0f, float height = 0f, bool shadows = true)
        {
            var root = new GameObject(model).transform;
            if (parent) root.SetParent(parent, false);
            var prefab = Prefab(kit, model);
            GameObject go;
            if (!prefab)
            {
                Debug.LogWarning($"[Kenney] 找不到模型 {kit}/{model}");
                go = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(go.GetComponent<Collider>());
                go.GetComponent<Renderer>().sharedMaterial = Look.Lit(Color.magenta);
            }
            else go = Object.Instantiate(prefab);
            go.transform.SetParent(root, false);
            go.transform.localPosition = Vector3.zero;

            var kitMat = KitMaterial(kit);
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int k = 0; k < mats.Length; k++) mats[k] = kitMat ? kitMat : Convert(mats[k]);
                r.sharedMaterials = mats;
                r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
                r.receiveShadows = true;
            }
            foreach (var c in go.GetComponentsInChildren<Collider>()) Object.Destroy(c);

            var b = LocalBounds(root, go);
            float s = 1f;
            if (height > 0f && b.size.y > 0.0001f) s = height / b.size.y;
            else if (size > 0f) s = size / Mathf.Max(0.0001f, Mathf.Max(b.size.x, b.size.z));
            go.transform.localScale *= s;
            go.transform.localPosition = new Vector3(-b.center.x * s, -b.min.y * s, -b.center.z * s);
            return root;
        }

        // 模型在 root 坐标系里的包围盒（root 还在原点、没旋转时调用）
        static Bounds LocalBounds(Transform root, GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return new Bounds(Vector3.zero, Vector3.one);
            var inv = root.worldToLocalMatrix;
            bool first = true;
            var b = new Bounds();
            foreach (var r in rs)
            {
                var mf = r.GetComponent<MeshFilter>();
                Bounds lb;
                Matrix4x4 m;
                if (mf && mf.sharedMesh) { lb = mf.sharedMesh.bounds; m = inv * r.transform.localToWorldMatrix; }
                else if (r is SkinnedMeshRenderer sk && sk.sharedMesh) { lb = sk.sharedMesh.bounds; m = inv * r.transform.localToWorldMatrix; }
                else continue;
                var c = lb.center; var e = lb.extents;
                for (int k = 0; k < 8; k++)
                {
                    var p = m.MultiplyPoint3x4(c + new Vector3((k & 1) == 0 ? -e.x : e.x, (k & 2) == 0 ? -e.y : e.y, (k & 4) == 0 ? -e.z : e.z));
                    if (first) { b = new Bounds(p, Vector3.zero); first = false; } else b.Encapsulate(p);
                }
            }
            return b;
        }

        // 同一套素材的贴图，整体往地主颜色偏一点（买下的楼一眼能看出是谁的）
        static readonly Dictionary<(string, Color), Material> tinted = new();
        public static Material KitTinted(string kit, Color c, float amount = 0.35f)
        {
            var key = (kit, c);
            if (tinted.TryGetValue(key, out var m)) return m;
            var baseMat = KitMaterial(kit);
            if (!baseMat) return Look.Lit(c);
            m = new Material(baseMat) { name = baseMat.name + " tint" };
            m.SetColor("_BaseColor", Color.Lerp(Color.white, c, amount));
            tinted[key] = m;
            return m;
        }

        // 模型（Spawn 返回的根节点）的高度
        public static float Height(Transform root)
        {
            float top = 0f;
            foreach (var r in root.GetComponentsInChildren<Renderer>()) top = Mathf.Max(top, r.bounds.max.y - root.position.y);
            return top;
        }

        // 把一个模型的所有材质换成指定材质（比如地主颜色的屋顶）
        public static void Tint(Transform t, Material m)
        {
            foreach (var r in t.GetComponentsInChildren<Renderer>())
            {
                var mats = r.sharedMaterials;
                for (int k = 0; k < mats.Length; k++) mats[k] = m;
                r.sharedMaterials = mats;
            }
        }
    }
}
