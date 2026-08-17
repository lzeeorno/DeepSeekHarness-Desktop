# DSH Desktop

English | [中文](README.zh.md)

DSH Desktop is a community desktop workbench built on the open-source [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is maintained by [lzeeorno](https://github.com/lzeeorno) and is not an official DeepSeek release.

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

The upstream harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run the upstream Web UI from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/lzeeorno/DeepSeekHarness-Desktop.git
cd DeepSeekHarness-Desktop
pnpm install
pnpm run build
pnpm dsh web
```

### Run the desktop shell

The Electron shell reuses the Web Client and starts a local DSH runtime. From a source checkout, run:

```sh
pnpm --filter @deepseek-ai/dsh-desktop dev
```

On Linux x64, a directory build and unsigned AppImage/deb artifacts can be created with:

```sh
pnpm --filter @deepseek-ai/dsh-desktop pack:linux
```

Artifacts are written to `dist/desktop/`. Linux x64 is the first public prerelease target. macOS: **Coming Soon**. Windows: **Coming Soon**. Native CI validation does not mean that an unsigned artifact is a distributable installer; use the [Agent systems whitepaper](references/AGENT_SYSTEMS_WHITEPAPER.md) for the acceptance sequence and release limits.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/lzeeorno/DeepSeekHarness-Desktop/discussions).
- Follow the [upstream DeepSeek Harness project](https://github.com/deepseek-ai/deepseek-harness) for harness and plugin ecosystem updates.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). This community repository does not publish new npm packages under `@deepseek-ai`.

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
