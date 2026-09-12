# OBEP Standards Overlap & Falsification Matrix

Status: research / experimental

Last reviewed: 2026-09-12

This document deliberately tries to **falsify** strong novelty claims around ZORYQ Outcome-Bound Economic Proof (OBEP). It compares OBEP with adjacent standards and identifies what ZORYQ should reuse, interoperate with, or avoid claiming as novel.

## Claim boundary

OBEP is **not** currently claimed to be:

- the first agent wallet;
- the first policy-bound wallet;
- the first agent identity/reputation protocol;
- the first agent-payment protocol;
- the first task escrow for agents;
- the first evaluator-gated agent settlement mechanism;
- an audited production standard;
- an accepted Ethereum standard.

Those categories already have substantial work or active standards proposals.

## Standards reviewed

- ERC-4337 — Account Abstraction Using Alt Mempool: https://eips.ethereum.org/EIPS/eip-4337
- EIP-7702 — Set Code for EOAs: https://eips.ethereum.org/EIPS/eip-7702
- ERC-8004 — Trustless Agents: https://eips.ethereum.org/EIPS/eip-8004
- ERC-8126 — AI Agent Verification: https://eips.ethereum.org/EIPS/eip-8126
- ERC-8183 — Agentic Commerce: https://eips.ethereum.org/EIPS/eip-8183
- ERC-8196 — AI Agent Authenticated Wallet: https://eips.ethereum.org/EIPS/eip-8196
- ERC-8199 — Sandboxed Smart Wallet: https://eips.ethereum.org/EIPS/eip-8199
- ERC-8257 — Agent Tool Registry: https://eips.ethereum.org/EIPS/eip-8257
- x402 — HTTP-native programmatic payments: https://docs.x402.org/introduction

## Comparison matrix

Legend:
- **Native**: primary concern of the protocol/standard.
- **Partial**: represented or extensible, but not the primary end-to-end guarantee.
- **External**: expected to be provided by another layer.
- **OBEP target**: explicit evidence binding in the current OBEP prototype.

| Capability | ERC-4337 / EIP-7702 | ERC-8004 | ERC-8183 | ERC-8196 / 8199 | x402 | OBEP target |
|---|---|---|---|---|---|---|
| Programmable account execution | Native | External | External | Native | External | External / interoperable |
| Scoped wallet policy | Partial / wallet-dependent | External | External | Native | External | Evidence-bound, not wallet replacement |
| Agent identity | External | Native | Addresses/roles | Partial | Wallet identity | External / referenceable |
| Agent discovery | External | Native | External | External | Service discovery extensions | External |
| Task/job definition | External | Partial metadata | Native | External | Resource/request oriented | Native evidence envelope |
| Provider/executor role | External | Agent identity | Native | Agent wallet | Client/server | Native evidence binding |
| Independent evaluator/verifier | External | Validation Registry | Native evaluator | Policy/verification stack | Payment verifier/facilitator | Native evidence binding |
| Escrow | Wallet/app-specific | External | Native | External | Scheme-specific settlement | External / optional adapter |
| Payment transport | Native execution only | Explicitly orthogonal | ERC-20 escrow/release | Wallet execution | Native | External transport + verified receipt |
| Payment conditioned on evaluator outcome | App-specific | External | Native | Policy-dependent | Not general task-outcome semantics | Target, but **not novel by itself** |
| Execution evidence | Transaction/UserOp evidence | Validation signals | Deliverable hash/reference | Audit/policy trail | Request/payment evidence | Native execution object + output commitment |
| Outcome evidence | App-specific | Validation Registry | Evaluator completion/rejection + optional reason hash | Verification/policy dependent | Resource response outside general economic semantics | Native outcome object bound to execution/output |
| Intent/task → execution binding | App-specific | Partial | Job/provider/deliverable state | Policy/transaction binding | Request/payment scope can bind request details | Explicit deterministic graph |
| Outcome → settlement binding | App-specific | External | Native state transition | Policy-dependent | Payment/resource flow | Explicit commitment + receipt binding |
| Accounting reconciliation | External | Feedback may reference revenues | External to core job accounting | External | Settlement response | Native Proof Pack field in prototype |
| Reputation derived only from verified settled outcomes | External | Reputation is native but aggregation/trust model is open | Can compose with ERC-8004 | External | External | Explicit target invariant |
| Portable multi-stage Proof Pack | External | Registry evidence can be composed | Events/job state | Audit trails | Payment receipts | **Primary OBEP research target** |
| Standalone verifier that replays cross-stage consistency | External | Registry-specific | Contract-state verification | Wallet/policy-specific | Payment-specific | **Primary OBEP research target** |
| Replay-resistant cross-stage evidence domain | Account/user-op nonces | Registry-specific | Contract state/job IDs | Native policy/wallet controls | Scheme/idempotency dependent | Explicit intent nonce + settlement uniqueness |

## Most important falsification result: ERC-8183

ERC-8183 strongly overlaps with any broad claim that OBEP invented outcome-gated agent commerce. It already defines:

`Open -> Funded -> Submitted -> Completed/Rejected/Expired`

with distinct client, provider and evaluator roles, escrowed budget, deliverable commitment, evaluator completion/rejection and payment release/refund.

Therefore ZORYQ MUST NOT market OBEP merely as:

> "agents get paid only when an evaluator accepts their work"

That idea is not sufficient differentiation.

## Where OBEP can still be differentiated

The narrower hypothesis worth testing is:

> **OBEP is a portable economic evidence layer that deterministically binds authorization, task, executor, execution output, verifier decision, settlement receipt, accounting reconciliation and reputation provenance into one independently verifiable proof graph.**

The value proposition is not a new escrow primitive. It is **cross-stage consistency and portable evidence**.

A valid OBEP proof should let an independent verifier answer, without trusting the ZORYQ frontend:

1. What exactly was authorized?
2. Which task was authorized?
3. Who was allowed to execute it?
4. What output was committed?
5. Who verified that output and under what decision?
6. Which payment corresponds to that exact accepted outcome?
7. Did payer, recipient, amount, asset, chain and calldata match the authorization?
8. Was Treasury/accounting reconciled against the verified receipt?
9. Was reputation changed only because a verified, non-replayed economic outcome occurred?
10. Has any artifact in the chain been substituted or tampered with?

The existing OBEP live ZORYQ Testnet proof is an early prototype of this narrower thesis, not proof that the thesis is novel or generally useful.

## Interoperability direction

ZORYQ should avoid rebuilding adjacent layers where standards are stronger.

### ERC-4337 / EIP-7702
Use for programmable account execution, sponsorship and delegated account behavior when/where supported. OBEP should consume execution evidence rather than replace account abstraction.

### ERC-8196 / ERC-8199
Use policy-bound/sandboxed wallet authorization concepts. OBEP should record policy/authorization references and prove that the execution corresponds to the authorized economic intent.

### ERC-8004
Use agent identity, validation and reputation registries where appropriate. OBEP reputation evidence should be exportable as a high-quality provenance signal rather than inventing an isolated global identity system.

### ERC-8183
Treat as the strongest adjacent commerce primitive. Build an OBEP adapter/profile capable of representing an ERC-8183 job lifecycle inside a Proof Pack. If OBEP cannot add useful independent evidence to an ERC-8183 job, the OBEP thesis should be weakened or abandoned.

### x402
Use as a payment transport for paid APIs/services when appropriate. An OBEP Proof Pack may reference x402 settlement evidence, but OBEP should not reinvent HTTP-native payment negotiation.

## Research tests that can kill the OBEP thesis

OBEP should be considered unnecessary if one of these becomes true:

1. ERC-8183 + ERC-8004 + wallet policy standards already produce the same portable cross-stage proof with comparable independent verification and accounting provenance.
2. Developers consistently prefer querying several standard contracts/APIs directly and see no value in a normalized proof graph.
3. The Proof Pack adds substantial complexity but no security, auditability, dispute-resolution or reputation benefit.
4. Cross-stage evidence can be reconstructed reliably and cheaply without an OBEP envelope/commitment.
5. External developers cannot explain a concrete use case where binding outcome + settlement + accounting + reputation prevents a real failure mode.

## Next executable experiment

Build **OBEP Interop Profile 0.2** rather than a new chain or new escrow system:

1. define canonical references for ERC-8004 agent identity/validation;
2. define canonical mapping for ERC-8183 `jobId`, client, provider, evaluator, deliverable, completion/rejection and payment release;
3. allow x402 settlement receipts as a payment evidence type;
4. allow ERC-8196-style policy identifiers/hashes as authorization evidence;
5. retain the OBEP invariant that a standalone verifier can validate the full economic evidence graph;
6. demonstrate the profile on ZORYQ Testnet;
7. ask an independent developer whether the normalized proof adds real value versus raw protocol evidence.

## Current research conclusion

**Do not create another chain.** OBEP remains a ZORYQ protocol/research primitive.

The current strongest ZORYQ thesis is not "we invented agent commerce." It is:

> **ZORYQ is testing whether autonomous economic activity can become independently auditable as a single portable proof — from bounded authority to useful outcome to settlement to accounting to reputation — while composing with emerging agent standards instead of replacing them.**

Status: **promising hypothesis, not yet proven category-defining innovation.**
