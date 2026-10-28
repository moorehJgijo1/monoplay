// 地图上的小标记：神仙（漂浮的光球 + 名字）、路障、地雷、空地的“待售”牌，以及面向镜头的文字。
using TMPro;
using UnityEngine;

namespace Monoplay
{
    public static class Marker
    {
        public static TextMeshPro Text(Transform parent, TMP_FontAsset font, string text, float size, Color color, Vector3 pos, bool billboard = true)
        {
            var go = new GameObject("Label");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            var t = go.AddComponent<TextMeshPro>();
            t.font = font;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = TextAlignmentOptions.Center;
            t.textWrappingMode = TextWrappingModes.NoWrap;
            t.rectTransform.sizeDelta = new Vector2(6, 1);
            t.outlineWidth = 0.25f;
            t.outlineColor = new Color32(0, 0, 0, 160);
            if (billboard) go.AddComponent<Billboard>();
            return t;
        }

        public static GameObject God(Transform parent, string name, bool good, TMP_FontAsset font)
        {
            var root = new GameObject("God " + name);
            root.transform.SetParent(parent, false);
            var col = good ? new Color(1f, 0.82f, 0.25f) : new Color(0.55f, 0.3f, 0.85f);
            var orb = MeshKit.Sphere(root.transform, 0.22f, new Vector3(0, 0.9f, 0), Look.Glow(col, 2.2f), false);
            var halo = MeshKit.Cylinder(root.transform, 0.32f, 0.02f, new Vector3(0, 1.22f, 0), Look.Glow(col, 1.5f), false);
            halo.transform.localScale = new Vector3(0.64f, 0.01f, 0.64f);
            Text(root.transform, font, name, 3f, col, new Vector3(0, 1.5f, 0));
            root.AddComponent<Bob>().amp = 0.15f;
            return root;
        }

        public static GameObject Roadblock(Transform parent)
        {
            var root = new GameObject("Roadblock");
            root.transform.SetParent(parent, false);
            var b = Kenney.Spawn("roads", "construction-barrier", root.transform, size: 0.75f);
            b.localRotation = Quaternion.Euler(0, 90, 0);
            var c1 = Kenney.Spawn("car", "cone", root.transform, size: 0.22f);
            c1.localPosition = new Vector3(0.35f, 0, 0.15f);
            return root;
        }

        public static GameObject Mine(Transform parent)
        {
            var root = new GameObject("Mine");
            root.transform.SetParent(parent, false);
            MeshKit.Cylinder(root.transform, 0.2f, 0.08f, Vector3.zero, Look.Lit("#3d4148", 0.5f, 0.6f));
            var l = MeshKit.Sphere(root.transform, 0.05f, new Vector3(0, 0.1f, 0), Look.Glow(new Color(1f, 0.15f, 0.1f), 3f), false);
            l.AddComponent<Blink>();
            return root;
        }

        // “待售”木牌
        public static void SaleSign(Transform parent, TMP_FontAsset font)
        {
            var root = new GameObject("Sale").transform;
            root.SetParent(parent, false);
            root.localPosition = new Vector3(0.35f, 0, 0.35f);
            var wood = Look.Lit("#8b5a2b", 0.2f);
            MeshKit.Cylinder(root, 0.03f, 0.62f, Vector3.zero, wood);
            MeshKit.BoxOn(root, 0.58f, 0.3f, 0.04f, 0, 0.45f, 0, Look.Lit("#ecdcb8", 0.2f));
            var t = Text(root, font, "待售", 2.2f, Look.Hex("#5a3a1a"), new Vector3(0, 0.6f, 0.025f), false);
            t.outlineWidth = 0f;
            t.rectTransform.sizeDelta = new Vector2(0.55f, 0.28f);
            t.transform.localRotation = Quaternion.Euler(0, 180, 0);
        }
    }

    // 永远面向镜头
    public class Billboard : MonoBehaviour
    {
        void LateUpdate()
        {
            var cam = Camera.main;
            if (cam) transform.rotation = cam.transform.rotation;
        }
    }

    // 上下漂浮
    public class Bob : MonoBehaviour
    {
        public float amp = 0.1f, speed = 2.5f;
        Vector3 basePos; float phase;
        void Start() { basePos = transform.localPosition; phase = Random.value * 6f; }
        void Update() => transform.localPosition = basePos + Vector3.up * Mathf.Sin(Time.time * speed + phase) * amp;
    }

    // 慢慢转
    public class Spin : MonoBehaviour
    {
        public Vector3 axis = Vector3.up; public float speed = 30f;
        void Update() => transform.Rotate(axis, speed * Time.deltaTime, Space.Self);
    }
}
