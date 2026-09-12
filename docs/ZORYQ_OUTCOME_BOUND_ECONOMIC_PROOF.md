# ZORYQ Outcome-Bound Economic Proof (OBEP)

Status: **RESEARCH HYPOTHESIS / PROTOTYPE SPECIFICATION**

This document does **not** claim that ZORYQ has invented a proven new industry standard. It defines a candidate protocol primitive to be implemented, attacked, benchmarked, reproduced externally, and only then promoted.

## 1. Research thesis

Agent wallets, policy-bound authorization, onchain identity, account abstraction, machine payments and agent registries are rapidly becoming separate building blocks.

The unresolved systems problem is cross-stage consistency:

> How can a third party prove that an economic payment was authorized for a specific intent, executed by the intended actor/service, produced the contracted outcome, passed the agreed verification policy, and was reconciled into reputation/accounting — without trusting a single coordinator's database?

ZORYQ proposes a candidate primitive called **Outcome-Bound Economic Proof (OBEP)**.

OBEP binds the full economic lifecycle into one verifiable evidence graph:

`Intent -> Policy -> Task -> Executor -> Authorization -> Execution -> Outcome -> Verification -> Payment -> Receipt -> Accounting -> Reputation`

The defining requirement is that no payment or reputation event is treated as evidence of successful work unless it is cryptographically or deterministically bound to the same economic intent and accepted outcome.

## 2. Why this is not just another agent wallet

OBEP is not primarily a wallet standard.

A wallet answers: **may this agent execute this transaction?**

OBEP answers a larger question:

> **What economic promise was made, who was authorized, what was executed, what result was produced, who verified it under which policy, what was paid for that result, and how should that verified result affect accounting and reputation?**

Policy-bound wallets, ERC-4337/EIP-7702 style accounts, ERC-8196-like authorization, ERC-8004-like identity/reputation, x402-like payments, attestations, zk/TEE proofs and conventional smart contracts may all be inputs or interoperability surfaces. OBEP's proposed contribution is the binding layer across them.

## 3. Core object: Economic Intent Envelope

Every autonomous economic action starts with an immutable/versioned envelope.

Minimum fields:

- `intentId`
- `companyId`
- `goalHash`
- `taskHash`
- `requester`
- `authorizedExecutor` or executor-selection policy
- `capability`
- `target`
- `maxSpend`
- `asset`
- `deadline`
- `rateLimit`
- `nonce`
- `replayDomain`
- `verificationPolicyHash`
- `successPredicateHash`
- `paymentTermsHash`
- `revocationAuthority`
- `createdAt`
- `validUntil`

The hash of this envelope becomes the root identifier for all downstream evidence.

## 4. Evidence graph

Every stage emits a typed evidence node referencing `intentId` and the preceding relevant evidence hash.

### 4.1 Authorization Evidence

Proves that the action was within bounded authority:

- permitted capability
- target/method
- per-action spend
- cumulative budget
- rate/time limits
- nonce/replay domain
- chain/account/session
- revocation state

### 4.2 Execution Evidence

Binds the actual execution to the authorized intent:

- executor identity
- execution request hash
- transaction/job hash
- tool/service identifier
- timestamps
- input commitment
- output commitment
- environment/provenance commitment where available

### 4.3 Outcome Evidence

Represents the result claimed by the executor:

- outcome hash
- artifact/result commitments
- objective measurements
- optional zk proof / TEE attestation / deterministic replay evidence
- external evidence URIs with hashes

### 4.4 Verification Evidence

A result is not successful merely because an executor says so.

Verification evidence records:

- verifier identity or verifier set
- verification policy hash
- predicate evaluated
- evidence inspected
- pass/fail/indeterminate
- confidence or quorum when applicable
- conflict/challenge state

High-value tasks SHOULD support verifier separation from executor and payer.

### 4.5 Settlement Evidence

Payment must be bound to the accepted outcome:

- payer
- payee
- intentId
- accepted outcome hash
- asset
- amount
- chainId
- transaction hash
- log index where relevant
- receipt status
- finality policy

A transaction sent to an agent is **not** sufficient evidence of successful economic work unless this binding is satisfied.

### 4.6 Accounting Evidence

Reconciles:

- budget committed
- budget spent
- revenue received
- liabilities
- refunds/disputes
- realized task cost
- treasury delta

Accounting state must reconcile with verified settlement evidence.

### 4.7 Reputation Evidence

Reputation is derived from verified outcomes, not arbitrary stars.

A reputation update references:

- actor identity
- intentId
- verification result
- outcome class
- economic value at risk
- dispute/challenge state
- prior reputation root

Repeated circular payments, self-dealing and Sybil-linked counterparties must not automatically create high reputation.

## 5. Proposed invariant

The central OBEP invariant is:

> **No economic success claim may advance farther in the lifecycle than its strongest verified evidence.**

Examples:

- authorized but not executed -> no work claim
- executed but not verified -> no successful outcome claim
- verified but unpaid -> no paid-work claim
- payment without bound outcome -> no successful-work reputation
- accounting entry without receipt -> unreconciled

## 6. Proof Pack

A Proof Pack is a portable representation of the evidence graph.

Minimum sections:

1. Intent
2. Policy
3. Authorization
4. Executor identity
5. Execution
6. Outcome
7. Verification
8. Settlement
9. Accounting reconciliation
10. Reputation update
11. Revocation/challenge history

A third party should be able to validate the pack without trusting the ZORYQ frontend.

## 7. Challenge and dispute model

OBEP must assume that executors, verifiers, requesters and counterparties may be adversarial.

Candidate challenge states:

`PROPOSED -> AUTHORIZED -> EXECUTED -> OUTCOME_SUBMITTED -> VERIFYING -> ACCEPTED | REJECTED | CHALLENGED -> SETTLED -> RECONCILED`

For challenge-capable tasks:

- payment may use escrow or delayed settlement
- a challenge references the exact evidence node disputed
- replacement/corrective evidence is append-only
- history is never silently rewritten

## 8. Security requirements

Required before production claims:

- bounded/revocable permissions
- nonce and replay protection
- intent/payment domain separation
- spending and cumulative-budget limits
- rate/time limits
- receipt/log verification
- finality policy
- executor/verifier separation where risk requires it
- durable consumed-intent/payment registry
- emergency stop
- accounting reconciliation
- challenge/dispute handling
- Sybil/self-dealing analysis for reputation
- no seed phrase/private-key collection

## 9. Interoperability-first architecture

OBEP should not require ZORYQ to replace existing standards unnecessarily.

Candidate adapters:

- policy-bound agent wallets / ERC-8196-style policies
- ERC-4337 / EIP-7702 smart accounts
- ERC-8004-style agent identity/reputation
- x402-style machine payments
- EIP-712 typed intent signatures
- conventional ERC-20/native settlement
- zkML/verifiable-compute proofs
- TEE attestations
- decentralized storage/content hashes

The research question is whether OBEP can become the common **economic evidence binding layer** across these components.

## 10. First falsifiable MVP

A successful first experiment must be small and independently reproducible.

Scenario:

1. User creates an Autonomous Company with a testnet budget.
2. Company emits one Economic Intent Envelope for a real deterministic task.
3. A second agent/service accepts the task under bounded authority.
4. Execution produces a committed artifact/result.
5. An independent verifier evaluates the success predicate.
6. Only an accepted outcome unlocks testnet settlement.
7. Settlement references the intent + accepted outcome.
8. Treasury accounting reconciles against the receipt.
9. Executor reputation updates from the verified outcome.
10. A Proof Pack is exported.
11. An external developer verifies the Proof Pack without relying on the ZORYQ UI.

## 11. Acceptance gates

### Gate A — Spec
- [x] Candidate primitive specified
- [ ] Threat model complete
- [ ] Serialization/schema frozen for prototype

### Gate B — Prototype
- [ ] Economic Intent Envelope implementation
- [ ] Evidence graph implementation
- [ ] bounded authorization adapter
- [ ] verifier adapter
- [ ] settlement binding
- [ ] accounting reconciliation
- [ ] reputation update
- [ ] Proof Pack exporter/verifier

### Gate C — Adversarial tests
- [ ] replayed authorization rejected
- [ ] wrong executor rejected
- [ ] wrong outcome cannot unlock payment
- [ ] payment without accepted outcome cannot create success reputation
- [ ] duplicate settlement rejected
- [ ] stale/revoked authorization rejected
- [ ] circular/self-dealing reputation attack detected or down-weighted
- [ ] accounting mismatch detected

### Gate D — External reproduction
- [ ] independent developer creates intent
- [ ] independent executor completes task
- [ ] independent verifier validates outcome
- [ ] third party verifies Proof Pack

Only after Gate D may ZORYQ describe OBEP as externally reproduced.

## 12. Relationship to ZORYQ Autonomous Company

OBEP becomes the evidence spine for:

`Create Company -> Plan -> Agents -> Tasks -> Hire -> Simulate -> Authorize -> Execute -> Outcome -> Verify -> Pay/Receive -> Reconcile -> Reputation -> Proof Pack -> Goal Progress`

This strengthens the Autonomous Company thesis without claiming that every stage is already proven.

## 13. Research success criterion

The hypothesis is valuable only if external developers conclude that the binding layer solves a problem they otherwise must solve repeatedly themselves.

The strongest evidence would be:

- external implementation/adoption of the schema
- interoperability with independent agents/wallets/payment systems
- adversarial tests passing
- multiple independently verified task/payment/outcome graphs

Until then, OBEP remains a **candidate ZORYQ protocol primitive**, not a proven breakthrough.
