# External ZORYQ Node Operator Runbook

Status: **public testnet operator guide**. This document does not claim that ZORYQ is decentralized, production-ready or mainnet-ready.

The goal is to let an operator who controls infrastructure independently from the primary ZORYQ operator reproduce the follower path without receiving private keys, seed phrases, signing credentials, provider tokens or private infrastructure access.

## 1. Canonical network identity

- Network: ZORYQ EVM Testnet
- Chain ID: `5919065`
- Execution client baseline: Reth `2.5.2`
- Canonical repository: `https://github.com/ZORYQ-Network/ZORYQ`
- Research/testnet branch: `zoryq-evm-testnet-node`
- Public reference RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`

Before starting, independently inspect the repository and chain specification. Do not accept a private replacement chain spec from another operator.

## 2. Independence requirements

Use infrastructure, storage and an operating account that are not administered by the primary ZORYQ operator.

Generate and keep your own P2P identity. Never request or reuse:

- a ZORYQ wallet mnemonic/private key;
- a discovery/P2P private key from another operator;
- a treasury or faucet signing key;
- Railway/Vercel/GitHub tokens;
- any primary-operator infrastructure credential.

A second container, service or cloud account controlled by the same ZORYQ administrator does **not** satisfy the independent Node 2 gate.

## 3. Clone and build

```bash
git clone https://github.com/ZORYQ-Network/ZORYQ.git
cd ZORYQ
git checkout zoryq-evm-testnet-node
git rev-parse HEAD
docker build -t zoryq-independent-node ./zoryq-evm-node
```

Record the checked-out commit SHA and Docker image digest in your evidence.

## 4. Persistent storage

```bash
docker volume create zoryq-independent-reth
```

Do not share the primary node's `/data` directory or database snapshot as proof of independent operation.

## 5. Why the external node must NOT use `--dev`

The current primary testnet sequencer uses Reth development mode to produce blocks. Reth dev mode disables normal P2P networking, so it is **not** the correct execution mode for an independent follower.

The external operator path is therefore a **non-dev Reth follower** that:

1. loads the same ZORYQ chain spec;
2. follows the public canonical source through Reth's RPC-consensus research path;
3. keeps Reth P2P networking enabled;
4. connects to at least one published, publicly reachable ZORYQ P2P bootstrap peer.

This is still research/testnet architecture. It is not a production consensus design.

## 6. Public P2P bootstrap requirement

The operator needs at least one **publicly reachable ZORYQ P2P endpoint** in Reth-compatible `enode://` or ENR form.

**Current blocker:** an Internet-reachable bootstrap identity has not yet been externally verified. Do not invent one.

Once ZORYQ publishes a verified bootstrap address:

```bash
export ZORYQ_BOOTNODE='<published-public-enode-or-enr>'
```

Never paste a private discovery key into commands, issues or evidence files.

## 7. Start the P2P-enabled follower

The image contains Reth and the canonical ZORYQ chain spec. Start Reth directly so the container entrypoint does not switch back to dev-mode sequencing.

```bash
docker run -d \
  --name zoryq-independent-node \
  -p 8545:8545 \
  -p 30303:30303/tcp \
  -p 30303:30303/udp \
  -v zoryq-independent-reth:/data \
  zoryq-independent-node \
  reth node \
    --chain /app/zoryq-reth-genesis.json \
    --datadir /data/reth \
    --addr 0.0.0.0 \
    --port 30303 \
    --network-id 5919065 \
    --trusted-peers "$ZORYQ_BOOTNODE" \
    --http \
    --http.addr 0.0.0.0 \
    --http.port 8545 \
    --http.api eth,net,web3 \
    --debug.rpc-consensus-url https://zoryq-evm-node-live-production.up.railway.app/rpc
```

The follower creates its own local Reth P2P identity in its operator-owned datadir. No ZORYQ mnemonic is required for this follower path.

For stronger operational isolation, restrict public access to port 8545 or place RPC behind your own gateway. Do not expose `admin` or `debug` namespaces publicly unless you intentionally control access.

## 8. Basic verification

Check chain identity:

```bash
curl -sS http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | jq
```

Expected result: hexadecimal chain ID for decimal `5919065`.

Check client identity:

```bash
curl -sS http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"web3_clientVersion","params":[]}' | jq
```

Check P2P peer count:

```bash
curl -sS http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"net_peerCount","params":[]}' | jq
```

`0x0` does **not** satisfy the independent Node 2 evidence gate.

## 9. Machine-readable evidence collector

From the repository root:

```bash
export ZORYQ_NODE_RPC='http://127.0.0.1:8545'
export ZORYQ_REFERENCE_RPC='https://zoryq-evm-node-live-production.up.railway.app/rpc'
export ZORYQ_OPERATOR_ID='<public-handle-or-neutral-operator-id>'

node zoryq-developer/verification/external-node-evidence.mjs
```

The collector fails closed unless it verifies:

1. chain ID `5919065`;
2. Reth client identity;
3. matching genesis hash;
4. `net_peerCount > 0` on the independent node;
5. a matching canonical block-number/hash sample between the independent node and the public reference RPC.

It writes `zoryq-independent-node-evidence.json` with an evidence SHA-256 and no private key material.

## 10. Persistence/restart evidence

Record an evidence file and current head, then destroy only the container while preserving the operator-owned volume:

```bash
docker rm -f zoryq-independent-node
```

Re-run the command from section 7 with the **same** volume, wait for the follower to resume, then run the evidence collector again.

For stronger evidence publish both JSON files plus:

- UTC timestamps;
- repository commit SHA;
- Docker image digest;
- pre-restart head number/hash;
- post-restart head number/hash;
- confirmation that the persistent volume was preserved;
- non-secret infrastructure description if desired.

Never publish credentials, private keys, private discovery material or a wallet seed phrase.

## 11. Full-resync evidence

A stronger independent-operator test deletes only the operator's own follower database and performs a clean bootstrap using public network information.

Do this only after the public P2P bootstrap path is externally reachable. Record duration and resulting canonical block/hash. One successful resync is evidence of reproducibility, not proof of decentralization or fault tolerance.

## 12. Definition of done for independent Node 2

Node 2 may be marked externally verified only when all are true:

- operator infrastructure/admin domain is independent from the primary ZORYQ operator;
- no primary private credentials were used;
- chain ID and genesis match;
- P2P peer count is greater than zero;
- at least one canonical block hash matches the public reference at the same height;
- persistent restart evidence is published;
- evidence includes a reproducible commit/build reference and digest.

Local CI peers prove implementation behavior only. They do **not** satisfy operator independence.

## 13. Current blocker

Primary-side work still required:

1. prove the non-dev P2P follower topology in CI;
2. expose a stable Internet-reachable Reth P2P bootstrap endpoint;
3. publish only its public enode/ENR identity;
4. have an outside operator reproduce the runbook and publish evidence.

Until those steps are complete:

**Independent Node 2: NOT VERIFIED.**
