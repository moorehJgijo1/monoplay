// 棋盘坐标：engine.js 的地图字符画（x 向右、z 向下）→ Unity 世界坐标（x 向右、z 向北，镜头在南边）。
// 也负责算出每块地产的地块朝向、路网围出的街区，以及某个位置属于哪种片区风格。
using System.Collections.Generic;
using System.Linq;
using Monoplay.Core;
using UnityEngine;

namespace Monoplay
{
    public class BoardLayout
    {
        public const float U = 2f;          // 相邻格子的间距
        public const float Tile = U * 0.82f; // 格子卡片边长
        public readonly GameConstants C;

        public BoardLayout(GameConstants c)
        {
            C = c;
            ComputeLots();
            ComputeBlocks();
        }

        public Vector3 World(float x, float z) => new Vector3((x - (C.mapW - 1) / 2f) * U, 0f, -(z - (C.mapH - 1) / 2f) * U);
        public Vector3 Cell(int i) => World(C.board[i].x, C.board[i].z);
        // 地图方向 → 世界方向（地图 z 向下 = 世界 -z）
        public static Vector3 Dir(Vector2Int d) => new Vector3(d.x, 0f, -d.y);

        public float HalfW => (C.mapW - 1) * U / 2f;
        public float HalfD => (C.mapH - 1) * U / 2f;

        // ---------- 地块 ----------
        public readonly Dictionary<int, Vector2Int> LotDir = new();
        readonly HashSet<Vector2Int> occupied = new();
        readonly HashSet<Vector2Int> usedLots = new();

        void ComputeLots()
        {
            foreach (var c in C.board) occupied.Add(new Vector2Int(c.x, c.z));
            foreach (int i in C.lands)
            {
                var c = C.board[i];
                bool horizontal = C.adj[i].Any(n => C.board[n].z == c.z);
                var dirs = horizontal ? new List<Vector2Int> { new(0, -1), new(0, 1) } : new List<Vector2Int> { new(1, 0), new(-1, 0) };
                bool Outside(Vector2Int d) => c.x + d.x < 0 || c.x + d.x >= C.mapW || c.z + d.y < 0 || c.z + d.y >= C.mapH;
                dirs = dirs.OrderByDescending(d => Outside(d) ? 1 : 0).ToList();
                var pick = dirs.FirstOrDefault(d => !occupied.Contains(new Vector2Int(c.x + d.x, c.z + d.y)) && !usedLots.Contains(new Vector2Int(c.x + d.x, c.z + d.y)));
                if (pick == default) pick = dirs[0];
                usedLots.Add(new Vector2Int(c.x + pick.x, c.z + pick.y));
                LotDir[i] = pick;
            }
        }
        public Vector3 LotCenter(int cell) => Cell(cell) + Dir(LotDir[cell]) * U;

        // ---------- 街区（路网围出的空地，摆主题景观） ----------
        public class Block
        {
            public List<Vector2Int> cells = new();
            public int x0, x1, z0, z1;
            public RectInt free;     // 其中最大的一块完整空地（地图坐标）
            public string theme;     // old / cbd / beach / fun
            public Vector3 center;   // 世界坐标
        }
        public readonly List<Block> Blocks = new();
        static readonly string[] Themes = { "old", "cbd", "beach", "fun" };

        void ComputeBlocks()
        {
            var seen = new HashSet<Vector2Int>();
            for (int z = 0; z < C.mapH; z++)
                for (int x = 0; x < C.mapW; x++)
                {
                    var k0 = new Vector2Int(x, z);
                    if (occupied.Contains(k0) || seen.Contains(k0)) continue;
                    var b = new Block();
                    var stack = new Stack<Vector2Int>();
                    stack.Push(k0); seen.Add(k0);
                    while (stack.Count > 0)
                    {
                        var p = stack.Pop();
                        b.cells.Add(p);
                        foreach (var d in new[] { new Vector2Int(1, 0), new Vector2Int(-1, 0), new Vector2Int(0, 1), new Vector2Int(0, -1) })
                        {
                            var n = p + d;
                            if (n.x < 0 || n.y < 0 || n.x >= C.mapW || n.y >= C.mapH || occupied.Contains(n) || seen.Contains(n)) continue;
                            seen.Add(n); stack.Push(n);
                        }
                    }
                    if (b.cells.Count < 6) continue;
                    b.x0 = b.cells.Min(c => c.x); b.x1 = b.cells.Max(c => c.x);
                    b.z0 = b.cells.Min(c => c.y); b.z1 = b.cells.Max(c => c.y);
                    var free = new HashSet<Vector2Int>(b.cells.Where(c => !usedLots.Contains(c)));
                    RectInt best = default; int bestArea = 0;
                    for (int ax = b.x0; ax <= b.x1; ax++) for (int bx = ax; bx <= b.x1; bx++)
                        for (int az = b.z0; az <= b.z1; az++) for (int bz = az; bz <= b.z1; bz++)
                        {
                            bool ok = true;
                            for (int xx = ax; xx <= bx && ok; xx++) for (int zz = az; zz <= bz && ok; zz++) ok = free.Contains(new Vector2Int(xx, zz));
                            int area = (bx - ax + 1) * (bz - az + 1);
                            if (ok && area > bestArea) { bestArea = area; best = new RectInt(ax, az, bx - ax + 1, bz - az + 1); }
                        }
                    if (bestArea == 0) continue;
                    b.free = best;
                    b.center = World((b.x0 + b.x1) / 2f, (b.z0 + b.z1) / 2f);
                    Blocks.Add(b);
                }
            // 先北后南、先西后东：西北古城、东北金融区、西南海滨、东南游乐园
            int k = 0;
            foreach (var b in Blocks.OrderBy(b => (b.z0 + b.z1) / 2f).ThenBy(b => (b.x0 + b.x1) / 2f)) b.theme = Themes[k++ % Themes.Length];
        }

        public bool InBlock(Vector2Int c) => Blocks.Any(b => b.cells.Contains(c));
        public bool IsRoad(Vector2Int c) => occupied.Contains(c);
        public bool IsLot(Vector2Int c) => usedLots.Contains(c);

        // 某个世界坐标属于哪种片区风格：看离哪个主题街区最近
        public string StyleAt(Vector3 p)
        {
            string best = "cbd"; float bd = float.MaxValue;
            foreach (var b in Blocks)
            {
                float d = (new Vector2(b.center.x, b.center.z) - new Vector2(p.x, p.z)).sqrMagnitude;
                if (d < bd) { bd = d; best = b.theme; }
            }
            return best;
        }

        // 某块街区里最大空地的世界坐标中心和尺寸
        public (Vector3 center, float w, float d) FreeArea(Block b)
        {
            var a = World(b.free.xMin, b.free.yMin);
            var c = World(b.free.xMax - 1, b.free.yMax - 1);
            return ((a + c) / 2f, Mathf.Abs(c.x - a.x) + U, Mathf.Abs(c.z - a.z) + U);
        }
    }
}
