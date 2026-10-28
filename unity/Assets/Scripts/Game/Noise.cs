// 运行时画出来的小贴图：草地、海浪、天空渐变、各片区的地面铺装、骰子点数。
using UnityEngine;

namespace Monoplay
{
    public static class Noise
    {
        static Texture2D New(int w, int h, TextureWrapMode wrap = TextureWrapMode.Repeat)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, true) { wrapMode = wrap, filterMode = FilterMode.Bilinear, anisoLevel = 4 };
            return t;
        }

        public static Texture2D Grass()
        {
            var t = New(128, 128);
            var rnd = new System.Random(7);
            Color[] cols = { Look.Hex("#86c95f"), Look.Hex("#8fd16a"), Look.Hex("#7fbf5c"), Look.Hex("#98d873") };
            var px = new Color[128 * 128];
            for (int k = 0; k < px.Length; k++) px[k] = cols[1];
            for (int n = 0; n < 1400; n++)
            {
                int x = rnd.Next(128), y = rnd.Next(128), s = 1 + rnd.Next(3);
                var c = cols[rnd.Next(cols.Length)];
                for (int dy = 0; dy < s; dy++) for (int dx = 0; dx < s; dx++) px[((y + dy) % 128) * 128 + (x + dx) % 128] = c;
            }
            t.SetPixels(px); t.Apply(true);
            return t;
        }

        public static Texture2D Water()
        {
            var t = New(256, 256);
            var px = new Color[256 * 256];
            var deep = Look.Hex("#2fa9d6");
            for (int k = 0; k < px.Length; k++) px[k] = deep;
            var rnd = new System.Random(3);
            var foam = new Color(1, 1, 1, 1);
            for (int n = 0; n < 50; n++)
            {
                int x0 = rnd.Next(256), y0 = rnd.Next(256), w = 14 + rnd.Next(22);
                for (int i = 0; i < w; i++)
                {
                    int y = y0 + Mathf.RoundToInt(Mathf.Sin(i / (float)w * Mathf.PI) * -3f);
                    for (int th = 0; th < 2; th++)
                    {
                        int idx = (((y + th) % 256 + 256) % 256) * 256 + (x0 + i) % 256;
                        px[idx] = Color.Lerp(px[idx], foam, 0.45f);
                    }
                }
            }
            t.SetPixels(px); t.Apply(true);
            return t;
        }

        public static Texture2D SkyGradient()
        {
            var t = New(4, 256, TextureWrapMode.Clamp);
            var top = Look.Hex("#4fa8ee"); var mid = Look.Hex("#a9dcfb"); var bottom = Look.Hex("#d9f1ff");
            for (int y = 0; y < 256; y++)
            {
                float v = y / 255f; // 球的 UV：0 在下、1 在上
                var c = v > 0.5f ? Color.Lerp(mid, top, (v - 0.5f) * 2f) : Color.Lerp(bottom, mid, v * 2f);
                for (int x = 0; x < 4; x++) t.SetPixel(x, y, c);
            }
            t.Apply(true);
            return t;
        }

        // 地块铺装：古城青石板、金融区花岗岩方砖、海滨沙地、游乐园彩色格子砖
        public static Texture2D Paving(string style, Color baseColor)
        {
            var t = New(128, 128);
            var px = new Color[128 * 128];
            var line = baseColor * 0.85f; line.a = 1;
            var alt = Color.Lerp(baseColor, style == "fun" ? Look.Hex("#ffd1dc") : Color.white, style == "fun" ? 1f : 0.25f);
            var rnd = new System.Random(style.GetHashCode());
            for (int y = 0; y < 128; y++)
                for (int x = 0; x < 128; x++)
                {
                    var c = baseColor;
                    switch (style)
                    {
                        case "old":
                            {
                                int row = y / 32, off = row % 2 == 1 ? 16 : 0;
                                if (y % 32 < 3 || (x + off) % 32 < 3) c = line;
                                break;
                            }
                        case "cbd":
                            if (((x / 32) + (y / 32)) % 2 == 1) c = Color.Lerp(baseColor, Color.black, 0.06f);
                            if (x % 32 < 2 || y % 32 < 2) c = Color.Lerp(baseColor, Color.white, 0.5f);
                            break;
                        case "fun":
                            if (((x / 32) + (y / 32)) % 2 == 1) c = alt;
                            break;
                        default:
                            if (rnd.NextDouble() < 0.06) c = rnd.NextDouble() < 0.5 ? baseColor * 0.93f : Color.Lerp(baseColor, Color.white, 0.4f);
                            break;
                    }
                    c.a = 1;
                    px[y * 128 + x] = c;
                }
            t.SetPixels(px); t.Apply(true);
            return t;
        }

        // 骰子一面：白底 + 圆点（1 和 4 是红点）
        public static Texture2D DieFace(int v)
        {
            var t = New(128, 128, TextureWrapMode.Clamp);
            int[][] pos = { null, new[] { 4 }, new[] { 0, 8 }, new[] { 0, 4, 8 }, new[] { 0, 2, 6, 8 }, new[] { 0, 2, 4, 6, 8 }, new[] { 0, 2, 3, 5, 6, 8 } };
            var px = new Color[128 * 128];
            var bg = Look.Hex("#fbfbf8");
            for (int k = 0; k < px.Length; k++) px[k] = bg;
            var pip = v == 1 || v == 4 ? Look.Hex("#d01818") : Look.Hex("#1a1a1a");
            float r = v == 1 ? 17f : 12f;
            foreach (int k in pos[v])
            {
                float cx = 28 + (k % 3) * 36, cy = 28 + (k / 3) * 36;
                for (int y = 0; y < 128; y++)
                    for (int x = 0; x < 128; x++)
                    {
                        float d = Mathf.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                        if (d < r + 1f) px[y * 128 + x] = Color.Lerp(pip, px[y * 128 + x], Mathf.Clamp01(d - r));
                    }
            }
            t.SetPixels(px); t.Apply(true);
            return t;
        }
    }
}
