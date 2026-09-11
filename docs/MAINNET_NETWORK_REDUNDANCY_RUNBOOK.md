# ZORYQ Mainnet Network Redundancy Runbook

Status: pre-mainnet control document. This runbook does **not** assert mainnet readiness.

## Current testnet constraint

The current Railway execution node starts Reth with `--dev`. Reth dev mode uses a local proof-of-authority engine and disables network discovery. It is therefore a single-node development/test configuration, not a production multi-node consensus topology.

Do not create additional `--dev` producers and count them as redundancy: independent local miners can diverge and would not prove production consensus safety.

## Exit criteria for the single-node blocker

All items below must be satisfied with machine-verifiable or operator-verifiable evidence before `ZORYQ_MAINNET_REDUNDANCY_READY=true` is permitted:

1. **Production consensus selected and documented**
   - No `--dev` or embedded dev mnemonic.
   - Consensus/finality model documented, version-pinned, and covered by `ZORYQ_MAINNET_CONSENSUS_EVIDENCE_PATH`.

2. **At least three independently stateful nodes**
   - Separate persistent data volumes.
   - Stable node identities/keys.
   - At least two failure domains. Mainnet target should use independent providers/regions where practical; replicas inside one Railway region are not sufficient evidence by themselves.

3. **P2P bootstrap is deterministic**
   - Bootnodes/static trusted peers are configured explicitly.
   - P2P identity survives restart.
   - Peer-count and sync-lag metrics are observable.
   - Public RPC exposure is separate from privileged/admin/engine interfaces.

4. **Failure testing is completed**
   - Stop one non-critical peer: remaining nodes stay synchronized.
   - Restart a node from persistent state: it rejoins without chain reset.
   - Start a clean observer/full node from the frozen genesis plus approved bootstrap configuration: it reaches canonical head.
   - Simulate loss of one failure domain and record recovery behavior.

5. **Backup/restore is proven**
   - Backup procedure documents what is backed up, consistency boundary, encryption and retention.
   - Restore is performed into a clean environment.
   - Restored node is verified against canonical block hashes/state roots before it is trusted.

6. **Evidence is bound to the launch manifest**
   - Produce a non-empty redundancy evidence artifact.
   - Produce a non-empty disaster-recovery evidence artifact.
   - Hash each artifact with SHA-256.
   - Put hashes in the launch manifest fields `redundancyEvidenceSha256` and `recoveryEvidenceSha256`.
   - Set the corresponding readiness variables only after human review of the evidence.

## Required mainnet guard variables

- `ZORYQ_MAINNET_REDUNDANCY_READY=true`
- `ZORYQ_MAINNET_REDUNDANCY_EVIDENCE_PATH=/path/to/redundancy-evidence.json`
- `ZORYQ_MAINNET_RECOVERY_READY=true`
- `ZORYQ_MAINNET_RECOVERY_EVIDENCE_PATH=/path/to/recovery-evidence.json`

These controls are additional to external signer/key custody, production consensus, security audit, incident runbook, frozen genesis, distinct mainnet chain ID and launch-manifest requirements.

## Suggested redundancy evidence schema

```json
{
  "network": "zoryq-mainnet-candidate",
  "testedAt": "ISO-8601 timestamp",
  "genesisSha256": "...",
  "clientVersion": "...",
  "nodes": [
    {
      "role": "bootnode-or-fullnode",
      "failureDomain": "provider/region identifier",
      "persistentState": true,
      "stableP2pIdentity": true
    }
  ],
  "tests": {
    "peerConnectivity": "pass",
    "singleNodeFailure": "pass",
    "cleanSync": "pass",
    "restartFromPersistentState": "pass",
    "crossFailureDomain": "pass"
  }
}
```

## Suggested recovery evidence schema

```json
{
  "testedAt": "ISO-8601 timestamp",
  "backupId": "non-secret identifier",
  "encrypted": true,
  "restoreIntoCleanEnvironment": "pass",
  "canonicalHeadVerified": "pass",
  "stateVerification": "pass",
  "rpo": "measured value",
  "rto": "measured value"
}
```

Never store private validator/signer keys, mnemonics, seed phrases or raw secrets in these evidence files or in GitHub.
