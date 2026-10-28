// 界面根节点：一块全屏画布（按 1920×1080 等比缩放），下面挂主菜单、联机房间、游戏 HUD 三个界面。
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace Monoplay
{
    public class UiRoot : MonoBehaviour
    {
        public RectTransform Root { get; private set; }
        public MenuScreen Menu { get; private set; }
        public RoomScreen Room { get; private set; }
        public HudScreen Hud { get; private set; }
        TextMeshProUGUI toast;
        float toastUntil;

        public static UiRoot Create(TMP_FontAsset font)
        {
            UiKit.Font = font;
            var go = new GameObject("UI", typeof(RectTransform));
            DontDestroyOnLoad(go);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            if (!FindAnyObjectByType<EventSystem>())
            {
                var es = new GameObject("EventSystem");
                DontDestroyOnLoad(es);
                es.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
                es.AddComponent<InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
            }
            var ui = go.AddComponent<UiRoot>();
            ui.Root = (RectTransform)go.transform;
            ui.Menu = MenuScreen.Create(ui);
            ui.Room = RoomScreen.Create(ui);
            ui.Hud = HudScreen.Create(ui);
            ui.toast = UiKit.Label(ui.Root, "", 28, Color.white, TextAlignmentOptions.Center, "Toast");
            UiKit.Place(ui.toast.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -260), new Vector2(1000, 60));
            ui.toast.outlineWidth = 0.25f;
            ui.toast.outlineColor = new Color32(0, 0, 0, 200);
            return ui;
        }

        public void ShowMenu()
        {
            Hud.gameObject.SetActive(false);
            Room.gameObject.SetActive(false);
            Menu.gameObject.SetActive(true);
            Menu.Refresh();
        }
        public void ShowRoom(OnlineClient c)
        {
            Menu.gameObject.SetActive(false);
            Hud.gameObject.SetActive(false);
            Room.gameObject.SetActive(true);
            Room.Bind(c);
        }
        public void ShowGame(Core.IGameSession s, GameView v)
        {
            Menu.gameObject.SetActive(false);
            Room.gameObject.SetActive(false);
            Hud.gameObject.SetActive(true);
            Hud.Bind(s, v);
        }

        // 屏幕下方的一行提示（错误、操作反馈）
        public void Toast(string msg, float seconds = 2.2f)
        {
            toast.text = UiKit.Clean(msg);
            toastUntil = Time.unscaledTime + seconds;
            toast.transform.SetAsLastSibling();
        }
        void Update() { if (toast.text.Length > 0 && Time.unscaledTime > toastUntil) toast.text = ""; }

        public static bool PointerOverUi() => EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
    }
}
