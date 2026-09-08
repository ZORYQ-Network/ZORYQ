import { JsonRpcProvider, Contract, getAddress } from 'ethers';

const RPC = process.env.ZORYQ_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const CHAIN_ID = 5919065;
const SWAP_LAB = '0x8205f34b803edd79ddca414f00e12ecddeddacbe';
const STAKE = '0xbb26faadd1e083c7c0dc0a82ddb96cc45253ecb1';
const FAUCET = '0x0fb96a10a25499248ec7ce8b1fed3ff0307e2910';
const CLIENT_ZUSD = '0xd2121e96c6af936c0496fdb499c1d0613d26c2b9';
const HISTORICAL_ZUSD = '0x742227605af1839683a51a7b74b6eb2c75d37a3e';

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const lower = v => String(v || '').toLowerCase();
const checksum = v => getAddress(lower(v));

async function codeStatus(address) {
  const normalized = lower(address);
  const code = await provider.getCode(normalized);
  return { address: checksum(normalized), hasCode: code !== '0x', bytecodeBytes: code === '0x' ? 0 : (code.length - 2) / 2 };
}

async function tokenMetadata(address) {
  const normalized = lower(address);
  const code = await provider.getCode(normalized);
  if (code === '0x') return { address: checksum(normalized), hasCode: false };
  const c = new Contract(normalized, [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ], provider);
  const result = { address: checksum(normalized), hasCode: true };
  for (const [key, fn] of [['name','name'],['symbol','symbol'],['decimals','decimals'],['totalSupply','totalSupply']]) {
    try {
      const v = await c[fn]();
      result[key] = typeof v === 'bigint' ? v.toString() : v;
    } catch (e) {
      result[key] = null;
      result[`${key}Error`] = e?.shortMessage || e?.message || String(e);
    }
  }
  return result;
}

async function main() {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) throw new Error(`chain_id_mismatch:${network.chainId}`);

  const swap = new Contract(SWAP_LAB, ['function token() view returns (address)', 'function tokensPerZQ() view returns (uint256)'], provider);
  const swapToken = await swap.token();
  let tokensPerZQ = null;
  try { tokensPerZQ = (await swap.tokensPerZQ()).toString(); } catch {}

  const report = {
    checkedAt: new Date().toISOString(),
    rpc: RPC,
    chainId: Number(network.chainId),
    contracts: {
      faucet: await codeStatus(FAUCET),
      swapLab: { ...(await codeStatus(SWAP_LAB)), token: checksum(swapToken), tokensPerZQ },
      stake: await codeStatus(STAKE),
      clientConfiguredZUSD: await tokenMetadata(CLIENT_ZUSD),
      historicalZUSD: await tokenMetadata(HISTORICAL_ZUSD)
    },
    canonicality: {
      swapLabTokenMatchesClientConfig: lower(swapToken) === CLIENT_ZUSD,
      swapLabTokenMatchesHistorical: lower(swapToken) === HISTORICAL_ZUSD,
      swapLabToken: checksum(swapToken)
    }
  };

  console.log('ZORYQ_LIVE_CONTRACT_REPORT=' + JSON.stringify(report));
  console.log(JSON.stringify(report, null, 2));

  const required = [report.contracts.faucet, report.contracts.swapLab, report.contracts.stake];
  if (required.some(x => !x.hasCode)) throw new Error('required_contract_code_missing');
  if (!report.canonicality.swapLabTokenMatchesClientConfig) {
    throw new Error(`zusd_canonicality_mismatch:swapLab=${report.canonicality.swapLabToken}:client=${checksum(CLIENT_ZUSD)}`);
  }
  if (!report.contracts.clientConfiguredZUSD.hasCode) throw new Error('configured_zusd_code_missing');
}

main().catch(err => {
  console.error('ZORYQ_LIVE_CONTRACT_VERIFY_FAILED', err?.stack || err?.message || String(err));
  process.exit(1);
});
