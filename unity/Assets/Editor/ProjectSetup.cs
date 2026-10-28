// 工程初始化（编辑器里自动运行一次，也可以点菜单「大富翁 → 初始化工程」重新运行）：
//   1. 创建 URP 渲染管线（阴影、抗锯齿、HDR、SSAO 环境光遮蔽）并设为当前管线
//   2. 在 Resources/Materials 下生成几个基础材质（运行时以它们为模板复制，保证打包时着色器变体不被裁掉）
//   3. 导入 TextMeshPro 必需资源
//   4. 创建主场景并加入 Build Settings；设置窗口标题、分辨率等
// Kenney 模型的导入设置在下面的 KenneyImport 里（关掉动画、相机、灯光导入）。
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Monoplay.EditorTools
{
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        const string Done = "Assets/Settings/.monoplay-setup-done";

        static ProjectSetup()
        {
            EditorApplication.delayCall += () =>
            {
                if (!File.Exists(Done) || GraphicsSettings.defaultRenderPipeline == null) Run();
            };
        }

        [MenuItem("大富翁/初始化工程")]
        public static void Run()
        {
            try
            {
                Directory.CreateDirectory("Assets/Settings");
                Directory.CreateDirectory("Assets/Resources/Materials");
                Directory.CreateDirectory("Assets/Scenes");
                SetupPipeline();
                SetupMaterials();
                ImportTmp();
                SetupScene();
                SetupPlayer();
                File.WriteAllText(Done, DateTime.Now.ToString("s"));
                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();
                Debug.Log("[大富翁] 工程初始化完成。点编辑器上方的 ▶ 播放按钮就能开始玩。");
            }
            catch (Exception e)
            {
                Debug.LogError("[大富翁] 初始化失败：" + e);
            }
        }

        // ---------- URP ----------
        static void SetupPipeline()
        {
            const string assetPath = "Assets/Settings/URP-Monoplay.asset", rendererPath = "Assets/Settings/URP-Monoplay-Renderer.asset";
            var asset = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(assetPath);
            if (!asset)
            {
                var renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, rendererPath);
                FillPostProcessData(renderer);
                AddSsao(renderer);
                asset = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(asset, assetPath);
            }
            asset.shadowDistance = 90f;
            asset.shadowCascadeCount = 2;
            asset.supportsHDR = true;
            asset.msaaSampleCount = 4;
            asset.renderScale = 1f;
            TrySet(asset, "supportsSoftShadows", true);
            TrySet(asset, "mainLightShadowmapResolution", 4096);
            TrySet(asset, "supportsMainLightShadows", true);
            EditorUtility.SetDirty(asset);
            GraphicsSettings.defaultRenderPipeline = asset;
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = asset;
            }
            QualitySettings.SetQualityLevel(QualitySettings.names.Length - 1, true);
        }

        // 后期处理用的默认资源（泛光、色调映射需要）
        static void FillPostProcessData(UniversalRendererData renderer)
        {
            try
            {
                if (renderer.postProcessData != null) return;
                var m = typeof(PostProcessData).GetMethod("GetDefaultPostProcessData", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
                if (m != null) renderer.postProcessData = (PostProcessData)m.Invoke(null, null);
                if (renderer.postProcessData == null)
                {
                    var guid = AssetDatabase.FindAssets("t:PostProcessData", new[] { "Packages/com.unity.render-pipelines.universal" }).FirstOrDefault();
                    if (guid != null) renderer.postProcessData = AssetDatabase.LoadAssetAtPath<PostProcessData>(AssetDatabase.GUIDToAssetPath(guid));
                }
                EditorUtility.SetDirty(renderer);
            }
            catch (Exception e) { Debug.LogWarning("[大富翁] 没能自动设置 PostProcessData：" + e.Message); }
        }

        // 屏幕空间环境光遮蔽：房子、树和地面接触的地方有柔和的阴影，立体感强很多
        static void AddSsao(UniversalRendererData renderer)
        {
            try
            {
                var type = typeof(UniversalRendererData).Assembly.GetType("UnityEngine.Rendering.Universal.ScreenSpaceAmbientOcclusion");
                if (type == null || renderer.rendererFeatures.Any(f => f && f.GetType() == type)) return;
                var feature = (ScriptableRendererFeature)ScriptableObject.CreateInstance(type);
                feature.name = "SSAO";
                AssetDatabase.AddObjectToAsset(feature, renderer);
                renderer.rendererFeatures.Add(feature);
                if (AssetDatabase.TryGetGUIDAndLocalFileIdentifier(feature, out _, out long id))
                {
                    var map = typeof(ScriptableRendererData).GetField("m_RendererFeatureMap", BindingFlags.Instance | BindingFlags.NonPublic);
                    if (map?.GetValue(renderer) is System.Collections.Generic.List<long> list) list.Add(id);
                }
                EditorUtility.SetDirty(renderer);
            }
            catch (Exception e) { Debug.LogWarning("[大富翁] 没能添加 SSAO：" + e.Message); }
        }

        static void TrySet(object obj, string prop, object value)
        {
            var p = obj.GetType().GetProperty(prop, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (p != null && p.CanWrite) { try { p.SetValue(obj, value); } catch { } return; }
            var f = obj.GetType().GetField("m_" + char.ToUpper(prop[0]) + prop.Substring(1), BindingFlags.Instance | BindingFlags.NonPublic);
            if (f != null) { try { f.SetValue(obj, value); } catch { } }
        }

        // ---------- 基础材质 ----------
        static void SetupMaterials()
        {
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            var unlit = Shader.Find("Universal Render Pipeline/Unlit");
            Make("Lit", lit, m => { m.SetFloat("_Smoothness", 0.25f); });
            Make("Unlit", unlit, m => { });
            Make("LitEmissive", lit, m =>
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", Color.white);
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            });
            Make("UnlitTransparent", unlit, m =>
            {
                m.SetFloat("_Surface", 1f);
                m.SetFloat("_Blend", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)RenderQueue.Transparent;
                m.SetColor("_BaseColor", new Color(1, 1, 1, 0.5f));
            });
        }

        static void Make(string name, Shader shader, Action<Material> setup)
        {
            var path = $"Assets/Resources/Materials/{name}.mat";
            if (AssetDatabase.LoadAssetAtPath<Material>(path)) return;
            if (!shader) { Debug.LogWarning("[大富翁] 找不到 URP 着色器，URP 包装好了吗？"); return; }
            var m = new Material(shader) { name = name };
            setup(m);
            AssetDatabase.CreateAsset(m, path);
        }

        // ---------- TextMeshPro ----------
        static void ImportTmp()
        {
            if (AssetDatabase.FindAssets("t:TMP_Settings").Length > 0) return;
            foreach (var p in new[] { "Packages/com.unity.ugui/Package Resources/TMP Essential Resources.unitypackage", "Packages/com.unity.textmeshpro/Package Resources/TMP Essential Resources.unitypackage" })
            {
                if (!File.Exists(Path.GetFullPath(p))) continue;
                AssetDatabase.ImportPackage(p, false);
                return;
            }
            Debug.LogWarning("[大富翁] 没找到 TMP Essential Resources，请手动点菜单 Window → TextMeshPro → Import TMP Essential Resources");
        }

        // ---------- 场景和发布设置 ----------
        static void SetupScene()
        {
            const string path = "Assets/Scenes/Main.unity";
            if (!File.Exists(path))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, path);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(path, true) };
            if (EditorSceneManager.GetActiveScene().path != path && !EditorApplication.isPlayingOrWillChangePlaymode)
                EditorSceneManager.OpenScene(path);
        }

        static void SetupPlayer()
        {
            PlayerSettings.companyName = "Monoplay";
            PlayerSettings.productName = "大富翁·欢乐城";
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.colorSpace = ColorSpace.Linear;
        }
    }

    // Kenney 模型：只要网格和材质，不要动画、相机、灯光
    public class KenneyImport : AssetPostprocessor
    {
        void OnPreprocessModel()
        {
            if (!assetPath.Contains("/Resources/Kenney/")) return;
            var mi = (ModelImporter)assetImporter;
            mi.importAnimation = false;
            mi.animationType = ModelImporterAnimationType.None;
            mi.importCameras = false;
            mi.importLights = false;
            mi.importBlendShapes = false;
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
        }

        void OnPreprocessTexture()
        {
            if (!assetPath.Contains("/Resources/Kenney/")) return;
            var ti = (TextureImporter)assetImporter;
            ti.mipmapEnabled = false; // 色板贴图开 mipmap 会让相邻颜色互相渗
            ti.filterMode = FilterMode.Bilinear;
        }
    }
}
