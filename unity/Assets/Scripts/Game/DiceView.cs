// 骰子：两颗带圆点贴图的骰子从空中抛下，翻滚、弹两下，停住时朝上的正好是引擎掷出的点数。
using System.Collections;
using TMPro;
using UnityEngine;

namespace Monoplay
{
    public class DiceView : MonoBehaviour
    {
        // 六个面的朝向：+y=1、-y=6、+x=2、-x=5、+z=3、-z=4（对面相加等于 7）
        static readonly Vector3[] FaceNormal = { Vector3.zero, Vector3.up, Vector3.right, Vector3.forward, Vector3.back, Vector3.left, Vector3.down };
        Transform[] dice;
        TextMeshPro total;

        public static DiceView Create(Transform parent, TMP_FontAsset font)
        {
            var go = new GameObject("Dice");
            go.transform.SetParent(parent, false);
            var d = go.AddComponent<DiceView>();
            d.dice = new[] { d.MakeDie(), d.MakeDie() };
            d.total = Marker.Text(go.transform, font, "", 6f, Look.Hex("#ffd43b"), Vector3.zero);
            d.total.outlineWidth = 0.3f;
            d.gameObject.SetActive(false);
            return d;
        }

        Transform MakeDie()
        {
            const float S = 0.7f;
            var die = new GameObject("Die").transform;
            die.SetParent(transform, false);
            MeshKit.Box(die, Vector3.one * (S - 0.02f), Vector3.zero, Look.Lit("#f4f2ea", 0.6f));
            for (int v = 1; v <= 6; v++)
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
                Destroy(q.GetComponent<Collider>());
                q.transform.SetParent(die, false);
                var n = FaceNormal[v];
                q.transform.localPosition = n * (S / 2f);
                q.transform.localRotation = Quaternion.LookRotation(-n, Mathf.Abs(n.y) > 0.5f ? Vector3.forward : Vector3.up);
                q.transform.localScale = Vector3.one * (S - 0.04f);
                var r = q.GetComponent<MeshRenderer>();
                r.sharedMaterial = Look.Textured(Noise.DieFace(v), 0.6f);
            }
            return die;
        }

        // 在 at 附近掷出 a、b 两个点数
        public IEnumerator Roll(int a, int b, Vector3 at, float speed)
        {
            gameObject.SetActive(true);
            total.text = "";
            Sfx.Play("dice");
            int[] vals = { a, b };
            var starts = new Vector3[2]; var ends = new Vector3[2];
            var spinAxis = new Vector3[2]; var finalRot = new Quaternion[2];
            var cam = Camera.main.transform;
            var toward = cam.forward; toward.y = 0; toward.Normalize();
            var side = Vector3.Cross(Vector3.up, toward);
            for (int k = 0; k < 2; k++)
            {
                ends[k] = at + side * (k == 0 ? -0.55f : 0.55f) + toward * 0.6f + Vector3.up * 0.35f;
                starts[k] = ends[k] - toward * 3.2f + Vector3.up * 3.5f + side * Random.Range(-0.6f, 0.6f);
                spinAxis[k] = Random.onUnitSphere;
                finalRot[k] = Quaternion.AngleAxis(Random.Range(0f, 360f), Vector3.up) * Quaternion.FromToRotation(FaceNormal[vals[k]], Vector3.up);
                dice[k].position = starts[k];
            }
            float dur = 1.15f / speed, t = 0f;
            while (t < 1f)
            {
                t = Mathf.Min(1f, t + Time.deltaTime / dur);
                for (int k = 0; k < 2; k++)
                {
                    // 抛物线落下，再弹两下
                    float x = t;
                    float y = x < 0.55f ? Mathf.Lerp(3.5f, 0f, x / 0.55f * (x / 0.55f)) : x < 0.8f ? Mathf.Sin((x - 0.55f) / 0.25f * Mathf.PI) * 0.6f : Mathf.Sin((x - 0.8f) / 0.2f * Mathf.PI) * 0.18f;
                    var p = Vector3.Lerp(starts[k], ends[k], Mathf.SmoothStep(0, 1, Mathf.Min(1, x / 0.8f)));
                    p.y = ends[k].y + y;
                    dice[k].position = p;
                    var spin = Quaternion.AngleAxis((1f - t) * 1080f, spinAxis[k]);
                    dice[k].rotation = Quaternion.Slerp(spin * finalRot[k], finalRot[k], Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.45f, 0.95f, t)));
                }
                yield return null;
            }
            Sfx.Play("diceLand");
            total.transform.position = (ends[0] + ends[1]) / 2f + Vector3.up * 1.2f;
            total.text = (a + b).ToString();
            yield return new WaitForSeconds(0.55f / speed);
        }

        public void Hide() => gameObject.SetActive(false);
    }
}
