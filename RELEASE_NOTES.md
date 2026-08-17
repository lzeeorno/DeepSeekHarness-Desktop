# DSH Desktop 0.1.0-rc.5 macOS preview

This community prerelease adds native macOS packaging to the Electron desktop shell, alongside the Linux x64 packages already built on DeepSeek Harness. It is not an official DeepSeek release.

## Downloads

- Linux x64 AppImage
- Linux amd64 Debian package
- macOS Intel x64 DMG and ZIP
- macOS Apple Silicon arm64 DMG and ZIP
- `SHA256SUMS`
- CycloneDX SBOM

The GitHub build records separate provenance and SBOM attestations for both Linux packages. Verify them with `gh attestation verify <asset> --repo lzeeorno/DeepSeekHarness-Desktop`. Personal GPG signatures and the maintainer's public key are added only after the exact CI assets have been downloaded and verified locally.

## Known Limits

- macOS assets are unsigned and not notarized. macOS may require Control-click > Open on first launch.
- The macOS packages are architecture-specific; no Universal binary is published.
- Windows: **Coming Soon**
- The full upgrade and uninstall matrix is still pending.
- Real model use requires a user-supplied provider API key. No API key is included in the repository or release assets.
- OAuth subscription login, cloud session handoff, GUI computer use, unattended scheduling, and complex agent teams remain future extension work.

See [RELEASE_SIGNING.md](RELEASE_SIGNING.md) for the signing policy and [UPSTREAM.md](UPSTREAM.md) for upstream attribution.
