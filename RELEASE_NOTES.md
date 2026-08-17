# DSH Desktop 0.1.0-rc.5

This community prerelease introduces the Electron desktop shell, the Build/Research workbench, the context ledger, provider profile settings, and Linux x64 packaging built on DeepSeek Harness. It is not an official DeepSeek release.

## Downloads

- Linux x64 AppImage
- Linux amd64 Debian package
- `SHA256SUMS`
- CycloneDX SBOM

The GitHub build records separate provenance and SBOM attestations for both Linux packages. Verify them with `gh attestation verify <asset> --repo lzeeorno/DeepSeekHarness-Desktop`. Personal GPG signatures and the maintainer's public key are added only after the exact CI assets have been downloaded and verified locally.

## Known Limits

- macOS: **Coming Soon**
- Windows: **Coming Soon**
- Linux is a prerelease target and has not completed the full cross-platform installation matrix.
- Real model use requires a user-supplied provider API key. No API key is included in the repository or release assets.
- OAuth subscription login, cloud session handoff, GUI computer use, unattended scheduling, and complex agent teams remain future extension work.

See [RELEASE_SIGNING.md](RELEASE_SIGNING.md) for the signing policy and [UPSTREAM.md](UPSTREAM.md) for upstream attribution.
