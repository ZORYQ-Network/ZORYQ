# Build on ZORYQ

ZORYQ EVM Testnet is the base infrastructure for builders to deploy and test EVM applications.

> Testnet only. ZQ, zUSD and Testnet points have no monetary value or guaranteed future rights.

## Network

| Setting | Value |
|---|---|
| Network | ZORYQ EVM Testnet |
| Chain ID | `5919065` |
| Hex Chain ID | `0x5a5159` |
| CAIP-2 | `eip155:5919065` |
| Native currency | `ZQ` (18 decimals) |
| RPC | `https://zoryq-evm-node-live-production.up.railway.app/rpc` |
| Explorer | `https://zoryq-evm-node-live-production.up.railway.app/explorer` |
| Faucet | `https://zoryq-evm-node-live-production.up.railway.app/faucet` |

## Builder path

1. Add ZORYQ to MetaMask, Rabby or another EVM wallet.
2. Claim test ZQ from the faucet.
3. Connect with ethers, viem, Foundry or Hardhat.
4. Deploy a Solidity contract.
5. Inspect the address, transaction and blocks in Explorer.
6. Integrate ZORYQ-native primitives such as Swap/DEX, Stake and Genesis where useful.
7. Publish verifiable Testnet usage rather than unverifiable claims.

## ethers v6

```js
import { JsonRpcProvider } from 'ethers';

const rpc = 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const provider = new JsonRpcProvider(rpc, 5919065);
console.log(await provider.getBlockNumber());
```

## viem

```ts
import { createPublicClient, defineChain, http } from 'viem';

const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] } }
});

const client = createPublicClient({ chain: zoryq, transport: http() });
console.log(await client.getBlockNumber());
```

## Foundry

```bash
export ZORYQ_RPC=https://zoryq-evm-node-live-production.up.railway.app/rpc
forge create src/MyContract.sol:MyContract \
  --rpc-url $ZORYQ_RPC \
  --private-key $TESTNET_PRIVATE_KEY
```

Use a disposable Testnet deployer. Never commit a private key or mnemonic.

## JSON-RPC compatibility target

The public gateway is intended to expose standard Ethereum methods including `eth_chainId`, `net_version`, `eth_blockNumber`, `eth_getBalance`, `eth_getCode`, `eth_call`, `eth_estimateGas`, `eth_getLogs`, `eth_sendRawTransaction`, and `eth_getTransactionReceipt`. Administrative namespaces are blocked publicly.

## Native ecosystem

- Faucet — test gas distribution
- Explorer — inspect blocks, transactions and addresses
- ZORYQ DEX — native testnet liquidity and swaps; DEX v1 source is being validated before deployment
- Stake — native ZQ staking lab
- Lending — testnet lending lab under validation before deployment
- Genesis — participation and verifiable activity layer
- Validator tooling — experimental node participation tooling

## Current security/consensus status

ZORYQ EVM Testnet is currently a centralized public testing environment. It must not be represented as a decentralized or production-ready consensus network. Multi-validator consensus, production treasury controls, bridge infrastructure and production-grade protocol contracts remain explicit roadmap/security gates.

## Builder principles

- EVM compatibility first.
- No hidden wallet custody.
- Verifiable on-chain evidence over vanity metrics.
- Testnet contracts are not automatically production-safe.
- Production treasury/fee controls should migrate to multisig and audited contracts.
