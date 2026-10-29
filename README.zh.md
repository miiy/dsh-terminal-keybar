# dsh-terminal-keybar

[English](README.md) | **中文**

给 DSH Web 终端用的**触屏按键条**：手机上没有方向键、`Esc`、`Tab`、`Ctrl`，
终端基本没法用。这个插件在屏幕右侧浮出一条半透明按键列，把按键直接写进当前显示的终端。

- 右侧竖排、半透明，不压住终端底部
- 只在**触屏设备**且**当前标签是终端**时出现，桌面完全不受影响
- 软键盘弹起时，整列跟着**可见区域**居中，不会被键盘盖住（含 iOS）
- 纯前端插件，不复制任何终端代码，也不改动 DSH 本体

![按键条示意](icon.svg)

## 截图

![手机上一个终端旁的按键条](Screenshot-wide.png)

## 按键

| 按钮 | 发送 | 常见用途 |
|---|---|---|
| `Esc` | `\x1b` | 退出 vim 插入模式、关闭 less/分页器 |
| `Tab` | `\t` | 路径/命令补全 |
| `↵` | `\r` | 回车执行 |
| `^C` | `\x03` | 中断当前命令 |
| `↑` `↓` | `ESC [ A` / `ESC [ B` | 历史命令、菜单上下、vim 移动 |
| `←` `→` | `ESC [ D` / `ESC [ C` | 行内移动光标 |

按下用 `pointerdown` + `preventDefault()`，终端的输入框保持焦点，软键盘不会收起，
所以可以一边打字一边点方向键。

## 安装

### 1. 走 Host 的 `installBundle`（安装 + 启用，一步到位）

在对话里直接说：

> 安装插件 `github:miiy/dsh-terminal-keybar`

或者在 **设置 → 插件** 页面的安装输入框里粘贴同一个 spec。

两者都会调用 Host 的 `installBundle`：装包、写进 `dsh.profile.bundles`、热生效。

### 2. 用 CLI（`dsh plugin`，只装不启用）

```sh
dsh plugin --profile <profile> add github:miiy/dsh-terminal-keybar
```

`dsh plugin` 只是把参数转发给 profile 目录里的 pnpm，所以这一步**只装包、不组合**。
装完在 **设置 → 插件** 里会多出一行，状态是「已安装、未启用」，把开关打开即可
（等价于写入 `dsh.profile.bundles`）。开关若没热生效，重启 `dsh web`。

本插件是纯 JavaScript、没有构建脚本，所以从 git 安装不需要 `allowBuilds` 批准。

支持的 spec 形式就是 pnpm/DSH 常见那几种：`github:user/repo`、`git+https://…`、
本地绝对路径、npm 包名。

### 3. 本地源码（开发用）

```sh
plugin_manager install_bundle /绝对路径/dsh-terminal-keybar
```

## 使用

1. 手机浏览器打开 DSH Web（DSH 官方推荐配合局域网/公网访问方案使用）。
2. 打开右侧栏的终端标签。
3. 屏幕右侧出现按键列，直接点即可；键盘收起时也能点。

## 已知限制

- **DECCKM（应用光标键模式）**：插件通过公开的 `webTerminals` 服务写字节，拿不到 xterm
  实例，因此方向键固定发 CSI 形式（`ESC [ A`）。bash/readline、vim、less 都接受这种形式；
  少数严格要求 SS3（`ESC O A`）的程序里方向键会不准。
- **浮动面板**：判定依据是"活动窗格的标签"，终端被拖成浮动面板时按键条不显示。
- 按键列会遮住终端最右侧约 46px；半透明可以看穿，嫌挡见 `client.js` 里 `styles.bar`
  的 `opacity` / `right`。
- 只在 Web 端生效（`platform: web`），不影响 Desktop 原生窗口的终端。

## 维护

改上游适配看 [MAINTENANCE.md](MAINTENANCE.md)：里面有一张"依赖的上游 API → 上游改动
后会怎样"的对照表，以及升级 DSH 后的 diff 流程。`client.js` 顶部的 `DEBUG` 开关可以
打开一条屏幕自检徽标，用来判断按键条为什么不显示。

```sh
node --check client.js && node --check index.js   # 语法自检
```

## License

MIT
