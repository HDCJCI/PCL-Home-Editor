# 自定义「独立子页面」示例

自定义主页本身没法新建页面（PCL 的页面是编译期写死的枚举），但可以**借用「帮助详情页」**：
它有一个独立的页面容器、左上角返回箭头、蓝色标题栏，而且渲染的 XAML 和 `Custom.xaml`
用的是**完全同一套解析规则**（PCL 源码里两处都调 `ArgumentReplace` + 去 xmlns + 套根节点）。

## 怎么用

1. 在 PCL 根目录下建一个 `PCL\Help\` 文件夹（如果还没有）
2. 把这两个文件复制进去：
   ```
   PCL\Help\snapshot.json
   PCL\Help\snapshot.xaml
   ```
3. 在自定义主页里放一个按钮，指向这个 json：

```xml
<local:MyButton Text="查看版本详情"
                EventType="打开帮助"
                EventData="{path}\PCL\Help\snapshot.json" />
```

`{path}` 是 PCL 根目录变量，会被自动替换，所以换电脑也能用。

## 两个文件的分工

**`snapshot.json`** —— 元数据（PCL 用这个登记条目，再去找同名 `.xaml`）

| 字段 | 说明 |
|---|---|
| `Title` | 必需，缺了会报错 |
| `Description` | 描述，显示在列表里 |
| `Keywords` | 搜索关键字 |
| `Types` | 分类标签，**这个页面会出现在「帮助」页的对应分类里** |
| `ShowInSearch` | 是否出现在搜索结果 |
| `ShowInPublic` | 是否在正式版显示 |
| `ShowInSnapshot` | 是否在快照版显示 |

> 示例里三个 `Show*` 都设成 `false`，目的是让它**只作为被按钮打开的页面**，
> 不出现在帮助列表和搜索里。想让用户也能从帮助页找到，就删掉这三行或改成 `true`。
>
> ⚠️ `Types` 即使全隐藏了也别删，某些版本会用到。

**`snapshot.xaml`** —— 页面内容，写法和 `Custom.xaml` 一样

```xml
<local:MyCard Title="26.3">
    <StackPanel Margin="25,40,23,15">
        <local:MyImage Source="" Height="150" />
        <TextBlock Text="新特性" FontSize="19" FontWeight="Bold" />
        ...
    </StackPanel>
</local:MyCard>
```

可以放任何 PCL 内置控件，也可以再放按钮，做成多级页面：

```xml
<local:MyButton Text="看第二章" EventType="打开帮助" EventData="{path}\PCL\Help\snapshot2.json" />
```

## 已验证 / 未验证

- ✅ 解析规则与主页一致（源码可证）
- ✅ 页面带返回箭头，走 PCL 的页面栈
- ❓ 多级跳转（页面 → 页面 → 页面）的返回链没有实测，建议先试两级
- ❓ 页面标题栏显示的文案由 PCL 决定，不一定是 `Title` 字段

## 和「弹出窗口」的区别

| | 帮助详情页 | 弹出窗口 |
|---|---|---|
| 能放控件 | ✅ 任何 PCL 控件 | ❌ 纯文本 |
| 有返回按钮 | ✅ | ❌ 关闭按钮 |
| 能放图片 | ✅ | ❌ |
| 需要额外文件 | ✅ json + xaml | ❌ 一行 EventData |
