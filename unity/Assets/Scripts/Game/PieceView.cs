// 棋子：Kenney 的 Q 版小人站在玩家颜色的底座上，头顶名字牌；当前玩家脚下有光圈、头顶有金色箭头。
// 走路时一格一格跳过去，站着时轻轻呼吸、慢慢转身面向镜头。
using System.Collections;
using System.Collections.Generic;
using Monoplay.Core;
using TMPro;
using UnityEngine;

namespace Monoplay
{
    public class PieceView : MonoBehaviour
    {
        // 6 个角色对应的 Kenney 小人
        static readonly Dictionary<string, string> Models = new()
        {
            ["atubo"] = "character-male-e", ["xiaomei"] = "character-female-a", ["qian"] = "character-female-c",
            ["beibei"] = "character-male-a", ["ninja"] = "character-male-d", ["laoqian"] = "character-male-b",
        };

        Transform body;
        GameObject ring, arrow;
        TextMeshPro status;
        public bool Moving { get; private set; }
        float phase;

        public static PieceView Create(Transform parent, PlayerState p, TMP_FontAsset font)
        {
            var go = new GameObject("Piece " + p.name);
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<PieceView>();
            v.Build(p, font);
            return v;
        }

        void Build(PlayerState p, TMP_FontAsset font)
        {
            var col = Look.Hex(p.color);
            MeshKit.Cylinder(transform, 0.42f, 0.1f, Vector3.zero, Look.Lit(col * 0.85f, 0.55f));
            MeshKit.Cylinder(transform, 0.44f, 0.03f, new Vector3(0, 0.09f, 0), Look.Lit(Color.white, 0.6f));
            body = Kenney.Spawn("mini-characters", Models.TryGetValue(p.@char, out var m) ? m : "character-male-a", transform, height: 1.05f);
            body.localPosition = new Vector3(0, 0.12f, 0);
            var tag = Marker.Text(transform, font, p.name, 3.2f, Color.white, new Vector3(0, 1.75f, 0));
            tag.outlineColor = (Color32)(col * 0.6f);
            tag.outlineWidth = 0.3f;
            status = Marker.Text(transform, font, "", 3f, Look.Hex("#ffe066"), new Vector3(0, 2.15f, 0));
            ring = MeshKit.Cylinder(transform, 0.75f, 0.02f, new Vector3(0, -0.02f, 0), Look.Glow(col, 1.6f), false);
            ring.SetActive(false);
            // 倒过来的四棱锥：底面在上、尖朝下
            var arrowRoot = new GameObject("Arrow").transform;
            arrowRoot.SetParent(transform, false);
            var cone = MeshKit.Cone(arrowRoot, 0.22f, 0.4f, 0.22f, Vector3.zero, Look.Glow(new Color(1f, 0.8f, 0.2f), 1.8f), 4, false);
            cone.transform.localRotation = Quaternion.Euler(180f, 0, 0);
            cone.transform.localPosition = new Vector3(0, 0.4f, 0);
            arrow = arrowRoot.gameObject;
            arrow.SetActive(false);
            phase = Random.value * 6f;
        }

        public void SetActiveTurn(bool on) { ring.SetActive(on); arrow.SetActive(on); }
        public void SetStatus(string text) => status.text = text ?? "";

        // 沿着路径一格一格跳过去
        public IEnumerator Hop(IList<Vector3> spots, float stepTime, bool jump)
        {
            Moving = true;
            foreach (var to in spots)
            {
                var from = transform.position;
                var dir = to - from; dir.y = 0;
                if (dir.sqrMagnitude > 0.001f) transform.rotation = Quaternion.LookRotation(dir);
                float t = 0, dur = jump ? stepTime * 1.8f : stepTime, h = jump ? 2.2f : 0.45f;
                while (t < 1f)
                {
                    t = Mathf.Min(1f, t + Time.deltaTime / dur);
                    var p = Vector3.Lerp(from, to, t);
                    p.y += Mathf.Sin(t * Mathf.PI) * h;
                    transform.position = p;
                    yield return null;
                }
                Sfx.Play("step");
            }
            Moving = false;
        }

        void Update()
        {
            if (arrow.activeSelf)
            {
                arrow.transform.localPosition = new Vector3(0, 2.75f + Mathf.Sin(Time.time * 4f) * 0.15f, 0);
                arrow.transform.Rotate(0, 120f * Time.deltaTime, 0);
                float s = 1f + (Mathf.Sin(Time.time * 4f) + 1f) * 0.08f;
                ring.transform.localScale = new Vector3(1.5f * s, 0.01f, 1.5f * s);
            }
            if (Moving) return;
            // 呼吸 + 转身面向镜头
            body.localScale = Vector3.one * (1f + Mathf.Sin(Time.time * 2f + phase) * 0.015f);
            var cam = Camera.main;
            if (cam)
            {
                var d = cam.transform.position - transform.position; d.y = 0;
                if (d.sqrMagnitude > 0.01f) transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(d), Time.deltaTime * 4f);
            }
        }
    }
}
