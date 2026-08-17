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

macOS: **Coming Soon**. Windows: **Coming Soon**. Native CI validation exists, but neither platform is part of the first public download. Do not treat CI-only unsigned artifacts as distributable installers.

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

`pack:linux`, `pack:mac`, and `pack:win` reject a non-matching host. Each command stages a built DSH runtime before electron-builder packages it. On Linux, verify the packaged directory and native terminal addon with:

```sh
DSH_DESKTOP_CDP_PORT=9331 pnpm --filter @deepseek-ai/dsh-desktop smoke:dir
pnpm --filter @deepseek-ai/dsh-desktop check:native
```

## Release Boundary

The first public release is a Linux x64 prerelease. The build outputs and CI artifacts are unsigned until the release signing process completes. A distributable cross-platform release still requires native installation, upgrade, and uninstall checks; real BYOK requests for each provider; macOS signing and notarization; and Windows code signing. The current release evidence and the complete acceptance sequence are in the [Agent Systems whitepaper](../../references/AGENT_SYSTEMS_WHITEPAPER.md#7-实施与验收路线).
