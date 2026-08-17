// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, WORKBENCH_LOCALE_NAMESPACE } from '../src/client/index.ts'
import {
  WorkbenchModeBadge, WorkbenchModeHero, WorkbenchModeRow,
} from '../src/client/WorkbenchModeControls.tsx'
import { ResearchEvidenceView } from '../src/client/ResearchEvidenceView.tsx'

const ITEMS = 'settings.general.item'
const HERO = 'conversation.hero.workbench'
const HEADER = 'conversation.session.header.actions'
const VIEW = 'conversation.view'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  ctx.provide('connection', {} as never)
  ctx.provide('remote', {} as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  let nodes: readonly unknown[] = []
  const loadOlder = vi.fn(async () => { nodes = [{ kind: 'assistant' }] })
  ctx.provide('sessions', {
    binding: () => ({ session: { getSnapshot: () => ({ nodes }), loadOlder } }),
  } as never)
  return { ctx, loadOlder, locale, slots: ctx.get('slots') as SlotRegistry }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      [ITEMS]: { kind: 'list', scope: 'root' },
      [HERO]: { kind: 'single', scope: 'root' },
      [HEADER]: { kind: 'list', scope: 'session' },
      [VIEW]: { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
}

describe('ui-workbench apply', () => {
  it('declares its existing service edges', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'settingsScope', 'sessions'])
  })

  it('registers localized settings, hero, active-session, and research-view controls', async () => {
    const b = await bench()
    const release = declare(b.slots)
    const fiber = b.ctx.plugin({ inject, apply })
    await fiber.await()
    expect(b.locale.bind(WORKBENCH_LOCALE_NAMESPACE)('title')).toBe('Workbench focus')
    expect(b.slots.entries(ITEMS).find(entry => entry.component === WorkbenchModeRow)?.options)
      .toMatchObject({ id: 'workbench', order: 20 })
    expect(b.slots.entries(HERO).some(entry => entry.component === WorkbenchModeHero)).toBe(true)
    expect(b.slots.entries(HEADER).find(entry => entry.component === WorkbenchModeBadge)?.options)
      .toMatchObject({ id: 'workbench', order: -5 })
    const researchEntry = b.slots.entries(VIEW).find(entry => entry.component === ResearchEvidenceView)
    expect(researchEntry?.options)
      .toMatchObject({ id: 'research', order: 20 })
    const injected = researchEntry?.inject?.('session' as never) as {
      loadOlder(): Promise<boolean>
    } | undefined
    expect(injected).toBeDefined()
    expect(await injected?.loadOlder()).toBe(true)
    expect(b.loadOlder).toHaveBeenCalledOnce()
    await fiber.dispose()
    release()
  })

  it('waits for a late declaration and removes registrations with its fiber', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject, apply })
    await fiber.await()
    expect(b.slots.entries(ITEMS)).toHaveLength(0)
    const release = declare(b.slots)
    await Promise.resolve()
    expect(b.slots.entries(ITEMS).some(entry => entry.component === WorkbenchModeRow)).toBe(true)
    await fiber.dispose()
    expect(b.slots.entries(ITEMS)).toHaveLength(0)
    release()
  })
})
