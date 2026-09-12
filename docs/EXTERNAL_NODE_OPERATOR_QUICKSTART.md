# ZORYQ External Node Operator Quickstart

> Status: testnet/operator onboarding. This guide does **not** claim decentralization or mainnet readiness.

## Objective

Make the next external contribution measurable: an independently controlled operator runs a ZORYQ peer, connects to the canonical public testnet, survives restart, and publishes a non-secret evidence bundle that can later feed the multi-operator gate.

## Trust boundary

For evidence to count as **independent**, the operator must control their own infrastructure/account and P2P identity. A second process controlled by the ZORYQ core operator is useful for networking tests but does not satisfy independent-operator evidence.

Never publish a mnemonic, private key, keystore password, JWT secret, seed phrase, API token, or Railway/provider secret.

## Required observations

Record only non-secret evidence:

- UTC observation time
- chain ID
- canonical genesis SHA-256
- software commit SHA
- operator ID chosen by the external operator
- region/provider class (provider name is optional)
- P2P node ID / public peer endpoint
- non-secret host fingerprint
- peer count
- head height
- finalized height/hash when supported by the runtime
- common checkpoint hash
- restart/rejoin result and recovery seconds

## Acceptance path

1. Build/run the canonical ZORYQ node from a pinned public commit.
2. Use an empty, persistent data directory unique to this operator.
3. Confirm the expected chain ID/genesis before enabling peering.
4. Connect to the canonical bootnode/static peer published by ZORYQ.
5. Observe `peerCount >= 1` on both sides.
6. Leave the peer connected long enough to demonstrate stable head convergence.
7. Restart the external node without deleting state.
8. Prove automatic rejoin and convergence.
9. Record the evidence fields above in JSON.
10. Publish the evidence without secrets and link the exact commit/runtime version used.

## Evidence template

```json
{
  "evidenceClass": "TESTNET_EXTERNAL_OPERATOR",
  "productionEvidence": false,
  "synthetic": false,
  "operatorControlledByCoreTeam": false,
  "observedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "chainId": 5919065,
  "genesisSha256": "<sha256>",
  "softwareCommit": "<40-char commit>",
  "operatorId": "<operator-chosen-id>",
  "region": "<region>",
  "p2pNodeId": "<public p2p id>",
  "hostFingerprint": "<non-secret sha256 fingerprint>",
  "peerCount": 1,
  "headHeight": 0,
  "finalizedHeight": 0,
  "finalizedHash": "0x...",
  "restartRecoverySeconds": 0,
  "notes": "External testnet operator evidence; not mainnet evidence."
}
```

## Claim gate

One external peer is a major testnet milestone, but it is **not** enough for ZORYQ to claim a decentralized or mainnet-ready network. The current production multi-operator gate requires at least four independent operators/nodes, three regions, unique host/P2P identities, registry-bound Ed25519 attestations, peer count >= 3 per node, common finalized checkpoints, and passed producer-loss, partition-recovery, and restart-recovery tests.

## External contributor success condition

A new operator who has never administered ZORYQ before can follow public documentation, join the testnet, produce a reproducible evidence JSON, restart/rejoin successfully, and have the result independently verified by another party.
