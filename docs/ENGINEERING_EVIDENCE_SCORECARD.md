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
| Public testnet runtime | `VERIFIED_LIVE` | Public service has produced/finalized blocks and exposes health/RPC evidence. | Long-duration reliability evidence and independent reproduction. |
| P2P distribution | `BLOCKED` | P2P endpoint exists. | Real Node 2, persistent `peers > 0`, restart/rejoin and independent operator evidence. |
| Multi-operator verifier | `VERIFIED_CI` | Adversarial verifier checks operator/host/key independence, checkpoint convergence and recovery evidence. | Feed it real production observations; synthetic fixtures do not count. |
| Autonomous organization/work/payment primitives | `PARTIAL` | Canonical public-testnet contracts/receipts can be verified by the product UI. | Fresh external user reproduces the complete goal-to-Proof-Pack path. |
| Real external revenue | `UNVERIFIED` | Operator-controlled external-work payment proves receipt-bound payment mechanics only. | Independently controlled payer/customer and independently linked work evidence. |
| Autonomous accounting | `PARTIAL` | Exact receipt/state/treasury-delta evidence exists for the canonical external-work proof. | Full company ledger reconciliation for outgoing + incoming flows and failure cases. |
| Mainnet readiness | `PARTIAL` | CI gates exist for release integrity, supply chain, validator/multi-operator evidence and recovery. | Real multi-host evidence, security review/audit, operational rehearsal, incident/rollback evidence and release sign-off. |
| External traction | `UNVERIFIED` | Public repository/testnet surfaces exist. | Repeated usage/contributions by independently controlled developers/operators with reproducible evidence. |

## Non-negotiable claim rules

1. A running single node is not a distributed network.
2. Synthetic fixtures validate gates; they do not validate production decentralization.
3. Same-operator wallets/services do not count as independent payer/operator evidence.
4. Passing CI does not make the network mainnet-ready.
5. A successful transaction proves only the facts bound to that transaction/receipt.
6. `works`, `hires`, `pays`, `earns`, and `accounts` are promoted independently and only from reproducible evidence.
7. External traction requires independent actors; page views and self-generated activity are not substitutes.

## Promotion gates

### Distributed testnet
- >= 2 real hosts for the first milestone
- stable bilateral peering
- restart/rejoin without state reset
- same canonical chain/checkpoints
- machine-readable evidence
- at least one independently controlled operator before using the word `independent`

### Production multi-operator/mainnet evidence
The production gate is intentionally stronger: >= 4 nodes/operators, >= 3 regions, unique P2P IDs and host fingerprints, registry-bound independent Ed25519 attestations, >= 3 peers per node, common finalized checkpoint, and passed producer-loss, network-partition-recovery and node-restart-recovery evidence within the gate's recovery bounds.

### Autonomous Company end-to-end
A fresh external user must be able to go from goal + bounded budget to inspectable plan, agents/services, hire/work relationship, explicit authorization, execution, outgoing payment, incoming independently sourced revenue, reconciliation, goal-progress update and machine-readable Proof Pack — without a core-team operator manually fabricating the evidence.

## Review rule

Any score increase must cite the evidence artifact that caused the promotion. If the evidence disappears, becomes stale, or cannot be independently reproduced, downgrade the row instead of preserving the score.
