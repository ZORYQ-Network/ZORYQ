# ZORYQ Testnet Genesis Freeze and Node Bootstrap Runbook

Purpose: make the existing live testnet reproducible for additional nodes **without changing the live genesis** and without copying Node 1's mnemonic/private keys.

## Non-negotiable rules

- Node 2/3 must use the exact effective genesis of the live chain.
- Never copy `/data/zoryq-reth-mnemonic.txt` to another node.
- Every node must have its own data directory and P2P identity.
- Do not regenerate or edit allocations after the chain is live.
- Compare SHA-256 before a new node starts.

## Export on the canonical node

The live entrypoint sets the effective chain spec to:

`/data/zoryq-reth-effective-genesis.json`

On Node 1, create a read-only export and digest:

```bash
set -euo pipefail
src=/data/zoryq-reth-effective-genesis.json
out=/data/zoryq-testnet-frozen-genesis.json
[ -s "$src" ]
cp "$src" "$out"
chmod 0444 "$out"
sha256sum "$out" | tee /data/zoryq-testnet-frozen-genesis.sha256
```

Record the digest together with chain ID `5919065`, the source deployment ID and export timestamp. The mnemonic is not part of this package.

## Validate the exported bundle

```bash
set -euo pipefail
cd /data
sha256sum -c zoryq-testnet-frozen-genesis.sha256
node -e "const g=require('./zoryq-testnet-frozen-genesis.json'); if(Number(g.config?.chainId)!==5919065) process.exit(1); console.log('chainId OK')"
```

Do not start the new node if either check fails.

## Node 2 bootstrap contract

Node 2 must receive only:

- frozen genesis JSON;
- expected SHA-256;
- chain ID;
- deterministic bootnode/trusted-peer information;
- its own persistent volume;
- its own P2P secret/identity generated on Node 2 or by an approved secret manager.

It must **not** receive Node 1's mnemonic, faucet operator secret, relayer private key or P2P private key.

## Acceptance checks for a new node

A new node is not counted as redundancy until all checks pass:

1. local genesis SHA-256 equals Node 1 frozen genesis SHA-256;
2. chain ID is `5919065`;
3. independent persistent data directory is in use;
4. independent P2P identity is in use;
5. Node 1 and Node 2 report `peerCount > 0` after deterministic peering is configured;
6. Node 2 reaches the same canonical block hash at an agreed height;
7. Node 2 survives restart with its own volume intact;
8. controlled Node 1 interruption does not corrupt Node 2;
9. recovery evidence is retained.

## Mainnet note

This process improves testnet reproducibility only. Mainnet requires a separately frozen genesis, distinct chain ID, production consensus, external signer custody, independent audit, recovery evidence and the other fail-closed requirements enforced by `mainnet-guard.mjs`.
