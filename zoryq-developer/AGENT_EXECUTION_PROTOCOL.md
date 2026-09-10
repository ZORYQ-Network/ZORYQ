# ZORYQ Agent Execution Protocol — v0.1

## Purpose

ZORYQ treats AI agents as software actors, but never as invisible signers. The protocol separates **intent**, **simulation**, **authorization**, **broadcast**, and **verification** so a developer can inspect what an agent plans to do before any state change occurs.

This addresses a real problem in agentic onchain software: natural-language intent is ambiguous, wallets sign opaque calldata, and post-transaction success is often inferred from a returned hash rather than verified from the receipt and expected state.

## Core invariant

**An agent may propose and prepare a state-changing action, but the action is not authorized until an explicit wallet confirmation is obtained.**

No ZORYQ tool or manifest should request, transmit, or persist a seed phrase or private key.

## Execution lifecycle

`intent → resolve → simulate → explain → authorize → broadcast → verify → attest`

### 1. Intent
A human or software system describes the desired outcome.

### 2. Resolve
The agent converts intent into a deterministic action envelope containing chain, target, method, arguments, value and constraints.

### 3. Simulate
Before signing, the client should run read-only checks and gas estimation where available. Simulation output must remain distinguishable from confirmed onchain state.

### 4. Explain
The user receives a human-readable preview containing:
- target contract;
- method;
- asset/value movement;
- expected output;
- estimated gas;
- relevant risk notices;
- postconditions that will be checked.

### 5. Authorize
The wallet performs explicit user confirmation. A returned signature or transaction hash alone is not proof of successful execution.

### 6. Broadcast
The signed transaction is sent to the configured ZORYQ RPC.

### 7. Verify
After inclusion, the client checks:
- receipt exists;
- receipt status is successful;
- chain ID is correct;
- destination/created contract is expected;
- required logs or state changes exist;
- optional postconditions pass.

### 8. Attest
The application may create a **Proof Pack**: a portable evidence object linking intent/action metadata to transaction hash, receipt, contract bytecode/state evidence and project identity.

## Security boundaries

Required:
- exact chain ID `5919065`;
- explicit target address or deployment intent;
- wallet confirmation for state changes;
- no secret collection;
- no silent chain switching;
- no claim that simulation equals execution;
- receipt verification after broadcast;
- clear testnet-only disclosure.

Recommended:
- allowlisted contracts for automated workflows;
- per-action value limits;
- expiry timestamp;
- nonce/replay domain;
- expected contract code hash where appropriate;
- bounded slippage for DeFi actions;
- postcondition checks;
- human-readable diff between proposed and resolved action.

## Why this matters

The protocol is designed to make agentic blockchain execution inspectable and composable. An agent can produce a machine-readable plan; a wallet can enforce the authorization boundary; a verifier can independently prove what happened.

That separation is useful beyond ZORYQ: any EVM developer building agentic payments, DeFi automation, treasury tooling or autonomous applications needs a way to turn ambiguous intent into constrained, auditable execution.

## Current status

This is an experimental testnet protocol specification. ZORYQ does not claim autonomous mainnet safety, audited agent execution, decentralized consensus or production security guarantees.