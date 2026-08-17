# Agent Note: Electron 桌面壳与暂存 runtime 闭包

Status: implemented

[English](2026-08-15-electron-desktop-shell-and-runtime-closure.md) | 中文

## 问题

Harness 已有可用的 Web Client 和 loopback runtime，但没有原生桌面入口。桌面包装必须保留现有 Cordis 组合和 event-sourced session 行为，同时从不依赖仓库工作区、符号链接或开发态模块图的打包应用目录启动。

## 决策

`apps/desktop` 提供薄 Electron 主进程。`run-electron.mjs` 清除继承的 `ELECTRON_RUN_AS_NODE` 值后启动真实 Electron 二进制。主进程预留 loopback 端口，以 `--expose-internals` 启动构建后的 DSH Web runtime，等待 HTTP 就绪，再在启用 context isolation 和 sandbox 的 `BrowserWindow` 中加载现有 Web Client。子进程收到 `RUST_LOG=info`，不继承 `ELECTRON_RUN_AS_NODE`，并在窗口关闭或应用退出时终止。启动失败显示在有限长度的诊断页面中。

暂存脚本构建工作区，用 pnpm 部署 DSH runtime，并把工作区 peer 依赖和外部 workspace 链接物化到 `.runtime`，使打包执行不需要符号链接支持。重复暂存时会把上一次生成的 runtime 移到带时间戳且被忽略的同级目录，而不依赖强制递归删除。profile fallback 在读取每个包的依赖 manifest 前先对 package anchor 执行 realpath，因此 pnpm store 链接后的传递包（包括 Web workbench plugin）会继续对每个已安装 profile 可见。打包脚本直接读取桌面 manifest，使用 electron-builder 生成目录、Linux AppImage/deb、macOS dmg/zip 和 Windows NSIS/zip 目标。`.github/workflows/desktop.yml` 在 pull request、`desktop-v*` tag 和手动 dispatch 中使用原生 Ubuntu、Intel macOS、Apple Silicon macOS 和 Windows runner 重复打包，在每个主机检查暂存的 `node-pty`，在 Linux 与 macOS 运行打包 UI smoke，并检查各平台产物类型。桌面 tag 会生成合并 checksum、CycloneDX SBOM 和 GitHub provenance attestation，并发布包含 Linux 与 macOS 资产的预发布包；所有资产在签名验收前都明确保持未签名。runtime 输出和生成的桌面产物仍是被忽略的构建产物。

打包入口会拒绝在非目标原生主机上生成 macOS 或 Windows 目标（Linux 目标也遵循同一规则）。这样可以避免把当前主机编译的 `node-pty` 二进制静默放入异平台安装包；跨平台产物必须来自对应的原生矩阵 runner，而不是看似成功的本地交叉打包。

Linux x64 仍具备无 key 打包启动、事件驱动的 Web Client 就绪检查和无依赖 `check-native.mjs` 的 `node-pty` 加载/启动检查。维护者的 Intel macOS 主机现在也会构建、安装、启动并 smoke-test 未签名的 x64 DMG 应用；Apple Silicon runner 执行相同的打包 UI 与 native addon 检查。社区桌面元数据使用 `DSH Desktop` 与 lzeeorno，而非 DeepSeek 官方安装包身份。macOS 签名/公证、升级/卸载、真实 provider 认证和模型切换仍是手工验收事项，因为仓库不保存凭据；Windows 仍是 CI-only 目标。

`apps/desktop/design/workbench-companion.html` 记录预期的三栏 Build/Research 工作台和窄窗口面板折叠，不替代生产 renderer。

## 考虑过的替代方案

**第二套桌面专用 renderer。** 否决，因为它会复制 Web Client 已提供的 session、credential、compaction、permission 和 provider UI，并产生事件语义不同的两套产品表面。

**Electron 直接加载源码文件。** 否决，因为打包执行需要构建后的 runtime 和可复现的模块闭包；加载源码还会把产品绑定到工作区工具链。

**在安装包中依赖 pnpm workspace 符号链接。** 否决，因为 Windows、macOS 和 Linux 的符号链接权限及路径行为不同。暂存过程解除外部链接，并把需要的 peer 依赖物化到打包 runtime。

**现在宣称已签名的跨平台发布。** 否决，因为当前环境没有 Apple Developer identity 或 notarization 凭据。原生 macOS 资产在有打包和 smoke 证据后可以作为明确未签名预览发布，但签名/公证声明仍需相应凭据和安装证据。

## 结果

原生壳保持很小，并将 Harness 插件架构、session log、provider、credentials 和 compaction 作为产品真源。打包有明确的暂存边界，可以脱离仓库工作区独立测试。代价是 Linux 产物更大，并且发布签名 macOS 或 Windows 安装包前必须执行原生构建矩阵。当前验证证据覆盖无 key 启动、聚焦 runtime/UI 路径、类型检查、链接检查、Linux 打包和未签名 Intel macOS 安装；API key、签名/公证、升级/卸载以及 Windows 验收仍未完成。

公开研究清单保留白皮书和来源链接，下载的论文与外部源码 checkout 保持为本地研究输入。`.gitignore` 排除这些材料，使许可证、本机路径和无许可证逆向材料不会进入社区仓库。

## 测试

桌面包测试覆盖启动参数构造、端口预留、就绪等待和关闭。开发启动器在继承 `ELECTRON_RUN_AS_NODE=1` 时经过实际运行验证，在 Xvfb 下保持为活跃 Electron 进程直至测试超时。profile fallback 测试覆盖通过 pnpm 风格符号链接 bundle 到达的传递依赖。打包态 `smoke:dir` 会定位 `linux-unpacked` 或原生 macOS `.app`，等待 loopback URL，并通过 CDP 使用现有 Web Playwright 依赖检查标题和无 key 首次运行控件，通过 `Configure later` 关闭只写密钥 onboarding，确认 Build/Research 工作台控件可用，用鼠标点击打开 Settings，再用键盘激活 Models，并确认 DeepSeek/API key 表面可见，最后终止 Electron。在 POSIX 上，它会把被启动应用放进专属 process group，因此应用启动器不会在 smoke 结束时遗留 Electron/runtime 进程；Windows 保持普通 child termination。原生 CI 矩阵在每个主机执行 `check-native.mjs`，在 Linux 和两个 macOS 架构运行打包 UI smoke，并检查生成的 AppImage/deb、dmg/zip 和 NSIS/zip payload。Linux 上还验证了打包入口会在 electron-builder 启动前拒绝 macOS 目标。组合的 Models 场景还通过同一页面配置了独立的 OpenAI 与 Anthropic BYOK profile，确认密钥保持只写、两个 route 都注册；model-default 场景确认共享 selector 的切换会成为后续 session 的 default，而不会改写已有 logged session route。这些检查使用本地伪 key，不发起模型请求。随后，Playwright Web replay 和 onboarding suite 在组合的无 key Web Client 上通过。provider profile、catalog、discovery、动态设置、SDK 选项、topology 和 model-editor 测试通过无 key case。聚焦 Harness 测试覆盖 replay、手动 compaction、approval/permission 和 provider settings。重新生成的 Linux AppImage 也以 extract-and-run 模式启动并通过相同的无 key UI smoke；deb payload 使用 `dpkg-deb --info` 检查。当前主机上的类型检查、Markdown 链接检查、源码语法检查、Linux 目录打包、AppImage/deb 打包、Intel macOS DMG/ZIP 打包、原生安装和 `node-pty` 加载均通过；签名/公证、升级/卸载和真实 provider 检查仍未完成。
