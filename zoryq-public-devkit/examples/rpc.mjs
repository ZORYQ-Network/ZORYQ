import { createPublicClient, defineChain, http } from 'viem';

const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] } },
  blockExplorers: { default: { name: 'ZORYQ Explorer', url: 'https://zoryq-evm-node-live-production.up.railway.app/explorer' } },
  testnet: true,
});

const client = createPublicClient({ chain: zoryq, transport: http() });
console.log({ chainId: await client.getChainId(), blockNumber: (await client.getBlockNumber()).toString() });
