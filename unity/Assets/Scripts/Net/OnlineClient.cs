// 联机客户端：和仓库里的 Node 服务器（server.js）说同一套协议——
// HTTP POST 创建/加入房间、发送行动；GET /stream 是 Server-Sent Events，服务器每次有变化就推送完整的房间和局面。
// 断线会自动重连；服务器那边断线 30 秒会自动托管，回来自动解除。
using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Monoplay.Core;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace Monoplay
{
    public class OnlineClient : MonoBehaviour
    {
        public string BaseUrl { get; private set; }
        public string RoomId { get; private set; }
        public string Token { get; private set; }
        public string You { get; private set; }
        public JObject Room { get; private set; }
        public JArray Chat { get; private set; }
        public string StateJson { get; private set; }
        public event Action Updated;
        public event Action Kicked;
        UnityWebRequest stream;
        bool closed;

        public static OnlineClient Create(string server)
        {
            var go = new GameObject("OnlineClient");
            DontDestroyOnLoad(go);
            var c = go.AddComponent<OnlineClient>();
            var url = (server ?? "").Trim().TrimEnd('/');
            if (!url.StartsWith("http")) url = "http://" + url;
            c.BaseUrl = url;
            return c;
        }

        // ---------- 房间 ----------
        public void CreateRoom(string name, string ch, Action<string> done) =>
            StartCoroutine(Post("/api/rooms", new JObject { ["name"] = name, ["char"] = ch }, (r, err) => Joined(r, err, done)));
        public void JoinRoom(string code, string name, string ch, Action<string> done) =>
            StartCoroutine(Post($"/api/rooms/{code}/join", new JObject { ["name"] = name, ["char"] = ch }, (r, err) => Joined(r, err, done)));

        void Joined(JObject r, string err, Action<string> done)
        {
            if (err != null) { done(err); return; }
            RoomId = (string)r["roomId"];
            Token = (string)r["token"];
            You = (string)r["playerId"];
            OpenStream();
            done(null);
        }

        // 房间里的操作：chat / char / addBot / kick / settings / start / action
        public void Send(string action, JObject body, Action<string> done = null)
        {
            body ??= new JObject();
            body["token"] = Token;
            StartCoroutine(Post($"/api/rooms/{RoomId}/{action}", body, (r, err) => done?.Invoke(err)));
        }

        IEnumerator Post(string path, JObject body, Action<JObject, string> done)
        {
            using var req = new UnityWebRequest(BaseUrl + path, "POST");
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body.ToString(Formatting.None)));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.timeout = 10;
            yield return req.SendWebRequest();
            JObject r = null;
            try { r = JObject.Parse(req.downloadHandler.text ?? "{}"); } catch { }
            if (req.result != UnityWebRequest.Result.Success)
            {
                var msg = r?["error"]?.ToString();
                done(null, msg ?? (req.result == UnityWebRequest.Result.ConnectionError ? "连不上服务器，请检查地址和网络" : req.error));
            }
            else done(r, r?["error"]?.ToString());
        }

        // ---------- 推送流 ----------
        void OpenStream()
        {
            if (closed) return;
            stream = new UnityWebRequest($"{BaseUrl}/api/rooms/{RoomId}/stream?token={UnityWebRequest.EscapeURL(Token)}", "GET");
            stream.downloadHandler = new SseHandler(OnEvent);
            stream.timeout = 0;
            stream.SendWebRequest();
            StartCoroutine(WatchStream(stream));
        }

        IEnumerator WatchStream(UnityWebRequest req)
        {
            while (!req.isDone) yield return null;
            req.Dispose();
            if (closed) yield break;
            yield return new WaitForSecondsRealtime(2f);
            OpenStream();
        }

        void OnEvent(string ev, string data)
        {
            if (ev == "kicked") { Kicked?.Invoke(); Close(); return; }
            JObject msg;
            try { msg = JObject.Parse(data); } catch { return; }
            Room = msg["room"] as JObject;
            Chat = msg["chat"] as JArray;
            var st = msg["state"];
            StateJson = st == null || st.Type == JTokenType.Null ? null : st.ToString(Formatting.None);
            Updated?.Invoke();
        }

        public void Close()
        {
            closed = true;
            if (stream != null && !stream.isDone) stream.Abort();
            Destroy(gameObject);
        }

        // 一行行解析 Server-Sent Events：事件之间用空行分隔
        class SseHandler : DownloadHandlerScript
        {
            readonly Action<string, string> onEvent;
            readonly List<byte> buf = new();
            public SseHandler(Action<string, string> cb) : base(new byte[16 * 1024]) { onEvent = cb; }
            protected override bool ReceiveData(byte[] data, int len)
            {
                for (int i = 0; i < len; i++) buf.Add(data[i]);
                while (true)
                {
                    int cut = -1;
                    for (int i = 1; i < buf.Count; i++) if (buf[i] == '\n' && buf[i - 1] == '\n') { cut = i; break; }
                    if (cut < 0) break;
                    var text = Encoding.UTF8.GetString(buf.GetRange(0, cut + 1).ToArray());
                    buf.RemoveRange(0, cut + 1);
                    string ev = "message";
                    var sb = new StringBuilder();
                    foreach (var line in text.Split('\n'))
                    {
                        if (line.StartsWith("event:")) ev = line.Substring(6).Trim();
                        else if (line.StartsWith("data:")) sb.Append(line.Substring(5).TrimStart());
                    }
                    if (sb.Length > 0 || ev != "message") onEvent(ev, sb.ToString());
                }
                return true;
            }
        }
    }

    // 联机的一局：局面以服务器为准；本地的 RulesHost 只用来做查询（过路费、落点预览）
    public class OnlineSession : IGameSession
    {
        readonly OnlineClient c;
        public RulesHost Rules { get; }
        public GameState State { get; private set; }
        public bool IsOnline => true;
        public int Me => State == null ? -1 : State.IndexOf(c.You);
        public OnlineClient Client => c;
        public event Action StateChanged;
        public event Action<string> Error;

        public OnlineSession(OnlineClient client, RulesHost rules)
        {
            c = client;
            Rules = rules;
            c.Updated += OnUpdate;
            OnUpdate();
        }

        void OnUpdate()
        {
            if (c.StateJson == null) return;
            Rules.LoadState(c.StateJson);
            State = JsonConvert.DeserializeObject<GameState>(c.StateJson);
            StateChanged?.Invoke();
        }

        public bool Controls(int i) => State != null && i >= 0 && i < State.players.Count && State.players[i].id == c.You;
        public void Act(int i, JObject action) => c.Send("action", new JObject { ["action"] = action }, err => { if (err != null) Error?.Invoke(err); });
        public void Tick(double nowMs, bool viewBusy) { }
        public void Close() { c.Updated -= OnUpdate; c.Close(); }
    }
}
