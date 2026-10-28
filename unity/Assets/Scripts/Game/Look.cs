// 画面的“底子”：材质工厂、灯光、天空、雾和后期效果（泛光、色调映射、调色、暗角）。
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Monoplay
{
    public static class Look
    {
        static Material litBase, unlitBase;
        static readonly Dictionary<(Color, float, float), Material> litCache = new();
        static readonly Dictionary<Color, Material> unlitCache = new();

        static Material LitBase
        {
            get
            {
                if (!litBase) litBase = Resources.Load<Material>("Materials/Lit");
                if (!litBase) litBase = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                return litBase;
            }
        }
        static Material UnlitBase
        {
            get
            {
                if (!unlitBase) unlitBase = Resources.Load<Material>("Materials/Unlit");
                if (!unlitBase) unlitBase = new Material(Shader.Find("Universal Render Pipeline/Unlit"));
                return unlitBase;
            }
        }

        public static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;

        // 不透明的 URP Lit 材质，同样参数共用一份
        public static Material Lit(Color c, float smooth = 0.25f, float metal = 0f)
        {
            var key = (c, smooth, metal);
            if (litCache.TryGetValue(key, out var m)) return m;
            m = new Material(LitBase) { name = "Lit " + ColorUtility.ToHtmlStringRGB(c) };
            m.SetColor("_BaseColor", c);
            m.SetFloat("_Smoothness", smooth);
            m.SetFloat("_Metallic", metal);
            litCache[key] = m;
            return m;
        }
        public static Material Lit(string hex, float smooth = 0.25f, float metal = 0f) => Lit(Hex(hex), smooth, metal);

        // 自发光（灯、航空灯、霓虹），配合泛光会亮起来
        public static Material Glow(Color c, float intensity = 2f)
        {
            var src = Resources.Load<Material>("Materials/LitEmissive");
            var m = new Material(src ? src : LitBase) { name = "Glow" };
            m.SetColor("_BaseColor", c);
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", c * intensity);
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            return m;
        }

        public static Material Unlit(Color c)
        {
            if (unlitCache.TryGetValue(c, out var m)) return m;
            m = new Material(UnlitBase) { name = "Unlit" };
            m.SetColor("_BaseColor", c);
            unlitCache[c] = m;
            return m;
        }

        // 半透明（高亮层、光圈、水花）。基础材质由编辑器初始化脚本生成，保证打包时透明变体不会被裁掉
        public static Material Transparent(Color c)
        {
            var src = Resources.Load<Material>("Materials/UnlitTransparent");
            Material m;
            if (src) m = new Material(src);
            else
            {
                m = new Material(UnlitBase);
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_Blend", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)RenderQueue.Transparent;
            }
            m.SetColor("_BaseColor", c);
            return m;
        }

        public static Material Textured(Texture tex, float smooth = 0.2f)
        {
            var m = new Material(LitBase) { name = "Tex " + tex.name };
            m.SetTexture("_BaseMap", tex);
            m.SetColor("_BaseColor", Color.white);
            m.SetFloat("_Smoothness", smooth);
            return m;
        }

        // ---------- 场景氛围 ----------
        public static Light Sun { get; private set; }

        public static void Setup()
        {
            // 环境光：天空偏蓝、地平线偏暖、地面偏绿，卡通城市的通透感
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Hex("#bcd9f5");
            RenderSettings.ambientEquatorColor = Hex("#e9dcc8");
            RenderSettings.ambientGroundColor = Hex("#7d9a6a");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = Hex("#c6e6fa");
            RenderSettings.fogStartDistance = 90f;
            RenderSettings.fogEndDistance = 220f;
            RenderSettings.skybox = null;

            var sunGo = new GameObject("Sun");
            Object.DontDestroyOnLoad(sunGo);
            Sun = sunGo.AddComponent<Light>();
            Sun.type = LightType.Directional;
            Sun.color = Hex("#fff1dc");
            Sun.intensity = 1.35f;
            Sun.shadows = LightShadows.Soft;
            Sun.shadowStrength = 0.75f;
            Sun.shadowBias = 0.03f;
            Sun.shadowNormalBias = 0.25f;
            sunGo.transform.rotation = Quaternion.Euler(48f, -35f, 0f);

            // 后期：泛光让灯和航空灯发亮；中性色调映射保留卡通的鲜艳；轻微提饱和和暗角
            var volGo = new GameObject("Post");
            Object.DontDestroyOnLoad(volGo);
            var vol = volGo.AddComponent<Volume>();
            vol.isGlobal = true;
            var prof = ScriptableObject.CreateInstance<VolumeProfile>();
            var bloom = prof.Add<Bloom>(true);
            bloom.threshold.Override(1.05f);
            bloom.intensity.Override(0.55f);
            bloom.scatter.Override(0.6f);
            var tm = prof.Add<Tonemapping>(true);
            tm.mode.Override(TonemappingMode.Neutral);
            var ca = prof.Add<ColorAdjustments>(true);
            ca.saturation.Override(12f);
            ca.contrast.Override(8f);
            ca.postExposure.Override(0.15f);
            var vg = prof.Add<Vignette>(true);
            vg.intensity.Override(0.18f);
            vg.smoothness.Override(0.5f);
            vol.profile = prof;
        }
    }
}
