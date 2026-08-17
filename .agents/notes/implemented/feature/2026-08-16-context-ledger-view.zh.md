# Agent Note: Context ledger view

Status: implemented

[English](2026-08-16-context-ledger-view.md) | 中文

## Problem

持久化的非用户 context injection 只能混在 Chat flow 中查看，用户无法迅速审阅一个已加载 session 记录为模型可见 context 的内容，也无法看出最近一次已加载 compaction 如何把较新的 injection 与较早 history 分开。

## Decision

`@deepseek-ai/dsh-client-ui-conversation` 在自己拥有的 `conversation.view` ring 中注册 session-local 的 `context` entry。该包应拥有这个 view，因为它已经投影 durable `ContextMessageNode`，并拥有按 source/form 展开的 `ContextInjectionRow` renderer；将任何一部分搬进 workbench package 会违反 client package boundary，并会重复解释不透明 source。

`ContextLedgerView` 只从标准 session snapshot 派生呈现。它找到最新已加载 compaction marker，将已加载 context injection 分为该点之前与之后，为每个既有 context disclosure 显示 durable event sequence，并使用与 Chat 相同的 scoped `loadOlder` 操作。它不会写入 store、setting、session event、prompt field、permission 或 provider setting。

该 ledger 刻意不是合成的 provider-request debugger。它报告已加载 window 中记录下来的 context injection，而不宣称得到完整的下一次 request，也不会重建 provider-specific system prompt 和 tool schema。

## Alternatives considered

**在 `ui-workbench` 中加入 context source parsing。** 未采用，因为 client package 不得从另一个 plugin 导入 presentation implementation，而对 opaque durable source 再写一个 parser 会与 Chat representation 漂移。

**持久化单独的 current-context store。** 未采用，因为 session 的 immutable event snapshot 已经提供可审阅事实。第二个 store 只会增加 mutable UI state，既不改善 model behavior，也不改善 replay。

**只显示 compaction 之后的 events。** 未采用，因为最新 marker 前的 events 仍是有价值的 audit history。该 view 会区分它们，而非静默丢弃。

## Consequences

Chat、Trajectory、Context 与 Research 现在可作为互补的 session projection 选择。Context tab 使 durable injection provenance 可审阅，同时保持 logged ledger 与完整 provider request 之间的界限。未来的精确 request inspector 需要一个单独定义的 model-request projection，拥有自己的 durable evidence 和 provider-neutral representation。

## Testing

聚焦 client tests 覆盖无 marker 和按 compaction 分隔的派生、既有 source/form disclosure 呈现、event label、空 window copy、loading state 与普通 history paging。conversation assembly tests 验证原生 view 加入有序 tab ring，并解析相同的 session-scoped history 操作。keyless Web replay exercise 会从真实 composition 中选择该 tab。
