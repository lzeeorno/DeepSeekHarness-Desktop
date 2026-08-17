/** Durable workbench-lens settings shared by the Host schema and browser UI. */

import z from '@deepseek-ai/schemastery'

/** Built-in workbench lenses. They organize UI only and never alter an Agent request. */
export const WORKBENCH_MODES = ['build', 'research'] as const

/** Settings namespace owned by the workbench UI plugin. */
export const WORKBENCH_SETTINGS_NAMESPACE = 'ui-workbench'

/** Field storing the selected workbench lens. */
export const WORKBENCH_MODE_FIELD = 'mode'

/** One built-in workbench lens. */
export type WorkbenchMode = typeof WORKBENCH_MODES[number]

/** Default workbench lens for a fresh DSH home. */
export const DEFAULT_WORKBENCH_MODE: WorkbenchMode = 'build'

/** Persisted user preference for the local UI lens. */
export interface WorkbenchSettings {
  /** Selected Build or Research interface lens. */
  mode: WorkbenchMode
}

/** Schema registered with the Host settings service. */
export const WorkbenchSettingsSchema: z<WorkbenchSettings> = z.object({
  [WORKBENCH_MODE_FIELD]: z.union([...WORKBENCH_MODES]).default(DEFAULT_WORKBENCH_MODE),
})
