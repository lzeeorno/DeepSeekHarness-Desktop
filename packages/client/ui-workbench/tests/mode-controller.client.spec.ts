import { describe, expect, it } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { WORKBENCH_MODE_FIELD, type WorkbenchSettings } from '../src/workbench-settings.ts'
import { WorkbenchModeController } from '../src/client/mode-controller.ts'

describe('WorkbenchModeController', () => {
  it('adopts Host updates, persists distinct local choices, and releases its subscription', () => {
    const host = stubSettingsScope<WorkbenchSettings>()
    const controller = new WorkbenchModeController(host.scope)
    expect(controller.store.getSnapshot()).toEqual({ mode: 'build', revision: 0 })
    expect(host.listenerCount()).toBe(1)

    host.publish({ value: { mode: 'research' }, revision: 1 })
    expect(controller.store.getSnapshot()).toEqual({ mode: 'research', revision: 1 })

    controller.setMode('build')
    expect(controller.store.getSnapshot()).toEqual({ mode: 'build', revision: 2 })
    expect(host.set).toHaveBeenCalledWith(WORKBENCH_MODE_FIELD, 'build')
    controller.setMode('build')
    expect(host.set).toHaveBeenCalledOnce()

    controller.dispose()
    expect(host.listenerCount()).toBe(0)
    host.publish({ value: { mode: 'research' }, revision: 2 })
    expect(controller.store.getSnapshot()).toEqual({ mode: 'build', revision: 2 })
  })
})
