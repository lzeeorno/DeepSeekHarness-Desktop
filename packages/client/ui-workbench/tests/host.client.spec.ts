import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_WORKBENCH_MODE, WORKBENCH_SETTINGS_NAMESPACE, apply,
} from '../src/index.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_namespace: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-workbench host', () => {
  it('registers and validates the durable local workbench preference', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const namespace = settingsNamespace(WORKBENCH_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(namespace)).toEqual({ mode: DEFAULT_WORKBENCH_MODE })
    await ctx.settings.update(namespace, { mode: 'research' })
    expect(ctx.settings.get(namespace)).toEqual({ mode: 'research' })
    await expect(ctx.settings.update(namespace, { mode: 'presentation' })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(namespace)
  })
})
