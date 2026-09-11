# ZORYQ Mainnet Incident Response Runbook

Status: operational runbook template. This document does **not** attest that mainnet is ready. It defines the minimum response procedure that must exist before launch evidence can be accepted by `mainnet-guard.mjs`.

## Severity

- **SEV-1** — chain halt, conflicting canonical heads/finality, key compromise, unauthorized signing, critical consensus or bridge exploit, corrupted canonical state, broad RPC compromise.
- **SEV-2** — degraded block production, major peer loss, partial RPC outage, indexer/explorer divergence, elevated error/latency with chain still safe.
- **SEV-3** — isolated client/UI issue, non-critical service degradation, documentation/telemetry issue.

## First 15 minutes

1. Declare severity and timestamp the incident.
2. Preserve logs, metrics, deployment IDs, node identities, block height/hash and current genesis hash. Do not delete volumes or rotate evidence away.
3. For suspected key compromise, disable the affected signer/relayer path before rotating anything. Never publish private keys or seed phrases in tickets, chat or logs.
4. For suspected consensus divergence, stop unsafe automated writes/deploys and compare canonical block hash/state root across independent nodes.
5. Keep public status messaging factual. Do not claim recovery until canonical-chain checks pass.

## Containment

- RPC abuse: tighten gateway access/rate controls and isolate privileged/admin interfaces; never expose Engine/Admin/Personal/Signer APIs publicly.
- Signer compromise: revoke/disable compromised signer, rotate through documented custody procedure, verify new signer allowlists and permissions before reactivation.
- Node corruption: remove the affected node from traffic; do not wipe the only surviving copy of canonical state.
- Consensus fault: prioritize safety over liveness. Do not force a head/finality decision without evidence from the production consensus procedure.

## Recovery validation

Recovery is not complete until all applicable checks pass:

1. Genesis file SHA-256 matches the frozen launch manifest.
2. Chain ID and client version are expected.
3. At least two independent healthy nodes agree on canonical block hash for the same height; production launch target is >=3 independently stateful nodes across >=2 failure domains.
4. Restored/synced node reaches the expected canonical head without manual state fabrication.
5. Public RPC exposes only approved methods and security limits remain enabled.
6. Signer/relayer keys are externalized according to production custody policy.
7. Health, peer/sync and resource telemetry are normal.
8. A post-incident evidence package is created and hash-bound to the launch/incident record where applicable.

## Evidence package

Record at minimum:

- incident ID, severity, start/end timestamps and responders;
- affected services/nodes and failure domains;
- relevant Git commit/deployment IDs;
- frozen genesis SHA-256 and chain ID;
- block heights/hashes/state roots used to establish canonical recovery;
- peer/sync health before and after recovery;
- key rotation/revocation reference without secret material;
- corrective actions and regression tests.

## Forbidden shortcuts

- Do not reset the chain to make health checks green.
- Do not delete persistent volumes before evidence and recovery copies exist.
- Do not weaken `mainnet-guard.mjs` or security CI to permit a launch.
- Do not mark a third-party audit complete without an independent report.
- Do not mark redundancy complete using multiple processes that share one volume/failure domain.

## Exit criteria

A SEV-1/SEV-2 incident can be closed only when containment is verified, canonical state is independently checked, follow-up actions have owners, and the evidence package is preserved. Mainnet launch/relaunch remains blocked until all launch guard evidence requirements are satisfied.
