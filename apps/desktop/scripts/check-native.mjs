import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const desktopRoot = resolve(import.meta.dirname, '..')
const runtimeRoot = resolve(process.env.DSH_DESKTOP_RUNTIME ?? join(desktopRoot, '.runtime'))
const requireFromRuntime = createRequire(join(runtimeRoot, '.node-modules', '.pnpm', 'node_modules', 'package.json'))
const pty = requireFromRuntime('node-pty')

if (typeof pty.spawn !== 'function') throw new Error('desktop: node-pty did not expose spawn')

const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || 'sh'
const terminal = pty.spawn(shell, [], {
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env,
})
terminal.kill()
console.log(`desktop: node-pty native addon passed (${process.platform}/${process.arch})`)
