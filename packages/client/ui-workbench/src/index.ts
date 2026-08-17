/** Host registration for the durable local workbench-lens preference. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { WORKBENCH_SETTINGS_NAMESPACE, WorkbenchSettingsSchema } from './workbench-settings.ts'

export {
  DEFAULT_WORKBENCH_MODE, WORKBENCH_MODE_FIELD, WORKBENCH_MODES, WORKBENCH_SETTINGS_NAMESPACE,
  WorkbenchSettingsSchema,
  type WorkbenchMode, type WorkbenchSettings,
} from './workbench-settings.ts'

const WORKBENCH_NAMESPACE = settingsNamespace(WORKBENCH_SETTINGS_NAMESPACE)

/**
 * Register the workbench lens setting when a Host settings provider is present.
 * @param ctx - Host context that may acquire the optional settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(WORKBENCH_NAMESPACE, WorkbenchSettingsSchema)
  })
}
