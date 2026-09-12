# ZORYQ OBEP Interop Profile 0.2

Status: experimental ZORYQ evidence profile

This profile extends Outcome-Bound Economic Proof (OBEP) so a Proof Pack can reference evidence from adjacent agent standards and payment transports rather than rebuilding those systems.

## What exists

Implementation:
- `zoryq-developer/obep/interop-profile.mjs`
- `zoryq-developer/obep/interop-profile.test.mjs`

Current normalized external references:
- ERC-8183-style job evidence;
- ERC-8004-style agent identity/role evidence;
- ERC-8196-style bounded wallet policy evidence;
- x402-style settlement metadata.

The profile deterministically binds these references to the OBEP Proof Pack and produces an `interopHash`.

## Cross-stage invariants currently enforced

For an ERC-8183 job reference:
- chain must equal the OBEP chain;
- provider must equal the OBEP executor;
- evaluator must equal the OBEP verifier;
- deliverable must equal the OBEP execution `outputHash`;
- job budget must equal the OBEP verified settlement amount;
- settlement beneficiary must equal the provider;
- OBEP outcome must be accepted.

For ERC-8004-style identity references:
- referenced executor identity address must equal the OBEP executor;
- referenced verifier identity address must equal the OBEP verifier;
- roles must be explicit and consistent.

For policy evidence:
- policy wallet must equal the autonomous-company Treasury bound by the OBEP intent.

For x402-style payment evidence:
- chain, payee, amount and transaction hash must match the OBEP verified receipt.

Any mutation of the normalized interoperability graph changes the `interopHash` and fails reconstruction.

## Verified CI evidence

GitHub Actions run:
`https://github.com/ZORYQ-Network/ZORYQ/actions/runs/34723276410`

Commit:
`47026e02f2457acb7492054bdce7547440bb404b`

Result:
- 21 tests passed;
- 0 tests failed;
- permanent live reference proof independently verified from the public ZORYQ RPC;
- fresh ZORYQ Testnet OBEP settlement generated;
- fresh settlement independently reverified from the public RPC.

Fresh proof from that run:
- chain ID: `5919065`
- tx: `0x46ee4cadeaf0f9b09b63936c99638f3f6d3d355ed4da78679c7c2854c064fa21`
- block: `127226`
- intentId: `0x7b8a00f612e9d437762cccf642fae2c6dde6980888c2bf5beace1a96a1805a04`
- outcomeId: `0x3e4ca0323f5a0494c900f8f76d6636aa9962006e74ccfe8c3564e958d0f8ef36`
- commitment: `0x9d41178566c7f81e885c1fb6ade27d5a14bbe015a620567cfce9ab496cdbb7e2`
- proofPackHash: `0x63ce07a2ae34356dea8ec05df1460d1cbb665939c513349c141ee1268e13e733`

## Important limitation

The interoperability test fixtures currently model the documented semantics of ERC-8183, ERC-8004, ERC-8196 and x402. They are **not evidence that ZORYQ is standards-compliant** with deployed/reference implementations.

Until real implementations are ingested and verified, the correct claim is:

> ZORYQ has an experimental OBEP interoperability evidence profile with adversarially tested cross-stage consistency checks.

Do not claim:
- official ERC compatibility;
- Ethereum standards certification;
- deployed ERC-8183 integration;
- deployed ERC-8004 integration;
- deployed x402 production integration.

## Why this matters

The research question is not whether ZORYQ can invent another escrow, identity registry or wallet standard. Those primitives already have active standards work.

The remaining OBEP hypothesis is narrower:

> Can ZORYQ provide a portable proof that lets an independent verifier audit the consistency of authority, job, identity, output, evaluator decision, payment, accounting and reputation provenance across otherwise separate protocols?

That hypothesis remains promising but unproven.
