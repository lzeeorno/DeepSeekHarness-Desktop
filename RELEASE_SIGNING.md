# Release Signing

Linux release assets are published only as a prerelease until native platform validation is complete.

Each release publishes SHA-256 checksums and a GitHub Actions provenance/SBOM attestation. The maintainer may additionally publish a detached GPG signature and public key for the exact assets in the release. Verify the public-key fingerprint shown in the GitHub release notes before trusting a personal signature.

The private signing key is never stored in this repository, GitHub Actions, an issue, a pull request, or a model prompt. A release without a published GPG signature must not be described as personally signed by lzeeorno.
