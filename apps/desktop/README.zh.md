# DSH Desktop

[English](README.md) | 中文

DSH Desktop 是基于 DeepSeek Harness Web Client 的社区 Electron 工作台，不是 DeepSeek 官方发行版。Electron 管理应用窗口和 loopback DSH 运行时；Cordis 插件继续管理会话、凭据、模型提供方、工具、权限和压缩。

## 安装与启动

Linux x64 是本机已验证的目标。构建会在 `dist/desktop/` 下生成 AppImage 和 Debian 包：

```sh
./dist/desktop/dsh-0.1.0-rc.5-linux-x86_64.AppImage
sudo apt install ./dist/desktop/dsh-0.1.0-rc.5-linux-amd64.deb
```

宿主缺少 FUSE 支持时，在 AppImage 命令前设置 `APPIMAGE_EXTRACT_AND_RUN=1`。

macOS Intel 和 Apple Silicon 的预览安装包可从[桌面发布页](https://github.com/lzeeorno/DeepSeekHarness-Desktop/releases)下载。请选择与 Mac CPU 匹配的 DMG 或 ZIP，打开 DMG 后将 `DSH Desktop.app` 拖入 Applications。本版安装包未签名且未 notarize；首次启动时请按住 Control 点击应用，选择 Open，并确认 macOS 警告。当前不发布 Universal binary。Windows：**Coming Soon**。

## 首次启动与 BYOK

无需 API key 即可启动，选择 `Configure later`，然后打开 Settings > Models。创建 DeepSeek、OpenAI 或 Anthropic profile，输入该提供方的 API key，选择模型，并发送一个小型只读请求。凭据提供方会在 settings 中保存 credential reference；不要把 key 写进提示词或提交到仓库，也不要把 API key 当作厂商订阅登录的替代品。

已有会话会保留已记录的 provider/model 来源。改变默认 profile 只会影响后续会话，不会重写历史轮次。

## 从源码构建

先安装一次工作区依赖，然后运行匹配的原生目标：

```sh
pnpm install
pnpm --filter @deepseek-ai/dsh-desktop dev
pnpm --filter @deepseek-ai/dsh-desktop pack:linux
pnpm --filter @deepseek-ai/dsh-desktop pack:mac
pnpm --filter @deepseek-ai/dsh-desktop pack:win
```

`pack:linux`、`pack:mac` 和 `pack:win` 会拒绝非匹配宿主。每个命令都会先暂存构建后的 DSH 运行时，再由 electron-builder 打包。以下命令会定位当前平台的解包应用，检查无 key 首次运行控件，在 Settings 中分别执行鼠标点击和键盘激活，然后关闭应用；同时可验证原生 terminal addon：

```sh
DSH_DESKTOP_CDP_PORT=9331 pnpm --filter @deepseek-ai/dsh-desktop smoke:dir
pnpm --filter @deepseek-ai/dsh-desktop check:native
```

## 发布边界

当前预发布包含 Linux x64 以及按架构区分的 macOS DMG/ZIP。维护者 Mac 上已安装并 smoke-test Intel 包；Apple Silicon 包在原生 CI runner 上完成构建和 smoke-test。所有发布包在签名流程完成前均未签名，因此 Gatekeeper 可能要求按上文方式首次启动。完整可分发的跨平台版本仍需签名/公证 macOS 包、原生升级和卸载检查、每个提供方的真实 BYOK 请求以及 Windows 代码签名。当前发布证据和完整验收顺序位于 [Agent Systems 白皮书](../../references/AGENT_SYSTEMS_WHITEPAPER.md#7-实施与验收路线)。
