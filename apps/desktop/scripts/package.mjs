import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { build, Platform } from 'electron-builder'

const desktopRoot = resolve(import.meta.dirname, '..')
const runtimeRoot = join(desktopRoot, '.runtime')
const stagedModules = join(runtimeRoot, '.node-modules')
const outputDirectory = resolve(desktopRoot, '../../dist/desktop')
const args = new Set(process.argv.slice(2))

if (!existsSync(join(runtimeRoot, 'lib', 'bin.js')) || !existsSync(stagedModules)) {
  throw new Error('desktop: run stage-runtime before packaging')
}

const targets = new Map()
if (args.has('--dir')) addTargets(Platform.current(), 'dir')
if (args.has('--linux')) {
  assertNativeHost('linux')
  addTargets(Platform.LINUX, ['appimage', 'deb'])
}
if (args.has('--mac')) {
  assertNativeHost('darwin')
  addTargets(Platform.MAC, ['dmg', 'zip'])
}
if (args.has('--win')) {
  assertNativeHost('win32')
  addTargets(Platform.WINDOWS, ['nsis', 'zip'])
}
if (targets.size === 0) throw new Error('desktop: choose --dir, --linux, --mac, or --win')

const temporaryProject = mkdtempSync(join(tmpdir(), 'dsh-desktop-app-'))
try {
  mkdirSync(dirname(join(temporaryProject, 'src')), { recursive: true })
  cpSync(join(desktopRoot, 'src'), join(temporaryProject, 'src'), { recursive: true })
  writeFileSync(join(temporaryProject, 'package.json'), `${JSON.stringify({
    name: 'dsh-desktop',
    productName: 'DSH Desktop',
    version: '0.1.0-rc.5',
    description: 'Community desktop workbench built on DeepSeek Harness',
    desktopName: 'dsh-desktop',
    homepage: 'https://github.com/lzeeorno/DeepSeekHarness-Desktop',
    author: { name: 'lzeeorno', email: '43123195+lzeeorno@users.noreply.github.com' },
    private: true,
    type: 'module',
    main: 'src/main.mjs',
    license: 'MIT',
  }, null, 2)}\n`)

  await build({
    projectDir: temporaryProject,
    targets,
    publish: null,
    config: {
      appId: 'io.github.lzeeorno.deepseekharness.desktop',
      productName: 'DSH Desktop',
      artifactName: 'dsh-${version}-${os}-${arch}.${ext}',
      electronVersion: '43.4.0',
      asar: true,
      npmRebuild: false,
      nodeGypRebuild: false,
      buildDependenciesFromSource: false,
      directories: { output: outputDirectory },
      files: ['src/**/*', 'package.json'],
      extraResources: [
        {
          from: runtimeRoot,
          to: 'dsh-runtime',
          filter: ['package.json', 'README*', 'config/**/*', 'lib/**/*'],
        },
        { from: stagedModules, to: 'dsh-runtime/node_modules' },
      ],
      linux: {
        category: 'Development',
        maintainer: 'lzeeorno <43123195+lzeeorno@users.noreply.github.com>',
        target: ['appimage', 'deb'],
        syncDesktopName: true,
      },
      mac: { category: 'public.app-category.developer-tools', target: ['dmg', 'zip'] },
      win: { target: ['nsis', 'zip'] },
      nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
    },
  })
} finally {
  rmSync(temporaryProject, { recursive: true, force: true })
}

function addTargets(platform, types) {
  const targetMap = platform.createTarget(types)
  for (const [targetPlatform, archMap] of targetMap) {
    const existing = targets.get(targetPlatform)
    if (existing === undefined) {
      targets.set(targetPlatform, archMap)
      continue
    }
    for (const [arch, targetNames] of archMap) {
      const current = existing.get(arch) ?? []
      existing.set(arch, [...new Set([...current, ...targetNames])])
    }
  }
}

function assertNativeHost(expected) {
  if (process.platform !== expected) {
    throw new Error(`desktop: ${expected} packaging requires a ${expected} runner; current host is ${process.platform}`)
  }
}
