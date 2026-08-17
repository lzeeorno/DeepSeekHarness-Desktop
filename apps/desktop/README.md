# DSH Desktop

English | [中文](README.zh.md)

DSH Desktop is a community Electron workbench built on the DeepSeek Harness Web Client. It is not an official DeepSeek release. Electron owns the application window and a loopback DSH runtime; Cordis plugins continue to own sessions, credentials, model providers, tools, permissions, and compaction.

## Install And Start

Linux x64 is the locally verified target. Its build produces an AppImage and a Debian package under `dist/desktop/`:

```sh
./dist/desktop/dsh-0.1.0-rc.5-linux-x86_64.AppImage
sudo apt install ./dist/desktop/dsh-0.1.0-rc.5-linux-amd64.deb
```

Set `APPIMAGE_EXTRACT_AND_RUN=1` before the AppImage command when the host lacks FUSE support.

macOS Intel and Apple Silicon preview packages are available from the [desktop releases](https://github.com/lzeeorno/DeepSeekHarness-Desktop/releases). Download the DMG or ZIP matching the Mac CPU, open the DMG, and drag `DSH Desktop.app` to Applications. The current packages are unsigned and not notarized; on first launch, Control-click the app and choose Open, then confirm the macOS warning. A universal binary is not published. Windows: **Coming Soon**.

## First Run And BYOK

Start without a key, choose `Configure later`, then open Settings > Models. Create a DeepSeek, OpenAI, or Anthropic profile, enter that provider's API key, choose a model, and send a small read-only request. The credentials provider stores a credential reference in settings; do not enter keys in prompts, commit them, or use them as a substitute for a vendor subscription login.

Existing sessions preserve their logged provider/model provenance. Changing the default profile affects a later session rather than rewriting historical turns.

## Build From Source

Install the workspace dependencies once, then run the matching native target:

```sh
pnpm install
pnpm --filter @deepseek-ai/dsh-desktop dev
pnpm --filter @deepseek-ai/dsh-desktop pack:linux
pnpm --filter @deepseek-ai/dsh-desktop pack:mac
pnpm --filter @deepseek-ai/dsh-desktop pack:win
```

`pack:linux`, `pack:mac`, and `pack:win` reject a non-matching host. Each command stages a built DSH runtime before electron-builder packages it. Verify the platform's packaged directory and native terminal addon with:

```sh
DSH_DESKTOP_CDP_PORT=9331 pnpm --filter @deepseek-ai/dsh-desktop smoke:dir
pnpm --filter @deepseek-ai/dsh-desktop check:native
```

The smoke command locates the platform's unpacked application, checks the keyless first-run controls, exercises a mouse click and keyboard activation in Settings, and then shuts the application down.

## Release Boundary

The current prerelease includes Linux x64 and architecture-specific macOS DMG/ZIP assets. The macOS Intel package has been installed and smoke-tested on the maintainer's Mac; the Apple Silicon package is built and smoke-tested on a native CI runner. All published packages are unsigned until the release signing process completes, so Gatekeeper may require the first-launch override above. A fully distributable cross-platform release still requires signed/notarized macOS assets, native upgrade and uninstall checks, real BYOK requests for each provider, and Windows code signing. The current release evidence and complete acceptance sequence are in the [Agent Systems whitepaper](../../references/AGENT_SYSTEMS_WHITEPAPER.md#7-实施与验收路线).
