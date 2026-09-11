# ZORYQ Network

**Experimental EVM-compatible public testnet for evidence-first Web3 engineering.**

ZORYQ exists to make blockchain engineering easier to inspect: developer-facing capabilities should be backed by working public surfaces, code, tests or reproducible evidence, while research ideas remain explicitly labeled as research.

> **Current stage:** active experimental development / centralized public testnet. ZQ has no monetary value. This repository does not claim production-mainnet readiness, audited security, decentralization, novel consensus or measured high performance unless linked evidence explicitly demonstrates it.

ZORYQ is researching **adaptive verifiable execution** — a blockchain architecture designed to dynamically handle different transaction workloads while preserving deterministic state. This is a research direction, not a proven performance capability.

## Start building

| Step | Public surface |
| --- | --- |
| Start | https://zoryq-evm-node-live-production.up.railway.app/start |
| Faucet | https://zoryq-evm-node-live-production.up.railway.app/faucet |
| Explorer | https://zoryq-evm-node-live-production.up.railway.app/explorer |
| RPC | https://zoryq-evm-node-live-production.up.railway.app/rpc |

### Network configuration

| Parameter | Value |
| --- | --- |
| Network | ZORYQ EVM Testnet |
| Chain ID | `5919065` |
| Chain ID (hex) | `0x5a5159` |
| Native symbol | `ZQ` |
| Decimals | `18` |

## Zero-to-build path

**Docs → Faucet → First transaction → First contract → First application → Contribution**

### 1. Verify the RPC

```bash
curl -s https://zoryq-evm-node-live-production.up.railway.app/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Expected chain identity: `5919065` (`0x5a5159`). A reproducible RPC compliance script is available at `zoryq-evm-node/scripts/rpc-compliance.mjs`.

### 2. Add ZORYQ to an EIP-1193 wallet

```js
await ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x5a5159',
    chainName: 'ZORYQ EVM Testnet',
    nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
    rpcUrls: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'],
    blockExplorerUrls: ['https://zoryq-evm-node-live-production.up.railway.app/explorer']
  }]
});
```

Never share or commit a private key, mnemonic or production credential.

### 3. Get test ZQ

Use the public faucet. ZQ is testnet-only and has no monetary value. Faucet access is subject to anti-abuse controls.

### 4. Verify activity

Use permanent Explorer routes where available:

```text
/tx/<transaction-hash>
/address/<wallet-or-contract-address>
/block/<block-number>
```

Explorer metadata must not be described as EIP-3091 compatible until those public permanent routes are verified live.

### 5. Connect with ethers v6

```js
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider(
  'https://zoryq-evm-node-live-production.up.railway.app/rpc',
  5919065
);

console.log(await provider.getNetwork());
console.log(await provider.getBlockNumber());
```

### 6. Connect with viem

```js
import { createPublicClient, defineChain, http } from 'viem';

const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] }
  }
});

const client = createPublicClient({ chain: zoryq, transport: http() });
console.log(await client.getBlockNumber());
```

### 7. Deploy a Solidity contract

Standard EVM tooling can target the testnet. Example with Foundry:

```bash
forge create src/MyContract.sol:MyContract \
  --rpc-url https://zoryq-evm-node-live-production.up.railway.app/rpc \
  --private-key "$DEPLOYER_PRIVATE_KEY"
```

Use a disposable testnet key and never commit it.

## EVM JSON-RPC compatibility

The public RPC is intended to work with standard EVM clients without proprietary adapters. Core methods currently exercised include:

- `eth_chainId`
- `net_version`
- `eth_blockNumber`
- `eth_getBalance`
- `eth_getTransactionReceipt`
- `eth_call`
- `eth_estimateGas`
- `eth_getLogs`
- `eth_sendRawTransaction`

Run the reproducible compliance script with Node.js 22+:

```bash
node zoryq-evm-node/scripts/rpc-compliance.mjs
```

## Evidence and research

ZORYQ separates implemented behavior from research hypotheses. Performance, finality, recovery or scalability claims should include methodology and reproducible artifacts before they are promoted as capabilities.

Relevant repository evidence includes:

- [`PROTOCOL.md`](PROTOCOL.md) and [`SPECIFICATION.md`](SPECIFICATION.md) — protocol/specification work;
- [`RESEARCH.md`](RESEARCH.md) and [`research/`](research/) — research process;
- [`BENCHMARKS.md`](BENCHMARKS.md) and [`benchmarks/`](benchmarks/) — benchmark methodology/evidence;
- [`SECURITY.md`](SECURITY.md) — security reporting;
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution workflow.

Any future TPS, latency, finality or recovery claim should identify the tested commit, hardware/environment, topology, workload, duration, raw output, methodology and limitations.

## Current architecture

```text
Wallets / ethers / viem / MetaMask / Rabby
                  |
                  v
          Public ZORYQ Gateway
                  |
         +--------+---------+
         |                  |
         v                  v
     EVM JSON-RPC       Web surfaces
       (Anvil)      Explorer / Faucet / Docs
         |
         v
 Persistent Railway volume
```

This is the current experimental testnet architecture, not evidence of decentralized validation or production-mainnet security. Railway currently provides infrastructure hosting. Infrastructure and protocol architecture are expected to evolve as independently reproducible node and protocol work matures.

## Genesis and identity

ZORYQ tracks testnet actions such as faucet use, swaps and stake operations. On-chain/server-verified actions are distinguished from social self-attestations. Social points are not represented as finalized on-chain proof until a verifiable finalization mechanism exists.

ENS identity support currently verifies an Ethereum Sepolia ENSv2 beta primary name by resolving reverse and forward records back to the same EVM address.

## ETHOnline 2026 development

For ETHOnline, new work is separated from pre-existing ZORYQ infrastructure. The planned demonstrable module is **ZORYQ Genesis Intelligence**: indexing and analytics for testnet wallets, contracts, Genesis actions, quests and network statistics, with The Graph as an essential data layer. Planned work is not represented as completed until evidence exists.

## Contribute

ZORYQ is open to contributors interested in EVM tooling, distributed systems, security, developer experience, reproducible benchmarking and blockchain research. Look for public issues labeled `good first issue` and `help wanted`.

Useful contributions include developer examples, failure-case tests, RPC compatibility checks, benchmark workloads, documentation improvements and falsifiable research experiments. Negative experimental results are useful when documented clearly.

## Security

- No private keys or mnemonic phrases belong in source control.
- Administrative Anvil/Hardhat RPC namespaces are blocked on the public gateway.
- Faucet access is rate-limited/cooldown-controlled.
- Testnet assets have no monetary value.
- This is not a mainnet security guarantee or audit.

## Engineering principles

- **Evidence first** — measured claims link to methodology and raw results.
- **Research is labeled** — hypotheses stay separate from implemented behavior.
- **Security before marketing** — critical risks block release claims.
- **Reproducibility** — another engineer should be able to rebuild a result.
- **Determinism before speed** — optimization cannot silently weaken correctness.
- **Failures are data** — known limitations and negative results are documented.

---

**ZORYQ Network — build it, test it, verify it.**
