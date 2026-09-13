# ZORYQ Repository Audit

This audit applies the `KEEP / MERGE / REFACTOR / ARCHIVE / DELETE` model without moving working modules merely for cosmetic organization.

## Canonical areas

| Path | Decision | Reason |
| --- | --- | --- |
| `mobile-games-native/` | KEEP + RENAME LATER | Canonical reviewable Android Wallet/Social/Games source and proven build/export path. Renaming/moving is deferred until release paths and external links are stable. |
| `autonomous/` | KEEP + EXPAND | Canonical Autonomous Company schema/Proof Pack implementation base. |
| `zoryq-developer/obep/` | KEEP + MERGE CONCEPTUALLY | Evidence/proof tooling belongs to the Autonomous Network developer layer. |
| `payments/` | KEEP | Current economy/payment reference implementation. |
| `infra/nondev/` | KEEP | Network/testnet reproduction and multi-node engineering artifacts. |
| `tools/` | KEEP | Reproducibility and network-gate tooling. |
| `research/` | KEEP | Explicit research boundary. |
| `rfcs/` | KEEP | Protocol/design proposal process. |
| `docs/` | KEEP + CURATE | Detailed evidence and product documents governed by the unified source-of-truth index. |
| `.github/workflows/` | KEEP + CONSOLIDATE | CI/security/evidence gates. |
| `command-center/` | KEEP | Machine-readable evidence registry and unified status dashboard. |

## Completed debt cleanup

| Former debt | Result | Evidence |
| --- | --- | --- |
| `zoryq-src.tgz` corrupt opaque archive | DELETED from current tree after canonical main-branch proof | `MOBILE_BUILD_EVIDENCE.md`; Git history preserves the old blob |
| `.github/workflows/android-apk.yml` archive flow | REFACTORED | Builds/tests normal `mobile-games-native/` source and publishes APK hashes/provenance |
| `.github/workflows/mobile-source-export.yml` archive flow | REFACTORED | Exports canonical source with deterministic inventory/checksums/provenance and secret gates |
| Issue #58 mobile release-integrity blocker | CLOSED / COMPLETED | main run IDs and artifact digests recorded in `MOBILE_BUILD_EVIDENCE.md` |

## Remaining legacy / debt areas

| Area | Decision | Reason |
| --- | --- | --- |
| historical naming references in immutable history/evidence | ARCHIVE / DO NOT REINTRODUCE | Preserve history where necessary; canonical product name is ZORYQ. |
| `mobile-games-native/` directory name | RENAME LATER | Functional but broader than games now; renaming requires atomic CI/import/link migration. |
| production Android signing | IMPLEMENT BEFORE PRODUCTION | Current Testnet RC is not an independently signed/audited production wallet. |
| autonomous/OBEP overlap | MERGE CONCEPTUALLY FIRST | Avoid moving proof tooling until end-to-end Autonomous MVP contracts are stable. |

## Target logical structure

The long-term organization remains:

```text
chain/              protocol/client source when canonicalized
contracts/          onchain contracts
mobile/             unified ZORYQ Android application
games/              shared game/runtime code if separated from mobile
social/             reusable social service/client modules
agents/              agent runtime and specialist agents
autonomous-company/ bounded-company orchestration
sdk/                developer SDKs
api/                public API contracts
services/           hosted application services
infra/              deployment/network infrastructure
security/           machine-readable security tooling/policies
tests/              cross-module/system tests
docs/               source-of-truth and supporting evidence
examples/            reproducible examples
tools/               developer/operator tooling
command-center/      unified evidence dashboard
```

This is a migration target, not permission to move working modules blindly. Moves should be atomic with imports, workflows, documentation and CI updated in the same PR.

## Next cleanup order

1. Keep canonical mobile reproducibility green on every relevant change.
2. Add exclusive production Android signing without committing keystore/private keys.
3. Rename/move `mobile-games-native/` only as a dedicated atomic migration.
4. Consolidate Autonomous/OBEP ownership around the end-to-end bounded-company MVP.
5. Continue separating research claims from production protocol/client evidence.
