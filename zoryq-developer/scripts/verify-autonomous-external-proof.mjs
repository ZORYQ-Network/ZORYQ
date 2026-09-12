const BASE = process.env.ZORYQ_PUBLIC_BASE || 'https://zoryq-evm-node-live-production.up.railway.app';
const MANIFEST_URL = `${BASE}/external-work-proof-live.json`;
const RPC_URL = `${BASE}/rpc`;
const EXPECTED_CHAIN_ID = 5919065;
const EXPECTED_PAYMENT_WEI = '1000000000000000';
const EXPECTED_CONTRACT = '0x5B19Fc8A94294DF15e4D3Fb37b4234936014238B';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const eq = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function rpc(method, params = []) {
  const body = await fetchJson(RPC_URL, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: Date.now(), method, params})
  });
  if (body.error) throw new Error(`RPC ${method}: ${body.error.message || JSON.stringify(body.error)}`);
  return body.result;
}

function validateManifest(m) {
  assert(m?.schema === 'zoryq-autonomous-external-work-proof/1.0', 'unexpected manifest schema');
  assert(Number(m?.network?.chainId) === EXPECTED_CHAIN_ID, 'manifest chain ID mismatch');
  assert(eq(m?.contractAddress, EXPECTED_CONTRACT), 'canonical contract address mismatch');
  assert(m?.contractCodePresent === true, 'manifest does not assert contract code');
  assert(Number(m?.workOrderId) > 0, 'missing canonical work order');
  assert(/^0x[0-9a-fA-F]{64}$/.test(String(m?.spec?.hash || '')), 'invalid spec hash');
  assert(/^0x[0-9a-fA-F]{64}$/.test(String(m?.delivery?.hash || '')), 'invalid delivery hash');
  assert(/^0x[0-9a-fA-F]{64}$/.test(String(m?.contractState?.proofDigest || '')), 'invalid proof digest');
  assert(String(m?.payment?.valueWei) === EXPECTED_PAYMENT_WEI, 'unexpected payment value');
  assert(String(m?.contractState?.revenueZqWei) === EXPECTED_PAYMENT_WEI, 'contract revenue mismatch in manifest');
  assert(m?.contractState?.delivered === true, 'manifest delivery state false');
  assert(m?.contractState?.paid === true, 'manifest paid state false');
  assert(m?.contractState?.cancelled === false, 'manifest cancelled state true');
  assert(m?.treasuryReconciliation?.exactDelta === true, 'treasury delta not exact');
  assert(String(m?.treasuryReconciliation?.observedBlockDeltaWei) === EXPECTED_PAYMENT_WEI, 'treasury delta value mismatch');
  assert(!eq(m?.ownerAddress, m?.payerAddress), 'payer must differ from owner');
  assert(/not an independent third party/i.test(String(m?.payerBoundary || '')), 'payer claim boundary missing');
}

async function verifyOnce() {
  const m = await fetchJson(MANIFEST_URL, {headers: {'cache-control': 'no-cache'}});
  validateManifest(m);

  const [chainHex, code, deployReceipt, workReceipt, deliveryReceipt, paymentReceipt, paymentTx] = await Promise.all([
    rpc('eth_chainId'),
    rpc('eth_getCode', [m.contractAddress, 'latest']),
    rpc('eth_getTransactionReceipt', [m.deploymentTx]),
    rpc('eth_getTransactionReceipt', [m.spec.tx]),
    rpc('eth_getTransactionReceipt', [m.delivery.tx]),
    rpc('eth_getTransactionReceipt', [m.payment.tx]),
    rpc('eth_getTransactionByHash', [m.payment.tx])
  ]);

  assert(parseInt(chainHex, 16) === EXPECTED_CHAIN_ID, 'public RPC chain ID mismatch');
  assert(code && code !== '0x', 'canonical contract has no bytecode');
  for (const [name, receipt] of [['deployment', deployReceipt], ['work order', workReceipt], ['delivery', deliveryReceipt], ['payment', paymentReceipt]]) {
    assert(receipt, `${name} receipt missing`);
    assert(receipt.status === '0x1', `${name} receipt status is not 0x1`);
  }
  assert(paymentTx, 'payment transaction missing');
  assert(eq(paymentTx.hash, m.payment.tx), 'payment hash mismatch');
  assert(eq(paymentTx.from, m.payerAddress), 'payment payer mismatch');
  assert(eq(paymentTx.to, m.contractAddress), 'payment target mismatch');
  assert(BigInt(paymentTx.value || '0x0').toString() === EXPECTED_PAYMENT_WEI, 'onchain payment value mismatch');
  assert(eq(m.contractState.payer, m.payerAddress), 'manifest contract-state payer mismatch');
  assert(Number(m.payment.receiptStatus) === 1, 'manifest receipt status mismatch');

  return {
    ok: true,
    verifier: 'github-actions-public-endpoint',
    chainId: EXPECTED_CHAIN_ID,
    contract: m.contractAddress,
    workOrderId: m.workOrderId,
    paymentTx: m.payment.tx,
    paymentWei: EXPECTED_PAYMENT_WEI,
    payer: m.payerAddress,
    owner: m.ownerAddress,
    proofDigest: m.contractState.proofDigest,
    verifiedAt: new Date().toISOString(),
    claimBoundary: 'Public infrastructure reproduction only; payer remains operator-controlled and is not an independent customer.'
  };
}

const attempts = Math.max(1, Number(process.env.ZORYQ_VERIFY_ATTEMPTS || 12));
const delayMs = Math.max(1000, Number(process.env.ZORYQ_VERIFY_DELAY_MS || 10000));
let lastError;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const result = await verifyOnce();
    console.log(JSON.stringify({...result, attempt}, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`[zoryq-public-proof] attempt ${attempt}/${attempts} failed: ${error.message}`);
    if (attempt < attempts) await sleep(delayMs);
  }
}
console.error(JSON.stringify({ok:false, error:lastError?.message || 'verification failed'}, null, 2));
process.exit(1);
