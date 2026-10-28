// 镜头：绕着目标点转（右键拖动旋转、滚轮缩放），跟随当前玩家或看全景；主菜单时慢慢自转展示城市。
using UnityEngine;
using UnityEngine.Rendering.Universal;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Monoplay
{
    public class CameraRig : MonoBehaviour
    {
        public Camera Cam { get; private set; }
        Vector3 target, wantTarget;
        float yaw = 0f, pitch = 48f, dist = 22f, wantDist = 22f;
        bool showcase;
        public bool Follow = true;
        public Transform FollowTarget;

        public const float FollowDist = 17f, OverviewDist = 52f;

        public static CameraRig Create()
        {
            var go = new GameObject("Camera");
            DontDestroyOnLoad(go);
            go.tag = "MainCamera";
            var cam = go.AddComponent<Camera>();
            cam.fieldOfView = 35f;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 600f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Look.Hex("#bfe6fb");
            var data = cam.GetUniversalAdditionalCameraData();
            data.renderPostProcessing = true;
            data.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            data.antialiasingQuality = AntialiasingQuality.High;
            go.AddComponent<AudioListener>();
            var rig = go.AddComponent<CameraRig>();
            rig.Cam = cam;
            return rig;
        }

        public void Showcase(bool on)
        {
            showcase = on;
            FollowTarget = null;
            wantTarget = Vector3.zero;
            wantDist = on ? OverviewDist * 0.95f : FollowDist;
            pitch = on ? 40f : 48f;
        }

        public void SetOverview(bool overview)
        {
            Follow = !overview;
            wantDist = overview ? OverviewDist : FollowDist;
            if (overview) wantTarget = Vector3.zero;
        }

        // 开场：从全景俯冲到第一位玩家
        public void SwoopFromOverview()
        {
            dist = OverviewDist;
            wantDist = FollowDist;
            Follow = true;
        }

        void LateUpdate()
        {
            float dt = Time.unscaledDeltaTime;
            if (showcase) yaw += dt * 4f;
            else HandleInput();
            if (!showcase && Follow && FollowTarget) wantTarget = new Vector3(FollowTarget.position.x, 0, FollowTarget.position.z);
            target = Vector3.Lerp(target, wantTarget, 1f - Mathf.Pow(0.02f, dt));
            dist = Mathf.Lerp(dist, wantDist, 1f - Mathf.Pow(0.05f, dt));
            var rot = Quaternion.Euler(pitch, yaw, 0);
            transform.position = target + rot * new Vector3(0, 0, -dist);
            transform.rotation = rot;
        }

        void HandleInput()
        {
            if (UiRoot.PointerOverUi()) return;
            Vector2 delta = Vector2.zero; float scroll = 0f; bool rotating = false;
#if ENABLE_INPUT_SYSTEM
            var m = Mouse.current;
            if (m != null)
            {
                rotating = m.rightButton.isPressed || m.middleButton.isPressed;
                delta = m.delta.ReadValue();
                scroll = m.scroll.ReadValue().y / 120f;
            }
#else
            rotating = Input.GetMouseButton(1) || Input.GetMouseButton(2);
            delta = new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y")) * 10f;
            scroll = Input.mouseScrollDelta.y;
#endif
            if (rotating)
            {
                yaw += delta.x * 0.25f;
                pitch = Mathf.Clamp(pitch - delta.y * 0.2f, 22f, 75f);
            }
            if (Mathf.Abs(scroll) > 0.01f) wantDist = Mathf.Clamp(wantDist * (1f - scroll * 0.1f), 8f, 70f);
        }
    }
}
