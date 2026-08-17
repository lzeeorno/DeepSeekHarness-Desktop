# Agent Note: Context ledger view

Status: implemented

English | [中文](2026-08-16-context-ledger-view.zh.md)

## Problem

Durable non-user context injections are visible only among the mixed Chat flow, so a user cannot quickly inspect what a loaded session recorded as model-facing context or see where the latest loaded compaction separates newer injections from earlier history.

## Decision

`@deepseek-ai/dsh-client-ui-conversation` registers a session-local `context` entry in its own `conversation.view` ring. It owns this view because it already projects durable `ContextMessageNode` values and owns the source/form-specific `ContextInjectionRow` renderer; moving either into a workbench package would violate the client package boundary and duplicate opaque-source interpretation.

`ContextLedgerView` derives its presentation solely from the standard session snapshot. It finds the latest loaded compaction marker, separates loaded context injections before and after that point, displays each existing context disclosure with its durable event sequence, and uses the same scoped `loadOlder` operation as Chat. It writes no store, setting, session event, prompt field, permission, or provider setting.

The ledger is deliberately not a synthetic provider-request debugger. It reports logged context injections in the loaded window and does not assert a complete next request or recreate provider-specific system prompts and tool schemas.

## Alternatives considered

**Add context source parsing to `ui-workbench`.** Rejected because client packages must not import presentation implementation from another plugin, and a second parser over opaque durable source would diverge from the Chat representation.

**Persist a separate current-context store.** Rejected because the session's immutable event snapshot already supplies the auditable facts. A second store would add mutable UI state without improving model behavior or replay.

**Show only post-compaction events.** Rejected because the events before the latest marker remain valuable audit history. The view distinguishes them instead of silently dropping them.

## Consequences

Chat, Trajectory, Context, and Research can now be selected as complementary session projections. The Context tab makes durable injection provenance inspectable while preserving the boundary between a logged ledger and a complete provider request. A future exact request inspector needs a separately specified model-request projection with its own durable evidence and provider-neutral representation.

## Testing

Focused client tests cover no-marker and compaction-separated derivation, existing source/form disclosure rendering, event labels, empty-window copy, loading state, and ordinary history paging. Conversation assembly tests verify that the native view participates in the ordered tab ring and resolves the same session-scoped history operation. The keyless Web replay exercise selects the tab from the real composition.
