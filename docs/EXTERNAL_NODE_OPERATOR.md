# ZORYQ External Node Operator Runbook

ZORYQ needs independent reproduction, not a second process controlled by the same operator. This runbook defines the evidence required for a real external Node 2.

## Current public network identity

- Network: ZORYQ Testnet
- Chain ID: `5919065`
- Compatibility target: EVM
- Public RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Public explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`

## Operator requirements

An independent operator must control its own host/account, storage, networking and node identity. Do not reuse ZORYQ infrastructure credentials, private keys, discovery secrets, wallets or operator mnemonics.

Recommended baseline:

- Linux host or VM controlled by the external operator
- Reth `v2.5.2` or the exact version documented by the current canonical node
- persistent storage sized for continued state growth
- TCP/UDP P2P port `30303` reachable as required by the deployment environment
- sufficient memory/CPU for stable Reth operation

## Chain-spec requirement

The external node must use the exact canonical ZORYQ chain specification used by the public testnet. A second node started with a different genesis is not evidence of multi-operator operation.

Before the public operator challenge is marked complete, publish a non-secret canonical chain-spec artifact plus its SHA-256 hash. Every operator reproduction must record the same hash.

## P2P configuration

The ZORYQ node image supports these environment variables:

- `ZORYQ_RETH_P2P_ADDR` — default `0.0.0.0`
- `ZORYQ_RETH_P2P_PORT` — default `30303`
- `ZORYQ_RETH_BOOTNODES` — comma-separated public enode URLs or ENRs
- `ZORYQ_RETH_TRUSTED_PEERS` — optional comma-separated public enode URLs or ENRs

These map to documented Reth networking options. Peer identities must be public node identities only; never publish P2P secret keys.

## Evidence gate: Node 2

The distributed-network milestone is complete only when an external operator publishes enough non-secret evidence to verify all of the following:

1. host/account is controlled independently from the ZORYQ primary operator;
2. exact chain-spec hash matches the canonical testnet artifact;
3. node uses a unique P2P identity;
4. Node 2 reaches the canonical chain and follows new blocks;
5. Node 1 and Node 2 show a real peer relationship;
6. at least one block/hash sample agrees across both nodes at the same height;
7. Node 2 can restart and recover from its own persistent state;
8. no ZORYQ private key, mnemonic, discovery secret or infrastructure credential was shared.

## Evidence to publish

Publish:

- UTC timestamp
- operator GitHub handle or organization
- hosting provider class or self-hosted statement (no private billing/account data)
- Reth version
- chain ID
- chain-spec SHA-256
- public node ID / ENR or enode where appropriate
- sampled block number + hash from Node 1 and Node 2
- peer count/status from each side
- restart/recovery confirmation
- known limitations

## Mainnet claim boundary

A successful Node 2 test is necessary but not sufficient for mainnet readiness. Mainnet still requires security review, production consensus/finality guarantees, key-management and signer separation, upgrade/governance controls, backup/recovery drills, capacity testing, observability, incident response and multiple independent operators.

## External developer path

After Node 2 is verified, the same external participant should attempt the developer funnel without private assistance:

`Docs → Faucet → First Transaction → First Contract → First Application`

Failures must be reported as evidence and fixed before the corresponding stage is promoted as stable.
