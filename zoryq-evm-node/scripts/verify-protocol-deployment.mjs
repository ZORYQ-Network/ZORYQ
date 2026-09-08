import { Contract, JsonRpcProvider, getAddress } from 'ethers';

const RPC = process.env.ZORYQ_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const CHAIN_ID = 5919065;
const ZUSD = getAddress((process.env.ZORYQ_ZUSD || '0xd2121e96c6af936c0496fdb499c1d0613d26c2b9').toLowerCase());
const TREASURY = getAddress((process.env.ZORYQ_TREASURY || '0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33').toLowerCase());
const DEX = process.env.ZORYQ_DEX_ADDRESS ? getAddress(process.env.ZORYQ_DEX_ADDRESS.toLowerCase()) : null;
const LENDING = process.env.ZORYQ_LENDING_ADDRESS ? getAddress(process.env.ZORYQ_LENDING_ADDRESS.toLowerCase()) : null;
const PROJECT_REGISTRY = process.env.ZORYQ_PROJECT_REGISTRY_ADDRESS ? getAddress(process.env.ZORYQ_PROJECT_REGISTRY_ADDRESS.toLowerCase()) : null;

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });

async function assertCode(label, address) {
  const code = await provider.getCode(address);
  if (code === '0x') throw new Error(`${label}_bytecode_missing:${address}`);
  return (code.length - 2) / 2;
}

async function receipt(hash) {
  if (!hash) return null;
  const r = await provider.getTransactionReceipt(hash);
  if (!r || r.status !== 1) throw new Error(`deployment_receipt_invalid:${hash}`);
  return { hash, blockNumber: r.blockNumber, contractAddress: r.contractAddress };
}

async function main() {
  const chain = await provider.send('eth_chainId', []);
  if (String(chain).toLowerCase() !== '0x5a5159') throw new Error(`chain_id_mismatch:${chain}`);
  if (!DEX && !LENDING && !PROJECT_REGISTRY) throw new Error('no_protocol_address_supplied');

  const report = { ok: true, checkedAt: new Date().toISOString(), chainId: CHAIN_ID, zUSD: ZUSD, treasury: TREASURY, contracts: {} };

  if (DEX) {
    const bytes = await assertCode('dex', DEX);
    const c = new Contract(DEX, [
      'function owner() view returns(address)',
      'function feeRecipient() view returns(address)',
      'function token() view returns(address)',
      'function TOTAL_FEE_BPS() view returns(uint256)',
      'function LP_FEE_BPS() view returns(uint256)',
      'function PROTOCOL_FEE_BPS() view returns(uint256)'
    ], provider);
    const [owner, feeRecipient, token, totalFee, lpFee, protocolFee] = await Promise.all([c.owner(), c.feeRecipient(), c.token(), c.TOTAL_FEE_BPS(), c.LP_FEE_BPS(), c.PROTOCOL_FEE_BPS()]);
    if (getAddress(owner) !== TREASURY) throw new Error(`dex_owner_mismatch:${owner}`);
    if (getAddress(feeRecipient) !== TREASURY) throw new Error(`dex_fee_recipient_mismatch:${feeRecipient}`);
    if (getAddress(token) !== ZUSD) throw new Error(`dex_token_mismatch:${token}`);
    if (totalFee !== 30n || lpFee !== 20n || protocolFee !== 10n) throw new Error('dex_fee_constants_mismatch');
    report.contracts.dexV1 = { address: DEX, bytecodeBytes: bytes, owner: getAddress(owner), feeRecipient: getAddress(feeRecipient), token: getAddress(token), totalFeeBps: Number(totalFee), lpFeeBps: Number(lpFee), protocolFeeBps: Number(protocolFee), receipt: await receipt(process.env.ZORYQ_DEX_TX) };
  }

  if (LENDING) {
    const bytes = await assertCode('lending', LENDING);
    const c = new Contract(LENDING, [
      'function owner() view returns(address)',
      'function debtToken() view returns(address)',
      'function maxLtvBps() view returns(uint256)',
      'function liquidationThresholdBps() view returns(uint256)',
      'function aprBps() view returns(uint256)'
    ], provider);
    const [owner, debtToken, maxLtv, threshold, apr] = await Promise.all([c.owner(), c.debtToken(), c.maxLtvBps(), c.liquidationThresholdBps(), c.aprBps()]);
    if (getAddress(owner) !== TREASURY) throw new Error(`lending_owner_mismatch:${owner}`);
    if (getAddress(debtToken) !== ZUSD) throw new Error(`lending_token_mismatch:${debtToken}`);
    report.contracts.lending = { address: LENDING, bytecodeBytes: bytes, owner: getAddress(owner), debtToken: getAddress(debtToken), maxLtvBps: Number(maxLtv), liquidationThresholdBps: Number(threshold), aprBps: Number(apr), receipt: await receipt(process.env.ZORYQ_LENDING_TX) };
  }

  if (PROJECT_REGISTRY) {
    const bytes = await assertCode('project_registry', PROJECT_REGISTRY);
    const c = new Contract(PROJECT_REGISTRY, ['function projectCount() view returns(uint256)'], provider);
    const count = await c.projectCount();
    report.contracts.projectRegistry = { address: PROJECT_REGISTRY, bytecodeBytes: bytes, projectCount: count.toString(), receipt: await receipt(process.env.ZORYQ_PROJECT_REGISTRY_TX) };
  }

  console.log('ZORYQ_PROTOCOL_DEPLOYMENT_VERIFIED=' + JSON.stringify(report));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error('ZORYQ_PROTOCOL_DEPLOYMENT_VERIFY_FAILED', error?.stack || error?.message || String(error));
  process.exit(1);
});
