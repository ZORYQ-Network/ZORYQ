# ZORYQ Repository Audit

This audit applies the `KEEP / MERGE / REFACTOR / ARCHIVE / DELETE` model without destructive cleanup before evidence is preserved.

## Canonical areas

| Path | Decision | Reason |
| --- | --- | --- |
| `mobile-games-native/` | KEEP + RENAME LATER | Canonical reviewable Android Wallet/Social/Games source and tested build path. Renaming/moving is deferred to avoid breaking CI in the same migration. |
| `autonomous/` | KEEP + EXPAND | Canonical Autonomous Company schema/Proof Pack implementation base. |
| `zoryq-developer/obep/` | KEEP + MERGE CONCEPTUALLY | Evidence/proof tooling belongs to the Autonomous Network developer layer. |
| `payments/` | KEEP | Current economy/payment reference implementation. |
| `infra/nondev/` | KEEP | Network/testnet reproduction and multi-node engineering artifacts. |
| `tools/` | KEEP | Reproducibility and network-gate tooling. |
| `research/` | KEEP | Explicit research boundary. |
| `rfcs/` | KEEP | Protocol/design proposal process. |
| `docs/` | KEEP + CURATE | Detailed evidence and product documents; canonical index is being introduced. |
| `.github/workflows/` | KEEP + CONSOLIDATE | CI/security/evidence gates. |

## Legacy / debt areas

| Path | Decision | Reason |
| --- | --- | --- |
| `zoryq-src.tgz` | ARCHIVE / REMOVE AFTER EVIDENCE MIGRATION | Corrupt opaque source archive; must not be an active build dependency. |
| `.github/workflows/android-apk.yml` old archive flow | REFACTOR | Replaced on the unification branch to build canonical reviewable Android source. |
| `.github/workflows/mobile-source-export.yml` old archive flow | REFACTOR | Replaced on the unification branch to export canonical reviewable source directly. |
| historical naming references | ARCHIVE / DO NOT REINTRODUCE | Preserve evidence/history when needed, but canonical product name is ZORYQ. |

## Target logical structure

The long-term organization is:

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

## Immediate cleanup order

1. Remove archive dependencies from build/export CI.
2. Establish source-of-truth documents and Command Center.
3. Close Issue #58 only after canonical source export/build passes on `main`.
4. Remove or quarantine the corrupt archive in a later cleanup PR.
5. Rename `mobile-games-native/` only after release paths and external links are stable.
6. Consolidate Autonomous/OBEP naming after end-to-end MVP evidence is green.
