# External ZORYQ Node Operator Runbook

Status: **public testnet operator guide**. This document does not claim that ZORYQ is decentralized or mainnet-ready.

The goal is to let an operator who controls infrastructure independently from the primary ZORYQ operator reproduce the node path without receiving private keys, seed phrases, signing credentials, provider tokens or private infrastructure access.

## 1. Canonical network identity

- Network: ZORYQ EVM Testnet
- Chain ID: `5919065`
- Execution client baseline: Reth `2.5.2`
- Canonical repository: `https://github.com/ZORYQ-Network/ZORYQ`
- Research/testnet branch: `zoryq-evm-testnet-node`
- Public reference RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`

Before starting, independently inspect the repository and the chain specification. Do not accept a private replacement chain spec from another operator.

## 2. What an independent operator must control

Use infrastructure, storage and an operating account that are not administered by the primary ZORYQ operator.

You must generate/use your own P2P identity. Never request or reuse:

- a ZORYQ mnemonic or wallet private key;
- a discovery/P2P private key;
- a treasury or faucet signing key;
- Railway/Vercel/GitHub tokens;
- any primary-operator infrastructure credential.

## 3. Clone and build

```bash
git clone https://github.com/ZORYQ-Network/ZORYQ.git
cd ZORYQ
git checkout zoryq-evm-testnet-node
docker build -t zoryq-independent-node ./zoryq-evm-node
```

Record the checked-out commit:

```bash
git rev-parse HEAD
```

## 4. Persistent storage

Create operator-owned persistent storage:

```bash
docker volume create zoryq-independent-reth
```

Do not share the primary node's `/data` directory or database snapshot as proof of independent operation.

## 5. P2P bootstrap requirement

The node implementation accepts:

- `ZORYQ_RETH_BOOTNODES`
- `ZORYQ_RETH_TRUSTED_PEERS`

The external operator needs at least one **publicly reachable ZORYQ P2P bootstrap endpoint** in Reth-compatible enode/enr form.

**Current infrastructure blocker:** this runbook does not invent a bootstrap address. A primary-node public P2P endpoint must be published and reachable from the Internet before an outside operator can produce honest `peers > 0` evidence.

Until that endpoint is published and externally reachable, Node 2 remains **not verified**.

Once an official public bootstrap endpoint is available, set it explicitly:

```bash
export ZORYQ_BOOTNODE='<published-public-enode-or-enr>'
```

Never paste a private discovery key here.

## 6. Start the independent node

Use a fresh operator-owned mnemonic for the local dev/testnet node identity/state where required by the current Reth dev-mode implementation. Do not publish that mnemonic.

```bash
export ZORYQ_RETH_MNEMONIC='<your-own-private-testnet-mnemonic>'

docker run -d \
  --name zoryq-independent-node \
  -p 8080:8080 \
  -p 30303:30303/tcp \
  -p 30303:30303/udp \
  -v zoryq-independent-reth:/data \
  -e ZORYQ_RETH_MNEMONIC="$ZORYQ_RETH_MNEMONIC" \
  -e ZORYQ_RETH_BOOTNODES="$ZORYQ_BOOTNODE" \
  zoryq-independent-node
```

The current testnet implementation is a research/dev-mode architecture. Do not reuse these commands as a production mainnet deployment recipe.

## 7. Basic health checks

```bash
curl -fsS http://127.0.0.1:8080/health | jq
```

Expected network identity includes chain ID `5919065` and Reth as execution client.

Check RPC identity:

```bash
curl -sS http://127.0.0.1:8080/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | jq
```

Check peer count:

```bash
curl -sS http://127.0.0.1:8080/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"net_peerCount","params":[]}' | jq
```

A zero peer count does **not** satisfy the independent Node 2 evidence gate.

## 8. Machine-readable evidence collector

From the repository root, run:

```bash
export ZORYQ_NODE_RPC='http://127.0.0.1:8080/rpc'
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

It writes:

`zoryq-independent-node-evidence.json`

The JSON contains an evidence SHA-256 and no private key material.

## 9. Restart/persistence evidence

Record a first evidence file and the current head. Then hard-stop and recreate only the container while preserving the same volume:

```bash
docker rm -f zoryq-independent-node

# Re-run the docker run command from section 6 using the SAME operator-owned volume.
```

After health returns, run the evidence collector again.

For stronger evidence, publish both evidence JSON files plus:

- UTC timestamps;
- repository commit SHA;
- Docker image digest;
- pre-restart head number/hash;
- post-restart head number/hash;
- confirmation that the persistent volume was preserved;
- non-secret infrastructure description (for example, cloud/provider class and region, if the operator is comfortable publishing it).

Do not publish credentials, mnemonics, private IPs that are not intended to be public, or discovery private keys.

## 10. Full-resync evidence

A stronger independent-operator test deletes the operator's own local database and performs a clean synchronization/bootstrap using only public network information.

Do this only after the public P2P bootstrap path is working. Record duration and resulting canonical block/hash, but do not interpret one successful resync as proof of decentralization or fault tolerance.

## 11. Definition of done for Node 2

Node 2 may be marked externally verified only when all are true:

- the operator is independent from the primary ZORYQ infrastructure/admin domain;
- the operator used no primary private credentials;
- chain ID and genesis match;
- P2P peer count is greater than zero;
- at least one canonical block hash matches the public reference at the same height;
- persistent restart evidence is published;
- operator evidence is reproducible and contains a digest/commit reference.

Local CI containers, a second service controlled by the same ZORYQ administrator, or a second Railway account controlled by the same person do not satisfy this definition.

## 12. Current blocker and next infrastructure action

The remaining primary-side requirement is to expose and publish a stable, Internet-reachable Reth P2P endpoint (TCP/UDP as required by Reth discovery/networking) and its public enode/enr without exposing its private discovery key.

Until that is completed and an outside operator connects successfully, the honest status remains:

**Independent Node 2: NOT VERIFIED.**
