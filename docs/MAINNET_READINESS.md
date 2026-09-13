# ZORYQ Mainnet Readiness

**Current verdict: NOT READY / mainnet is not claimed.**

This scorecard is a summary. Detailed evidence requirements remain in `MAINNET_RECOVERY_AND_AUDIT_GATES.md` and `MAINNET_SECURITY_AUDIT_SCOPE.md`.

## Required gates

| Gate | Current state | Promotion evidence |
| --- | --- | --- |
| Canonical protocol/client source | WORKING | reviewable source, reproducible builds, release hashes |
| Deterministic execution / state conformance | WORKING | test vectors, compatibility matrix, adversarial tests |
| Multi-node convergence | WORKING | repeated convergence/restart evidence |
| Independent Node 2 | NOT_PROVEN | operator-controlled external node with peer/rejoin evidence |
| Multi-operator topology | NOT_PROVEN | at least two independently controlled operators |
| Disaster recovery drill | NOT_PROVEN | clean-host restore with hashes and recovery metrics |
| Key custody / signer separation | NOT_PROVEN | ceremony, role separation, rotation/revocation evidence |
| Incident response exercise | WORKING | runbook exists; tabletop execution evidence required |
| External security audit | NOT_PROVEN | named auditor, exact commit/scope, findings and report evidence |
| Production mobile signing | NOT_PROVEN | exclusive release key, protected CI secret path, fingerprint record |
| Wallet independent security assessment | NOT_PROVEN | critical signing/recovery flow assessment |
| Sustained observability | WORKING | public/operator metrics and alerting evidence |
| Upgrade / rollback procedure | WORKING | tested release and rollback drill |

## Fail-closed rule

A gate is not green because documentation exists. It becomes green only when the evidence package exists at an immutable commit/tag and can be reviewed or reproduced.

## Launch decision

Before any `mainnet` label is used publicly, create a launch manifest binding evidence by SHA-256 and release commit. A different Chain ID and immutable production genesis/config must be explicitly defined. Testnet success must never be silently rebranded as mainnet.
