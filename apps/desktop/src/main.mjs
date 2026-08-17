import { app, BrowserWindow } from 'electron/main'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import {
  buildDshLaunch,
  desktopWindowTitle,
  reserveLoopbackPort,
  startDsh,
  stopDsh,
  waitForHttp,
} from './runtime.mjs'

if (process.argv.includes('--disable-gpu')) app.disableHardwareAcceleration()

const workspaceRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const startupHtml = `<!doctype html><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#101417;color:#dfe7e9;font:14px system-ui,sans-serif}main{height:100%;display:grid;place-items:center}p{margin:0;color:#91a1a6}</style><main><p>Starting DSH Desktop...</p></main>`
let mainWindow
let dshRuntime

function runtimeRoot() {
  return app.isPackaged ? join(process.resourcesPath, 'dsh-runtime') : workspaceRoot
}

function dshBinary(root) {
  return app.isPackaged ? join(root, 'lib', 'bin.js') : join(root, 'apps', 'cli', 'lib', 'bin.js')
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#101417',
    title: 'DSH Desktop',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.on('page-title-updated', (event, title) => {
    event.preventDefault()
    window.setTitle(desktopWindowTitle(title))
  })
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
    if (dshRuntime !== undefined) {
      const closingRuntime = dshRuntime
      dshRuntime = undefined
      void stopDsh(closingRuntime.child)
    }
  })
  return window
}

async function showStartupError(error) {
  const detail = error instanceof Error ? error.message : String(error)
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#101417;color:#dfe7e9;font:14px system-ui,sans-serif}main{max-width:760px;margin:12vh auto;padding:32px}h1{font-size:20px;font-weight:600}pre{white-space:pre-wrap;color:#f0a7a7;background:#1b2226;padding:16px;border-radius:6px}</style><main><h1>DSH Desktop could not start</h1><pre>${escapeHtml(detail)}</pre></main>`
  await mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  mainWindow?.show()
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function startDesktop() {
  if (mainWindow !== undefined) return
  mainWindow = createWindow()
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startupHtml)}`)
  try {
    const root = runtimeRoot()
    const port = await reserveLoopbackPort()
    const launch = buildDshLaunch({
      rootDir: root,
      dshBinary: dshBinary(root),
      workingDirectory: app.isPackaged ? app.getPath('userData') : workspaceRoot,
      port,
      // Electron's Node mode cannot resolve the source worktree's isolated
      // pnpm dependencies. A packaged runtime has its own deployed closure.
      nodeBinary: app.isPackaged ? process.execPath : 'node',
      electronNode: app.isPackaged,
    })
    dshRuntime = startDsh(launch)
    await waitForHttp(`http://127.0.0.1:${port}/`)
    await mainWindow.loadURL(`http://127.0.0.1:${port}/`)
  } catch (error) {
    const diagnostic = dshRuntime?.diagnostic()
    const failedRuntime = dshRuntime
    dshRuntime = undefined
    if (failedRuntime !== undefined) await stopDsh(failedRuntime.child)
    if (diagnostic !== undefined && diagnostic !== '') {
      error = new Error(`${error instanceof Error ? error.message : String(error)}\n\n${diagnostic}`)
    }
    await showStartupError(error)
  }
}

app.whenReady().then(startDesktop)

app.on('before-quit', () => {
  if (dshRuntime !== undefined) void stopDsh(dshRuntime.child)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  void startDesktop()
})
