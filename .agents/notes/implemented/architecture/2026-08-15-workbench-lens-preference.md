# Agent Note: Build and Research workbench lens preference

Status: implemented

English | [中文](2026-08-15-workbench-lens-preference.zh.md)

## Problem

The desktop workbench needs an immediately understandable choice between code-oriented and research-oriented work without implying that a visual selection has changed an Agent's tools, model, permissions, prompt, or recorded history.

## Decision

`@deepseek-ai/dsh-client-ui-workbench` owns the `ui-workbench.mode` Host settings namespace and contributes the same Build/Research choice to General settings, the empty-session hero, and active session chrome. The selection is a durable loopback-user preference and defaults to `build`.

The browser controller mirrors the normal `SettingsScope` value and writes explicit selections through that scope. `dsh-host-apiproxy` exposes `ui-workbench` as a Web preference namespace so the loopback client can read and mutate it. The namespace has no secret field.

The active-session header action also selects an existing browser view: Research selects `research`, a workbench-owned read-only projection of loaded durable events. It lists tool outcomes, successful mutation paths, provider/model provenance, and compaction markers, and can ask the session for its existing earlier-history pages; `trajectory` remains the neighboring detailed event ledger. Build selects `chat`. Browser view selection is already stored by the conversation UI and remains presentation-only.

The setting deliberately has no consumer in prompt assembly, model routing, tool policy, agent preset selection, permission evaluation, or session-event projection. A session replay therefore does not depend on its current value.

## Alternatives considered

**Persist the lens in `dsh-session` events.** Rejected because the selection is a user interface preference rather than a fact that changes a turn's semantics. Logging it would make replay imply model behavior that does not exist.

**Keep each selector as component-local state.** Rejected because settings, the empty-session entry point, and active session chrome would disagree after a refresh or reconnect.

**Switch an Agent preset when the user selects Research.** Rejected because preset composition changes the available runtime capabilities and can only be changed for an eligible blank session. That policy needs an explicit, separately auditable provider decision.

## Consequences

Users can choose and retain a clear workbench focus across the local Web Client and Electron shell without creating a second session store or duplicating renderer state. The narrow setting plus existing UI slots keeps all three controls synchronized, while the active-session control makes the distinction immediately useful through Chat versus the evidence projection and detailed event ledger.

The API proxy now has one more intentional Web settings allowlist entry. Future research workflows, evidence panels, model policies, or tool policies must state their own behavior and persistence; they cannot infer it from this preference.

## Testing

Focused client tests cover Host adoption, optimistic selection, rejected writes, all three control surfaces, Build/Research view selection, evidence derivation from tool/model/compaction events, and the existing session-history paging injection. The conversation skeleton test verifies that a header action writes the current session's view store. The API-proxy configuration test verifies that the namespace is exposed and mutable. `apps/web/tests/workbench-mode.e2e.ts` exercises the real Web composition, persisted setting, reload, Research evidence, and the adjacent trajectory ledger without a model key.
