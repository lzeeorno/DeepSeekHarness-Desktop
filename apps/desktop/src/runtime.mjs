import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'

const WEB_PRODUCT_NAME = 'DeepSeek Harness'
const DESKTOP_PRODUCT_NAME = 'DSH Desktop'
const WEB_PRODUCT_SUFFIX = ` \u2014 ${WEB_PRODUCT_NAME}`

/**
 * Translate the Web Client document title for the native desktop window.
 * @param pageTitle - title emitted by the loaded Web Client document.
 * @returns the desktop-branded window title.
 */
export function desktopWindowTitle(pageTitle) {
  if (pageTitle === WEB_PRODUCT_NAME) return DESKTOP_PRODUCT_NAME
  if (!pageTitle.endsWith(WEB_PRODUCT_SUFFIX)) return DESKTOP_PRODUCT_NAME
  return `${pageTitle.slice(0, -WEB_PRODUCT_SUFFIX.length)} \u2014 ${DESKTOP_PRODUCT_NAME}`
}

/**
 * Reserve a loopback port for the child Web host.
 * @returns a currently unused TCP port on `127.0.0.1`.
 */
export async function reserveLoopbackPort() {
  const server = createServer()
  server.unref()
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen({ host: '127.0.0.1', port: 0 }, resolvePromise)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    server.close()
    throw new Error('desktop: the operating system did not return a loopback port')
  }
  const port = address.port
  await new Promise((resolvePromise, reject) => {
    server.close(error => error === undefined || error === null ? resolvePromise() : reject(error))
  })
  return port
}

/**
 * Build the child-process invocation used by the native shell.
 * @param options - the workspace and DSH binary locations.
 * @returns a process command, arguments, working directory, and environment.
 */
export function buildDshLaunch({
  rootDir,
  port,
  dshBinary = resolve(rootDir, 'apps/cli/lib/bin.js'),
  workingDirectory = rootDir,
  nodeBinary = process.execPath,
  electronNode = false,
  parentEnv = process.env,
}) {
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...cleanParentEnv } = parentEnv
  return {
    command: nodeBinary,
    args: ['--expose-internals', dshBinary, 'web', '--host', '127.0.0.1', '--port', String(port)],
    cwd: workingDirectory,
    env: {
      ...cleanParentEnv,
      RUST_LOG: 'info',
      ...(electronNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    },
  }
}

/**
 * Start the built DSH CLI without a shell and retain only a bounded diagnostic
 * tail in memory for a startup error.
 * @param launch - the invocation returned by {@link buildDshLaunch}.
 * @returns the child process and a diagnostic accessor.
 */
export function startDsh(launch) {
  const child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let diagnostic = ''
  const retain = chunk => {
    diagnostic = `${diagnostic}${String(chunk)}`.slice(-4096)
  }
  child.stdout?.on('data', retain)
  child.stderr?.on('data', retain)
  return { child, diagnostic: () => diagnostic }
}

/**
 * Poll an HTTP endpoint until the DSH Web host accepts requests.
 * @param url - loopback URL to probe.
 * @param options - timeout, interval, and injectable test functions.
 * @returns the first successful response.
 */
export async function waitForHttp(url, {
  timeoutMs = 20_000,
  intervalMs = 100,
  fetchImpl = globalThis.fetch,
  sleep = delay,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('desktop: fetch is unavailable')
  const deadline = Date.now() + timeoutMs
  let lastFailure = 'no response'
  while (Date.now() <= deadline) {
    try {
      const response = await fetchImpl(url, { redirect: 'manual' })
      if (response.ok) return response
      lastFailure = `HTTP ${response.status}`
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error)
    }
    await sleep(intervalMs)
  }
  throw new Error(`desktop: DSH Web host did not become ready at ${url}: ${lastFailure}`)
}

/**
 * Ask the child to stop and give it a short grace period.
 * @param child - DSH child process.
 * @param timeoutMs - grace period before a final kill request.
 * @returns when the child exits or the grace period expires.
 */
export async function stopDsh(child, timeoutMs = 3_000) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    delay(timeoutMs).then(() => false),
  ])
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await once(child, 'exit')
  }
}

/** @param milliseconds - delay duration. */
function delay(milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
}
