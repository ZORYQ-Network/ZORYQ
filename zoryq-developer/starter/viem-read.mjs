import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] }
  },
  blockExplorers: {
    default: { name: 'ZORYQ Explorer', url: 'https://zoryq-evm-node-live-production.up.railway.app/explorer' }
  },
  testnet: true
});

const client = createPublicClient({ chain: zoryq, transport: http() });

const [chainId, blockNumber] = await Promise.all([
  client.getChainId(),
  client.getBlockNumber()
]);

console.log({ chainId, blockNumber: blockNumber.toString() });
