# ZORYQ Autonomous — Verifiable Company Reference Model

This directory is the machine-readable implementation surface for the ZORYQ Autonomous Company thesis:

> Give ZORYQ a goal and a budget. It creates a bounded company of agents that plans, delegates, works, hires, accounts and can later attach verified economic/onchain evidence.

This remains **experimental testnet architecture**. The complete autonomous-company lifecycle is not claimed as live until real execution/payment/outcome receipts are independently reproduced.

## What is now reproducible

The reference MVP can take:

- a concrete goal;
- a testnet budget;
- a root-controller address;
- an autonomy mode;

and deterministically create:

- a company identity and goal hash;
- four specialist agents: Planner, Builder, Verifier and Accountant;
- four bounded tasks with acceptance requirements;
- two internal hire records;
- explicit budget allocations and committed budget;
- expiring/revocable simulation permissions;
- an emergency-stop policy boundary;
- a simulation-only authorization run;
- a portable Proof Pack with deterministic `evidenceRoot`;
- SHA-256/provenance artifacts in CI.

The reference simulation deliberately creates **zero chain receipts** and keeps evidence-backed `goalProgress` at **0%**. A simulation may prove policy/orchestration behavior; it may not be relabeled as payment, revenue or real-world outcome success.

## Evidence model

Lifecycle:

`goal -> plan -> company -> agents -> tasks -> hire -> simulate -> authorize -> execute -> pay/receive -> verify -> reputation -> proof pack -> goal progress`

Current reference code proves the lifecycle through **authorize/simulate/proof-pack construction**. The later execute/pay/receive/outcome stages still require real external evidence.

The model defines:

- `company`: root controller, goal, success criteria, budget, policy and emergency state;
- `agents`: role/capability identities attached to a company;
- `tasks`: bounded work units with acceptance/evidence requirements;
- `permissions`: target/method/value/time/domain restrictions;
- `hires`: task-to-agent delegation and compensation intent;
- `receipts`: chain-bound execution/payment evidence when it truly exists;
- `proofPack`: portable evidence joining the lifecycle.

## Security invariants

1. Root authority remains revocable.
2. No seed phrase/private key belongs in this model.
3. Delegated permission is bounded and expiring/revocable where appropriate.
4. Simulation is not onchain execution.
5. Transaction submission is not success; receipt status must be verified.
6. Reverted/failed actions must never advance evidence-backed goal progress.
7. Accounting must reconcile against evidence.
8. Emergency stop blocks new delegated execution.
9. Reputation must not materially increase from self-interaction/circular farming.
10. A missing real receipt must remain missing; the reference system must never fabricate one.

## Files

- `lib/core.mjs` — deterministic planner, amount codec, scoped policy engine, simulator and Proof Pack verifier.
- `cli.mjs` — goal/budget → company/plan/simulation CLI.
- `verify-proof.mjs` — portable Proof Pack integrity verifier.
- `test/core.test.mjs` — planner/policy/tamper-detection tests.
- `schemas/company.schema.json` — company + policy envelope.
- `schemas/proof-pack.schema.json` — portable verification envelope.
- `examples/company.example.json` — explicitly non-live example data.
- `validate.mjs` — dependency-free structural validator for the company envelope.

## Create a bounded company plan

```bash
node autonomous/cli.mjs plan \
  --goal "Ship a verifiable ZORYQ developer demo" \
  --budget 10 \
  --controller 0x1111111111111111111111111111111111111111 \
  --autonomy supervised \
  --out ./autonomous-output
```

Outputs:

- `company.json`
- `execution-plan.json`
- `manifest.json`

## Run the safe simulation

```bash
node autonomous/cli.mjs simulate \
  --goal "Ship a verifiable ZORYQ developer demo" \
  --budget 10 \
  --controller 0x1111111111111111111111111111111111111111 \
  --autonomy supervised \
  --out ./autonomous-output
```

Additional outputs:

- `simulation-intents.json`
- `authorization-decisions.json`
- `proof-pack.json`

Verify it independently:

```bash
node autonomous/validate.mjs autonomous-output/company.json
node autonomous/verify-proof.mjs autonomous-output/proof-pack.json
```

## CI evidence

`.github/workflows/autonomous-company.yml` runs unit tests, generates a fixed deterministic company/simulation, validates the envelopes, requires `receipts.length == 0`, requires `goalProgress.percent == 0`, binds checksums to the commit and uploads the evidence bundle.

Passing this workflow proves the bounded **reference planner/policy/simulation** path. It still does **not** prove real task execution, testnet payment, revenue, external adoption, decentralization, security audit or mainnet readiness.

See `docs/ZORYQ_AUTONOMOUS_COMPANY.md` and issue #59 for the product/evidence gate.