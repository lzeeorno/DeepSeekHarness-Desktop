// Web e2e scenario: the Build/Research lens is a Host-backed local UI
// preference. It is selectable before a prompt, visible in General settings,
// and restored after a browser reload without writing a session event. A
// keyless replayed turn then proves its active-session button selects the
// existing Chat, Research evidence, Context ledger, and Trajectory views
// without changing agent behavior.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  acknowledgeReloadConnectionLoss, assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { connectFreshWorkspaceZh, ZH_BROWSER_LOCALE, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/workbench-mode', import.meta.url))
const HERO_EXPECTED = join(SNAPSHOT_DIR, 'research-hero.expected.md')
const ROUND_TRIP_FIXTURE = fileURLToPath(new URL('./snapshots/fresh-round-trip/session.jsonl', import.meta.url))
const ROUND_TRIP_PROMPT = 'Use the bash tool to run exactly: echo WEB_E2E_OK. Then reply with the single word DONE and stop.'
const MODE = webSnapshotMode()

describe('web e2e: durable Build/Research workbench lens', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      ...(MODE === 'record' ? {} : { replayFixture: ROUND_TRIP_FIXTURE, paceMs: 15 }),
    })
    expect(scaffold.ctx.settings.describe().map(row => row.ns)).toContain(settingsNamespace('ui-workbench'))
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('persists the hero selection, exposes it in General settings, and restores it after reload', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-workbench-mode'))
    const hero = page.getByRole('group', { name: '工作台焦点' })
    const research = hero.getByRole('button', { name: '切换到科研工作台' })
    await research.waitFor({ timeout: 15_000 })
    expect(await research.getAttribute('aria-pressed')).toBe('false')
    const persisted = page.waitForResponse(response => response.url().endsWith('/api/settings.mutate'), {
      timeout: 10_000,
    })
    await research.click()
    const response = await persisted
    expect(response.status()).toBe(200)
    const responseBody = await response.json() as { result: { ok: boolean; error?: { message: string } } }
    if (!responseBody.result.ok) throw new Error(responseBody.result.error?.message ?? 'workbench settings write failed')
    await expect.poll(() => research.getAttribute('aria-pressed'), { timeout: 5_000 }).toBe('true')
    await expect.poll(
      async () => readFile(join(scaffold.harnessHome, 'settings.yaml'), 'utf8'),
      { timeout: 10_000 },
    ).toMatch(/ui-workbench:\n\s+mode: research/)
    const snapshot = await captureStableAria(page, '[role="group"][aria-label="工作台焦点"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(HERO_EXPECTED, snapshot, MODE)

    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.getByText('工作台焦点', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await dialog.getByRole('button', { name: '切换到科研工作台' }).getAttribute('aria-pressed')).toBe('true')
    await page.keyboard.press('Escape')

    const warningStart = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
    await expect.poll(() => hero.getByRole('button', { name: '切换到科研工作台' }).getAttribute('aria-pressed'), {
      timeout: 15_000,
    }).toBe('true')
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)

  it.skipIf(MODE === 'record')('uses the active-session switch to move between Research evidence and Chat', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-workbench-active-session'))
    const settled = scaffold.whenTurnSettled()
    const input = page.locator('textarea').first()
    await input.fill(ROUND_TRIP_PROMPT)
    await input.press('Enter')
    await settled

    const research = page.getByRole('button', {
      name: '当前为科研工作台，点击切换到代码工作台并打开对话',
    })
    await research.waitFor({ timeout: 15_000 })
    await research.click()
    await expect.poll(() => page.getByRole('tab', { name: '对话', exact: true }).getAttribute('aria-selected'), {
      timeout: 10_000,
    }).toBe('true')

    const build = page.getByRole('button', {
      name: '当前为代码工作台，点击切换到科研工作台并打开证据账本',
    })
    await build.click()
    await expect.poll(() => page.getByRole('tab', { name: '科研证据', exact: true }).getAttribute('aria-selected'), {
      timeout: 10_000,
    }).toBe('true')
    await page.getByText('证据与产物', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByRole('tab', { name: '上下文', exact: true }).click()
    await expect.poll(() => page.getByRole('tab', { name: '上下文', exact: true }).getAttribute('aria-selected'), {
      timeout: 10_000,
    }).toBe('true')
    await page.getByText('上下文账本', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByRole('tab', { name: '轨迹', exact: true }).click()
    await expect.poll(() => page.getByRole('tab', { name: '轨迹', exact: true }).getAttribute('aria-selected'), {
      timeout: 10_000,
    }).toBe('true')
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)

  it.skipIf(MODE === 'record')('keeps the fixture inventory closed', async () => {
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['research-hero.expected.md'])
  })
})
