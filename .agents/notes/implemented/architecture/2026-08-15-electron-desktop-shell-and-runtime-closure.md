# Agent Note: Electron desktop shell and staged runtime closure

Status: implemented

English | [中文](2026-08-15-electron-desktop-shell-and-runtime-closure.zh.md)

## Problem

The harness had a usable web client and loopback runtime, but no native desktop entry point. A desktop wrapper must preserve the existing Cordis composition and event-sourced session behavior while starting from a packaged application directory that does not depend on the repository workspace, symlinks, or a development-only module graph.

## Decision

`apps/desktop` provides a thin Electron main process. `run-electron.mjs` starts the actual Electron binary after removing an inherited `ELECTRON_RUN_AS_NODE` value. The main process reserves a loopback port, launches the built DSH web runtime with `--expose-internals`, waits for HTTP readiness, and loads the existing Web Client in a context-isolated, sandboxed `BrowserWindow`. The child process receives `RUST_LOG=info`, inherits no `ELECTRON_RUN_AS_NODE` value, and is terminated on window close or application quit. Startup failures are shown in a bounded diagnostic view.

The staging script builds the workspace, deploys the DSH runtime with pnpm, and materializes workspace peer dependencies and external workspace links into `.runtime` so packaged execution does not require symlink support. Profile fallback resolution realpaths each package anchor before reading its dependency manifest, so transitive packages behind pnpm store links, including the Web workbench plugin, remain visible to every installed profile. The packaging script creates a temporary dependency-free Electron project and uses electron-builder to produce directory, Linux AppImage/deb, macOS dmg/zip, and Windows NSIS/zip targets. `.github/workflows/desktop.yml` repeats the packaging on native Ubuntu, macOS, and Windows runners for pull requests, `desktop-v*` tags, and manual dispatch, checks the staged `node-pty` addon on each host, and checks each platform's payload type. A desktop tag creates checksums, a CycloneDX SBOM, and GitHub provenance attestations for the Linux assets before publishing a Linux prerelease; macOS and Windows artifacts remain CI-only until their installation and signing acceptance exists. Runtime output and generated desktop artifacts remain ignored build products.

The packaging entry point rejects a macOS or Windows target when the current process is not running on that native host (and applies the same rule to Linux). This keeps a host-built `node-pty` binary from being silently placed in a foreign installer; cross-platform artifacts therefore come from the matching matrix runner rather than an apparently successful local cross-build.

The first locally verified target is Linux x64. It has a keyless packaged launch, event-backed Web Client readiness, and the dependency-free `check-native.mjs` PTY load/spawn check. The community desktop metadata identifies `DSH Desktop` and lzeeorno rather than an official DeepSeek installer. The CI matrix builds macOS and Windows on native hosts and runs the same addon check, but both platforms remain Coming Soon until installation and signing acceptance are supplied. Real provider authentication and model switching remain manual acceptance steps because no API key is stored in the repository.

The visual companion at `apps/desktop/design/workbench-companion.html` documents the intended three-pane Build/Research workbench and narrow-window panel folding without replacing the production renderer.

## Alternatives considered

**A second desktop-specific renderer.** Rejected because it would duplicate session, credential, compaction, permission, and provider UI already supplied by the Web Client and would create two product surfaces with different event semantics.

**Electron loading source files directly.** Rejected because packaged execution needs the built runtime and a reproducible module closure; source loading also couples the product to the workspace toolchain.

**Relying on pnpm workspace symlinks in the installer.** Rejected because symlink privileges and path behavior differ across Windows, macOS, and Linux. Staging dereferences external links and materializes required peer dependencies into the packaged runtime.

**Claiming a signed cross-platform release now.** Rejected because this environment cannot perform native macOS/Windows builds or provide signing/notarization credentials. The scripts and product metadata are prepared, but the release claim stays limited to the verified Linux artifacts.

## Consequences

The native shell is small and keeps the harness plugin architecture, session log, providers, credentials, and compaction as the product source of truth. Packaging has an explicit staging boundary and can be tested independently from the repository workspace. The cost is a larger Linux artifact and a required native build matrix before publishing macOS or Windows installers. The current validation evidence covers keyless startup, focused runtime/UI paths, typechecking, link checks, and Linux packaging; API-key and non-Linux acceptance remain open.

The public research manifest retains the whitepaper and source links, while downloaded papers and external source checkouts remain local research inputs. `.gitignore` excludes those materials so their licenses, local paths, and unlicensed reverse-engineering inputs do not enter the community repository.

## Testing

The desktop package tests cover launch argument construction, port reservation, readiness, and shutdown. The development launcher was exercised with an inherited `ELECTRON_RUN_AS_NODE=1` and remained a live Electron process under Xvfb until the test timeout. The profile fallback test covers a transitive dependency reached through a pnpm-style symlinked bundle. The packaged `smoke:dir` command launches `linux-unpacked`, waits for the loopback URL, and uses the existing Web Playwright dependency over CDP to check the title and keyless first-run controls, dismiss the write-only-key onboarding through `Configure later`, verify the Build/Research workbench control, then open Settings → Models and verify the DeepSeek/API key surface before terminating Electron. On POSIX it gives the launched app a dedicated process group, so AppImage launcher detachment cannot leave an Electron/runtime tree behind after a smoke run; Windows retains ordinary child termination. The native CI matrix runs `check-native.mjs` on each host and checks generated AppImage/deb, dmg/zip, and NSIS/zip payloads; the macOS/Windows checks establish addon loading and artifact format only, not installation acceptance. The packaging guard was also exercised on Linux by rejecting a macOS target before electron-builder starts. The assembled Models scenario also configured independent OpenAI and Anthropic BYOK profiles through the same page, checked that keys stayed write-only and that both routes registered, while the model-default scenario verified the shared selector switches a subsequent session's default without rewriting a logged session route. Those checks use local dummy keys and no model request. Playwright web replay and onboarding suites pass on the assembled keyless Web Client. Provider profile, catalog, discovery, dynamic settings, SDK option, topology, and model-editor tests pass keyless cases. Focused harness tests cover replay, manual compaction, approval/permission, and provider settings. The regenerated Linux AppImage also launched in extract-and-run mode and passed the same keyless UI smoke; the deb payload was inspected with `dpkg-deb --info`. Typechecking, markdown-link verification, source syntax checks, Linux directory packaging, AppImage/deb packaging, and `node-pty` loading pass on the current Linux host.
