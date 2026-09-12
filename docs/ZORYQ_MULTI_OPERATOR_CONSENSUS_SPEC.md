# ZORYQ Multi-Operator Consensus / Finality Specification

Status: P0 design gate for public testnet migration. This document does not claim decentralization or mainnet readiness.

## Current boundary

The current public testnet execution runtime uses Reth dev mode. P2P connectivity, a canonical non-secret chain spec and external peer configuration are useful networking evidence, but they do not establish decentralized block production or finality.

## Target trust model

A production decentralization claim requires at least 4 independently controlled validator/producer operators across at least 3 regions. No operator may share a validator key, mnemonic, infrastructure account, persistent data directory, or signing credential with another operator. Core-team replicas do not count as independent operators.

## Roles

- Execution node: executes EVM payloads and exposes the Engine API boundary required by the selected consensus implementation.
- Validator/producer: independently signs consensus messages with an operator-specific key.
- Witness: follows P2P data and verifies canonical checkpoints but has no block-production authority.
- Bootnode: discovery infrastructure only; it is not a validator and does not count toward operator independence.
- Evidence verifier: checks signed machine-readable operator attestations and common checkpoints.

## Safety invariants

1. A validator key belongs to exactly one operator identity at a time.
2. No shared mnemonic or producer key is permitted.
3. A finalized checkpoint cannot be replaced without violating an explicitly documented safety threshold.
4. Equivocation/double-sign evidence is machine-detectable and attributable to a validator identity.
5. Validator admission, rotation and revocation are deterministic and auditable.
6. Network partition must not allow conflicting finalized checkpoints under the stated fault threshold.
7. Recovery after producer loss, partition and restart must be demonstrated before public-testnet cutover.

## Required evidence bundle

Each operator publishes a signed, non-secret JSON attestation containing: operatorId, validatorPublicKey, p2pNodeId, region, softwareCommit, chainId, genesisSha256, observedAt, peerCount, headHeight, finalizedHeight, finalizedHash, restartRecoverySeconds and an infrastructure-independence declaration.

The aggregate verifier must reject duplicate validator keys, duplicate P2P identities, insufficient operators, insufficient regions, mismatched chain IDs, mismatched genesis hashes, stale observations and divergent finalized checkpoints.

## Migration sequence

### Stage A — Witness network
Run independently controlled witness nodes against the canonical chain spec. Require matching chain ID/genesis, peer connectivity, matching block checkpoints and restart/rejoin evidence.

### Stage B — Consensus prototype
Run a separate private test environment with at least four distinct validator keys and an explicit execution/consensus boundary. Do not alter the current public testnet during prototype validation.

### Stage C — Adversarial gates
Pass producer-loss, one-validator loss, network partition/recovery, restart/rejoin, equivocation detection, stale-message/replay rejection and validator key rotation/revocation tests.

### Stage D — Public testnet cutover
Publish versioned genesis/config, exact client versions, validator registry, cutover height/time, rollback policy and reproducible operator runbook. The old dev-mode network remains explicitly identified as experimental history.

### Stage E — Mainnet gate
Mainnet remains blocked until >=4 independent operators / >=3 regions are externally evidenced, adversarial gates pass, security review/audit is complete, release artifacts are reproducible and an operational rehearsal succeeds.

## Acceptance matrix

| Gate | Minimum |
| --- | --- |
| Independent operators | 4 |
| Regions | 3 |
| Unique validator keys | 4 |
| Unique P2P identities | 4 |
| Common finalized checkpoint | 100% of accepted evidence |
| Peer count | >=3 per validator at observation |
| Producer-loss recovery | pass |
| Partition/recovery | pass |
| Restart/rejoin | pass |
| Equivocation detection | pass |
| Key rotation/revocation | pass |
| External reproduction | pass |

## Claim policy

`peers>0`, same-operator replicas, CI simulations, witness nodes or a four-process local cluster must never be presented as proof of decentralized consensus. ZORYQ may claim multi-operator decentralization only when the acceptance matrix is satisfied with independently controlled, externally verifiable evidence.