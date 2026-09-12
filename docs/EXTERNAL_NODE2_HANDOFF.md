# ZORYQ Independent Node 2 Handoff

Status: external-operator protocol. This document defines what must be true before Node 2 is counted as independently operated. It does not by itself prove independence.

## Goal

Transfer operation of the second non-dev ZORYQ node to a person or organization that controls its own infrastructure, account, persistent storage and node identity, without receiving ZORYQ private signing material or privileged infrastructure credentials.

## Required operator boundary

The Node 2 operator must control:

- its own cloud/server account or physical host;
- its own billing/control plane;
- its own persistent disk;
- its own SSH/admin credentials;
- its own EL and CL P2P identities;
- its own monitoring endpoint or exported evidence;
- any validator/signing material assigned to it, generated and stored outside the ZORYQ repository.

The following do **not** count as independent operation:

- another service under the same primary ZORYQ cloud account;
- another process/container on the same host;
- credentials supplied by the primary ZORYQ operator;
- a shared disk or copied node identity;
- a node started with a ZORYQ-controlled private key or mnemonic;
- a temporary peer connection with no restart/rejoin evidence.

## Public artifacts ZORYQ may provide

Only non-secret bootstrap material may be handed to the operator:

1. exact release/commit SHA;
2. execution + consensus client versions or image digests;
3. canonical EL genesis/config artifact and SHA-256;
4. canonical CL network config/genesis artifact and SHA-256;
5. bootnode ENR/enode/public P2P coordinates;
6. chain/network identifiers;
7. required TCP/UDP ports;
8. startup commands/templates with all secret fields represented as local placeholders;
9. health/convergence verification commands;
10. expected evidence schema.

Do not transmit private validator keys, seed phrases, treasury keys, faucet signing keys, CI tokens, cloud credentials or another operator's JWT secret.

## Operator bootstrap

The external operator should:

1. provision a clean host/account under its own control;
2. create persistent EL and CL data directories;
3. verify published config/genesis hashes before first start;
4. generate its local Engine API JWT secret on the host and mount it only into its paired Reth/Lighthouse processes;
5. start Reth without `--dev` or any `--dev.*` flag;
6. start Lighthouse against the local authenticated Engine API endpoint;
7. establish P2P connectivity using published bootstrap data;
8. expose only the public surfaces intentionally required; Engine API must remain private;
9. wait until both EL head and CL finalized checkpoints converge with the reference network.

## Required evidence

### A. Control boundary

Publish a signed statement or GitHub comment containing only non-sensitive facts:

- operator GitHub/account identity;
- provider/host class (provider name is enough; no account IDs or IPs required if the operator prefers not to publish them);
- confirmation that billing/control plane is not controlled by the primary ZORYQ operator;
- confirmation that persistent disks and node identities are independently generated/controlled.

### B. Chain identity

Record:

- release/commit SHA;
- EL genesis/config SHA-256;
- CL config/genesis SHA-256;
- chain/network ID;
- Reth version;
- Lighthouse version.

### C. Live convergence

At one UTC timestamp, capture from Node 1 and Node 2:

- EL block number;
- EL block hash for the same block number;
- CL head slot;
- finalized epoch/root;
- EL/CL peer counts.

Success requires matching canonical EL block hash and compatible finalized checkpoint evidence.

### D. Restart/rejoin

1. record pre-restart head/finality;
2. stop Node 2 cleanly;
3. restart from the same persistent storage without replacing node identity;
4. prove that it rejoins peers;
5. prove that it catches up to the canonical EL head and CL finalized checkpoint;
6. record elapsed recovery time as a measurement, not an SLA claim.

### E. Outage recovery

After the two-node prototype is stable, perform one controlled Node 2 outage long enough to miss blocks/slots, then restore it and prove canonical convergence. Do not run destructive fault injection against a production/mainnet network.

## Evidence JSON shape

```json
{
  "schema": "zoryq-independent-node2/1.0",
  "operator": {
    "github": "external-operator",
    "independentControlBoundary": true
  },
  "release": {
    "commit": "<sha>",
    "reth": "<version>",
    "lighthouse": "<version>",
    "elGenesisSha256": "<sha256>",
    "clGenesisSha256": "<sha256>"
  },
  "live": {
    "utc": "<timestamp>",
    "blockNumber": 0,
    "blockHashNode1": "0x...",
    "blockHashNode2": "0x...",
    "finalizedEpochNode1": "0",
    "finalizedEpochNode2": "0",
    "peers": {
      "node1": {"el": 0, "cl": 0},
      "node2": {"el": 0, "cl": 0}
    }
  },
  "restart": {
    "samePersistentState": true,
    "sameNodeIdentity": true,
    "rejoined": true,
    "canonicalAfterRestart": true,
    "recoverySeconds": 0
  }
}
```

## Green gate

Node 2 becomes green only when all are true:

- independent control boundary is credible and publicly attested;
- non-dev EL/CL pair is running;
- config/genesis hashes match the canonical network;
- P2P identities and storage are independently controlled;
- canonical convergence is demonstrated;
- restart/rejoin succeeds from persistent state;
- no secret or privileged bypass was supplied;
- evidence is linked from the repository/issue tracking the milestone.

Even then, this is evidence of an independent second operator, not proof of broad decentralization or mainnet readiness.
