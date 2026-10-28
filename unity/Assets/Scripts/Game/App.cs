// 游戏入口：场景里不需要预先摆任何东西，进入播放模式后自动搭好相机、灯光、界面和主菜单。
// 规则来自 StreamingAssets/rules 下的 engine.js / ai.js（和 Node 联机服务器是同一份）。
using System.IO;
using Monoplay.Core;
using TMPro;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace Monoplay
{
    public class App : MonoBehaviour
    {
        public static App I { get; private set; }

        public RulesHost Rules { get; private set; }
        public GameConstants C => Rules.Constants;
        public TMP_FontAsset Font { get; private set; }
        public Settings Settings { get; private set; }

        public BoardView Board { get; private set; }
        public CameraRig Cam { get; private set; }
        public UiRoot Ui { get; private set; }

        IGameSession session;
        GameView view;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (I != null) return;
            var go = new GameObject("Monoplay");
            DontDestroyOnLoad(go);
            go.AddComponent<App>();
        }

        void Awake()
        {
            I = this;
            Application.targetFrameRate = 120;
            QualitySettings.vSyncCount = 1;
            Settings = Settings.Load();

            var dir = Path.Combine(Application.streamingAssetsPath, "rules");
            Rules = new RulesHost(File.ReadAllText(Path.Combine(dir, "engine.js")), File.ReadAllText(Path.Combine(dir, "ai.js")));

            Font = LoadFont();
            Look.Setup();
            Cam = CameraRig.Create();
            Board = BoardView.Create(Rules.Constants);
            Ui = UiRoot.Create(Font);
            ShowBlankBoard();
            Cam.Showcase(true);
            Ui.ShowMenu();
        }

        static TMP_FontAsset LoadFont()
        {
            var f = Resources.Load<Font>("Fonts/NotoSansSC-Bold");
            // 动态字体：用到哪个汉字才往图集里画哪个，图集满了自动开新的
            var fa = TMP_FontAsset.CreateFontAsset(f, 72, 8, GlyphRenderMode.SDFAA, 2048, 2048, AtlasPopulationMode.Dynamic, true);
            fa.name = "NotoSansSC (dynamic)";
            return fa;
        }

        // ---------- 开局 / 退出 ----------
        public void StartLocal(LocalSession.Seat[] seats, int maxRounds, int startingCash)
        {
            var s = new LocalSession(Rules);
            s.Start(seats, maxRounds, startingCash);
            Begin(s, fresh: true);
        }

        public bool HasSave => File.Exists(SavePath);
        static string SavePath => Path.Combine(Application.persistentDataPath, "save.json");

        public void ResumeLocal()
        {
            var s = new LocalSession(Rules);
            s.Resume(File.ReadAllText(SavePath));
            Begin(s, fresh: false);
        }

        public void StartOnline(OnlineSession s) => Begin(s, fresh: true);

        void Begin(IGameSession s, bool fresh)
        {
            session = s;
            Cam.Showcase(false);
            view = GameView.Create(s, Board, Cam, Ui);
            Ui.ShowGame(s, view);
            view.Begin(fresh);
        }

        public void QuitToMenu()
        {
            SaveLocal();
            if (session is OnlineSession o) o.Close();
            session = null;
            if (view) Destroy(view.gameObject);
            view = null;
            ShowBlankBoard();
            Cam.Showcase(true);
            Ui.ShowMenu();
        }

        // 用一局空白的新游戏把棋盘恢复成没人买过地的样子
        void ShowBlankBoard()
        {
            Rules.NewGame(new[] { new LocalSession.Seat { id = "a", name = "A", isBot = true }, new LocalSession.Seat { id = "b", name = "B", isBot = true } },
                new System.Collections.Generic.Dictionary<string, object> { ["seed"] = 1 });
            Board.ShowBlank(Rules.State(), Rules);
        }

        void SaveLocal()
        {
            if (session is LocalSession l && l.State != null)
            {
                if (l.State.phase == "over") { if (File.Exists(SavePath)) File.Delete(SavePath); }
                else File.WriteAllText(SavePath, l.Save());
            }
        }

        void Update()
        {
            session?.Tick(Time.realtimeSinceStartupAsDouble * 1000.0, view != null && view.Busy);
        }

        void OnApplicationQuit() => SaveLocal();
    }

    // 玩家偏好：昵称、角色、速度、音量
    [System.Serializable]
    public class Settings
    {
        public string name = "";
        public string character = "atubo";
        public int speed = 1; // 0 慢 1 中 2 快
        public float volume = 0.8f;
        public string server = "http://localhost:3000";

        public float SpeedMul => speed == 0 ? 0.7f : speed == 2 ? 1.8f : 1.1f;

        public static Settings Load()
        {
            var json = PlayerPrefs.GetString("settings", "");
            return string.IsNullOrEmpty(json) ? new Settings() : JsonUtility.FromJson<Settings>(json);
        }
        public void Save() { PlayerPrefs.SetString("settings", JsonUtility.ToJson(this)); PlayerPrefs.Save(); }
    }
}
