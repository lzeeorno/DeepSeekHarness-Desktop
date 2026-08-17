/** Browser owner for one durable workbench lens and its UI snapshot. */

import { createSnapshotStore, type SettingsScope, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  DEFAULT_WORKBENCH_MODE, WORKBENCH_MODE_FIELD,
  type WorkbenchMode, type WorkbenchSettings,
} from '../workbench-settings.ts'

/** Immutable UI snapshot for the selected workbench lens. */
export interface WorkbenchModeSnapshot {
  /** Current Build or Research UI lens. */
  mode: WorkbenchMode
  /** Increments after a distinct local or Host-backed mode change. */
  revision: number
}

/**
 * Mirrors the Host setting for the UI and writes explicit user choices back.
 * It deliberately owns no Agent, prompt, tool, provider, or session behavior.
 */
export class WorkbenchModeController {
  /** Stable observable source consumed by all workbench UI entries. */
  readonly store: SnapshotStore<WorkbenchModeSnapshot> = createSnapshotStore({
    mode: DEFAULT_WORKBENCH_MODE,
    revision: 0,
  })

  private unsubscribe: (() => void) | undefined

  /**
   * @param host - Host-backed settings scope for this preference.
   */
  constructor(private readonly host: SettingsScope<WorkbenchSettings>) {
    this.unsubscribe = host.subscribe(() => { this.adopt() })
    this.adopt()
  }

  /**
   * Select a local lens and persist the choice through the Host settings scope.
   * @param mode - Build or Research lens selected by the user.
   */
  setMode(mode: WorkbenchMode): void {
    if (this.store.getSnapshot().mode === mode) return
    this.publish(mode)
    void this.host.set(WORKBENCH_MODE_FIELD, mode)
  }

  /** Release the settings subscription with the owning plugin fiber. */
  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  /** Adopt a validated Host setting without re-writing it. */
  private adopt(): void {
    const mode = this.host.getSnapshot().value?.mode
    if (mode === undefined || mode === this.store.getSnapshot().mode) return
    this.publish(mode)
  }

  /** Publish an immutable lens change to every registered UI entry. */
  private publish(mode: WorkbenchMode): void {
    this.store.update((snapshot) => {
      snapshot.mode = mode
      snapshot.revision += 1
    })
  }
}
