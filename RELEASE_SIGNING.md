# Release Signing

Linux and macOS release assets are published only as a prerelease until native platform validation and the signing process are complete.

The current macOS packages intentionally use an explicit unsigned configuration. They do not contain a Developer ID signature or Apple notarization ticket. A user may need to Control-click the app and choose Open on its first launch.

For a signed macOS build, the release environment must provide a Developer ID Application certificate through `CSC_LINK` and `CSC_KEY_PASSWORD`, and may select it with `CSC_NAME`. Notarization uses one complete tuple: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`; or `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`; or an `APPLE_KEYCHAIN_PROFILE`. On a trusted `desktop-v*` tag, the desktop workflow passes repository secrets with these same names to the native macOS packaging step; pull requests and branch builds never receive them. Empty secrets keep the explicit unsigned preview path. These values belong in the CI secret store and must never be committed or pasted into a prompt.

Each release publishes SHA-256 checksums; Linux assets also receive the GitHub Actions provenance/SBOM attestation. The maintainer may additionally publish a detached GPG signature and public key for the exact assets in the release. Verify the public-key fingerprint shown in the GitHub release notes before trusting a personal signature.

The private signing key is never stored in this repository, GitHub Actions, an issue, a pull request, or a model prompt. A release without a published GPG signature must not be described as personally signed by lzeeorno.
