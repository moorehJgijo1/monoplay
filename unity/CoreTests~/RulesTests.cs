using System;
using System.IO;
using System.Linq;
using Monoplay.Core;
using Newtonsoft.Json.Linq;
using Xunit;

public class RulesTests
{
    static RulesHost NewHost()
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "rules");
        return new RulesHost(File.ReadAllText(Path.Combine(dir, "engine.js")), File.ReadAllText(Path.Combine(dir, "ai.js")));
    }
    static LocalSession.Seat[] Bots(int n) =>
        Enumerable.Range(0, n).Select(k => new LocalSession.Seat { id = "p" + k, name = "电脑" + k, isBot = true }).ToArray();

    [Fact]
    public void ConstantsLoad()
    {
        var c = NewHost().Constants;
        Assert.True(c.board.Count > 50);
        Assert.Equal(c.board.Count, c.adj.Count);
        Assert.Equal(6, c.characters.Count);
        Assert.Equal(19, c.cards.Count);
        Assert.Equal(6, c.stocks.Count);
        Assert.Equal("start", c.board[c.start].type);
        Assert.All(c.lands, i => Assert.Equal("land", c.board[i].type));
    }

    [Fact]
    public void QueriesWork()
    {
        var h = NewHost();
        var s = new LocalSession(h);
        s.Start(Bots(4), 30, 20000, seed: 1);
        var land = h.Constants.lands[0];
        Assert.True(h.BuyPrice(0, land) > 0);
        Assert.True(h.UpgradeCost(land) > 0);
        Assert.Equal(20000, s.State.players[0].cash);
        Assert.True(h.NetWorth(0) >= 20000);
        var p = s.State.players[0];
        Assert.NotEmpty(h.Landings(0, p.pos, p.prev, 7, null));
        Assert.True(h.CardPrice(0, "remote") > 0);
    }

    [Fact]
    public void HumanActionsAndErrors()
    {
        var h = NewHost();
        var s = new LocalSession(h);
        s.Start(new[] { new LocalSession.Seat { id = "me", name = "我" }, new LocalSession.Seat { id = "b", name = "电脑", isBot = true } }, 30, 20000, seed: 3);
        string err = null;
        s.Error += e => err = e;
        int me = s.State.IndexOf("me");
        if (s.State.current != me) { while (s.State.current != me) Assert.True(s.StepBot()); }
        s.Act(me, new JObject { ["type"] = "buy" });
        Assert.NotNull(err); // 还没掷骰子不能买地
        err = null;
        s.Act(me, new JObject { ["type"] = "roll" });
        Assert.Null(err);
        Assert.NotEqual("roll", s.State.phase);
        Assert.NotNull(s.State.dice);
    }

    [Theory]
    [InlineData(1)] [InlineData(2)] [InlineData(3)] [InlineData(4)] [InlineData(5)]
    [InlineData(6)] [InlineData(7)] [InlineData(8)] [InlineData(9)] [InlineData(10)]
    public void BotGamesFinish(int seed)
    {
        var h = NewHost();
        var s = new LocalSession(h);
        s.Start(Bots(2 + seed % 3), 20, 20000, seed);
        int steps = 0;
        while (s.State.phase != "over" && steps < 20000) { Assert.True(s.StepBot(), $"卡住了：phase={s.State.phase}"); steps++; }
        Assert.Equal("over", s.State.phase);
        Assert.NotNull(s.State.winner);
        // 存档/读档：读回来的局面应当一样
        var json = s.Save();
        var s2 = new LocalSession(NewHost());
        s2.Resume(json);
        Assert.Equal(s.State.players[0].cash, s2.State.players[0].cash);
    }
}

public class RulesSyncTests
{
    // Unity 用的规则文件必须和 Node 服务器用的是同一份（改了 public/engine.js 之后运行 npm run sync-unity）
    [Theory]
    [InlineData("engine.js")] [InlineData("ai.js")]
    public void StreamingAssetsMatchServerRules(string file)
    {
        var dir = AppContext.BaseDirectory;
        while (dir != null && !File.Exists(Path.Combine(dir, "server.js"))) dir = Path.GetDirectoryName(dir);
        Assert.NotNull(dir);
        var server = File.ReadAllText(Path.Combine(dir, "public", file));
        var unity = File.ReadAllText(Path.Combine(dir, "unity", "Assets", "StreamingAssets", "rules", file));
        Assert.True(server == unity, $"{file} 不一致，请运行 npm run sync-unity");
    }
}
