import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const desktopRoot = resolve(import.meta.dirname, '..')
const electronBinary = createRequire(import.meta.url)('electron')
const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...environment } = process.env
const child = spawn(electronBinary, ['.', ...process.argv.slice(2)], {
  cwd: desktopRoot,
  env: environment,
  stdio: 'inherit',
  windowsHide: false,
})

child.once('error', error => {
  console.error(`desktop: Electron failed to start: ${error.message}`)
  process.exitCode = 1
})
child.once('exit', code => {
  process.exitCode = code ?? 1
})
