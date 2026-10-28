// engine.js 里局面和常量的 C# 镜像。字段名和 JS 一致（小写开头），直接用 Newtonsoft 反序列化。
// 只声明界面要用的字段；其他字段放进 Extra，不会丢。
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Monoplay.Core
{
    // ---------- 常量（地图、角色、道具卡、股票……） ----------
    public class GameConstants
    {
        public List<BoardCell> board;
        public List<int[]> adj;
        public int mapW, mapH, start, jail, hospital;
        public Dictionary<string, GroupInfo> groups;
        public Dictionary<string, CharacterInfo> characters;
        public List<string> charKeys;
        public Dictionary<string, GodInfo> gods;
        public Dictionary<string, CardInfo> cards;
        public List<string> cardKeys;
        public Dictionary<string, CardCat> cardCats;
        public Dictionary<string, StockInfo> stocks;
        public List<string> stockKeys;
        public List<string> levels;
        public List<int> levelMult;
        public int maxLevel, maxCards, lot;
        public double stockFee;
        public List<string> playerColors;
        public Dictionary<string, int> pace;
        public List<WheelFace> wheelFaces;
        public List<int> lands;
    }
    public class BoardCell { public string type, name, group; public int x, z, price; }
    public class GroupInfo { public string name, color; public int price; public List<string> cities; }
    public class CharacterInfo { public string name, emoji, skill; }
    public class GodInfo { public string name, emoji, desc; public bool good; public int turns; }
    public class CardInfo { public string cat, name, emoji, target, desc; public int price; public bool self; }
    public class CardCat { public string name, emoji, color; }
    public class StockInfo { public string name, emoji; public List<string> groups; public double @base; }
    public class WheelFace { public double w; public string @short, emoji, text, tone; }

    // ---------- 局面 ----------
    public class GameState
    {
        public List<PlayerState> players;
        public Dictionary<string, LandState> lands;
        public Dictionary<string, string> obstacles;
        public Dictionary<string, string> gods;
        public int current;
        public string phase;
        public int[] dice;
        public int? forcedDice;
        public int cardsUsed, seq, round, turn, maxRounds, diceSeq, diceN, trades;
        public List<MoveEntry> moves;
        public List<FxEntry> fx;
        public List<LogEntry> log;
        public int? winner;
        public Dictionary<string, MarketEntry> market;
        public ForkState fork;
        public int[] casinoDice;
        [JsonExtensionData] public IDictionary<string, JToken> Extra;

        public LandState Land(int cell) => lands != null && lands.TryGetValue(cell.ToString(), out var l) ? l : null;
        public string ObstacleAt(int cell) => obstacles != null && obstacles.TryGetValue(cell.ToString(), out var o) ? o : null;
        public string GodAt(int cell) => gods != null && gods.TryGetValue(cell.ToString(), out var g) ? g : null;
        public int IndexOf(string playerId) => players.FindIndex(p => p.id == playerId);
    }
    public class PlayerState
    {
        public string id, name, @char, color, stayAt;
        public bool isBot, auto, bankrupt;
        public int cash, points, pos, stay, turtle;
        public int? prev;
        public List<string> cards;
        public GodOnPlayer god;
        public Dictionary<string, int> stocks;
        public Dictionary<string, double> tips;
    }
    public class GodOnPlayer { public string key; public int turns; }
    public class LandState { public int? owner; public int level; }
    public class MoveEntry { public int n, player; public int[] path; public bool jump; }
    public class FxEntry { public int n; public string emoji, title, text, tone; public int? player; public JToken extra; }
    public class LogEntry { public int n; public string text; }
    public class MarketEntry { public double price, pressure, last; public List<double> hist; }
    public class ForkState { public int player, left; public int[] options; }
}
