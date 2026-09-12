# ZORYQ Engineering Evidence Scorecard

This scorecard is an evidence ledger, not a marketing readiness percentage. Estimated percentages may be used for internal planning only.

## Evidence classes

| Class | Meaning |
|---|---|
| `VERIFIED_LIVE` | Observed on running public infrastructure with reproducible evidence. |
| `VERIFIED_CI` | Deterministic CI/self-test verifies logic, not production behavior. |
| `PARTIAL` | Material evidence exists but the complete claim gate is not met. |
| `BLOCKED` | A known external/technical blocker prevents the gate from being met. |
| `UNVERIFIED` | No acceptable evidence yet. |

## Current ledger

| Front | Evidence class | What is supported | What remains before promotion |
|---|---|---|---|
| Public testnet runtime | `VERIFIED_LIVE` | Public service produces blocks and exposes health/RPC evidence. | Long-duration reliability and independent reproduction. |
| Basic P2P connectivity | `VERIFIED_LIVE` | Current production deployment moved from `peers=0` to persistent `peers=1`; inspected logs show the peer from block 110762 through at least 110912. | Identify remote peer/control boundary, prove distinct process/state/P2P identity, restart/rejoin, bilateral convergence. |
| Independent distributed testnet | `PARTIAL` | Live P2P transport is now proven. | At least one independently controlled operator and reproducible two-host evidence before using `independent` or `distributed` as a verified claim. |
| Multi-operator verifier | `VERIFIED_CI` | Adversarial verifier checks operator/host/key independence, checkpoint convergence and recovery evidence. | Feed it real production observations; synthetic fixtures do not count. |
| Autonomous organization/work/payment primitives | `PARTIAL` | Canonical public-testnet contracts/receipts can be verified by the product UI. | Fresh external user reproduces the complete goal-to-Proof-Pack path. |
| Real external revenue | `UNVERIFIED` | Operator-controlled external-work payment proves receipt-bound payment mechanics only. | Independently controlled payer/customer and independently linked work evidence. |
| Autonomous accounting | `PARTIAL` | Exact receipt/state/treasury-delta evidence exists for the canonical external-work proof. | Full company ledger reconciliation for outgoing + incoming flows and failure cases. |
| Mainnet readiness | `PARTIAL` | CI gates exist for release integrity, supply chain, validator/multi-operator evidence and recovery. | Real multi-host evidence, security review/audit, operational rehearsal, incident/rollback evidence and release sign-off. |
| External traction | `PARTIAL` | Public repository/testnet surfaces and external-operator onboarding are now available. | Independent developer/operator must actually reproduce the flow; self-generated activity does not count. |

## Non-negotiable claim rules

1. `peers=1` proves live P2P connectivity, not decentralization.
2. A peer whose control boundary is unknown cannot be counted as an independent operator.
3. Synthetic fixtures validate gates; they do not validate production decentralization.
4. Same-operator wallets/services do not count as independent payer/operator evidence.
5. Passing CI does not make the network mainnet-ready.
6. A successful transaction proves only the facts bound to that transaction/receipt.
7. `works`, `hires`, `pays`, `earns`, and `accounts` are promoted independently and only from reproducible evidence.
8. External traction requires independent actors; page views and self-generated activity are not substitutes.

## Promotion gates

### Distributed testnet
- >= 2 real hosts for the first milestone
- stable bilateral peering
- distinct P2P identities and persistent data directories
- restart/rejoin without state reset
- same canonical chain/checkpoints
- machine-readable evidence
- at least one independently controlled operator before using the word `independent`

### Production multi-operator/mainnet evidence
The production gate is intentionally stronger: >= 4 nodes/operators, >= 3 regions, unique P2P IDs and host fingerprints, registry-bound independent Ed25519 attestations, >= 3 peers per node, common finalized checkpoint, and passed producer-loss, network-partition-recovery and node-restart-recovery evidence within the gate's recovery bounds.

### Autonomous Company end-to-end
A fresh external user must be able to go from goal + bounded budget to inspectable plan, agents/services, hire/work relationship, explicit authorization, execution, outgoing payment, incoming independently sourced revenue, reconciliation, goal-progress update and machine-readable Proof Pack — without a core-team operator manually fabricating the evidence.

## Current highest-value network action

Resolve the identity/control boundary of the live peer now visible as `peers=1`; if it is core-controlled, keep it as a networking milestone and recruit/provision an independently controlled peer. If it is independently controlled, capture signed non-secret evidence, restart/rejoin behavior and common-chain convergence immediately.

## Review rule

Any score increase must cite the evidence artifact that caused the promotion. If the evidence disappears, becomes stale, or cannot be independently reproduced, downgrade the row instead of preserving the score.
