# Agent Note: Build and Research workbench lens preference

Status: implemented

[English](2026-08-15-workbench-lens-preference.md) | 中文

## Problem

桌面工作台需要让用户立即理解代码导向与科研导向工作的选择，同时不能暗示一个视觉选择已经改变 Agent 的工具、模型、权限、提示词或已记录历史。

## Decision

`@deepseek-ai/dsh-client-ui-workbench` 拥有 `ui-workbench.mode` Host settings namespace，并将同一组代码／科研选择贡献到常规设置、空 session hero 与活动 session 标题栏。该选择是可持久化的回环用户偏好，默认值为 `build`。

浏览器 controller 镜像正常的 `SettingsScope` 值，并经由该 scope 写入明确的用户选择。`dsh-host-apiproxy` 将 `ui-workbench` 作为 Web 偏好 namespace 暴露，使回环 client 可以读取和修改它。该 namespace 没有 secret 字段。

活动 session 的标题栏动作还会选择一个既有 browser view：科研选择 `research`，即由工作台对已加载 durable events 做出的只读投影。它列出工具结果、成功写入路径、provider/model 来源与 compaction 标记，并可向 session 请求既有的更早历史页；`trajectory` 仍是相邻的详细事件账本。代码选择 `chat`。这个 browser view 选择已由 conversation UI 存储，仍然只改变呈现。

该设置刻意没有 prompt assembly、模型路由、工具策略、agent preset 选择、权限判断或 session-event projection 的 consumer。因此 session replay 不依赖其当前值。

## Alternatives considered

**把视图持久化在 `dsh-session` events 中。** 未采用，因为该选择是用户界面偏好，而不是会改变一轮语义的事实。记录它会使 replay 暗示并不存在的模型行为。

**让每个选择器保持 component-local state。** 未采用，因为 settings、空 session 入口与活动 session 标题栏会在刷新或重连后彼此不一致。

**用户选择科研时切换 Agent preset。** 未采用，因为 preset composition 会改变可用 runtime capability，且只能为合格的空 session 改变。该策略需要一个明确、可独立审计的 provider 决策。

## Consequences

用户可以在本地 Web Client 与 Electron shell 中选择并保留清晰的工作台焦点，而无需新增第二个 session store 或复制 renderer state。这个窄设置加上既有 UI slot 让三个控件保持同步，而活动 session 控件会通过 Chat、证据投影与详细事件账本让区分立即可用。

API proxy 现在多了一项有意的 Web settings allowlist 条目。未来的科研 workflow、证据面板、模型策略或工具策略必须说明自身行为与持久化方式；它们不能从这一偏好推断。

## Testing

聚焦客户端测试覆盖 Host 接纳、乐观选择、被拒写入、全部三个控件表面、代码／科研 view 选择、从工具/model/compaction events 派生证据，以及既有 session-history paging 注入。conversation skeleton 测试验证标题栏动作会写入当前 session 的 view store。API-proxy configuration 测试验证该 namespace 可暴露和修改。`apps/web/tests/workbench-mode.e2e.ts` 在无需模型 key 的情况下覆盖真实 Web composition、持久化设置、重载、科研证据与相邻轨迹账本。
