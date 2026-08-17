import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { join, resolve } from 'node:path'

const desktopRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(desktopRoot, '../..')
const unpackedRoot = resolve(process.env.DSH_DESKTOP_UNPACKED ?? defaultUnpackedRoot())
const binary = resolve(process.env.DSH_DESKTOP_BINARY ?? defaultBinary(unpackedRoot))
const cdpPort = Number.parseInt(process.env.DSH_DESKTOP_CDP_PORT ?? '9229', 10)

if (!existsSync(binary)) throw new Error(`desktop smoke: packaged executable is missing: ${binary}`)
if (!Number.isInteger(cdpPort) || cdpPort < 1 || cdpPort > 65_535) {
  throw new Error(`desktop smoke: invalid DSH_DESKTOP_CDP_PORT: ${cdpPort}`)
}

const requireFromWeb = createRequire(join(workspaceRoot, 'apps/web/package.json'))
const { chromium } = requireFromWeb('playwright')
const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...environment } = process.env
for (const name of ['ALL_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY', 'all_proxy', 'http_proxy', 'https_proxy']) {
  delete process.env[name]
  delete environment[name]
}
const child = spawn(binary, [
  `--remote-debugging-port=${cdpPort}`,
  '--disable-gpu',
  ...(process.platform === 'linux' ? ['--disable-dev-shm-usage', '--no-sandbox'] : []),
], {
  cwd: workspaceRoot,
  // AppImage may detach the real Electron process from its launcher. A POSIX
  // process group keeps that process reachable during smoke-test cleanup.
  detached: process.platform !== 'win32',
  env: environment,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})
let diagnostic = ''
const retain = chunk => { diagnostic = `${diagnostic}${String(chunk)}`.slice(-4096) }
child.stdout?.on('data', retain)
child.stderr?.on('data', retain)
let browser

try {
  await waitForCdp(`http://127.0.0.1:${cdpPort}/json/version`)
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)
  const page = browser.contexts().flatMap(context => context.pages())[0]
  if (page === undefined) throw new Error('no Electron page was exposed over CDP')
  await page.waitForURL(/^http:\/\/127\.0\.0\.1:/, { timeout: 30_000 })
  await page.waitForLoadState('domcontentloaded')
  if (await page.title() !== 'DeepSeek Harness') throw new Error(`unexpected page title: ${await page.title()}`)
  for (const labels of [['New Session', '新会话'], ['Workspaces', '工作区'], ['Settings', '设置']]) {
    await localizedText(page, labels).waitFor({ state: 'visible', timeout: 15_000 })
  }
  await dismissOnboardingAction(page, ['Continue', '继续'])
  await dismissOnboardingAction(page, ['Configure later', '稍后配置'])
  await page.getByRole('group', { name: localizedPattern(['Workbench focus', '工作台焦点']) }).first().waitFor({ state: 'visible', timeout: 15_000 })
  const settingsButton = localizedButton(page, ['Settings', '设置'])
  await settingsButton.click()
  const settings = page.getByRole('dialog').last()
  await settings.waitFor({ state: 'visible', timeout: 15_000 })
  const modelsButton = localizedButton(settings, ['Models', '模型'])
  await modelsButton.focus()
  await page.keyboard.press('Enter')
  await localizedText(settings, ['DeepSeek']).waitFor({ state: 'visible', timeout: 15_000 })
  const apiKey = localizedText(settings, ['API key', 'API 密钥'])
  if (!await apiKey.isVisible()) {
    await settings.getByRole('button', { name: /^(?:Edit|编辑).*DeepSeek/ }).click()
  }
  await apiKey.waitFor({ state: 'visible', timeout: 15_000 })
  console.log(`desktop smoke: packaged UI passed (${page.url()})`)
} finally {
  try {
    await browser?.close()
  } finally {
    await stopChild(child)
  }
  if (diagnostic !== '') console.log(`desktop smoke: runtime tail\n${diagnostic}`)
}

function defaultUnpackedRoot() {
  if (process.platform !== 'darwin') return join(workspaceRoot, 'dist/desktop/linux-unpacked')
  const candidates = ['mac', 'mac-arm64', 'mac-x64']
  for (const candidate of candidates) {
    const root = join(workspaceRoot, 'dist/desktop', candidate)
    if (existsSync(join(root, 'DSH Desktop.app'))) return root
  }
  return join(workspaceRoot, 'dist/desktop/mac')
}

function defaultBinary(root) {
  if (process.platform === 'darwin') return join(root, 'DSH Desktop.app/Contents/MacOS/DSH Desktop')
  return join(root, 'dsh-desktop')
}

async function dismissOnboardingAction(page, labels) {
  const action = localizedButton(page, labels)
  try {
    await action.waitFor({ state: 'visible', timeout: 5_000 })
  } catch (error) {
    if (error?.name === 'TimeoutError') return
    throw error
  }
  await action.click()
  await action.waitFor({ state: 'detached', timeout: 15_000 })
}

function localizedText(scope, labels) {
  return scope.getByText(localizedPattern(labels)).first()
}

function localizedButton(scope, labels) {
  return scope.getByRole('button', { name: localizedPattern(labels) }).first()
}

function localizedPattern(labels) {
  return new RegExp(`^(?:${labels.map(label => escapeRegExp(label)).join('|')})$`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function waitForCdp(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastFailure = 'no response'
  while (Date.now() <= deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`packaged Electron exited before CDP became ready: ${lastFailure}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastFailure = `HTTP ${response.status}`
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100))
  }
  throw new Error(`packaged Electron CDP did not become ready: ${lastFailure}`)
}

async function stopChild(processHandle) {
  if (process.platform !== 'win32') {
    const groupId = processHandle.pid
    if (groupId === undefined || !signalProcessGroup(groupId, 'SIGTERM')) return
    await new Promise(resolvePromise => setTimeout(resolvePromise, 3_000))
    signalProcessGroup(groupId, 'SIGKILL')
    return
  }
  if (processHandle.exitCode !== null || processHandle.signalCode !== null) return
  processHandle.kill('SIGTERM')
  const exited = await Promise.race([
    once(processHandle, 'exit').then(() => true),
    new Promise(resolvePromise => setTimeout(() => resolvePromise(false), 3_000)),
  ])
  if (!exited && processHandle.exitCode === null && processHandle.signalCode === null) {
    processHandle.kill('SIGKILL')
    await once(processHandle, 'exit')
  }
}

function signalProcessGroup(groupId, signal) {
  try {
    process.kill(-groupId, signal)
    return true
  } catch (error) {
    if (error?.code === 'ESRCH') return false
    throw error
  }
}
