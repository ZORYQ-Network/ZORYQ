# ZORYQ Disaster Recovery Runbook

Status: executable runbook template; a completed drill is still required as evidence.

## Trigger conditions

Use this runbook for:

- execution database corruption;
- consensus database corruption;
- host/provider loss;
- accidental destructive deployment;
- disk/volume failure;
- operator credential loss that does not imply signer compromise;
- regional infrastructure outage.

Signer compromise follows the incident-response runbook and key-rotation procedures in addition to recovery.

## Roles

- Incident lead: owns severity, containment and recovery decision.
- Execution operator: restores execution state and validates chain/genesis identity.
- Consensus operator: restores consensus state and validates finality/head.
- Security reviewer: verifies no secret leakage or unsafe shortcut occurred.
- Evidence recorder: records UTC timestamps, hashes, versions, commands and outcomes.

One person may fill multiple roles in testnet drills, but production mainnet evidence must document separation of critical duties.

## Preconditions

Before a production launch, each operator must have:

- encrypted backup policy;
- documented retention and rotation;
- a clean-host restore path;
- immutable/pinned genesis and consensus configuration hashes;
- client versions and reproducible installation steps;
- separate secret-recovery procedure;
- monitoring access independent from the failed node.

## Recovery procedure

1. Declare incident and stop unsafe automatic restarts if they can worsen corruption.
2. Record last trusted finalized/canonical block from at least one independent healthy source.
3. Preserve failed host logs and relevant metadata before destructive repair.
4. Provision a clean host under the intended operator boundary.
5. Verify software/client versions and release checksums.
6. Verify execution genesis/config hash against the canonical published hash.
7. Verify consensus configuration/genesis hash against the canonical published hash.
8. Generate or securely restore local Engine API JWT secret according to policy; never copy a secret into public evidence.
9. Restore state from the most recent verified encrypted backup, or perform protocol-supported sync from trusted peers/checkpoints when preferred by the architecture.
10. Start execution client and verify Engine API availability only on the intended private/local interface.
11. Start consensus client and verify authenticated Engine API connection.
12. Verify chain ID, execution head, consensus head/finality and peer state.
13. Compare at least three finalized/canonical block hashes against an independent healthy operator.
14. Observe normal progress for a defined soak interval.
15. Re-enable public traffic/validator duties only after the security reviewer accepts the evidence.

## Required drill evidence

Publish or retain an auditable redacted package containing:

- UTC incident/drill timeline;
- operator identity/control boundary;
- failure scenario;
- backup timestamp and integrity hash;
- release/client versions;
- execution and consensus config hashes;
- restore start/end timestamps;
- recovery time objective observed;
- recovery point/data-loss window observed;
- sampled matching block/finality hashes;
- restart/rejoin result;
- monitoring screenshots or machine-readable extracts without secrets;
- failures and corrective actions;
- reviewer approval.

## Acceptance criteria

A recovery drill passes only if:

- restored node uses the intended canonical configs;
- no private key/JWT/provider credential is exposed;
- node rejoins without chain divergence;
- independently sampled canonical/finalized hashes match;
- documented recovery time and any data-loss window are recorded;
- any failure discovered during the drill receives a tracked corrective action.

A backup that has not been successfully restored does not satisfy the mainnet recovery gate.
