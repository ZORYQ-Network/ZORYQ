# ZORYQ Public P2P Bootstrap Deployment Gate

Status: **research/testnet deployment plan**. This document defines evidence required before ZORYQ may publish a public P2P bootstrap endpoint. It does not claim that one already exists.

## Objective

Provide a stable, Internet-reachable, P2P-enabled Reth follower that can act as the first public static peer for independently operated ZORYQ testnet nodes while leaving the current dev-mode sequencer unchanged.

Target topology:

```text
current ZORYQ dev sequencer / public RPC
                 |
                 | RPC-consensus research feed
                 v
      dedicated non-dev Reth follower
      persistent P2P identity + database
                 |
                 | public RLPx TCP / static enode
                 v
          independent Node 2
```

The dedicated follower is **not** a validator and does not make ZORYQ decentralized. It is a bootstrap/follower component for public testnet research.

## Preconditions

Do not deploy or advertise the public bootstrap until all are true:

1. `ZORYQ P2P Follower Evidence` passes with two non-dev Reth followers;
2. both followers report `net_peerCount > 0`;
3. both followers track a canonical block hash equal to the reference sequencer at the same height;
4. the evidence artifact contains a SHA-256 digest and conservative claim boundary;
5. the follower startup mode does not use `--dev`.

## Deployment isolation

The public bootstrap must be a **separate service** from the current block-producing dev sequencer.

Requirements:

- Reth `2.5.2` baseline while the research gate uses that version;
- exact ZORYQ chain specification for chain ID `5919065`;
- operator-owned persistent `/data` volume;
- stable Reth node key/P2P identity stored only in that volume;
- no wallet mnemonic, treasury key, faucet key or application signing key;
- non-dev Reth process;
- RPC-consensus source set to the public ZORYQ reference RPC;
- public RLPx TCP endpoint;
- HTTP RPC restricted or minimally exposed; never expose privileged namespaces publicly by default;
- no change to the existing sequencer until the follower path is proven independently.

## Baseline follower command

Conceptual command used by the dedicated service:

```bash
reth node \
  --chain /app/zoryq-reth-genesis.json \
  --datadir /data/reth \
  --addr 0.0.0.0 \
  --port 30303 \
  --network-id 5919065 \
  --http \
  --http.addr 0.0.0.0 \
  --http.port 8545 \
  --http.api eth,net,web3 \
  --debug.rpc-consensus-url https://zoryq-evm-node-live-production.up.railway.app/rpc
```

`--debug.rpc-consensus-url` is a research/testing mechanism. Passing this gate does not establish a production consensus architecture.

## Static TCP peering first

Reth supports direct trusted peers via an `enode://...@host:port` identity. The first external Node 2 evidence may therefore use a verified static RLPx TCP peer before public discovery is treated as a separate requirement.

Do not claim public discovery support merely because static TCP peering works.

Discovery v4/v5 and UDP reachability should have their own follow-up evidence gate if/when enabled.

## Public identity publication

Only publish the public peer identity after reachability has been tested from outside the primary infrastructure domain.

Allowed publication:

```text
enode://<PUBLIC_NODE_ID>@<PUBLIC_HOST>:<PUBLIC_TCP_PORT>
```

Never publish:

- the node-key private key;
- wallet private keys or mnemonic;
- cloud/provider credentials;
- internal/private management endpoints;
- database snapshots containing private application data.

## Internet reachability gate

A primary-side test is not enough. Before adding the enode to `docs/EXTERNAL_NODE_OPERATOR.md`, collect evidence from a network outside the primary service/container network showing:

1. DNS/host resolves as expected where applicable;
2. the advertised TCP port is reachable;
3. a fresh Reth follower can establish an RLPx session with the advertised enode;
4. `net_peerCount > 0`;
5. chain ID is `5919065`;
6. genesis matches;
7. at least one canonical block hash at the same height matches the public reference RPC.

## Persistence gate

Restart/redeploy the dedicated follower while preserving its volume and verify:

- P2P identity remains stable;
- chain database remains usable;
- follower resumes canonical tracking;
- external static peer can reconnect;
- evidence before/after restart includes timestamps and hashes.

A regenerated public node ID after every deployment is a failure for a published static bootstrap identity.

## Independent Node 2 gate

Only after the public bootstrap passes the Internet reachability and persistence gates should an external operator use `docs/EXTERNAL_NODE_OPERATOR.md`.

Independent Node 2 remains **NOT VERIFIED** until an operator outside the primary ZORYQ administration domain publishes reproducible evidence satisfying Issue #73.

## Claim boundaries

Even after this bootstrap is online, allowed claims are limited to facts actually demonstrated, for example:

- a public P2P-enabled ZORYQ testnet follower exists;
- an external operator established a direct RLPx peer session;
- an external follower reproduced chain identity and canonical block evidence.

Do not infer or claim from those facts alone:

- decentralized consensus;
- validator independence;
- Byzantine fault tolerance;
- production-grade finality;
- mainnet readiness;
- audited security;
- censorship resistance.
