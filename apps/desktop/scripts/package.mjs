import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build, Platform } from 'electron-builder'

const desktopRoot = resolve(import.meta.dirname, '..')
const runtimeRoot = join(desktopRoot, '.runtime')
const stagedModules = join(runtimeRoot, '.node-modules')
const outputDirectory = resolve(desktopRoot, '../../dist/desktop')
const desktopManifest = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8'))
const args = new Set(process.argv.slice(2))

if (typeof desktopManifest.version !== 'string' || desktopManifest.version === '') {
  throw new Error('desktop: package.json version is missing')
}

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

const macSigningEnabled = args.has('--mac') && (hasEnvironmentValue('CSC_LINK') || hasEnvironmentValue('CSC_NAME'))
const macNotarizationEnabled = macSigningEnabled && (
  hasAllEnvironmentValues(['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'])
  || hasAllEnvironmentValues(['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'])
  || hasAllEnvironmentValues(['APPLE_KEYCHAIN_PROFILE'])
)
const macConfig = macSigningEnabled
  ? {
      category: 'public.app-category.developer-tools',
      target: ['dmg', 'zip'],
      hardenedRuntime: true,
      notarize: macNotarizationEnabled,
      entitlements: join(desktopRoot, 'build/entitlements.mac.plist'),
      entitlementsInherit: join(desktopRoot, 'build/entitlements.mac.inherit.plist'),
    }
  : {
      category: 'public.app-category.developer-tools',
      target: ['dmg', 'zip'],
      identity: null,
      hardenedRuntime: false,
      notarize: false,
    }

await build({
  projectDir: desktopRoot,
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
    forceCodeSigning: macSigningEnabled,
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
    mac: macConfig,
    win: { target: ['nsis', 'zip'] },
    nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
  },
})

function hasEnvironmentValue(name) {
  return typeof process.env[name] === 'string' && process.env[name] !== ''
}

function hasAllEnvironmentValues(names) {
  return names.every(hasEnvironmentValue)
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
