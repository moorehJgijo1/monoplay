// 音效：全部用代码合成（不需要音频文件），和网页版一样是“咔哒、叮、收银机”这类短促的声音。
using System.Collections.Generic;
using UnityEngine;

namespace Monoplay
{
    public static class Sfx
    {
        const int Rate = 44100;
        static AudioSource src;
        static readonly Dictionary<string, AudioClip> clips = new();

        public static void Play(string name, float vol = 1f)
        {
            if (!src)
            {
                var go = new GameObject("Sfx");
                Object.DontDestroyOnLoad(go);
                src = go.AddComponent<AudioSource>();
                src.playOnAwake = false;
            }
            if (!clips.TryGetValue(name, out var clip)) clips[name] = clip = Make(name);
            if (clip) src.PlayOneShot(clip, vol * (App.I != null ? App.I.Settings.volume : 1f));
        }

        static AudioClip Make(string name)
        {
            switch (name)
            {
                case "step": return Synth(0.06f, t => Tone(t, 900f, 0.06f) * 0.25f);
                case "dice": return Synth(0.45f, t => Rattle(t, 0.45f) * 0.5f);
                case "diceLand": return Synth(0.12f, t => (Tone(t, 420f, 0.1f) + Rattle(t, 0.08f)) * 0.5f);
                case "coin": return Synth(0.35f, t => (Tone(t, 1320f, 0.25f) + Tone(t - 0.08f, 1760f, 0.25f)) * 0.3f);
                case "buy": return Synth(0.5f, t => (Tone(t, 880f, 0.15f) + Tone(t - 0.1f, 1175f, 0.2f) + Tone(t - 0.22f, 1568f, 0.28f)) * 0.3f);
                case "build": return Synth(0.4f, t => (Thud(t, 0.12f) + Thud(t - 0.18f, 0.12f)) * 0.6f);
                case "good": return Synth(0.6f, t => (Tone(t, 523f, 0.5f) + Tone(t - 0.1f, 659f, 0.5f) + Tone(t - 0.2f, 784f, 0.5f)) * 0.22f);
                case "bad": return Synth(0.6f, t => (Tone(t, 330f, 0.5f) + Tone(t - 0.15f, 262f, 0.5f)) * 0.25f);
                case "turn": return Synth(0.3f, t => (Tone(t, 660f, 0.2f) + Tone(t - 0.1f, 990f, 0.2f)) * 0.22f);
                case "click": return Synth(0.04f, t => Tone(t, 1500f, 0.04f) * 0.2f);
            }
            return null;
        }

        static AudioClip Synth(float len, System.Func<float, float> f)
        {
            int n = Mathf.CeilToInt(len * Rate);
            var data = new float[n];
            for (int i = 0; i < n; i++) data[i] = Mathf.Clamp(f(i / (float)Rate), -1f, 1f);
            var clip = AudioClip.Create("sfx", n, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }
        // 带指数衰减的正弦音
        static float Tone(float t, float freq, float decay) => t < 0 ? 0 : Mathf.Sin(2 * Mathf.PI * freq * t) * Mathf.Exp(-t / decay * 4f);
        // 骰子在杯里/桌上的咔哒声：一串随机的短噪声
        static float Rattle(float t, float len)
        {
            float v = 0;
            for (int k = 0; k < 7; k++)
            {
                float at = len * k / 7f, dt = t - at;
                if (dt >= 0 && dt < 0.03f) v += (Mathf.PerlinNoise(t * 9000f, k) * 2 - 1) * Mathf.Exp(-dt * 120f);
            }
            return v;
        }
        static float Thud(float t, float len) => t < 0 || t > len ? 0 : Mathf.Sin(2 * Mathf.PI * (140f - t * 400f) * t) * Mathf.Exp(-t * 25f) + (Mathf.PerlinNoise(t * 7000f, 1) * 2 - 1) * Mathf.Exp(-t * 60f) * 0.5f;
    }
}
