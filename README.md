# PCL 主页工坊 🎨

可视化编辑 **Plain Craft Launcher 2**（Minecraft 启动器）的自定义主页，导出 `Custom.xaml` 直接丢进 PCL 就能用。

---

## 🚀 两种打开方式

| 方式 | 怎么做 | 说明 |
|---|---|---|
| **EXE（推荐）** | 双击 `PCL主页工坊.exe` | 原生 Windows 程序：自己的窗口、自己的图标、自己的进程名 |
| 网页版 | 双击 `index.html` | 用 Edge/Chrome 打开，功能完全一样 |

EXE 是 **C# + WinForms** 写的原生宿主，界面用 WebView2 渲染（VS Code、微信、QQ 都是这个思路）。
所以它不是"拿 Edge 开个窗"：

- 窗口是无边框的，**蓝色标题栏是程序自己画的**，右上角 − □ ✕ 是真窗口按钮
- 任务管理器 / 任务栏里显示的是 **PCL主页工坊.exe**，不是 `msedge.exe`
- 四边可以拖动改大小，双击标题栏最大化
- 双击即开，不用装任何东西（Win10/11 自带 WebView2 运行时）

**EXE 比网页版多一个功能**：启动时会扫描本机 `%APPDATA%\.minecraft\versions`，
在「启动游戏」按钮的事件设置里列出你装过的版本，点一下就能填进 `EventData`，不用手打版本名。

---

## 📦 三步导出，装进 PCL

1. 编辑完点右上角 **「导出 XAML」→「下载 Custom.xaml」**（文件名默认就是 `Custom.xaml`）
2. 找到你的 PCL 目录（和 `Plain Craft Launcher 2.exe` 同级），里面的 `PCL` 文件夹：

   ```
   Plain Craft Launcher 2\
   ├─ Plain Craft Launcher 2.exe
   ├─ PCL\
   │   ├─ Setup.ini
   │   └─ Custom.xaml     ← 放这里
   └─ ...
   ```
3. 打开 PCL → **设置 → 主页 → 选「自定义主页」**，回主页看效果

> ⚠️ 改坏了别慌：**删掉 `Custom.xaml`** 就恢复默认主页，不会把启动器搞坏。
> `sample/Custom.xaml` 是一份现成的，可以先拿它试能不能加载。

---

## 🧱 布局模型：和 PCL 一样是「纵向单列」

这点很关键，也是上一版最大的坑：

> PCL 的自定义主页就是一个 **纵向排列的 StackPanel**，卡片横向撑满，宽度跟着窗口走。

所以本工具**不做自由画布**，只做「上下顺序 + 卡片嵌套」：

- 画布上永远只有一列，你看到的就是 PCL 里的样子
- 导出的根节点是 `<StackPanel>`，**不写死宽度**，PCL 窗口多宽就多宽
- 想并排？PCL 的自定义主页不支持左右分栏，本工具也不装作支持

每个元素都可以单独设置：
- **宽度**：撑满（默认）/ 自定义 px + 左中右对齐
- **间距**：和下一项的垂直距离
- **高度**：按钮、图片、列表项这类可以填；卡片、文本是内容自适应（和 PCL 一致）

---

## 🧩 组件对照表

| 编辑器组件 | 导出的 XAML 控件 | 能干什么 |
|---|---|---|
| 卡片 | `local:MyCard` | PCL 标准卡片；标题、折叠（`CanSwap` / `IsSwapped` / `SwapLogoRight`）、动画（`UseAnimation` / `HasMouseAnimation`） |
| 自绘面板 | `Border` | 自己配色配圆角的容器（位置同样由上下顺序决定） |
| 文本 | `TextBlock` | 字号 / 加粗 / 对齐 / 换行 / 跟随主题色 |
| 图片 | `local:MyImage` | 网络或本地图片；备用地址 `FallbackSource`、加载中图片 `LoadingSource`、缓存 `EnableCache` |
| 按钮 | `local:MyButton` | 黑 / 主题色 / 红色三色 + 内边距 `Padding` + 点击事件 |
| 文字按钮 | `local:MyTextButton` | 无边框按钮 |
| **图文按钮** | `local:MyIconTextButton` | SVG 图标 + 文字，图标缩放 `LogoScale` |
| **图标按钮** | `local:MyIconButton` | 只有 SVG 图标，主题 `Color` / `White` / `Black` / `Red` |
| 列表项 | `local:MyListItem` | 图标 + 标题 + 描述；`Type` 选「仅展示」或「可点击」 |
| 提示条 | `local:MyHint` | 三色主题 `Theme="Blue / Yellow / Red"` |
| 输入框 | `local:MyTextBox` | 带占位文字的输入框；**圆角可调**（`CornerRadius`，PCL 默认 3） |
| 分隔线 | `Rectangle` | 一条细线 |
| 色块 | `Rectangle` | 纯色方块 |
| **横向行** | `StackPanel Orientation="Horizontal"` | 把按钮 / 图标横着排，列间距统一控制 |

**所有组件都通用的属性**（右侧「通用属性」一栏）：

| 编辑器项 | 导出属性 | 说明 |
|---|---|---|
| 悬停提示 | `ToolTip` | 鼠标停上去显示的文字 |
| 上边距 / 左右边距 | `Margin` | 和下间距一起组成 `Margin="左右,上,左右,下"` |
| 垂直对齐 | `VerticalAlignment` | Top / Center / Bottom / Stretch（固定高度时才看得出效果） |
| 不响应鼠标 | `IsHitTestVisible="False"` | 纯装饰的图片、色块用它，不会挡住下面的点击 |

**预设区块**：启动区块 / 公告区块 / 快捷方式 / 版本列表 / **快照卡片** —— 整块卡片连内容一起插入，插进来改文字就行。

> 「快照卡片」仿 PCL 默认主页的「最新快照版」：大图 + 版本号胶囊 + 最后更新 + 底部一排按钮（启动 / 服务端 / 维基 / 更新日志）。
> 图片地址是空的，插进来后点中图片，在右边填官方那期的截图链接即可。
> **它不会自动跟着 Mojang 更新** —— XAML 是静态文件，没有联网能力；每次快照更新要手动改版本号、图片、日期三处。

---

## 🖱️ 点击事件（PCL 功能入口）

按钮和列表项可以挂事件，导出成 `EventType` + `EventData`：

| EventType | 作用 | EventData |
|---|---|---|
| `启动游戏` | 启动指定版本 | **版本名称**（`versions` 下的文件夹名），如 `1.20.1-Forge_47.2.0`；连服务器写 `26.2\|mc.hypixel.net`；写 `\current` 表示用 PCL 里当前选中的版本 |
| `打开网页` | 打开网址 | `https://...` |
| `打开文件` | 运行程序 / 打开文件夹 | `notepad.exe` 或 `explorer.exe\|/select,文件` |
| `刷新主页` | 重新加载主页 | 不需要 |
| `切换页面` | 跳到启动器某个页面 | `3\|1` |
| `复制文本` | 复制到剪贴板 | 要复制的文字 |
| `弹出窗口` | 弹提示框 | `标题\|内容` |
| `下载文件` | 下载文件 | `https://...` |
| `打开帮助` | 打开帮助数据源 | json 的 URL |
| `今日人品` / `内存优化` / `清理垃圾` | PCL 小功能 | 不需要 |

选中组件 → 右边「点击事件」里选，下面的提示会告诉你参数怎么填。

---

## 🔗 输入框里的内容，怎么用到别处

PCL 的 XAML 支持 WPF 的**元素绑定**，所以输入框可以驱动按钮、文本、弹窗。

**在工具里怎么做：**

1. 拖一个「输入框」进来，右侧属性里把 **名称（Name）** 起好，比如 `site`
2. 选中要用它的按钮或文本
3. 属性里会出现 **「用输入框内容：site」** 这排小按钮，点一下就绑上了
4. 导出后，在 PCL 里点按钮时就会取输入框**当前**的内容

能绑的地方：按钮 `EventData`、弹窗内容、文本的 `Text`、列表项的标题 / 描述。

导出的样子：

```xml
<local:MyTextBox Name="site" HintText="输入网址" />
<local:MyButton Text="打开" EventType="打开网页"
                EventData="{Binding ElementName=site, Path=Text}" />
```

画布上被绑定的位置会显示一个蓝色小标签 `⟵ site`，提醒你这里不是写死的文字。

---

## 🔀 弹窗能不能不写死 / 能不能“判断”

PCL 的 XAML **没有 if/else**，但有三条实用路子：

**① 绑定输入框（最常用）**
弹窗按钮的 `EventData` 点「用输入框内容」，写成：

```xml
EventData="{Binding ElementName=site,Path=Text}"
```

> ⚠️ **PCL 的解析器不认 `StringFormat`**。写成 `StringFormat='提示|{0}'` 会让 PCL 直接报
> 「加载主页失败 / 规则中的意外标记」，主页都打不开。所以弹窗做不到「标题写死 + 内容动态」二合一；
> 想带标题，就在输入框里自己打 `标题|内容`，PCL 会按 `|` 拆。
> 工具里已经不会生成 StringFormat，老工程打开时也会自动剥掉。

**② 变量标记（最接近“判断”的做法）**
给某段文本填一个 **变量名**（比如 `Msg`），导出成：

```xml
<TextBlock Text="{variable:Msg:默认文字}" />
```

再放一个按钮，事件选 **`修改变量`**，`EventData` 写 `Msg|新的文字|-`。
点这个按钮，那段文字就变 —— 相当于一个只能二选一 / 多选一的状态开关。

**③ 多个按钮各写一句**
最土但最稳，适合内容完全不同的情况。

> 顺带一提：想让弹窗内容“随机”的话，PCL 自带的 `今日人品` 事件就是干这个的。

---

## ⌨️ 操作

| 操作 | 效果 |
|---|---|
| 拖动元素 | 调整上下顺序；拖进卡片就变成卡片的内容 |
| 双击文字 | 直接在画布上改内容 |
| `Ctrl+↑ / ↓` | 选中元素上移 / 下移 |
| `Ctrl+Z` / `Ctrl+Shift+Z` | 撤销 / 重做 |
| `Ctrl+D` | 复制选中元素 |
| `Delete` | 删除 |
| `Ctrl+S` | 保存工程 |
| `Ctrl+E` | 打开导出窗口 |

---

## 💡 约定与限制

- **文字颜色默认「自动跟随主题」**：导出时不写 `Foreground`，交给 PCL 主题决定，深色主题下不会出现黑字看不清。
- **卡片底色不能改**：`MyCard` 的外观由 PCL 主题控制。要自定义外观用「自绘面板」（导出 `Border`）。
- **颜色写成 `#AARRGGBB`**：导出时自动补透明度，`#1B1D21` → `#FF1B1D21`。
- **预览宽度**只影响你在编辑器里看到的样子（默认 600px），导出的文件是自适应的。

---

## 🔧 出问题怎么办

1. **点「启动游戏」提示「当前 Minecraft 文件夹中尚未安装该版本」**
   → `EventData` 第一段填的是**版本名称**，也就是 `.minecraft\versions` 下那个文件夹的名字，
   **不是原版版本号**。装过 Forge 的话文件夹会叫 `1.20.1-Forge_47.2.0`，填 `1.20.1` 就找不到。
   - EXE 版会自动扫描本机 `versions`，右侧「点击事件」下方点一下对应版本就能填入
   - 不想写死版本：填 `\current`，跟着 PCL 当前选中的版本走（源码里硬编码的特殊值）
2. PCL 报错说找不到 `local:` 控件 → PCL 版本太老，删掉「图片」元素再导一次
3. 卡片标题和内容**叠在一起** → 说明卡片内层 `<StackPanel>` 少了 `Margin`。PCL 的卡片内容区不会自己避开标题，
   必须写成 `<StackPanel Margin="25,40,23,15">`（本工具已经自动加）
4. 主页一片空白 → 检查 `Custom.xaml` 是不是放在 `PCL` 文件夹里（不是启动器根目录）
5. 怎么都恢复不了 → 删掉 `Custom.xaml`，重启 PCL

---

## 📁 文件说明

```
PCL主页工坊.exe    编译好的原生程序（推荐）
index.html         界面（网页版入口，也是 EXE 里渲染的页面）
style.css          界面样式
app.js             编辑器逻辑 + XAML 导出器
sample/Custom.xaml 示例主页，可直接丢进 PCL
build/             打包脚本
  native/          C# 原生宿主（WinForms + WebView2）
  gen_sample.js    重新生成 sample/Custom.xaml
  make_icon.py     重新生成 app.ico
```

界面统一用 PCL 的视觉：蓝色标题栏、浅灰面板、白色卡片、微软雅黑。

**自己重新打包**（改了 `app.js` / `style.css` / `index.html` 之后）：

```bash
cd build/native
cp ../../index.html ../../style.css ../../app.js assets/
dotnet publish -c Release -o out
cp out/PCL主页工坊.exe ../../PCL主页工坊.exe
```

只需要 .NET SDK（本机已装），不需要 Node，也不用联网。
