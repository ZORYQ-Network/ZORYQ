import { createPublicClient, defineChain, http, formatEther } from 'viem';

const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] } },
  testnet: true,
});

const client = createPublicClient({ chain: zoryq, transport: http() });
const dex = '0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156';
const abi = [{
  type: 'function', name: 'reserves', stateMutability: 'view', inputs: [],
  outputs: [
    { name: 'zqReserve', type: 'uint256' },
    { name: 'tokenReserve', type: 'uint256' }
  ]
}];

const [zqReserve, zUsdReserve] = await client.readContract({ address: dex, abi, functionName: 'reserves' });
console.log({ ZQ: formatEther(zqReserve), zUSD: formatEther(zUsdReserve) });
