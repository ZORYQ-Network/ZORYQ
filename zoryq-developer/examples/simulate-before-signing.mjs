import { JsonRpcProvider, Interface, formatEther } from 'ethers';

const RPC = 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const CHAIN_ID = 5919065;
const STAKE = '0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1';

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const stakeAbi = ['function stake() payable'];
const iface = new Interface(stakeAbi);

// Replace this with the connected wallet address in your app.
const from = process.env.ZORYQ_FROM;
const value = 1n * 10n ** 18n; // 1 test ZQ

if (!from || !/^0x[0-9a-fA-F]{40}$/.test(from)) {
  throw new Error('Set ZORYQ_FROM to a valid public wallet address. Never provide a private key.');
}

const tx = {
  from,
  to: STAKE,
  data: iface.encodeFunctionData('stake'),
  value
};

const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) {
  throw new Error(`Unexpected chain: ${network.chainId}`);
}

// eth_call checks whether the call would revert at the latest state.
await provider.call(tx);

// eth_estimateGas gives the wallet a gas estimate before any signing happens.
const gasEstimate = await provider.estimateGas(tx);

console.log(JSON.stringify({
  chainId: CHAIN_ID,
  target: STAKE,
  method: 'stake()',
  valueZQ: formatEther(value),
  estimatedGas: gasEstimate.toString(),
  simulation: 'passed',
  nextStep: 'Present this preview to the user and ask their wallet for explicit confirmation.'
}, null, 2));
