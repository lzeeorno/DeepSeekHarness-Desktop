# Agent Systems and the DeepSeek Harness Local Workbench

## 读者、范围与证据

本文面向希望构建、评估或使用本地 Agent software 的程序员、研究者和开源贡献者。

它先解释一个可长期运行的 Agent 由哪些部分构成，再以 2024-2025 年的 CCF-A 论文和可本地阅读的工业代码为证据，最后给出 DeepSeek Harness (DSH) 的渐进式桌面工作台设计。

本文不是对任何厂商内部实现的复述，也不把 benchmark 成绩当作生产可靠性承诺。

每项结论按下列证据等级阅读。

| 标记 | 含义 | 使用方式 |
| --- | --- | --- |
| `P` | 论文原文 | 用于方法、数据集、指标、主实验和消融结论。 |
| `I` | 有明确许可证的本地工业仓库 | 用于代码结构、发布方式和可观察产品机制。 |
| `O` | 厂商官方文档 | 用于 Codex、Claude Code 等闭源产品公开宣称的能力。 |
| `B` | 本地可复现行为 | 用于 DSH 实际 profile、构建和 UI 入口。 |
| `U` | 许可证不明确的第三方材料 | 只作内部设计启发，不单独支撑公开技术事实，也不复制源码、提示词或凭据。 |

论文的公开来源、固定版本和归档理由见 [papers/ccf-a-agent-systems](papers/ccf-a-agent-systems/README.md)。原始 PDF 不是本社区发行版的一部分；阅读提取物和受许可证限制的参考材料保留在维护者的本地研究环境中。

## 1. 什么是一个可用的 Agent

把 Agent 只理解成“模型加工具”会遗漏大部分产品难题。

一个可长期运行的 Agent 是一个在受控环境中循环执行“接收任务、构造上下文、推理、采取动作、观察结果、记录状态、请求人类决定”的系统。

模型负责从当前上下文产生候选文字或动作。

系统负责决定模型能看到什么、动作是否允许、动作在何处执行、结果如何持久化、失败后能否恢复，以及用户怎样审阅过程。

### 1.1 七个协作面

| 协作面 | 回答的问题 | 典型组件 | 失败时的表现 |
| --- | --- | --- | --- |
| Interaction | 用户怎样发起、观察和介入工作？ | 桌面 UI、IDE、CLI、命令面板、审批对话框 | 用户看不见当前目标、风险或进度。 |
| Orchestration | 一项工作怎样被拆成可暂停的单元？ | session、turn、step、plan、job、subagent | 长任务无法取消、恢复或归因。 |
| Context | 模型此刻应该看到哪些事实？ | event log、history projection、附件、检索、summary | 上下文膨胀、遗漏关键约束或重复劳动。 |
| Model | 如何选择并调用模型？ | provider、model profile、流式适配器、token meter | 模型切换破坏会话，或者把密钥和能力混淆。 |
| Action | 模型可以做什么？ | tool、MCP、skill、code action、command | 工具粒度错误，模型频繁失败或误用接口。 |
| Environment | 动作在什么世界中发生？ | workspace、Git、terminal、LSP、browser、sandbox | 结果不可复现，或 Agent 越权影响本机。 |
| Operations | 如何控制与评估系统？ | approvals、credentials、cancel、telemetry、evals | 成本不可见、事故不可追溯、发布无法验收。 |

这七个协作面也是设计边界。

例如，添加一个模型提供商不应改写 agent loop，而应实现 Model 面的 provider。

添加一个论文阅读器不应在聊天组件里保存私有状态，而应把论文、注释和引用作为可追溯的 Context 或 Action 产物。

### 1.2 session、turn 与 step

`session` 是用户能够重新打开、搜索、分叉和导出的长期工作单元。

`turn` 是一次由输入唤醒的连续工作，可包含零个或多个模型请求。

`step` 是一次模型请求和它引发的一组工具调用。

最小的可审计循环如下。

```text
user input / command / injected evidence
  -> append durable event
  -> claim next step input
  -> assemble instructions + history + plan + artifacts + tool schemas
  -> model stream
  -> assistant text or tool calls
  -> permission decision
  -> execute in workspace or sandbox
  -> append action and observation events
  -> next step, finish, cancel, or create background job
```

这条循环将“模型看见的事实”和“可重放的记录”绑定在一起。

如果模型收到的文件、网页、工具结果或人工决策没有被记录，恢复后的会话就无法解释为什么产生某个改动。

### 1.3 上下文不是单一的 memory

实践中常把下面四类状态都称作 memory，但它们承担不同职责。

| 状态 | 生命周期 | 应保存什么 | 不应承担什么 |
| --- | --- | --- | --- |
| 当前工作窗口 | 当前 step | 当前输入、规则、选中文件、计划、工具 schema、近期结果 | 历史的唯一存储。 |
| 耐久 session 记录 | 跨重启 | 用户消息、agent 消息、调用、结果、审批、摘要边界 | 任意二次加工的知识库。 |
| workspace evidence | 跨项目 | 代码、diff、数据、PDF、实验配置、终端输出、图表 | 取代会话中的决定说明。 |
| 项目知识 | 显式维护 | 项目规则、skills、MCP 配置、团队约定 | 隐式自动学习用户的所有习惯。 |

检索只是在构造当前工作窗口时选择证据。

它不是可以跳过 session 持久化和用户可见引用的替代品。

### 1.4 Compaction 是状态转换，不是删除历史

长任务会被 token budget、模型上下文窗口、延迟和成本限制。

手动 compaction 是用户要求系统压缩当前工作窗口。

自动 compaction 是系统在接近模型容量时主动进行相同类别的状态转换。

一个有用的 summary 至少要保留当前目标、接受条件、已读和已改文件、关键决定、验证结果、失败原因、待办和仍然需要用户回答的问题。

原始事件不应因为生成 summary 而失去可追溯性。

DSH 已使用 session event projection 和 compaction provider 来处理此问题，因此产品重点是显示触发原因、保留内容、上下文占用和回看入口，而不是另造一个彼此矛盾的 memory subsystem。

### 1.5 工具、MCP、skills 与 code actions

`tool` 是模型可以请求执行的结构化能力，例如读文件、写文件、运行测试、搜索网页或查询数据库。

`MCP` (Model Context Protocol) 是把外部工具和资源接入 Agent 的协议层，不是一个 agent loop。

`skill` 是可复用的工作知识和流程，通常按需载入，适合编码规范、研究工作流和发布步骤。

`code action` 是让模型写可执行代码来组合已有库和 API 的动作形式。

这四者不应互相替代。

一个文件编辑器适合提供具明确副作用的 tool。

多个 API 的批量分析可能更适合 code action。

跨公司服务适合 MCP。

重复的开发或研究方法适合 skill。

### 1.6 模型 profile 与 BYOK

模型切换不能只是下拉菜单中的字符串替换。

一个 model profile 应当明确说明 provider、endpoint、credential reference、model、上下文容量、输入输出模态、工具调用能力、reasoning 设置、成本和延迟提示。

BYOK (bring your own key) 表示用户把自己拥有的 API credential 写入本地凭据存储，再把 profile 指向它。

API key 不等同于订阅账户 OAuth。

前者通常是一个可撤销的服务密钥，后者涉及授权码或设备码、PKCE、refresh token、scope、账户策略和厂商特定的登录会话。

V1 应优先完成可观察的 BYOK provider profiles，不能假装 API key 自动获得 Claude Code 或 Codex 的订阅权限。

### 1.7 环境、权限与可恢复执行

模型给出动作提议，不等于动作已经安全执行。

系统至少要区分只读观察、写文件、运行命令、访问网络、删除或覆盖、使用外部账户这几类副作用。

权限应在 action 发生前显示命令、目标、工作目录、模型和预期副作用。

执行结果必须返回到同一 session，使模型和用户都能基于真实 observation 而非猜测继续工作。

取消、超时、限流、工具错误和应用重启都应保留恢复点。

### 1.8 plan、job 与 subagent 的生命周期

`plan` 是对目标、步骤、验收条件和当前决定的持久化表达，不是另一个 agent loop。计划可以被用户编辑、暂停或标记完成；计划状态的改变应进入 session event，使 UI、模型和恢复流程看到同一份状态。

前台 `turn` 适合需要用户持续观察的工作。`job` 是可由一个 turn 启动、随后独立运行的持久任务，它至少需要 job id、所属 session、输入引用、状态、取消入口、失败原因和最终产物引用。job 的开始、进度、完成、取消和失败都应写入事件；进程重启后只能从这些事件恢复，不应偷偷重新执行有副作用的 tool。

`subagent` 是带父子关系的受限执行单元，而不是把整个 session 复制一份。父 Agent 应显式给出目标、最少必要上下文、工具和权限 allowlist；子 Agent 回传结构化结论、文件或证据引用，父 session 记录委托和收敛结果。共享 workspace 时仍需要冲突策略，不能把并发写入当成自然合并。

command palette 属于 Interaction 面的 UI 路由器。它可以启动 plan、切换 profile、压缩、停止 job 或打开 evidence，但不是模型可以绕过权限调用的隐藏 tool；有模型可见影响的命令仍须经过同一 permission、event 和 recovery pipeline。

DSH 对应的实现插槽是 [`plan-mode`](../packages/plan/plan-mode)、[`jobs`](../packages/jobs/jobs)、[`subagent`](../packages/subagent) 和 [`commands`](../packages/interaction/commands)。这些 package 提供能力 seam，不代表当前桌面端已经实现完整的 unattended scheduler 或 team coordinator。

### 1.9 event log、replay 与错误恢复

事件日志至少要能区分用户意图、计划变更、模型请求、assistant 输出、tool proposal、permission decision、tool observation、compaction、job 状态和错误恢复。每个事件应能指向所属 session、turn、step 或 job；跨实体的因果关系必须用显式引用表达，而不是依赖 UI 当前排序。

replay 只重建 projection、UI 和模型 history，不重新执行原始 tool。resume 则从最近一个可恢复事件开始构造新 step，并把“恢复自何处”记录为新事件。这样可以在保留原始失败的同时继续工作，也避免把一次网络重试误记成两次文件写入。

错误恢复至少分三类：模型或网络错误可以重试或切换 profile；tool 错误需要保留命令、stderr、退出状态和工作目录；权限拒绝、取消和超时需要让用户知道动作没有完成。应用崩溃或强制退出时，checkpoint policy 应先保证事件完整，再由下次启动显示未完成的 turn/job，而不是显示一个看似成功的 assistant 消息。

这些规则把“可恢复”定义为可解释的状态转换，而不是保证任何外部副作用都能回滚。数据库写入、远程提交和文件删除等动作仍需由具体 provider 给出幂等或人工恢复方案。

## 2. 2024-2025 的研究路线

近两年的高质量工作并没有证明存在一个万能 Agent。

它们分别说明了动作接口、代码执行、事件流和沙箱、真实 OS、企业 GUI、科研闭环、资源约束和长上下文治理为什么都必须进入系统设计。

```text
tool use
  -> agent-computer interface and executable actions
  -> sandboxed generalist software agents
  -> real OS and enterprise-workflow evaluation
  -> scientific discovery and resource-aware evaluation
  -> context governance and multi-surface productization
```

### 2.1 SWE-agent: Agent-Computer Interface

**论文与代码。** [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](papers/ccf-a-agent-systems/swe-agent.pdf)，NeurIPS 2024，原文页为 [NeurIPS proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html)，代码为 [SWE-agent](https://github.com/SWE-agent/SWE-agent)。`P`。

**Motivation。** 面向人类设计的 shell 对模型不一定是好界面。

**Challenges。** 代码仓库导航、局部编辑、测试反馈、冗长观察和错误恢复都会消耗模型的有限上下文。

**Method。** 论文提出 Agent-Computer Interface (ACI)，用专门的搜索、查看、编辑命令和紧凑的环境反馈来替代纯 shell 操作。

**Dataset。** 主任务是 2,294 个实例的 SWE-bench test，并在 300 个实例的 SWE-bench Lite 上做界面选择分析，还报告 HumanEvalFix。

**Code。** [SWE-agent](https://github.com/SWE-agent/SWE-agent) 是论文对应的公开实现；本地白皮书只引用其公开仓库，不把实现细节当作论文实验结果。

**Tables。** Table 1 报告 SWE-bench full 与 Lite，GPT-4 Turbo 的 full resolve rate 为 12.47% (286/2,294)，Lite 为 18.00%。Table 2 报告 HumanEvalFix，论文摘要给出 87.7% pass@1。Table 3 比较 ACI 编辑、搜索、观察和 guardrail 选择。

**Ablation relation。** Lite 上的 ACI 相对只使用默认 Linux shell 的 baseline 多解决 10.7 个百分点。消融的核心不是更换模型，而是改变动作粒度、结果反馈和编辑 guardrail。

**Limitations。** 结果依赖具体模型、预算和 benchmark harness。ACI 的成功不等于任意 GUI 自动化可靠。

**DSH implication。** DSH 的 file、shell、LSP、terminal 和 tool render 不应只追求“暴露更多命令”。应让常见任务少回合、观察短而足够、错误可纠正，并在 UI 中呈现实际影响。

### 2.2 CodeAct: executable code actions

**论文与代码。** [Executable Code Actions Elicit Better LLM Agents](papers/ccf-a-agent-systems/codeact.pdf)，ICML 2024，原文页为 [PMLR](https://proceedings.mlr.press/v235/wang24h.html)，代码为 [code-act](https://github.com/xingyaoww/code-act)。`P`。

**Motivation。** 纯文本或 JSON action 往往只能调用固定工具，难以在一次动作中组合多个 API、变量和控制流。

**Challenges。** 动作接口需要同时保持可组合性、可执行反馈和环境权限边界，固定 schema 很难表达循环、条件和中间变量。

**Method。** CodeAct 让模型生成可执行 Python，使用解释器反馈修订或继续动作。

**Dataset。** 论文评测 17 个 LLM，复用 API-Bank 的 level-1 指令并评测 M3 ToolEval 等工具任务，同时提供 7k 多轮交互的 CodeActInstruct。

**Code。** [code-act](https://github.com/xingyaoww/code-act) 提供论文对应的公开代码和数据处理入口；它不是 DSH 的运行时依赖。

**Tables。** Table 1 对比 code、JSON 和 text actions。Table 2 观察 atomic API call correctness。Table 3 同时报成功率和平均 interaction turns。论文摘要报告相对常用替代方式最高可多 20 个百分点成功率，正文指出平均少 2.1 个 interaction turns 的配置。

**Ablation relation。** 附录 A.8 评估 CodeActInstruct 与数据混合成分。这个关系说明“代码作为动作”的收益来自统一的可组合动作空间和反馈，而不是仅增加一段 prompt。

**Limitations。** 任意代码执行扩大能力，也扩大环境管理和权限问题。

**DSH implication。** DSH 可保留 structured tools 作为稳定接口，并让 `code` preset 或 sandboxed interpreter 承担多工具组合。UI 应明确区分“模型提出的脚本”“实际运行的命令”和“已产生的文件”。

### 2.3 OpenHands: event stream、sandbox 与 evaluation platform

**论文与代码。** OpenHands: An Open Platform for AI Software Developers as Generalist Agents，ICLR 2025，原文页为 [OpenReview](https://openreview.net/forum?id=OJd3ayDDoF)，代码固定于 [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) commit `bab1baf2de1028c1d4404358448fb6ab3185755d`，MIT。`P` + `I`。

**Motivation。** 软件 Agent 需要的不只是一个 prompt，还需要用户、Agent 和环境之间的互动机制，安全的执行世界，以及可重复的评测。

**Challenges。** 平台必须同时容纳不同 Agent、执行后端、交互事件和 benchmark，而 sandbox、可恢复事件与产品 UI 还要保持可观察的一致性。

**Method。** 平台以 event stream 跟踪 user messages、actions 和 observations，在 Docker sandbox 中提供 shell、browser、IPython 和 action execution API，并允许多 agent delegation 和 benchmark integration。

**Dataset。** 论文纳入 15 类挑战任务，包括 SWE-Bench、HumanEvalFix、BioCoder、WebArena、GPQA、GAIA 等。

**Code。** [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) 固定在 `bab1baf2de1028c1d4404358448fb6ab3185755d`，许可证为 MIT；其 README 和 `docs/architecture.md` 说明 Agent Canvas 通过 Agent Server REST API 连接一个或多个后端，Electron 资源位于 `electron/`，公开代码用于核对前端、runtime service 和打包边界。

**Tables。** Table 2 是 benchmark catalog，Table 3 是跨 benchmark 的 selected results，Table 4 进一步报告软件工程任务。

**Ablation relation。** 该论文的重点是平台和 agent/evaluation catalog，不把单一组件消融包装成通用因果结论。应把不同 agent 与不同 benchmark 的对比理解为系统级比较。

**Industrial code lesson。** 当前 OpenHands Agent Canvas 采用 Electron 主进程启动 local stack 或 remote backend，再在 BrowserWindow 载入 UI。它把后端位置和界面位置分开，而不在 renderer 内重写 agent runtime。

**Limitations。** 论文中的 benchmark catalog 和平台对比不能推出任意模型、任意 sandbox 或任意桌面部署都具有相同的可靠性。

**DSH implication。** DSH 已有 durable events、plugin composition 和 web client。桌面端应复用它们，Electron 只负责窗口和 runtime lifecycle。

### 2.4 MLE-bench: 把资源与提交结果纳入 ML engineering 评测

**论文与代码。** [MLE-bench: Evaluating Machine Learning Agents on Machine Learning Engineering](papers/ccf-a-agent-systems/mle-bench.pdf)，ICLR 2025，原文页为 [OpenReview](https://openreview.net/forum?id=6s5uXNWGIh)，代码为 [openai/mle-bench](https://github.com/openai/mle-bench)。`P`。

**Motivation。** 单元级代码题不能衡量数据准备、训练、实验、提交和有限资源下的 ML engineering。

**Challenges。** 评测必须把数据、运行时间、硬件、提交结果和 agent 产物放进同一可重复环境，不能只看一个代码片段是否通过。

**Method。** 基于 Kaggle 构建离线环境，记录 agent 产物并用 competition leaderboard medal threshold 评估。

**Dataset。** 75 个手工筛选的 Kaggle ML engineering competitions，包含不同领域和复杂度划分。

**Code。** [openai/mle-bench](https://github.com/openai/mle-bench) 是论文对应的公开评测代码；它的 Kaggle 运行前提不等同于 DSH 本地 workspace。

**Tables。** Table 1 解释 Kaggle bronze/silver/gold threshold。主实验比较 o1-preview、AIDE、MLAB、OpenHands 等模型与 scaffold，并研究 pass@k、运行时间和硬件资源扩展。摘要报告 o1-preview 加 AIDE 在 pass@1 下至少达到 bronze 的比例为 16.9%，在更多尝试下达到 34.1%。

**Ablation relation。** 论文研究 runtime、hardware、pass@k 和训练数据污染的影响。这里的“更多预算”是独立变量，不能与某个 UI 或单一 tool 的收益混为一谈。

**Limitations。** Kaggle 任务仍是经过封装的 offline environment，不能完整代表生产数据权限、长期运营和团队流程。

**DSH implication。** Research mode 要显示实验时间、设备、输入数据、命令、输出和可复现配置。聊天窗口不能替代实验记录。

### 2.5 OSWorld: 真实操作系统不是玩具网页

**论文与代码。** [OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments](papers/ccf-a-agent-systems/osworld.pdf)，NeurIPS 2024，原文页为 [NeurIPS proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/hash/5d413e48f84dc61244b6be550f1cd8f5-Abstract-Datasets_and_Benchmarks_Track.html)，代码为 [xlang-ai/OSWorld](https://github.com/xlang-ai/OSWorld)。`P`。

**Motivation。** 真实电脑任务包含多应用、文件系统和操作系统状态，网页导航 benchmark 不足以代表它们。

**Challenges。** 视觉观察、鼠标键盘动作、窗口焦点、跨平台应用状态和任务验证互相影响，单一网页 DOM 接口不能覆盖这些失败模式。

**Method。** 使用真实 Ubuntu、Windows、macOS 环境，观察为桌面 screenshot，动作为鼠标键盘，结果由 task-specific execution script 验证。

**Dataset。** 论文描述 369 个可复现的 Ubuntu tasks，另有 43 个 Windows tasks，并在跨 OS 使用常见应用进行配置和评测。

**Code。** [xlang-ai/OSWorld](https://github.com/xlang-ai/OSWorld) 提供任务、环境和执行验证代码；它要求独立的真实 OS 测试环境，不是桌面壳的直接依赖。

**Tables。** Table 1 例示 evaluation script，Table 2 例示 mouse/keyboard actions，后续统计和结果表按 application/task 类型报告 agent 与人类表现。摘要报告 human completion 为 72.4%，当时最强 agent 远低于人类。

**Ablation relation。** 平台差异、视觉观察、动作空间和应用类别共同影响结果，不能把某一个 VLM 分数解释为“已经能安全自动操作桌面”。

**Limitations。** 论文任务依赖预置应用、桌面镜像和 task-specific verifier；benchmark 结果不能替代真实用户机器上的安全和兼容性验收。

**DSH implication。** V1 应优先用 filesystem、shell、LSP、browser API 与 MCP 等结构化能力。完整 GUI computer-use 需作为单独 capability 评估和审计。

### 2.6 Spider2-V: 企业数据工作流同时需要代码和 GUI

**论文与代码。** [Spider2-V: How Far Are Multimodal Agents From Automating Data Science and Engineering Workflows?](papers/ccf-a-agent-systems/spider2-v.pdf)，NeurIPS 2024，原文页为 [NeurIPS proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/hash/c2f71567cd53464161cab3336e8fc865-Abstract-Datasets_and_Benchmarks_Track.html)，代码为 [xlang-ai/Spider2-V](https://github.com/xlang-ai/Spider2-V)。`P`。

**Motivation。** 专业数据工作通常交替使用 SQL/Python、数据仓库、编排器、可视化配置和企业 GUI。

**Challenges。** 一个任务可能同时依赖代码、企业软件状态、文档检索和 GUI 操作；任何一层失败都会使最终数据产物不可验证。

**Method。** Spider2-V 提供执行式任务流程，把代码和视觉操作放在同一个企业工作流中评测。

**Dataset。** 数据集包含 494 个真实可执行 tasks，覆盖 20 个 enterprise-level data software systems，并为任务提供 execution-based evaluation 和系统文档。

**Code。** [xlang-ai/Spider2-V](https://github.com/xlang-ai/Spider2-V) 提供 benchmark、任务和评测入口；企业软件凭据与服务状态不随仓库获得。

**Tables。** 论文按数据仓库、数据摄取、编排、可视化等类别报告结果，比较 LLM/VLM agent、文档检索和不同观察/行动设置。任务要求既写代码又管理 GUI。

**Ablation relation。** 文档检索和 GUI 操作能力相互制约。模型能生成 SQL 并不表示它能完成 SaaS 控制台中的所有状态变更。

**Limitations。** 当前最强 agent 在细粒度、知识密集的企业任务上仍不可靠。

**DSH implication。** 工作台需要把环境状态、配置文件、运行日志和引用文档并列显示。未来 computer-use plugin 应明确每一步可验证结果，而不是只展示 screenshot reasoning。

### 2.7 DiscoveryWorld: 科研闭环需要 hypothesis、experiment 与 evidence

**论文与代码。** [DiscoveryWorld: A Virtual Environment for Developing and Evaluating Automated Scientific Discovery Agents](papers/ccf-a-agent-systems/discoveryworld.pdf)，NeurIPS 2024，原文页为 [NeurIPS proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/hash/13836f251823945316ae067350a5c366-Abstract-Datasets_and_Benchmarks_Track.html)，代码为 [allenai/discoveryworld](https://github.com/allenai/discoveryworld)。`P`。

**Motivation。** 现实实验昂贵且任务特化，难以比较 agent 是否真的完成从假设到结论的科学发现循环。

**Challenges。** 科研任务的成功不只是执行几个动作，还要保留假设、实验过程、观测证据和可解释结论之间的关系。

**Method。** 文本为主、可选 2D overlay 的环境让 agent 执行假设、实验、观测、分析和行动的闭环。

**Dataset。** DiscoveryWorld 提供 120 个 tasks，覆盖 8 个主题、3 个难度与参数变化；任务要求形成假设、设计实验、收集和分析结果、解释并行动。

**Code。** [allenai/discoveryworld](https://github.com/allenai/discoveryworld) 提供环境和任务实现；它是科研 Agent 评测参考，不是 DSH 的实验数据库。

**Tables。** Table 1 比较其他环境的模态、任务数、参数化、对象和动作。Table 2 描述八个 discovery themes。Table 3 是 scorecard。Table 4 和 Table 5 报 baseline 三类指标，Table 6 报 expert human scientist 表现。

**Ablation relation。** 评测把 task completion、task-relevant process actions、discovered explanatory knowledge 分开。只完成表面动作不等于形成可解释发现。

**Limitations。** 模拟环境不能取代真实实验室，且 baseline 低分说明任务难度而非产品已经可靠。

**DSH implication。** Research mode 需要 hypothesis、实验设计、数据/脚本、结果、解释和引用的明确产物链。论文 PDF、实验输出和最终文字都应能回到原始证据。

### 2.8 LongLLMLingua: 压缩要考虑问题相关性和位置信息

**论文与代码。** [LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression](papers/ccf-a-agent-systems/longllmlingua.pdf)，ACL 2024，原文页为 [ACL Anthology](https://aclanthology.org/2024.acl-long.91/)，代码为 [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua)。`P`。

**Motivation。** 长上下文同时带来成本、延迟、噪声和 lost-in-the-middle position bias。

**Challenges。** 压缩不能只追求更少 token；问题相关证据、文档顺序、答案位置和原始可追溯性都可能受到影响。

**Method。** 方法使用 question-aware coarse-to-fine compression、document reordering、dynamic compression ratio 和 post-compression subsequence recovery。

**Dataset。** NaturalQuestions、LongBench、ZeroSCROLLS、MuSiQue、LooGLE，共五类长上下文 benchmark。

**Code。** [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) 提供论文对应的 prompt compression 实现；DSH 只借鉴评测维度，不把它替换为 durable event compaction。

**Tables。** Table 1 比较不同 compression ratio 下的性能、token、成本和 latency。Table 2 是 LongBench 结果。Table 3、4、7 分析 question awareness、reordering 和其他组件。摘要报告 NaturalQuestions 上最高 21.4% performance gain 且约少 4 倍 token，LooGLE 最高 94.0% cost reduction，约 10k token prompt 在 2x-6x 压缩时 end-to-end latency 为 1.4x-2.6x。

**Ablation relation。** 移除 question-awareness 或 reorder 会改变不同位置、不同压缩率下的性能，说明“删 token”本身不是正确目标。

**Limitations。** 这些数字来自论文指定模型、数据集、压缩率和评测脚本；它们不能直接预测 DSH 的 provider 成本、延迟或 summary 质量。

**DSH implication。** DSH 应保留 event-sourced compaction 作为历史和恢复基础，再借鉴问题相关性、来源选择和位置意识来改进 context tray。不要把通用 prompt clipper 直接当作 durable session summary。

## 3. 工业实现的共同结构

### 3.1 本地参考仓库

| 项目 | 本地位置与固定版本 | 许可证 | 官方/上游链接 | 关键结构 | 对 DSH 的直接启发 |
| --- | --- | --- | --- | --- | --- |
| OpenHands Agent Canvas | `bab1baf2de1028c1d4404358448fb6ab3185755d` | MIT | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | Electron 启动 agent server、automation、frontend 和 ingress；多 backend | 桌面 shell 管生命周期，agent runtime 不进入 renderer。 |
| Goose | `3810898a7447ec3299be72e223d3570a7aabf0ab` | Apache-2.0 | [aaif-goose/goose](https://github.com/aaif-goose/goose) | Rust core，desktop/CLI/API，ACP，provider/extension，context management | 一个 agent engine 支持多宿主表面；compaction summary 应含当前工作和待办。 |
| Cline | `8bbdde2a5c1f972864fe1b954f639c21fac61a40` | Apache-2.0 | [cline/cline](https://github.com/cline/cline) | VS Code-first task core、providers、SDK、MCP、hooks、desktop example | IDE 工作流可由可复用 core 支撑，但不应把 editor host 写死为 runtime。 |
| Grok Build | `SOURCE_REV=e6a67a5408288c98380cd13f3b1fe1fbc01c9f1f` | Apache-2.0 | [x.ai/cli](https://x.ai/cli) | Rust TUI、ACP、session search、compaction、MCP、skills、sandbox、workspace | 计划、model picker、session search、config precedence 和终端密度值得学习。 |



### 3.2 从工业代码得到的非专有结论

**一个引擎，多种表面。** OpenHands、Goose、官方 Codex 和 Claude Code 都将本地执行引擎与终端、IDE、桌面或远程表面分离。

**桌面程序必须管理 runtime 生命周期。** 这包括 bundled executable/Node runtime、PATH、启动进度、health check、日志尾部、崩溃后的可见错误和退出时的子进程回收。

**上下文管理是产品功能。** Goose 的 context-management crate 将 summary 视为结构化的 current work、files、pending tasks 和问题状态。DSH 有更强的 event log 基础，应让这些状态在 UI 中可见。

**配置要有层级与信任边界。** 模型、扩展、hooks、MCP 和权限不应混在一个无法解释的全局 JSON 中。profile、project override、user default 和 one-off override 必须有清晰优先级。

**可扩展性需要稳定插槽。** Cline 的 core/SDK、Goose 的 extension/ACP、OpenHands 的 agent backend 都表明，UI integration 和 agent runtime 不应互相硬编码。

### 3.3 官方 Codex 与 Claude Code 的公开能力

下表只使用官方文档公开的能力。

| 维度 | Codex | Claude Code | DSH 当前状态 |
| --- | --- | --- | --- |
| 主表面 | CLI、IDE extension、Desktop、cloud/remote surface | CLI、VS Code/JetBrains、Desktop、Web、mobile/remote | CLI、Web Client，以及已在 Linux x64 验证 keyless 首启的 Electron 薄壳。 |
| 本地工作 | 检查、编辑、执行命令、review、`codex exec` | 检查、编辑、shell、CI/pipe automation | file、shell、terminal、LSP、tool pipeline，受 profile 影响。 |
| 配置 | user/project/profile/system precedence，trusted project | CLAUDE.md、settings、project/user scope | profile、bundle、patch、settings 和 credentials seam。 |
| 扩展 | AGENTS.md、skills、plugins、MCP、app server | CLAUDE.md、skills、MCP、subagents、hooks、plugins | Cordis plugins、skills、MCP、workflow、subagent、hook bridges。 |
| context | session configuration、model/reasoning selection、record/replay docs | auto compaction、memory、subagent context isolation | event-sourced session、manual/automatic compaction、plan/todo。 |
| 身份与分发 | ChatGPT sign-in 或其他官方 auth 路径 | subscription login 或 API key，原生安装器 | BYOK credential storage。没有官方订阅 OAuth bridge。 |
| 多端和后台 | 官方提供 IDE/cloud/desktop surface | 官方提供 desktop、remote、cloud routine/schedule 等 | 尚无本地完成的 cloud sync 或 unattended scheduler。 |

Codex CLI 的官方入口是 [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)，其配置层级见 [Config basics](https://learn.chatgpt.com/docs/config-file/config-basic)，IDE 语境见 [Codex IDE extension](https://learn.chatgpt.com/docs/codex/ide)。

Claude Code 的安装和 surface 说明见 [Overview](https://code.claude.com/docs/en/overview)，扩展机制见 [Features overview](https://code.claude.com/docs/en/features-overview)，子 Agent 和 compaction 见 [Subagents](https://code.claude.com/docs/en/sub-agents)，hooks 见 [Hooks guide](https://code.claude.com/docs/en/hooks-guide)。

这些闭源产品的功能面不代表 DSH 已经拥有相同的服务质量、账户集成或远程基础设施。

## 4. DeepSeek Harness 的现实能力与边界

### 4.1 架构事实

DSH 基于 vendored Cordis，核心原则是“everything is a plugin”。

profile 由 bundle、profile patch、home patch 和命令行 overlay 叠加组成。

web profile 组合 Web host、frontend、API proxy 和 client，而不是一个单独的静态聊天页面。

session event log 是模型 history、UI replay、fork、resume、telemetry 和 persistence 的源头。

agent loop 的关键序列是 `turn/start -> step/start -> history -> llm stream -> assistant/tool events -> step/end -> turn/end`。

这些事实的架构说明位于 [docs/architecture.md](../docs/architecture.md)。

### 4.2 已经能做什么

| 能力 | DSH 证据 | 使用含义 |
| --- | --- | --- |
| 组合 Agent 运行时 | bundle/profile/patch 和 Cordis plugins | 能以配置替换 provider、tool、session、sandbox policy 等。 |
| Web 工作台 | `apps/web`、`dsh web`、`dsh-web-app` bundle | 已有 browser UI，而非从零开始做聊天窗口。 |
| 本地工作台视图 | `dsh-client-ui-workbench`、`ui-workbench.mode` | 代码／科研选择由 Host settings 在 loopback 本地持久化，并在常规设置、空 session 与会话标题栏同步；科研入口读取已加载 durable events，投影工具结果、成功写入路径、provider/model 和 compaction；它不改变模型、工具、权限、提示词或 session event。 |
| 多 provider 模型 | `llm-deepseek`、`llm-pi-ai` | 可经官方或兼容 API 使用 DeepSeek、OpenAI、Anthropic 等 profile。 |
| 本地 BYOK | credentials service 和 `.credentials.yaml` provider | key 可由 credentials seam 写入，调用方只拿 credential reference。 |
| durable context | `dsh-session` events 和 projection | 事件可重放，UI 与模型 history 有共同来源。 |
| compaction | `dsh-compaction`、manual command、capacity policy | 已有手动与自动压缩机制。 |
| 开发工具 | fs、shell、subprocess、terminal、LSP、workspace、Git 相关能力 | 适合代码与实验执行，但权限和 sandbox 取决于 profile。 |
| 扩展 | MCP、skills、workflow、subagent、todo、plan、hooks bridges | 可扩展能力应通过插件和已定义 service seam 接入。 |
| Sandbox providers | 各 OS provider、bwrap/Landlock、sandbox-exec、Windows ACL 路径 | 有实现基础，不能据此承诺所有 host 上等价隔离。 |

### 4.3 需要配置、验证或仍缺失的能力

| 目标 | 当前判断 | 原因 |
| --- | --- | --- |
| 原生桌面使用 | Linux x64 与 Intel macOS x64 的 Electron 目录构建已 keyless 验收；Apple Silicon 在原生 CI runner smoke 验收 | 主进程启动 built CLI、携带 runtime closure、等待 loopback 就绪并加载真实 Web Client；macOS 资产仍未签名/公证。 |
| Windows/macOS/Ubuntu 安装包 | Linux x64 AppImage/deb 与 macOS Intel/Apple Silicon DMG/ZIP 已在原生 host 生成并检查；Windows 仍为 CI-only | `electron-builder` maker 已接入，macOS 包安装/首启与 native addon 有证据；签名/notarization、升级/卸载和完整三平台安装矩阵仍是发布工作。 |
| Claude/GPT/DeepSeek API 切换 | profile/config 可支持，必须逐个真实 API 验收 | endpoint、模型目录、账户额度和 provider capability 变化很快。 |
| API key UI | keyless Electron 首启已显示现有 provider/API key 配置页 | 需要用户手工输入真实 key，验证 key 不被回显或写进 session，并逐个验证 provider。 |
| 云端会话接续 | 未完成 | 缺 event replication、identity、remote backend 和同步语义。 |
| 厂商订阅 OAuth | 未完成 | BYOK 不能替代厂商 OAuth、token refresh 或服务条款。 |
| 完整 GUI computer-use | 不是当前可验收能力 | 需要视觉观察、动作预算、跨 OS 环境和独立 benchmark。 |
| 后台无人值守调度 | 有 workflow/job 基础，不是完整 local daemon 产品 | 仍需 scheduler、durable execution、通知和权限时效设计。 |
| 复杂 agent team | 有 subagent/workflow 基础，不是 team coordination 产品 | 仍需任务图、并发、worktree、冲突合并和成本控制。 |

## 5. DSH Local Workbench 蓝图

### 5.1 设计原则

1. 复用 DSH 的 agent core，不在 Electron renderer 再写一份 session、provider 或 compaction。
2. 一个 event stream 支撑 Build 与 Research 两种模式，不做两个彼此不能恢复的产品。
3. 所有模型可见的 context 都在 Context Tray 中可检查。
4. 所有有副作用的 tool call 都有可审阅的操作和 observation。
5. 优先使用结构化工具，GUI automation 作为独立、可审计的后续 capability。
6. 视觉采用安静、紧凑、可扫描的本地开发工作台，不使用营销 hero 或卡片堆叠代替信息架构。


### 5.2 原生进程模型

```text
Electron main process
  -> reserve 127.0.0.1 port
  -> start built DSH CLI with RUST_LOG=info
  -> wait for local Web host readiness
  -> load existing DSH Web Client in BrowserWindow
  -> stop child process when application exits

DSH runtime
  -> profile/bundle/plugin composition
  -> credentials, session events, model providers, tools and compaction
  -> local workspace and sandbox providers
```

Electron 是 V1 的选择，因为 DSH 的运行时已是 Node/ESM workspace，依赖 built CLI、pnpm dependency closure 和 `node-pty` 等 native addon。

Tauri 在最终二进制体积上可能有优势，但会在 V1 引入另一套 Rust host 与 Node plugin runtime 的跨边界维护成本。

桌面 shell 的责任只包括窗口、子进程和用户可见启动失败信息。

模型、credentials、session、plugins、tools 和 compaction 继续由 DSH packages 拥有。

### 5.2.1 当前实现与发布边界

本仓库的 [`apps/desktop/src/main.mjs`](../apps/desktop/src/main.mjs) 和 [`runtime.mjs`](../apps/desktop/src/runtime.mjs) 已实现这个薄壳：主进程只绑定 loopback、启动 `dsh web`、等待 HTTP 就绪并加载现有 client；`BrowserWindow` 启用 context isolation、关闭 Node integration 并开启 sandbox。

开发态使用 PATH 中的普通 Node 运行工作区的 built CLI，因为 Electron 的 Node 子模式不能解析 pnpm isolated worktree 的 plugin 依赖。

桌面开发入口经 [`run-electron.mjs`](../apps/desktop/scripts/run-electron.mjs) 启动真实 Electron 二进制，并在 Electron 自身启动前移除继承的 `ELECTRON_RUN_AS_NODE`。这是因为某些开发环境或自动化会为子进程设置该变量；它只适合 Electron 内部启动 Node runtime，不能让 BrowserWindow 进程进入 Node 模式。

在当前 Linux host 上，带 Xvfb 的开发入口通过 Electron DevTools Protocol 连接后，页面标题为 `DeepSeek Harness`，首屏可见 `New Session`、`Workspaces`、`Settings`、`Standard mode`、`API key` 和 `Configure later`；这是 keyless UI smoke evidence，不是 provider 请求成功证据。

同一 host 安装 Playwright Chromium 后，`replay-round-trip.e2e.ts` 与 `onboarding-deepseek-config.e2e.ts` 在 `DSH_SNAPSHOT=replay` 下通过，覆盖真实 Web assembly 的事件重放、bash observation、keyless DeepSeek credential 写入、刷新后配置投影和密钥不回显。

Provider 侧的配置、catalog、dynamic settings、discovery、SDK wire options、拓扑和模型编辑 keyless 测试通过。`llm-pi-ai` 的 adapter、dynamic-config 与 loader-composition 测试还将 DeepSeek catalog route 和 OpenAI Responses route 指向本地 HTTP/SSE mock，验证 credential reference 解析、动态 route 注册和 next-request credential rotation；`llm-retry` 的 transport-recovery 测试以同一类 mock 驱动实际 DeepSeek adapter 的拒绝连接、部分流和 idle timeout 恢复。它们证明 profile 注册、OpenAI/Anthropic/DeepSeek route 切换和凭据引用路径可在 mock/本地环境工作，不证明任何真实厂商账户额度或服务可用。

其中 [`models-settings.e2e.ts`](../apps/web/tests/models-settings.e2e.ts) 直接从 Models 页面将 OpenAI 与 Anthropic 写成两个独立 BYOK profile，确认两个 route 重新注册、`settings.yaml` 只保存 credential reference、key 只进入本地 credentials 文件且不进入 DOM；[`default-model.e2e.ts`](../apps/web/tests/default-model.e2e.ts) 再确认同一个 session model selector 的切换会成为后续 session 的 default，而已有 logged route 保持不变。两者都使用本地伪值且不发起模型请求。

当前可核验的能力证据可以按下面的边界阅读。

| 场景 | 本地证据 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| 事件重放与恢复 | [`apps/web/tests/replay-round-trip.e2e.ts`](../apps/web/tests/replay-round-trip.e2e.ts)、[`packages/core/agent-loop/tests/resume.spec.ts`](../packages/core/agent-loop/tests/resume.spec.ts)、[`packages/core/agent-loop/tests/cancel.spec.ts`](../packages/core/agent-loop/tests/cancel.spec.ts) | durable event、cancel/resume 和 keyless Web assembly 的路径可运行。 | 任意外部副作用都能回滚。 |
| provider mock 与 profile | [`apps/web/tests/models-settings.e2e.ts`](../apps/web/tests/models-settings.e2e.ts)、[`apps/web/tests/default-model.e2e.ts`](../apps/web/tests/default-model.e2e.ts)、[`packages/llm/llm-pi-ai/tests/adapter.spec.ts`](../packages/llm/llm-pi-ai/tests/adapter.spec.ts)、[`packages/llm/llm-pi-ai/tests/dynamic-config.spec.ts`](../packages/llm/llm-pi-ai/tests/dynamic-config.spec.ts)、[`packages/llm/llm-retry/tests/transport-recovery.spec.ts`](../packages/llm/llm-retry/tests/transport-recovery.spec.ts) 的 keyless provider/UI 测试 | OpenAI/Anthropic/DeepSeek route、model selector、wire option、credential reference、动态 credential rotation、capability mismatch 和本地 HTTP/SSE 传输恢复。 | 真实 endpoint、账户额度、服务条款或网络 SLA。 |
| compaction | [`packages/compaction/compaction-basic/tests/manual-compaction.spec.ts`](../packages/compaction/compaction-basic/tests/manual-compaction.spec.ts)、[`packages/compaction/compaction-basic/tests/compaction-loop-repro.spec.ts`](../packages/compaction/compaction-basic/tests/compaction-loop-repro.spec.ts) | 手动压缩、自动循环和原始事件保留的代码路径。 | 任意模型生成的 summary 都正确或不丢失领域事实。 |
| 权限与错误恢复 | [`apps/web/tests/approval-composer.e2e.ts`](../apps/web/tests/approval-composer.e2e.ts)、[`apps/web/tests/permission-policy-context.e2e.ts`](../apps/web/tests/permission-policy-context.e2e.ts)、[`packages/interaction/user-approval/tests/approval.spec.ts`](../packages/interaction/user-approval/tests/approval.spec.ts) | approval、deny、policy projection 和错误状态的 keyless 交互。 | 未经审批的 host 操作、跨平台 sandbox 等价性或真实网络失败的完整矩阵。 |
| 本地工作台视图 | [`apps/web/tests/workbench-mode.e2e.ts`](../apps/web/tests/workbench-mode.e2e.ts)、[`packages/client/ui-workbench/tests/`](../packages/client/ui-workbench/tests/) | 代码／科研 UI lens 的持久化、重载恢复、三个 client entry point，以及活动 session 在 Chat、Research evidence projection 与既有 `trajectory` event ledger 间切换。 | 选择某个 lens 后自动获得科研 agent、跨 session 证据管理或不同模型策略。 |
| checkpoint 与崩溃恢复 | [`packages/session/session-checkpoint-policy/tests/crash-recovery.e2e.ts`](../packages/session/session-checkpoint-policy/tests/crash-recovery.e2e.ts) | 进程异常后的 checkpoint/restart 语义。 | OS 强制断电、磁盘损坏或所有外部服务的事务回滚。 |

重新生成的 Linux x64 AppImage 也在 `APPIMAGE_EXTRACT_AND_RUN=1`、Xvfb 和 DevTools Protocol 下启动，显示同一 keyless 首屏；这是 AppImage payload smoke，不是对系统级安装、桌面菜单、升级或卸载的证明。deb 仅完成 `dpkg-deb --info` 元数据检查。

Linux 与 macOS 原生 runner 的桌面工作流还会在同一次构建输出的 `linux-unpacked` 或 macOS `.app` 目录上运行 [`smoke:dir`](../apps/desktop/scripts/smoke.mjs)：它通过 Playwright CDP 等待 loopback Web Client URL 和真实标题，检查首屏入口，选择 `Configure later` 关闭 keyless onboarding，再用鼠标打开 Settings、用键盘激活 Models，并确认 DeepSeek/API key 设置表面可见，最后在成功或失败后回收 Electron。这个 smoke 把打包应用的启动时序和本地 BYOK 设置路径纳入 Linux 与 macOS CI，但仍不替代 AppImage/DMG 安装、升级、卸载或真实 provider 请求验收。

打包态由 [`stage-runtime.mjs`](../apps/desktop/scripts/stage-runtime.mjs) 执行 `pnpm deploy --prod --legacy`，补齐声明为 workspace peer 但未被 deploy 带出的包，并将指向工作区的外部链接实体化；重复暂存会把上一份生成 runtime 移到带时间戳的 ignored sibling。[`package.mjs`](../apps/desktop/scripts/package.mjs) 直接以桌面 manifest 作为 electron-builder 项目，并根据签名环境选择明确的 unsigned 或 hardened/notarized macOS 配置。运行时放在 `resources/dsh-runtime`，子进程使用 `RUST_LOG=info` 和 `--expose-internals`，后者是 DSH HMR service 的现有启动要求。

当前已在 Linux x64 验证 `linux-unpacked` 目录、AppImage 和 deb 目标，并在 Intel macOS 验证 `.app`、DMG 和 ZIP 目标：目录构建可以启动真实 Web Client，keyless 首屏可进入 New Session、Workspaces、Settings 和 provider/API key 配置页；macOS DMG 已挂载并将应用安装到用户 Applications 目录后再次 smoke；[`check-native.mjs`](../apps/desktop/scripts/check-native.mjs) 成功从各自暂存 runtime 加载并启动/关闭 `node-pty`。这些验证没有使用真实 API key；Apple Silicon 由原生 CI runner 提供相同的 UI/native-addon smoke，签名、公证、升级、卸载和真实 provider 仍未验收。

macOS 构建脚本已在 Intel 本机和 Apple Silicon 原生 runner 运行；当前 DMG/ZIP 是架构专用且 unsigned，签名证书、Apple notarization、Windows code signing、完整安装升级卸载和真实 provider 请求仍未完成。因此只能把当前产物称为 unsigned macOS preview，不能称为已签名的三平台发行版。

### 5.3 信息架构

```text
top bar: project | active session | command palette | model profile | runtime status

left pane: workspace, sessions, plans, research sources, terminal entries
center pane: event conversation, tool cards, diffs, test output, citations
right pane: active context, plan progress, evidence/artifacts, approval inspector
bottom composer: attached sources | context controls | compact | stop/send
```

窄窗口将三个主 pane 切换显示，而不是简单把文字压缩到不可读。

已获同意的设计预览位于 [`workbench-companion.html`](../apps/desktop/design/workbench-companion.html)：它展示三栏工作台、窄窗口的 Work/Run/Context 折叠，以及 Build/Research 两种事件流；它是视觉伴随页，不替换现有 DSH Web Client。

当前的 [`dsh-client-ui-workbench`](../packages/client/ui-workbench/README.md) 已把代码／科研做成持久化的本地 UI lens：它在常规设置、空 session hero 和活动 session 标题栏使用相同的 `ui-workbench.mode` 值。活动标题栏切到科研会打开 `research` evidence projection，列出当前已加载 event window 的工具结果、成功写入路径、provider/model 和 compaction；相邻的 `trajectory` 保留逐 turn/step 的详细 event ledger，切回代码会打开 Chat。会话 ring 还由 [`dsh-client-ui-conversation`](../packages/client/ui-conversation/README.md) 原生提供 `context` ledger：它按最近一次已加载 compaction 分组审阅 durable context injections，沿用 context source/form 的现有可读呈现并可加载更早 history。这些呈现都只读取同一 session 的 durable events，不改变 Agent 语义；跨 session 证据库、研究 workflow 或不同的 tool/model policy 仍必须由独立 plugin/provider 明确实现。

accent color 必须统一，动效只表示启动、流式状态、审批结果、面板切换和布局重排，并遵循 `prefers-reduced-motion`。

### 5.4 Build mode

Build mode 的首要对象是 repository、任务计划、文件 diff、测试和 terminal。

典型流程是选择项目和 model profile，写明任务，确认或修改 plan，审阅 tool approval，查看 diff 和测试输出，然后把结果保留在同一 session。

重点不是模仿 IDE 的每一项编辑功能，而是让用户理解 Agent 为什么读某个文件、运行了什么、改动了什么、如何验证。

### 5.5 Research mode

Research mode 的首要对象是问题、论文、数据、实验、图表、引用和结论。

当前实现把活动 session 的 Research 切换映射到 `research` evidence view：它从当前已加载 durable event window 读取 tool outcome、成功 mutation path、provider/model 和 compaction，并可通过既有 session paging 请求更早事件页；它不另存证据或改变 Agent 行为。相邻的 `trajectory` view 仍可审阅由同一 durable events 派生的 turn/step、工具调用、请求、provider/model、compaction 与 token 用量；Chat 中已有的 Web 引用卡、文件 diff、terminal 输出和 produced-files 行仍保留在同一 session 内。

它应将 hypothesis、实验设计、输入数据、命令、运行时间、输出、失败、解释和引用组织为可追溯产物。

它不承诺替代 Jupyter、LaTeX、Zotero 或专业实验平台。

它的价值是把这些工作产物和同一 Agent session 的决策、工具调用和 summary 连接起来。

### 5.6 Context Tray 与 compaction UX

完整的 Context Tray 应展示下一次模型请求的可解释组成部分：项目规则、选中文件、附件、计划、工具、近期 events 和已有 summary。

当前实现的 `context` ledger 是这个方向的已交付最小面：它只显示当前已加载 session window 中 durable `context` events，并按最近一次已加载的 compaction marker 分开较新的与较早的注入；每项复用 Chat 的 source/form disclosure，用户可以继续加载更早 event page。它不合成 provider-specific system prompt、tool schema 或完整的下一次 provider payload，因此不能被误读为精确 request debugger。

用户可以移除无关来源、固定关键证据、查看 token/capacity 提示，或请求手动 compaction。

自动 compaction 应显示触发的容量条件、生成的 summary、保留内容和原始 events 的回溯入口。

summary 可以由用户编辑或拒绝，但编辑也必须记录为 durable event。

### 5.7 插件、MCP 与 UI contributions

新能力必须使用现有 DSH extension point。

新 tool 注册到 `ctx.tools` 并经过执行 pipeline。

新 provider 注册到 `ctx.llm`。

新 durable state 扩展 SessionEventMap。

新 UI 通过 conversation node、panel 或 command 定义渲染已有 events。

插件不能直接修改 agent-loop，也不应在独立客户端 store 中制造模型不可见但会改变行为的状态。

## 6. 延期能力不是一句“以后再做”

### 6.1 云端多设备接续

云端接续意味着 session event、workspace reference、identity、approval 和 credential policy 可以在本机与远端间安全移动。

典型架构需要 remote session broker、append ordering、deduplication、断线重连、冲突处理、设备撤销和端到端数据策略。

本地 event log 是必要前提，但不是同步实现。

V1 延期它，是因为首先需要证明单机 session 的 replay、compaction、权限和 runtime lifecycle 正确。

未来可通过 remote session provider 或 ACP-compatible remote backend 接入。

验收需覆盖离线恢复、重复事件不重复触发副作用、设备撤销和跨设备文件引用失败。

### 6.2 完整 computer-use GUI 自动化

computer-use agent 通常由 screenshot 或 accessibility tree 观察，VLM/LLM 规划鼠标键盘动作，再对动作后的状态做验证。

它还需要跨 DPI/窗口/OS 的坐标处理、动作预算、页面加载处理、sandbox、目标选择和可恢复的错误策略。

OSWorld 和 Spider2-V 的现实环境结果说明这项能力仍远未达到“默认安全自动运行”的标准。

V1 延期它，不是否认它有价值，而是优先使用 shell、filesystem、LSP、MCP、browser API 等可验证的结构化路径。

未来 computer-use provider 应以独立 capability seam 提供 screenshot、action、verification、approval 和 audit trail。

验收应衡量任务成功率、误操作率、人工恢复率、每步证据和平台差异。

### 6.3 厂商订阅 OAuth

OAuth subscription integration 要处理 device or authorization-code flow、PKCE、refresh token、scope、账户注销、组织策略和 provider-specific API behavior。

它不同于将 API key 存入 credentials provider。

V1 只承诺 BYOK，原因是它可以用 DSH 现有 credentials seam 透明处理，并允许用户控制不同厂商的 endpoint 和费用。

未来应为每个厂商实现独立 credential provider，而不是在通用 model selector 中伪造 OAuth。

验收要确认 token 不进入 session 或日志，refresh failure 可恢复，logout 真正撤销，权限不足时能正确降级。

### 6.4 后台无人值守调度

unattended scheduling 需要 local daemon 或 remote worker、durable job queue、time/webhook trigger、retry、resource budget、notification、wake/sleep behavior 和有时效的 approval policy。

仅有一个 `workflow` tool 或循环提示不等于具备安全的后台调度产品。

V1 先让 jobs 的启动、取消、失败和恢复在可见 UI 中成立。

之后可将 scheduler 作为 plugin，使用明确的持久化 job state 和通知通道。

验收需要重启恢复、幂等性、资源限制、过期授权和外部副作用审计。

### 6.5 复杂 Agent Team

team 不是“多开几个模型”。

它需要 coordinator、任务图、worker isolation、消息协议、共享或隔离 workspace、Git worktree、冲突合并、失败传播、预算与结果评审。

V1 只使用边界清晰的 subagent delegation：子 Agent 获得最少上下文和工具，回传结构化结论与产物摘要。

未来 team provider 可以在这一基础上增加并发调度和 worktree 管理。

验收要比较并行带来的 wall-clock 收益、merge conflict rate、token/cost budget 和单 worker 失败是否被隔离。

## 7. 实施与验收路线

### 7.1 阶段

1. 研究证据和白皮书：完成本文件，确保每个数字、仓库和链接可追溯。
2. 桌面壳：已验证 Electron 能启动 built DSH CLI，显示真实 Web Client，并在关闭时回收 child runtime。
3. Context and provider workbench：把现有模型设置、credential reference、capacity 和 compaction 暴露为可解释 UI。
4. Build and Research surfaces：在同一 event stream 上组织 diff/test/terminal 与 evidence/experiment/citation。
5. Runtime closure and installers：Linux x64 的 `resources/dsh-runtime`、AppImage 和 deb，以及 Intel macOS 的 `resources/dsh-runtime`、DMG 和 ZIP 已验证；Apple Silicon native runner 完成 UI/native-addon smoke，但签名/公证和完整安装矩阵仍待完成。
6. Release verification：完成三平台安装/升级/卸载、真实 API key 手工验收和签名流程。

### 7.2 原生 runner 与开源交付入口

`.github/workflows/desktop.yml` 是三平台构建的可复现入口：Ubuntu 24.04 运行 `pack:linux` 并在 `xvfb-run` 下执行 `smoke:dir`，随后检查 AppImage/deb；macOS Intel runner 与 macOS 15 Apple Silicon runner 运行 `pack:mac`、打包 UI smoke 并检查 dmg/zip；Windows 2025 runner 运行 `pack:win` 并检查 NSIS exe/zip，且展开 zip 验证其可读。每个原生 runner 还运行 [`check-native.mjs`](../apps/desktop/scripts/check-native.mjs)，从暂存 runtime 加载 `node-pty` 并创建/关闭一个最小 PTY。打包入口会在 electron-builder 启动前拒绝与当前 `process.platform` 不匹配的目标，因此 host 编译的 native addon 不会被误放进异平台安装包。工作流在 pull request、`desktop-v*` tag 和手动 dispatch 时运行，使用锁定的 `pnpm-lock.yaml`，上传 AppImage/deb、架构专用 dmg/zip 或 exe/zip 作为 7 天保留的 unsigned artifacts；desktop tag 的发布任务会把 Linux 与 macOS 资产一起放入 prerelease。具体 CPU 架构随 runner 和构建目标确定，不能从该 workflow 推出 Universal macOS binary。安装、BYOK 和本地打包命令由 [`apps/desktop/README.md`](../apps/desktop/README.md) 作为用户入口维护。

工作流设置 `CSC_IDENTITY_AUTO_DISCOVERY=false` 和 `WIN_CSC_IDENTITY_AUTO_DISCOVERY=false`，所以构建成功只证明 runtime closure、native addon 编译和 installer payload 可以生成；macOS/Windows 的 payload 检查只证明文件非空、zip 可读或镜像可检查，不证明签名、Apple notarization、Windows SmartScreen 信任、安装升级卸载或真实模型接入。发布前必须在拥有相应证书的 release job 中显式注入签名材料，并把安装/升级/卸载和 API key 手工验收结果作为 release evidence；没有这些证据时只能把工作流产物称为 unsigned build artifact。

该 workflow 在 `desktop-v*` tag 上会由 GitHub Actions 创建包含 Linux 与 macOS unsigned assets 的 prerelease，但不会替维护者完成签名/公证或安装升级卸载验收。开源发布顺序应是：维护者审阅源码与 `references/` 的许可证，合并变更，使用 tag 触发构建，下载并安装验收 unsigned artifacts，拥有相应凭据后再签名/公证并更新 release evidence。这样“仓库已开源”和“可分发安装包已签名”不会被混为一谈。

### 7.3 测试矩阵

| 层级 | 必须验证的场景 |
| --- | --- |
| Unit | port reservation、child launch arguments、`RUST_LOG=info`、health wait、shutdown、provider profile、compaction projection、approval state。 |
| Assembled profile | keyless boot、durable events、snapshot replay、cancel/resume、tool error 和 provider failure。 |
| UI | 三栏 pane、窄窗口、keyboard command palette、loading/error/empty state、manual/automatic compaction、diff 和 approval review。 |
| Provider mock | DeepSeek/OpenAI/Anthropic compatible endpoint、key rotation、rate limit、network interruption、model capability mismatch。 |
| Platform | macOS, Ubuntu, Windows 的 package install、native addon、runtime closure、first launch、upgrade、uninstall。 |
| Manual acceptance | 用户输入自己的 API key，实际选择模型，执行受控读写/测试任务，检查 session 与 compaction 是否可恢复。 |

真实模型验收前不能宣称 provider integration 已完成。

签名证书和 Apple notarization、Windows code signing 是发布 prerequisites，不应在缺少凭据时被伪装成已完成的 installer。

### 7.4 手工 BYOK 验收顺序

手工验收由用户在本机完成，API key 不应发送到聊天、提交到 Git 或写入 session event。先启动 Linux 目录包/AppImage，或在 macOS/Windows 启动对应 native runner 生成的应用；在 Settings → Models 中为 DeepSeek 输入 key，保存后确认页面只显示 configured/redacted 状态，随后选择一个实际模型发送最小无副作用请求。成功标准是 provider request 正常结束、assistant 事件和 usage 可在同一 session 回看，而不是某个固定回答文本。

然后为 OpenAI 和 Anthropic 分别填写各自 key，选择它们的 route/model，重复同一最小请求；配置兼容网关时同时记录 endpoint、protocol 和 model id。切换 provider 后回看历史，确认旧 assistant 事件仍保留其原 provider/model source，新的 turn 使用新 profile，且 key 的任何字符不出现在消息、tool observation、错误诊断、截图或日志中。

最后在同一 session 执行一次手动 compaction，等待一次自动 compaction 条件或使用 keyless replay fixture，检查 summary、原始事件回看和下一轮上下文；发起一个需要审批的 shell/file action，分别验证 Allow/Deny、取消、超时和 provider failure 的恢复点。每个平台都记录应用版本、OS/CPU、runtime closure、安装/升级/卸载结果和截图/日志路径；没有这组证据时，发布状态仍为待验收。

## 8. 致谢与使用边界

感谢代号 CC 的匿名朋友提供技术讨论与支持。

本项目将论文、官方文档和有许可证的开源仓库作为可复核来源。

第三方、无明确许可证的逆向材料只用于内部问题发现，不会被复制、再分发或伪造为本白皮书的公开技术证据。

任何将来开源发布都必须分别检查 DSH 自身、vendored dependencies、外部引用、论文 PDF 和发布包中二进制依赖的许可证与分发条件。
