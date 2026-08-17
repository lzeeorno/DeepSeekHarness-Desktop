# @deepseek-ai/dsh-client-ui-workbench

[English](README.md) | 中文

该插件为 DSH 浏览器与 Electron 工作台提供可持久化的代码／科研视图。它拥有 `ui-workbench.mode` 设置，内置值为 `build` 和 `research`，默认值为 `build`。该视图只是本地呈现偏好：不会选择模型、修改提示词、授予工具权限、改变 agent preset，也不会新增 session event。

对于回环地址上的 Web Client，Host settings provider 会把所选视图持久化到 `$DSH_HOME/settings.yaml`；settings 更新和重连会恢复保存的值。无法访问特权回环 settings API 的浏览器仍可改变其进程内视图，但该选择不具持久性。API proxy 明确暴露此 namespace，因为其中不含凭据或影响模型的状态。

客户端半侧注册四个既有 slot：

- `settings.general.item` 将可持久化偏好加入常规设置。
- `conversation.hero.workbench` 在空 session 的首个 prompt 之前加入代码／科研选择器。
- `conversation.session.header.actions` 在活动 session 标题栏中显示当前视图并提供紧凑切换。切到科研会打开 `research` 证据视图，切回代码会回到 Chat。
- `conversation.view` 贡献该 session 内的科研证据视图。它读取已加载事件账本中的工具结果、成功写入路径、provider/model 来源与 compaction 标记，并可请求 session 既有的更早历史页；`trajectory` 仍是相邻的详细事件账本。

装配后的 session ring 还包含由 `ui-conversation` 提供的原生 `context` 账本。它保留在 conversation domain，因为该包拥有 durable context-node projection 及其 source/form 呈现；本 lens 不会重复或重新解释这些模型可见 events。

真正的科研 agent preset、证据存储或模型路由策略必须是独立的 plugin/provider 决策。若将这一偏好复用为 session 已拥有科研语义的证据，会使 UI 状态在没有 durable event 的情况下表现为模型行为。

## 模型体验

无。该浏览器端 UI 偏好不会进入模型请求、提示词、权限或 session event。

#### KV Cache 影响

无。视图切换不是模型可见的 context。

## 已知限制与暂缓事项

- **科研复用既有事件账本，而不是新增一套科研系统。** 证据视图可通过正常 session paging 扩展已加载 event window；它尚未新增 notebook、引用管理器、实验运行器、IDE 编辑器、证据库或不同的工具策略。
- **回环设置是用户偏好，而非 session 属性。** session replay 不会重建所选视图，切换它也不会改变一轮历史的含义。
