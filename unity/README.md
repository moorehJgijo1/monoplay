# 大富翁·欢乐城：Unity 电脑客户端

这是游戏的 Unity 版（Windows / macOS 电脑客户端）。规则和联机服务器还是仓库根目录那一套：

- 规则：`public/engine.js`、`public/ai.js`。Unity 里用 [Jint](https://github.com/sebastienros/jint)（C# 写的 JavaScript 解释器）直接运行这两个文件，所以单机、联机、服务器三方的规则永远一致。Unity 用的副本在 `Assets/StreamingAssets/rules/`，改了规则后在仓库根目录运行 `npm run sync-unity` 同步。
- 联机：还是用 `node server.js` 启动的服务器，协议不变。

## 第一次打开

1. 安装 [Unity Hub](https://unity.com/download)，在 Hub 里安装 **Unity 6**（6000.x 的 LTS 版本即可，安装时勾选你要打包的平台，比如 Windows Build Support）。
2. Hub → **Add / 添加** → **Add project from disk**，选这个 `unity` 文件夹，用 Unity 6 打开。
3. 第一次打开要导入素材，需要几分钟。如果弹出「是否启用新的输入系统 / enable the new Input System backends」，点 **Yes**，编辑器会重启一次（选 No 也能玩）。
4. 打开后会自动运行初始化（也可以随时点菜单 **大富翁 → 初始化工程**）：
   - 创建 URP 渲染管线（软阴影、HDR、抗锯齿、SSAO 环境光遮蔽、泛光等后期）
   - 生成基础材质、导入 TextMeshPro 资源
   - 创建主场景 `Assets/Scenes/Main.unity` 并加入打包列表
5. 点编辑器顶部的 **▶ 播放** 就能玩。场景里不需要摆任何东西，所有画面都由代码生成。

如果画面是粉红色，说明渲染管线没设置上，点一下菜单 **大富翁 → 初始化工程** 再播放。

## 操作

- 鼠标右键（或中键）拖动：旋转视角；滚轮：缩放
- 左键点格子：查看地产信息；岔路口时点金色箭头选方向；道具卡要选格子时点闪红光的格子
- 右上角：全景 / 跟随、速度、托管、菜单（认输、保存并回到主菜单）
- 单机进度会自动保存，下次在主菜单点「继续上一局」

## 联机

1. 在一台电脑上运行服务器：仓库根目录 `node server.js`（默认端口 3000）。
2. 客户端主菜单 → **联机对战**，服务器地址填 `http://服务器的IP:3000`（同一台电脑填 `http://localhost:3000`），创建房间。
3. 朋友填同一个服务器地址和 4 位房间号加入。房主可以加电脑、改设置、开始游戏。

## 打包成电脑客户端

**File → Build Profiles**（旧版本叫 Build Settings）→ 选 Windows 或 macOS → **Build**，选一个输出文件夹即可得到可以直接运行的游戏。

## 代码结构

```
Assets/
├── Scripts/Core/      规则宿主和数据模型（不依赖 Unity，可以单独测试）
│   ├── RulesHost.cs   用 Jint 运行 engine.js / ai.js
│   ├── GameModels.cs  局面、常量的 C# 镜像
│   └── GameSession.cs 单机会话（电脑玩家等动画播完再行动）
├── Scripts/Game/      3D 场景
│   ├── App.cs         入口：自动搭相机、灯光、界面
│   ├── Look.cs        材质、灯光、天空、雾、后期效果
│   ├── Kenney.cs      Kenney 模型加载（统一换 URP 材质、按占地缩放）
│   ├── BoardLayout.cs 地图坐标、地块朝向、主题街区
│   ├── BoardView.cs   小岛、海、路网、格子卡片、地块、神仙/路障标记
│   ├── Buildings.cs   四种风格的楼房（中式楼阁、写字楼、海滨住宅、童话城堡）
│   ├── Scenery.cs     四个主题街区的地标、郊区、树
│   ├── RingRoad.cs    环岛路和车流
│   ├── PieceView.cs   棋子（Kenney 小人）
│   ├── DiceView.cs    骰子
│   ├── CameraRig.cs   镜头
│   ├── GameView.cs    播放动画、选格子
│   └── Sfx.cs         代码合成的音效
├── Scripts/UI/        界面（全部代码生成）：主菜单、联机房间、游戏 HUD
├── Scripts/Net/       联机客户端（HTTP + Server-Sent Events）
├── Editor/            工程初始化、Kenney 模型导入设置
├── Resources/Kenney/  Kenney 免费 3D 素材
├── Resources/Fonts/   思源黑体（Noto Sans SC）
├── Plugins/Jint/      Jint、Acornima
└── StreamingAssets/rules/  engine.js、ai.js 的副本
CoreTests~/            核心代码测试（Unity 会忽略带 ~ 的文件夹）
```

不需要 Unity 也能测试核心代码（规则宿主、单机会话、存档、规则文件同步）：

```bash
cd unity/CoreTests~
dotnet test
```

## 第三方素材和库

| 名称 | 用途 | 许可 |
|---|---|---|
| [Kenney](https://kenney.nl) City Kit（Suburban / Commercial / Industrial / Roads）、Car Kit、Nature Kit、Fantasy Town Kit、Pirate Kit、Mini Characters、Castle Kit、Survival Kit、Holiday Kit | 3D 模型 | CC0（每个文件夹里有 License.txt） |
| [Noto Sans SC](https://github.com/notofonts/noto-cjk)（思源黑体） | 中文字体 | SIL Open Font License 1.1 |
| [Jint](https://github.com/sebastienros/jint) 4.16.4 | C# 里运行 JavaScript | BSD 2-Clause |
| [Acornima](https://github.com/adams85/acornima) 1.8.0 | Jint 的 JS 解析器 | BSD 3-Clause |
| System.Runtime.CompilerServices.Unsafe 6.0.0 | Jint 依赖 | MIT |
