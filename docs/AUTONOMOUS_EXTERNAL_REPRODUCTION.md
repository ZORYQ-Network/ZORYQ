# ZORYQ Autonomous Company — External Reproduction Protocol

## Purpose

Define the shortest credible path from the current public-testnet primitives to an independently reproducible Autonomous Company claim.

The product thesis is:

> Give ZORYQ a goal and a bounded budget. It creates an autonomous company of agents that works, hires, pays, earns and accounts onchain.

Each verb is a separate evidence gate. No verb inherits proof from another.

## Fresh-user protocol

The reproducer must start without a preconfigured core-team wallet or private artifact.

1. Open the public Autonomous product surface.
2. Verify chain ID and public RPC from the browser.
3. Enter a goal, measurable success criteria, bounded testnet budget, duration and autonomy policy.
4. Preview an inspectable plan before signing anything.
5. Connect a fresh compatible wallet on ZORYQ Testnet.
6. Explicitly authorize the company launch transaction.
7. Verify successful receipt and contract state from public RPC/explorer.
8. Create/attach at least two distinct agent/service roles.
9. Record a concrete hire/work relationship bound to a task specification hash.
10. Submit delivery/work evidence and bind it to the task.
11. Simulate any critical payment/action, show target/value/method/policy impact, then require explicit authorization where policy demands it.
12. Execute an outgoing testnet payment and verify the receipt.
13. Link an incoming payment from an independently controlled payer to declared work/delivery evidence and verify the receipt.
14. Reconcile treasury/accounting against chain state: opening balance + verified incoming - verified outgoing = closing balance.
15. Update goal progress only from accepted evidence.
16. Export a machine-readable Proof Pack.
17. A second independent verifier checks the Proof Pack against public RPC without trusting the creator's browser state.

## Required Proof Pack sections

```text
identity
network
company
policy
agents
workOrders
authorizations
executions
outgoingPayments
incomingRevenue
accounting
claimGates
riskEvents
receipts
reproduction
```

Every evidence item should carry its source transaction/hash, chain ID, block reference, verifier status and timestamp when applicable.

## Claim matrix

| Claim | Minimum evidence |
|---|---|
| `creates` | Fresh wallet launch + successful receipt + expected company state. |
| `works` | Declared task/spec + accepted execution/delivery evidence. |
| `hires` | Agent/service relationship bound to a task and enforceable/inspectable in the experimental protocol. |
| `pays` | Successful outgoing receipt, correct target/value and reconciled treasury delta. |
| `earns` | Successful incoming receipt from an independently controlled payer linked to declared work/delivery evidence. |
| `accounts` | Deterministic ledger reconciliation against verified chain state for incoming and outgoing flows. |

## Adversarial reproduction requirements

The external reproduction must also demonstrate safe rejection of representative failures:

- expired/revoked authorization
- wrong target/method/chain/domain
- budget/rate/time limit violation
- replay/double execution
- stale simulation
- reverted transaction
- forged or mismatched receipt
- double payment
- untrusted metadata/evidence substitution
- accounting mismatch
- emergency-stop bypass attempt

## UX requirements

The public interface must make trust boundaries visible without requiring the user to read source code:

- `PREVIEW` vs `SIGNED` vs `EXECUTED` vs `VERIFIED`
- synthetic testnet accounting vs native token movement vs independently sourced revenue
- human/root authority and emergency stop
- budget remaining and policy limits
- agent/task graph
- pending approvals
- receipts/evidence links
- claim gates with `verified`, `partial`, `blocked`, `unverified`
- one-click Proof Pack export

## Success condition

A person outside the core operator can complete the flow, publish the resulting Proof Pack, and another person can independently verify the same claim-gate outcomes from public evidence. Until then, the Autonomous Company remains experimental and partially verified.
