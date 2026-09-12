# ZORYQ Autonomous — Verifiable Company Reference Model

This directory is the first machine-readable implementation surface for the ZORYQ Autonomous Company thesis:

> Give ZORYQ a goal and a budget. It creates an autonomous company of agents that works, hires, pays, earns and accounts onchain.

This is **experimental testnet architecture**, not a claim that the complete autonomous-company lifecycle is already live.

## Evidence model

Every user-visible success must be derivable from verifiable evidence rather than model text.

Lifecycle:

`goal -> plan -> company -> agents -> tasks -> hire -> simulate -> authorize -> execute -> pay/receive -> verify -> reputation -> proof pack -> goal progress`

The reference model defines:

- `company`: root controller, goal, success criteria, budget, policy and emergency state;
- `agents`: role/capability identities attached to a company;
- `tasks`: bounded work units with acceptance/evidence requirements;
- `permissions`: target/method/value/rate/time/domain restrictions;
- `receipts`: chain-bound execution/payment evidence;
- `proofPack`: portable evidence joining the lifecycle.

## Security invariants

1. Root authority remains revocable.
2. No seed phrase/private key belongs in this model.
3. Delegated permission is bounded and expiring/revocable where appropriate.
4. Simulation is not authorization.
5. Transaction submission is not success; receipt status must be verified.
6. Reverted/failed actions must never advance evidence-backed goal progress.
7. Accounting must reconcile against chain evidence.
8. Emergency stop blocks new delegated execution.
9. Reputation must not materially increase from self-interaction/circular farming.

## Files

- `schemas/company.schema.json` — company + policy envelope.
- `schemas/proof-pack.schema.json` — portable verification envelope.
- `examples/company.example.json` — explicitly non-live example data.
- `validate.mjs` — dependency-free structural validator for the example/reference format.

## Run locally

```bash
node autonomous/validate.mjs autonomous/examples/company.example.json
```

A successful structural validation proves only that the example conforms to this reference format. It does **not** prove onchain execution, payment, revenue, security, decentralization, or mainnet readiness.

See `docs/ZORYQ_AUTONOMOUS_COMPANY.md` and issue #59 for the product/evidence gate.