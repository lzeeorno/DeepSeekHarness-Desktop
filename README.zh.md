# DSH Desktop

[English](README.md) | 中文

DSH Desktop 是基于开源 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区桌面工作台，由 [lzeeorno](https://github.com/lzeeorno) 维护，不是 DeepSeek 官方发行版。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

上游 DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 通过 `npm` 运行上游 Web UI

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/lzeeorno/DeepSeekHarness-Desktop.git
cd DeepSeekHarness-Desktop
pnpm install
pnpm run build
pnpm dsh web
```

### 运行桌面壳

Electron 桌面壳复用 Web Client，并启动本地 DSH runtime。从源码 checkout 运行：

```sh
pnpm --filter @deepseek-ai/dsh-desktop dev
```

在 Linux x64 上，可以用以下命令生成目录构建以及未签名的 AppImage/deb 产物：

```sh
pnpm --filter @deepseek-ai/dsh-desktop pack:linux
```

产物写入 `dist/desktop/`。首个公开预发布目标是 Linux x64。macOS：**Coming Soon**。Windows：**Coming Soon**。原生 CI 验证不等于未签名产物可以作为可分发安装包；验收顺序和发布限制见 [Agent 系统白皮书](references/AGENT_SYSTEMS_WHITEPAPER.md)。

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/lzeeorno/DeepSeekHarness-Desktop/discussions) 提交反馈或 bug 报告。
- 请通过[上游 DeepSeek Harness 项目](https://github.com/deepseek-ai/deepseek-harness)了解 harness 与插件生态的更新。

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。本社区仓库不会在 `@deepseek-ai` 名义下发布新的 npm 包。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
