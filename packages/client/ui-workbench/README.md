# @deepseek-ai/dsh-client-ui-workbench

English | [中文](README.zh.md)

This plugin provides a durable Build/Research lens for the DSH browser and Electron workbench. It owns the `ui-workbench.mode` setting, whose built-in values are `build` and `research` and whose default is `build`. The lens is a local presentation preference: it does not select a model, modify a prompt, grant a tool permission, change an agent preset, or add a session event.

On a loopback Web Client, the Host settings provider persists the selected lens in `$DSH_HOME/settings.yaml`; settings updates and reconnects restore the stored value. A browser without access to the privileged loopback settings API can still change its in-process view, but that choice is not durable. The API proxy exposes this namespace deliberately because it contains no credentials or model-affecting state.

The client half registers four existing slots:

- `settings.general.item` adds the durable preference to General settings.
- `conversation.hero.workbench` adds a Build/Research selector before an empty session's first prompt.
- `conversation.session.header.actions` shows the current lens and supplies a compact switch in active session chrome. Switching to Research opens its `research` evidence view; switching to Build returns to Chat.
- `conversation.view` contributes that session-local Research evidence view. It reads the loaded event ledger for tool outcomes, successful mutation paths, provider/model provenance, and compaction markers, and can request the session's existing earlier-history pages. `trajectory` remains the adjacent detailed event ledger.

The assembled session ring also includes the native `context` ledger from `ui-conversation`. It stays in the conversation domain because that package owns durable context-node projection and its source/form rendering; this lens neither duplicates nor reinterprets those model-facing events.

An actual research-agent preset, evidence store, or model-routing policy must be a separate plugin/provider decision. Reusing this preference as evidence that a session has research semantics would make UI state appear in model behavior without a durable event.

## Model Experience

None, as this browser-side UI preference never enters a model request, prompt, permission, or session event.

#### KV Cache effect

None. A lens change is not model-visible context.

## Known Limitations and Deferred Work

- **Research reuses the existing event ledger, not a new research system.** The evidence view can extend its loaded event window through normal session paging, but it does not add a notebook, citation manager, experiment runner, IDE editor, evidence store, or a different tool policy.
- **A loopback setting is a user preference, not a session property.** Session replay does not recreate the selected lens, and switching it does not change the historical meaning of a turn.
