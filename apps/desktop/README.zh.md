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

macOS：**Coming Soon**。Windows：**Coming Soon**。原生 CI 已具备验证流程，但这两个平台不属于首个公开下载版本。不要把 CI-only 未签名产物当作可分发安装包。

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

`pack:linux`、`pack:mac` 和 `pack:win` 会拒绝非匹配宿主。每个命令都会先暂存构建后的 DSH 运行时，再由 electron-builder 打包。Linux 上可使用以下命令验证打包目录和原生 terminal addon：

```sh
DSH_DESKTOP_CDP_PORT=9331 pnpm --filter @deepseek-ai/dsh-desktop smoke:dir
pnpm --filter @deepseek-ai/dsh-desktop check:native
```

## 发布边界

首个公开版本是 Linux x64 预发布版。签名流程完成前，构建输出和 CI 产物均未签名。跨平台可分发发行版仍需要完成原生安装、升级和卸载检查；每个提供方的真实 BYOK 请求；macOS 签名与 notarization；以及 Windows 代码签名。当前发布证据和完整验收顺序位于 [Agent Systems 白皮书](../../references/AGENT_SYSTEMS_WHITEPAPER.md#7-实施与验收路线)。
