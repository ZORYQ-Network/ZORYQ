# ZORYQ Technical Debt

This file records known engineering debt that should not be hidden behind roadmap or marketing language.

## P1 — Mobile source stored as `zoryq-src.tgz`

### Current state

The Android workflow extracts `zoryq-src.tgz` before dependency installation, type checking and APK generation.

### Why this is debt

Keeping active source code inside a compressed archive reduces normal Git review quality:

- file-by-file diffs are unavailable on GitHub;
- dependency tooling cannot easily inspect manifests/lockfiles;
- CODEOWNERS/path rules are less useful;
- code search and contributor onboarding are weaker;
- security review and supply-chain automation become harder;
- small changes may require replacing the entire archive.

### Target state

Move the application source into normal reviewable repository directories with:

- package manifest and lockfile committed normally;
- source files visible to GitHub code review/search;
- typecheck/lint/test workflows operating directly on source;
- dependency update/security tooling able to inspect dependencies;
- APK workflow building from the same reviewed source tree.

### Migration rule

Do not delete `zoryq-src.tgz` until the replacement source tree is present and the Android build succeeds from it. Migration must preserve a rollback path.

## P1 — Protocol implementation/evidence boundary

The repository currently contains stronger product/mobile artifacts than first-class protocol implementation artifacts. README/specification language must continue to distinguish declared network status from independently reviewable protocol evidence.

## P2 — Benchmark implementation

Benchmark policy exists, but benchmark code/results are not yet established. Do not publish performance numbers as measured ZORYQ results until reproducible artifacts exist.

## P2 — Conformance and recovery testing

Protocol-level deterministic test vectors, serial-equivalence tests, state recovery tests and adversarial network tests should be added alongside the corresponding implementation.
