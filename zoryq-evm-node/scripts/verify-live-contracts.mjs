import { JsonRpcProvider, Contract, getAddress } from 'ethers';

const BASE = process.env.ZORYQ_BASE || 'https://zoryq-evm-node-live-production.up.railway.app';
const RPC = process.env.ZORYQ_RPC || `${BASE}/rpc`;
const CHAIN_ID = 5919065;
const CHAIN_HEX = '0x5a5159';
const SWAP_LAB = '0x8205f34b803edd79ddca414f00e12ecddeddacbe';
const STAKE = '0xbb26faadd1e083c7c0dc0a82ddb96cc45253ecb1';
const HISTORICAL_FAUCET = '0x0fb96a10a25499248ec7ce8b1fed3ff0307e2910';
const CLIENT_ZUSD = '0xd2121e96c6af936c0496fdb499c1d0613d26c2b9';
const HISTORICAL_ZUSD = '0x742227605af1839683a51a7b74b6eb2c75d37a3e';
const CLIENT_TREASURY = '0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33';

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
    'function totalSupply() view returns (uint256)',
    'function owner() view returns (address)'
  ], provider);
  const result = { address: checksum(normalized), hasCode: true };
  for (const [key, fn] of [['name','name'],['symbol','symbol'],['decimals','decimals'],['totalSupply','totalSupply'],['owner','owner']]) {
    try {
      const v = await c[fn]();
      result[key] = key === 'owner' ? checksum(v) : typeof v === 'bigint' ? v.toString() : v;
    } catch (e) {
      result[key] = null;
      result[`${key}Error`] = e?.shortMessage || e?.message || String(e);
    }
  }
  return result;
}

async function faucetStatus() {
  try {
    const r = await fetch(`${BASE}/faucet/status`, { headers: { accept: 'application/json' } });
    if (!r.ok) return { ok: false, httpStatus: r.status };
    return await r.json();
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function main() {
  const liveChainId = lower(await provider.send('eth_chainId', []));
  if (liveChainId !== CHAIN_HEX) throw new Error(`chain_id_mismatch:${liveChainId}`);
  const network = await provider.getNetwork();

  const swap = new Contract(SWAP_LAB, [
    'function token() view returns (address)',
    'function tokensPerZQ() view returns (uint256)',
    'function owner() view returns (address)'
  ], provider);
  const [swapToken, swapOwner] = await Promise.all([swap.token(), swap.owner()]);
  let tokensPerZQ = null;
  try { tokensPerZQ = (await swap.tokensPerZQ()).toString(); } catch {}

  const faucet = await faucetStatus();
  let activeFaucetContract = null;
  if (faucet?.mode === 'onchain' && faucet?.contract) activeFaucetContract = await codeStatus(faucet.contract);
  const configuredToken = await tokenMetadata(CLIENT_ZUSD);

  const report = {
    checkedAt: new Date().toISOString(),
    rpc: RPC,
    chainId: Number(network.chainId),
    faucetService: {
      mode: faucet?.mode || null,
      amount: faucet?.amount || null,
      symbol: faucet?.symbol || null,
      contract: faucet?.contract || null,
      healthy: faucet?.healthy !== false,
      statusReachable: faucet?.ok === true
    },
    contracts: {
      historicalFaucetReference: await codeStatus(HISTORICAL_FAUCET),
      activeFaucetContract,
      swapLab: { ...(await codeStatus(SWAP_LAB)), token: checksum(swapToken), owner: checksum(swapOwner), tokensPerZQ },
      stake: await codeStatus(STAKE),
      clientConfiguredZUSD: configuredToken,
      historicalZUSD: await tokenMetadata(HISTORICAL_ZUSD)
    },
    privilegedAccounts: {
      clientConfiguredTreasury: checksum(CLIENT_TREASURY),
      swapLabOwner: checksum(swapOwner),
      zUSDOwner: configuredToken.owner,
      swapLabOwnerMatchesTreasury: lower(swapOwner) === CLIENT_TREASURY,
      zUSDOwnerMatchesTreasury: lower(configuredToken.owner) === CLIENT_TREASURY
    },
    canonicality: {
      swapLabTokenMatchesClientConfig: lower(swapToken) === CLIENT_ZUSD,
      swapLabTokenMatchesHistorical: lower(swapToken) === HISTORICAL_ZUSD,
      swapLabToken: checksum(swapToken),
      configuredZUSDHasCode: configuredToken.hasCode,
      historicalZUSDHasCode: (await provider.getCode(HISTORICAL_ZUSD)) !== '0x'
    }
  };

  console.log('ZORYQ_LIVE_CONTRACT_REPORT=' + JSON.stringify(report));
  console.log(JSON.stringify(report, null, 2));

  if (!report.contracts.swapLab.hasCode || !report.contracts.stake.hasCode) throw new Error('required_contract_code_missing');
  if (!report.canonicality.swapLabTokenMatchesClientConfig) {
    throw new Error(`zusd_canonicality_mismatch:swapLab=${report.canonicality.swapLabToken}:client=${checksum(CLIENT_ZUSD)}`);
  }
  if (!configuredToken.hasCode) throw new Error('configured_zusd_code_missing');
  if (faucet?.mode === 'onchain' && (!activeFaucetContract || !activeFaucetContract.hasCode)) throw new Error('active_faucet_contract_code_missing');
  if (!['onchain','legacy-balance'].includes(String(faucet?.mode || ''))) throw new Error('unknown_faucet_mode');
}

main().catch(err => {
  console.error('ZORYQ_LIVE_CONTRACT_VERIFY_FAILED', err?.stack || err?.message || String(err));
  process.exit(1);
});
