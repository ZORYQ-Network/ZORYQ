# Release Policy

## Channels
- development: local/test data
- staging: testnet/sandbox providers
- limited mainnet: small allowlisted cohort
- production: public supported release

## Versioning
Every money-moving change must be traceable to a Git commit and mobile build number.

## Rollback
High-risk features use server-controlled capability flags. A broken route/provider should be disableable without waiting for an app-store release.

## Production signing
Debug APKs from GitHub Actions are for testing. Public distribution requires a protected production signing key and controlled release workflow.
