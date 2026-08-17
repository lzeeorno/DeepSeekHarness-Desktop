import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const desktopRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(desktopRoot, '../..')
const runtimeRoot = join(desktopRoot, '.runtime')
const stagedModules = join(runtimeRoot, '.node-modules')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

if (existsSync(runtimeRoot)) rmSync(runtimeRoot, { recursive: true, force: true })
mkdirSync(dirname(runtimeRoot), { recursive: true })

// deploy --prod records a production-only workspace state. Restore the full
// source dependency graph before the next build so repeated packaging stays
// deterministic in a non-interactive shell.
execFileSync(pnpm, ['install', '--frozen-lockfile', '--prod=false', '--config.confirmModulesPurge=false'], {
  cwd: workspaceRoot,
  stdio: 'inherit',
})
execFileSync(pnpm, ['run', 'build'], { cwd: workspaceRoot, stdio: 'inherit' })
execFileSync(pnpm, ['--filter', '@deepseek-ai/dsh', 'deploy', '--prod', '--legacy', runtimeRoot], {
  cwd: workspaceRoot,
  stdio: 'inherit',
})

const binary = join(runtimeRoot, 'lib', 'bin.js')
if (!existsSync(binary)) throw new Error(`desktop: staged runtime is missing ${binary}`)
renameSync(join(runtimeRoot, 'node_modules'), stagedModules)
materializeMissingWorkspacePeers(stagedModules)
materializeExternalLinks(stagedModules)
execFileSync(pnpm, ['install', '--frozen-lockfile', '--prod=false', '--config.confirmModulesPurge=false'], {
  cwd: workspaceRoot,
  stdio: 'inherit',
})
console.log(`desktop: staged DSH runtime at ${runtimeRoot}`)

function materializeMissingWorkspacePeers(root) {
  const peers = new Set()
  collectWorkspacePeers(root, peers)
  const hoistedRoot = join(root, '.pnpm', 'node_modules')
  for (const peer of peers) {
    const destination = join(hoistedRoot, peer)
    if (existsSync(destination)) continue
    const source = [
      join(workspaceRoot, 'node_modules', peer),
      join(workspaceRoot, 'node_modules', '.pnpm', 'node_modules', peer),
    ].find(candidate => existsSync(candidate))
    if (source === undefined) continue
    mkdirSync(dirname(destination), { recursive: true })
    copyExternalTree(source, destination)
  }
}

function collectWorkspacePeers(directory, peers) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const entry = lstatSync(path)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      collectWorkspacePeers(path, peers)
      continue
    }
    if (name !== 'package.json') continue
    const packageJson = JSON.parse(readFileSync(path, 'utf8'))
    for (const [peer, version] of Object.entries(packageJson.peerDependencies ?? {})) {
      if (!packageJson.peerDependenciesMeta?.[peer]?.optional && String(version).startsWith('workspace:')) {
        peers.add(peer)
      }
    }
  }
}

function materializeExternalLinks(root) {
  const links = []
  const visit = directory => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      const entry = lstatSync(path)
      if (entry.isDirectory()) visit(path)
      else if (entry.isSymbolicLink()) {
        const target = realpathSync(path)
        const fromRoot = relative(root, target)
        if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
          links.push({ path, target })
        }
      }
    }
  }
  visit(root)
  for (const { path, target } of links) {
    unlinkSync(path)
    copyExternalTree(target, path)
  }
}

function copyExternalTree(source, destination) {
  cpSync(source, destination, {
    recursive: statSync(source).isDirectory(),
    dereference: true,
    // Dependencies already live in the deployed closure. Copying a source
    // package's nested node_modules would otherwise revive workspace links.
    filter: path => !relative(source, path).split(sep).includes('node_modules'),
  })
}
