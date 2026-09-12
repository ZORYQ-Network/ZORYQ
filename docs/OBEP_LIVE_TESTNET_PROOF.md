# ZORYQ OBEP — First Live Testnet Proof

Status: **publicly reproduced by GitHub Actions on ZORYQ public centralized testnet**

This document records the first ZORYQ **Outcome-Bound Economic Proof (OBEP)** lifecycle that used a real ZORYQ Testnet transaction instead of a simulated receipt.

It is evidence of a working prototype. It is **not** evidence of decentralization, production readiness, independent economic demand, audit, mainnet readiness, or external adoption.

## What was proven

The run created three ephemeral CI-only roles:

- Autonomous Company Treasury
- Executor
- Outcome Verifier

The Company Treasury received native ZQ testnet funds from the public faucet. The protocol then created an OBEP intent, authorization, execution record and accepted outcome. The three roles produced cryptographic attestations. The Company Treasury sent a real native-ZQ payment to the executor. The transaction calldata committed to the same `intentId + outcomeId + outputHash`. A standalone verifier then fetched the transaction and receipt from the public RPC and independently revalidated the Proof Pack.

Lifecycle demonstrated:

`Intent -> Authorization -> Execution -> Outcome -> Payment -> Receipt -> Accounting -> Proof Pack`

## Immutable proof coordinates

- Chain ID: `5919065`
- Network claim boundary: public centralized testnet
- GitHub Actions run: `34721460108`
- Commit: `9bb1e74a027b1e823cf6cf5bbede41095e3e291c`
- Block: `126054`
- Transaction: `0x573de41d87fd1bc9c6679f7addf6cbf03f724c15e03fc2fda1a187b9b12a7080`
- Faucet funding transaction: `0x3b2a6cef2054becfb2ff014ed2cef0ba831059f0a4af64a270f28478dc5aaa9b`
- Intent ID: `0x572f9277bc20218e99652de931830e7c66f117a7131009e979ec91a78338bc5d`
- Outcome ID: `0x891f40df7f32e0aa6d2217d9ce2d5fb2a475d340f1a7622b64a0cbabb51561da`
- Output hash: `0x2e68680e6d7cebdb10c00420efac3bd44a6b304573801b8e4e87704cbd068076`
- Onchain commitment: `0x165d4f01d551ac16f4150c9bbfd2b46ddffde2e176ef7489dff2946604af2238`
- Proof Pack hash: `0x6faba71daa11b7aafc69a9b238d9711b3be03ba52b4576d188bf89b86af05b32`
- Payment amount: `1000000000000000000` wei native ZQ testnet

## Role addresses

- Company Treasury / authorizer: `0xac516ffa2704adb8ae2bdee499a8eadcfcb0d5fb`
- Executor / payment recipient: `0xa2c9faf843ed4d04d01c606bff8a632e75969ce2`
- Outcome verifier: `0xd355f65c45bcea646ff68d0e549f0fc38e659eda`

The private keys were generated in-process by the CI runner and were not persisted or emitted into the evidence artifact.

## Onchain binding

The transaction calldata contains a protocol marker plus a deterministic commitment derived from:

```text
protocol = ZORYQ_OBEP_ONCHAIN_V1
chainId = 5919065
intentId = 0x572f9277bc20218e99652de931830e7c66f117a7131009e979ec91a78338bc5d
outcomeId = 0x891f40df7f32e0aa6d2217d9ce2d5fb2a475d340f1a7622b64a0cbabb51561da
outputHash = 0x2e68680e6d7cebdb10c00420efac3bd44a6b304573801b8e4e87704cbd068076
```

The resulting commitment is:

`0x165d4f01d551ac16f4150c9bbfd2b46ddffde2e176ef7489dff2946604af2238`

The verifier checks that the public-RPC transaction has:

- the same payer as the OBEP Company Treasury;
- the same recipient as the OBEP executor;
- the same payment amount as the OBEP settlement receipt;
- successful receipt status;
- the expected calldata commitment;
- the same transaction hash referenced by the OBEP receipt.

## Reproduce

The implementation lives in:

- `zoryq-developer/obep/obep.mjs`
- `zoryq-developer/obep/live-proof.mjs`
- `zoryq-developer/obep/verify-live-proof.mjs`
- `.github/workflows/zoryq-obep-proof.yml`

A new public proof can be created by running the `ZORYQ OBEP Proof` workflow. Each run uses fresh ephemeral identities and therefore produces different addresses, IDs and transaction hashes while preserving the same verification rules.

The local adversarial suite must remain green before the live proof step. It tests replayed nonce, wrong executor, revoked authorization, rejected outcome, wrong verifier, wrong Treasury/recipient/chain/amount, failed receipt, duplicate settlement, substituted output and accounting mismatch.

## What this does NOT prove

This first live proof does not yet prove:

- an independent external executor or verifier;
- real-world useful work;
- external revenue or market demand;
- decentralized consensus;
- independent Node 2 operation;
- production-safe custody;
- audited smart contracts;
- Sybil-resistant reputation;
- dispute resolution for subjective outcomes;
- economic value of native ZQ.

The deterministic task was deliberately simple so that the protocol binding itself could be tested without an ambiguous oracle.

## Next evidence gates

1. External developer independently verifies a Proof Pack.
2. Executor is operated independently from the ZORYQ project.
3. Verifier is independent from both payer and executor.
4. Replace deterministic arithmetic task with a useful externally observable task.
5. Add dispute/challenge window and multi-verifier policy.
6. Add Sybil/circular-payment resistance before reputation can be treated as economic trust.
7. Bind Autonomous Company UI directly to OBEP lifecycle and expose the Proof Pack publicly.

Until those gates are satisfied, OBEP remains a **research prototype with a real onchain testnet settlement proof**, not a production economic standard.
