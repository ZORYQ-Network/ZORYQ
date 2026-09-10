# Contributing to ZORYQ

ZORYQ contributions should make the project more **verifiable, secure, understandable or reproducible**.

## Before coding

Choose the smallest process that matches the risk:

- small fix/documentation → issue or direct PR;
- durable architecture decision → ADR;
- major protocol/API/security design → RFC;
- experimental protocol idea → research artifact before production integration.

## Workflow

1. open an issue/design note for material changes;
2. create a focused branch;
3. implement with proportional tests and documentation;
4. run applicable typecheck/lint/tests/builds;
5. record benchmark evidence when performance is claimed;
6. open a PR using the repository template;
7. obtain additional review for security/protocol-sensitive code.

## Definition of Done

A change is not done only because it compiles.

- behavior and failure cases are understood;
- tests are proportional to risk;
- docs/specification are updated;
- security impact is reviewed;
- performance claims have reproducible evidence;
- known limitations are not hidden;
- no secret, seed, private key or credential is committed;
- ZORYQ naming remains consistent.

For user-facing application work also consider:

- loading/error/empty states;
- accessibility;
- internationalization;
- analytics/logging privacy;
- rollback or feature flags for risky behavior.

## Crypto/protocol review

Changes affecting wallet, signing, authentication, fees, swaps, bridges, token eligibility, treasury, RPC validation, state transitions, consensus/finality, cryptography or upgrades require deeper review than visual/product changes.

A major protocol optimization must not be merged merely because a benchmark is faster. Correctness, deterministic state, recovery and security take precedence.

## Research integrity

Do not present a hypothesis as an implemented feature. Do not fabricate benchmarks, audits, partnerships, users, validators, academic citations or novelty.

Negative experimental results should be documented when useful.

## Commits

Prefer Conventional Commits with useful scopes where appropriate:

- `feat(execution):`
- `fix(network):`
- `perf(state):`
- `security(rpc):`
- `test(vm):`
- `docs(protocol):`
- `research(scheduler):`
- `ci(actions):`
- `bench(execution):`

Keep commits reviewable and logically focused.
