# Deploy on ZORYQ in under 5 minutes

ZORYQ EVM Testnet is compatible with standard Ethereum tooling.

> Testnet only. ZQ and zUSD have no monetary value.

## 1. Add the network

- Network: `ZORYQ EVM Testnet`
- Chain ID: `5919065`
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Native token: `ZQ`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet`

## 2. Get test ZQ

Open the faucet, connect an EVM wallet, complete the required anti-abuse step and claim test ZQ.

Never paste a seed phrase or private key into a website.

## 3. Deploy with Foundry

```bash
forge init hello-zoryq
cd hello-zoryq
```

Create `src/HelloZoryq.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HelloZoryq {
    string public message = "Hello ZORYQ";

    function setMessage(string calldata next) external {
        message = next;
    }
}
```

Build:

```bash
forge build
```

Deploy from your own wallet:

```bash
forge create src/HelloZoryq.sol:HelloZoryq \
  --rpc-url https://zoryq-evm-node-live-production.up.railway.app/rpc \
  --private-key "$DEPLOYER_PRIVATE_KEY"
```

Prefer hardware wallets, encrypted keystores or wallet-native signing for valuable keys. Never commit secrets.

## 4. Verify deployment

Copy the deployed contract address and open:

```text
https://zoryq-evm-node-live-production.up.railway.app/address/<CONTRACT_ADDRESS>
```

The transaction is available at:

```text
https://zoryq-evm-node-live-production.up.railway.app/tx/<TX_HASH>
```

## 5. Connect with viem

```ts
import { createPublicClient, defineChain, http } from 'viem';

export const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] }
  },
  blockExplorers: {
    default: {
      name: 'ZORYQ Explorer',
      url: 'https://zoryq-evm-node-live-production.up.railway.app/explorer'
    }
  },
  testnet: true
});

export const client = createPublicClient({
  chain: zoryq,
  transport: http()
});
```

## 6. Connect with ethers v6

```js
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider(
  'https://zoryq-evm-node-live-production.up.railway.app/rpc',
  5919065
);

console.log(await provider.getBlockNumber());
```

## Native protocol addresses

- DEX v1: `0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156`
- Lending: `0xA08d491c06a2B01bbe6866CA87302c794aD9fB77`
- Project Registry: `0x180042c92A42f183A67005E8C0968a1F190aab33`
- Stake: `0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1`
- zUSD: `0xd2121E96C6af936c0496fDB499c1D0613d26c2B9`

## Next

Use `/developer`, `/swap`, `/lending`, `/stake`, `/intelligence` and `/explorer` to move from first deployment to verifiable usage.
