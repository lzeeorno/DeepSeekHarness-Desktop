import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { buildDshLaunch, reserveLoopbackPort, stopDsh, waitForHttp } from '../src/runtime.mjs'

const servers: ReturnType<typeof createServer>[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => { resolve() }))))
})

describe('desktop runtime', () => {
  it('reserves a loopback port and releases it', async () => {
    const port = await reserveLoopbackPort()
    expect(port).toBeGreaterThan(0)
    const server = createServer((_request, response) => response.end('ready'))
    servers.push(server)
    await new Promise<void>(resolve => server.listen(port, '127.0.0.1', () => { resolve() }))
    expect(server.address()).toMatchObject({ address: '127.0.0.1', port })
  })

  it('constructs a loopback-only DSH invocation with the logging policy', () => {
    expect(buildDshLaunch({
      rootDir: '/workspace',
      port: 43123,
      nodeBinary: 'node',
      parentEnv: { ELECTRON_RUN_AS_NODE: '1', KEEP: 'yes' },
    })).toMatchObject({
      command: 'node',
      args: ['--expose-internals', '/workspace/apps/cli/lib/bin.js', 'web', '--host', '127.0.0.1', '--port', '43123'],
      cwd: '/workspace',
      env: { RUST_LOG: 'info', KEEP: 'yes' },
    })
    expect(buildDshLaunch({
      rootDir: '/runtime',
      port: 43123,
      electronNode: true,
      parentEnv: {},
    }).env).toMatchObject({ ELECTRON_RUN_AS_NODE: '1' })
  })

  it('waits through connection failures and non-success responses', async () => {
    const responses = [
      new Response(null, { status: 503 }),
      new Response('ready', { status: 200 }),
    ]
    const seen: RequestInit[] = []
    const response = await waitForHttp('http://127.0.0.1:43123', {
      intervalMs: 0,
      fetchImpl: async (_url, init) => {
        seen.push(init ?? {})
        const response = responses.shift()
        if (response === undefined) throw new Error('test response queue exhausted')
        return response
      },
      sleep: async () => {},
    })
    expect(response).toMatchObject({ ok: true, status: 200 })
    expect(seen).toHaveLength(2)
  })

  it('stops a running child process', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { stdio: 'ignore' })
    await once(child, 'spawn')
    await stopDsh(child, 1_000)
    expect(child.exitCode === null && child.signalCode === null).toBe(false)
  })
})
