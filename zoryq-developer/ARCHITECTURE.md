# ZORYQ Architecture — Current vs Target

This document intentionally separates what exists today from what ZORYQ is targeting. A roadmap item must never be described as live infrastructure before it is deployed and independently verified.

## Current public testnet

### Network

- EVM-compatible public test environment
- Chain ID: `5919065` (`0x5a5159`)
- Native test asset: `ZQ`, 18 decimals
- Public RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet`
- Current consensus/maturity label: **centralized testing environment**

### Public product surfaces

- Start/onboarding
- Faucet
- Explorer
- Developer portal
- Stake UI
- Swap / DEX transition UI
- Lending UI gated until contract deployment
- Genesis Intelligence
- Machine-readable agent context and schemas

### Deployed testnet primitives

See `contracts/testnet.json` for the status registry. The current Swap Lab is a fixed-quote testnet component and is not the DEX v1 AMM.

### Source-level / not yet deployed

- ZoryqDexV1
- ZoryqLendingLab
- ZoryqProjectRegistry
- Project Intelligence indexer
- Builder Reputation live scoring
- Multi-validator consensus

## Target architecture

```text
Users / Builders / AI Agents
            |
            v
+------------------------------+
| ZORYQ Developer Platform     |
| docs · SDK · templates       |
| manifests · actions · sim    |
+------------------------------+
            |
            v
+------------------------------+
| Wallet Permission Boundary   |
| preview · simulate · confirm |
+------------------------------+
            |
            v
+------------------------------+
| ZORYQ EVM Execution Layer    |
| contracts · tx · logs        |
+------------------------------+
      |             |
      |             +----------------------+
      v                                    v
Native Protocols                       Explorer / Indexing
DEX · Stake · Lending                  receipts · contracts
      |                                    |
      +----------------+-------------------+
                       v
              Genesis Intelligence
        wallet · project · network signals
                       |
                       v
              Builder Reputation
          evidence-based · versioned
```

## Agent-native execution model

A ZORYQ-compatible agent should follow this path:

1. Read canonical network and contract registries.
2. Identify the intended action and target contract.
3. Build a human-readable transaction preview.
4. Run `eth_call` where applicable.
5. Run `eth_estimateGas`.
6. Surface target, calldata meaning, value, gas estimate and warnings.
7. Require explicit wallet confirmation.
8. Broadcast only through the user's wallet/signing boundary.
9. Verify the receipt and resulting state.
10. Link the result to Explorer and verifiable intelligence.

Agents must never request or store private keys or seed phrases.

## Project Intelligence target

A registered project will eventually declare its contracts through a versioned manifest. The indexer will then attribute only successful, verifiable activity to those contracts and derive:

- unique external wallets
- returning wallets / retention
- successful interactions
- first and last activity
- native protocol integrations
- DEX volume / protocol fees when measurable
- integrity flags
- Builder Reputation component scores

Self-attested social activity stays separate from verified Builder Reputation.

## Network evolution target

The largest infrastructure gap is consensus decentralization. The progression should be explicit:

1. single public testing node
2. persistent reproducible node lifecycle
3. independent validator/node process definition
4. multi-node network with deterministic peer discovery
5. validator set / consensus verification
6. failure, restart and partition testing
7. upgrade/governance procedure
8. public operator documentation and monitoring

Until steps 3–6 are implemented and independently verified, ZORYQ must continue to describe the network as centralized testing infrastructure.

## Engineering principles

- Evidence over marketing claims.
- Standard EVM compatibility before custom abstractions.
- Machine-readable metadata alongside human documentation.
- Simulation before signing.
- Explicit status for live, experimental, pending and roadmap components.
- No canonical contract address without on-chain verification.
- No finalized score until finalization exists on-chain.
- No decentralization claim without multi-node consensus evidence.
