# ZORYQ Autonomous Company — MVP Evidence Checklist

This checklist converts the Autonomous Company thesis into falsifiable implementation gates.

## P0 — Company creation
- [ ] Fresh user can create an experimental company from the public ZORYQ surface.
- [ ] Goal, success criteria, budget, duration, autonomy mode and policy are persisted/versioned.
- [ ] Company ID and controller/root authority are inspectable.
- [ ] Creation event/state can be independently read.

## P0 — Agent and permission model
- [ ] At least two agents/services can be attached to a company.
- [ ] Each agent exposes identity, role, parent/controller and capability metadata.
- [ ] Scoped permission includes target, method, value, budget, rate, time and replay domain.
- [ ] Revocation is enforced.
- [ ] Emergency stop is enforced.

## P0 — Task/hiring lifecycle
- [ ] Orchestrator can decompose a goal into 2-5 inspectable tasks.
- [ ] Task acceptance criteria and budget are visible.
- [ ] One task can be assigned/hired to another agent/service.
- [ ] Failed/cancelled work updates status and accounting correctly.

## P0 — Execution evidence
- [ ] Critical action creates an intent envelope.
- [ ] Simulation/risk output is distinguishable from authorization.
- [ ] Authorized action executes on testnet.
- [ ] Receipt status is verified before marking success.
- [ ] Reverted/failed transactions never appear successful.

## P0 — Treasury/payments/revenue
- [ ] Company treasury tracks initial, committed, spent and remaining testnet budget.
- [ ] At least one outgoing testnet payment is linked to task/service and verified.
- [ ] At least one incoming testnet payment is linked to company/task/service and verified.
- [ ] Treasury/accounting reconciles against RPC/onchain state.
- [ ] Double-payment and over-budget attempts fail.

## P0 — Proof Pack
- [ ] Export includes goal/version, identities, tasks, permissions, hires, actions, tx hashes, receipts, payments, failures, treasury state and evidence hashes.
- [ ] Human-readable UI and machine-readable Proof Pack represent the same facts.
- [ ] Proof Pack is independently verifiable.

## P0 — Adversarial suite
- [ ] expired permission
- [ ] revoked permission
- [ ] wrong target
- [ ] wrong method
- [ ] over-budget spend
- [ ] rate violation
- [ ] replay
- [ ] wrong chain/domain
- [ ] forged receipt
- [ ] reverted transaction
- [ ] double-payment
- [ ] self-hiring/reputation farming
- [ ] accounting mismatch
- [ ] stale simulation
- [ ] agent metadata injection
- [ ] emergency stop bypass

## P1 — Public UX
- [ ] Autonomous entrypoint is visible from primary ZORYQ product/developer navigation.
- [ ] Create Company form is mobile-usable.
- [ ] Live company page shows org graph, treasury, tasks, verified actions, payments, revenue and risk alerts.
- [ ] Agent drill-down shows permissions, budget, tasks, receipts and reputation evidence.
- [ ] Explorer verification is one click from transaction/evidence rows.
- [ ] Experimental testnet status is always visible.

## P1 — SDK / developer surface
- [ ] Versioned schemas are public.
- [ ] TypeScript validation/canonical hashing exists.
- [ ] SDK exposes company creation, planning, hiring, execution and Proof Pack without hiding signer/authorization boundaries.
- [ ] Copy-paste example is runnable from a clean environment.

## P1 — Independent reproduction
- [ ] Fresh external reviewer reproduces create -> task -> hire -> execute -> pay/receive -> Proof Pack.
- [ ] Reviewer supplies commit/run/tx evidence and reports limitations.

## Claim gate
Do not use the phrase "works, hires, pays, earns and accounts onchain" as a current capability claim until the corresponding P0 evidence is public and reproducible.