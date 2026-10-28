// uGUI 小工具：圆角面板、文字、按钮、输入框、布局。所有界面都用代码搭，编辑器里不用拖任何东西。
using System;
using System.Text.RegularExpressions;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Monoplay
{
    public static class UiKit
    {
        public static TMP_FontAsset Font;

        // 配色：奶油色面板、深棕文字、红色主按钮、金色高亮
        public static readonly Color Cream = Hex("#fffaf0"), CreamDim = Hex("#f3ead8"), Ink = Hex("#3b2f22"), InkSoft = Hex("#7a6a55"),
            Red = Hex("#ff5a4e"), Gold = Hex("#ffc93c"), Green = Hex("#2fb36d"), Blue = Hex("#3a7bd5"), Grey = Hex("#8d8f94"),
            Glass = new Color(1f, 0.98f, 0.94f, 0.92f), DarkGlass = new Color(0.12f, 0.12f, 0.16f, 0.72f);

        public static Color Hex(string h) => ColorUtility.TryParseHtmlString(h, out var c) ? c : Color.magenta;

        static Sprite rounded, circle;
        // 圆角矩形贴图（9 宫格拉伸）
        public static Sprite Rounded => rounded ? rounded : rounded = MakeRounded(64, 22);
        public static Sprite Circle => circle ? circle : circle = MakeRounded(64, 32);
        static Sprite MakeRounded(int size, int r)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float cx = Mathf.Clamp(x + 0.5f, r, size - r), cy = Mathf.Clamp(y + 0.5f, r, size - r);
                    float d = Mathf.Sqrt((x + 0.5f - cx) * (x + 0.5f - cx) + (y + 0.5f - cy) * (y + 0.5f - cy));
                    t.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(r - d + 0.5f)));
                }
            t.Apply();
            int b = Mathf.Min(r, size / 2 - 1);
            return Sprite.Create(t, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, new Vector4(b, b, b, b));
        }

        // 引擎的文字里带 emoji，TMP 默认字体显示不了，先去掉
        static readonly Regex Emoji = new(@"[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿]|[️‍]|[⬀-⯿]", RegexOptions.Compiled);
        public static string Clean(string s) => string.IsNullOrEmpty(s) ? "" : Emoji.Replace(s, "").Trim();

        public static RectTransform Rect(Transform parent, string name = "Rect")
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static void Place(RectTransform rt, Vector2 anchor, Vector2 pivot, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = pivot;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
        }
        public static void Fill(RectTransform rt, float l = 0, float r = 0, float t = 0, float b = 0)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(l, b); rt.offsetMax = new Vector2(-r, -t);
        }

        public static Image Panel(Transform parent, Color c, string name = "Panel", bool shadow = true, Sprite sprite = null)
        {
            var rt = Rect(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite ? sprite : Rounded;
            img.type = Image.Type.Sliced;
            img.color = c;
            if (shadow)
            {
                var sh = rt.gameObject.AddComponent<Shadow>();
                sh.effectColor = new Color(0, 0, 0, 0.18f);
                sh.effectDistance = new Vector2(0, -4);
            }
            return img;
        }

        public static TextMeshProUGUI Label(Transform parent, string text, float size, Color color, TextAlignmentOptions align = TextAlignmentOptions.Left, string name = "Label")
        {
            var rt = Rect(parent, name);
            var t = rt.gameObject.AddComponent<TextMeshProUGUI>();
            t.font = Font;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.raycastTarget = false;
            t.textWrappingMode = TextWrappingModes.Normal;
            t.overflowMode = TextOverflowModes.Ellipsis;
            return t;
        }

        public static Button Button(Transform parent, string text, Color bg, Action onClick, float fontSize = 26, Color? fg = null, string name = "Button")
        {
            var img = Panel(parent, bg, name);
            var b = img.gameObject.AddComponent<Button>();
            var cb = b.colors;
            cb.normalColor = Color.white;
            cb.highlightedColor = new Color(1.08f, 1.08f, 1.08f);
            cb.pressedColor = new Color(0.85f, 0.85f, 0.85f);
            cb.disabledColor = new Color(0.75f, 0.75f, 0.75f, 0.6f);
            cb.colorMultiplier = 1.1f;
            b.colors = cb;
            b.onClick.AddListener(() => { Sfx.Play("click"); onClick?.Invoke(); });
            var l = Label(img.transform, text, fontSize, fg ?? Color.white, TextAlignmentOptions.Center);
            l.fontStyle = FontStyles.Bold;
            l.textWrappingMode = TextWrappingModes.NoWrap;
            Fill(l.rectTransform, 8, 8, 2, 2);
            return b;
        }
        public static void SetText(Button b, string text) => b.GetComponentInChildren<TextMeshProUGUI>().text = text;

        public static TMP_InputField Input(Transform parent, string placeholder, string value, float fontSize = 26, int limit = 12)
        {
            var bg = Panel(parent, Color.white, "Input", false);
            var outline = bg.gameObject.AddComponent<Outline>();
            outline.effectColor = Hex("#e6d6b8");
            outline.effectDistance = new Vector2(2, -2);
            var area = Rect(bg.transform, "Text Area");
            Fill(area, 16, 16, 6, 6);
            area.gameObject.AddComponent<RectMask2D>();
            var ph = Label(area, placeholder, fontSize, Hex("#b8ab95"), TextAlignmentOptions.Left, "Placeholder");
            Fill(ph.rectTransform);
            ph.textWrappingMode = TextWrappingModes.NoWrap;
            var tx = Label(area, "", fontSize, Ink, TextAlignmentOptions.Left, "Text");
            Fill(tx.rectTransform);
            tx.textWrappingMode = TextWrappingModes.NoWrap;
            var input = bg.gameObject.AddComponent<TMP_InputField>();
            input.textViewport = area;
            input.textComponent = tx;
            input.placeholder = ph;
            input.fontAsset = Font;
            input.characterLimit = limit;
            input.text = value ?? "";
            return input;
        }

        public static VerticalLayoutGroup VStack(Component c, float spacing, int pad = 0, bool expandWidth = true)
        {
            var g = c.gameObject.AddComponent<VerticalLayoutGroup>();
            g.spacing = spacing;
            g.padding = new RectOffset(pad, pad, pad, pad);
            g.childControlWidth = true; g.childControlHeight = true;
            g.childForceExpandWidth = expandWidth; g.childForceExpandHeight = false;
            return g;
        }
        public static HorizontalLayoutGroup HStack(Component c, float spacing, int pad = 0, bool expandHeight = true)
        {
            var g = c.gameObject.AddComponent<HorizontalLayoutGroup>();
            g.spacing = spacing;
            g.padding = new RectOffset(pad, pad, pad, pad);
            g.childControlWidth = true; g.childControlHeight = true;
            g.childForceExpandWidth = false; g.childForceExpandHeight = expandHeight;
            g.childAlignment = TextAnchor.MiddleCenter;
            return g;
        }
        public static LayoutElement Size(Component c, float w = -1, float h = -1, float flexW = -1, float flexH = -1)
        {
            var le = c.GetComponent<LayoutElement>();
            if (!le) le = c.gameObject.AddComponent<LayoutElement>();
            if (w >= 0) le.preferredWidth = w;
            if (h >= 0) le.preferredHeight = h;
            if (flexW >= 0) le.flexibleWidth = flexW;
            if (flexH >= 0) le.flexibleHeight = flexH;
            return le;
        }
        public static ContentSizeFitter FitHeight(Component c)
        {
            var f = c.gameObject.AddComponent<ContentSizeFitter>();
            f.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            return f;
        }

        public static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
        }

        public static string Money(int v) => "¥" + v.ToString("N0");
        public static string Short(int v) => v >= 10000 ? "¥" + (v / 10000f).ToString("0.#") + "万" : "¥" + v.ToString("N0");
    }
}
