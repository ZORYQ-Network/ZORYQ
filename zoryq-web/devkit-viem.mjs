import { createPublicClient, defineChain, http } from 'https://esm.sh/viem@2';

export const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] } },
  blockExplorers: { default: { name: 'ZORYQ Explorer', url: 'https://zoryq-evm-node-live-production.up.railway.app/explorer' } },
  testnet: true,
});

const client = createPublicClient({ chain: zoryq, transport: http() });
console.log('ZORYQ chainId', await client.getChainId());
console.log('Latest block', (await client.getBlockNumber()).toString());
