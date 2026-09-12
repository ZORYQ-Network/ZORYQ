import fs from 'node:fs';
import { Contract, ContractFactory, HDNodeWallet, JsonRpcProvider, keccak256, toUtf8Bytes, formatEther } from 'ethers';

const CHAIN_ID = 5919065;
const RPC = process.env.ZORYQ_INTERNAL_RPC || 'http://127.0.0.1:8082/rpc';
const MNEMONIC_FILE = process.env.ZORYQ_RETH_MNEMONIC_FILE || '/data/zoryq-reth-mnemonic.txt';
const ARTIFACT = process.env.ZORYQ_EXTERNAL_WORK_PROOF_ARTIFACT || '/app/protocol-out/ZoryqExternalWorkProof.sol/ZoryqExternalWorkProof.json';
const STATE_FILE = process.env.ZORYQ_EXTERNAL_WORK_PROOF_STATE || '/data/zoryq-external-work-proof.json';
const PUBLIC_FILE = process.env.ZORYQ_EXTERNAL_WORK_PROOF_PUBLIC_FILE || '/app/web/external-work-proof-live.json';
const OWNER_INDEX = Number(process.env.ZORYQ_EXTERNAL_WORK_OWNER_INDEX || 21);
const PAYER_INDEX = Number(process.env.ZORYQ_EXTERNAL_WORK_PAYER_INDEX || 18);
const PAYMENT_WEI = BigInt(process.env.ZORYQ_EXTERNAL_WORK_PAYMENT_WEI || '1000000000000000'); // 0.001 ZQ testnet
const SPEC_TEXT = 'ZORYQ Autonomous canonical external-work test: produce the public delivery artifact bound to this work order.';
const DELIVERY_TEXT = 'ZORYQ Autonomous canonical delivery artifact: external-work-proof protocol deployed, exercised and reconciled on public testnet.';
const COMPANY_REF_TEXT = 'zoryq-autonomous-company/external-work-proof/v1';

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, value, mode = 0o600) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, mode); } catch {}
}
function walletAt(phrase, index, provider) { return HDNodeWallet.fromPhrase(phrase, '', `m/44'/60'/0'/0/${index}`).connect(provider); }
async function mined(tx) { const r = await tx.wait(); if (!r || r.status !== 1) throw new Error(`transaction failed: ${tx.hash}`); return r; }
function eqAddress(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase(); }
function orderView(result) {
  return {
    id: result[0], companyOwner: result[1], treasury: result[2], companyRef: result[3], specHash: result[4],
    deliveryHash: result[5], payer: result[6], revenueZqWei: result[7], createdAt: result[8], deliveredAt: result[9],
    paidAt: result[10], delivered: result[11], paid: result[12], cancelled: result[13]
  };
}
async function latestMatchingOrder(contract, owner, companyRef, specHash) {
  const count = await contract.workOrderCount();
  for (let id = count; id >= 1n; id--) {
    const w = orderView(await contract.workOrders(id));
    if (eqAddress(w.companyOwner, owner) && w.companyRef === companyRef && w.specHash === specHash) return id;
  }
  return 0n;
}
async function latestEvent(contract, filter, fromBlock) {
  const logs = await contract.queryFilter(filter, fromBlock, 'latest');
  return logs.length ? logs[logs.length - 1] : null;
}

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) throw new Error(`wrong chain: ${network.chainId}`);
if (!fs.existsSync(MNEMONIC_FILE)) throw new Error('operator mnemonic file missing');
if (!fs.existsSync(ARTIFACT)) throw new Error('external work proof artifact missing');
if (OWNER_INDEX === PAYER_INDEX) throw new Error('owner and payer indexes must differ');

const phrase = fs.readFileSync(MNEMONIC_FILE, 'utf8').trim();
const owner = walletAt(phrase, OWNER_INDEX, provider);
const payer = walletAt(phrase, PAYER_INDEX, provider);
const artifact = readJson(ARTIFACT);
const abi = artifact?.abi;
let bytecode = artifact?.bytecode?.object || '';
if (!abi || !bytecode) throw new Error('invalid external work proof artifact');
if (!bytecode.startsWith('0x')) bytecode = `0x${bytecode}`;

let state = readJson(STATE_FILE) || {
  schema: 1,
  chainId: CHAIN_ID,
  network: 'ZORYQ EVM Testnet',
  ownerAddress: owner.address,
  payerAddress: payer.address,
  payerBoundary: 'operator-separated testnet address; not an independent third party'
};
if (state.chainId !== CHAIN_ID) throw new Error('persisted external-work state has wrong chain');
if (state.ownerAddress && !eqAddress(state.ownerAddress, owner.address)) throw new Error('persisted owner differs from configured owner');
if (state.payerAddress && !eqAddress(state.payerAddress, payer.address)) throw new Error('persisted payer differs from configured payer');
state.ownerAddress = owner.address;
state.payerAddress = payer.address;
state.payerBoundary = 'operator-separated testnet address; not an independent third party';

let contract;
if (state.contractAddress) {
  const code = await provider.getCode(state.contractAddress);
  if (code !== '0x') contract = new Contract(state.contractAddress, abi, owner);
}
if (!contract) {
  const factory = new ContractFactory(abi, bytecode, owner);
  const deployed = await factory.deploy();
  const receipt = await mined(deployed.deploymentTransaction());
  contract = deployed;
  state.contractAddress = await deployed.getAddress();
  state.deploymentTx = receipt.hash;
  state.deploymentBlock = Number(receipt.blockNumber);
  state.deployedBy = owner.address;
  state.deployedAt = new Date().toISOString();
  writeJson(STATE_FILE, state);
}
if (!Number.isInteger(Number(state.deploymentBlock)) || Number(state.deploymentBlock) < 0) {
  const deploymentReceipt = state.deploymentTx ? await provider.getTransactionReceipt(state.deploymentTx) : null;
  if (!deploymentReceipt) throw new Error('deployment block unavailable for bounded event recovery');
  state.deploymentBlock = Number(deploymentReceipt.blockNumber);
  writeJson(STATE_FILE, state);
}
const eventFromBlock = Number(state.deploymentBlock);

const companyRef = keccak256(toUtf8Bytes(COMPANY_REF_TEXT));
const specHash = keccak256(toUtf8Bytes(SPEC_TEXT));
const deliveryHash = keccak256(toUtf8Bytes(DELIVERY_TEXT));
state.companyRef = companyRef;
state.specHash = specHash;
state.deliveryHash = deliveryHash;
state.specArtifact = SPEC_TEXT;
state.deliveryArtifact = DELIVERY_TEXT;

let workOrderId = state.canonicalWorkOrderId ? BigInt(state.canonicalWorkOrderId) : 0n;
if (!workOrderId) {
  const specAlreadyUsed = await contract.usedSpecHashes(specHash);
  if (specAlreadyUsed) {
    workOrderId = await latestMatchingOrder(contract, owner.address, companyRef, specHash);
    if (!workOrderId) throw new Error('spec hash used but canonical work order cannot be recovered');
  } else {
    const receipt = await mined(await contract.createWorkOrder(owner.address, companyRef, specHash));
    workOrderId = await contract.workOrderCount();
    state.createWorkOrderTx = receipt.hash;
    state.createWorkOrderBlock = Number(receipt.blockNumber);
  }
  state.canonicalWorkOrderId = Number(workOrderId);
  writeJson(STATE_FILE, state);
}

let order = orderView(await contract.workOrders(workOrderId));
if (!eqAddress(order.companyOwner, owner.address) || !eqAddress(order.treasury, owner.address)) throw new Error('canonical work order owner/treasury mismatch');
if (order.companyRef !== companyRef || order.specHash !== specHash) throw new Error('canonical work order evidence mismatch');
if (order.cancelled) throw new Error('canonical work order is cancelled');

if (!order.delivered) {
  const used = await contract.usedDeliveryHashes(deliveryHash);
  if (used) throw new Error('delivery hash already used by another work order');
  const receipt = await mined(await contract.recordDelivery(workOrderId, deliveryHash));
  state.recordDeliveryTx = receipt.hash;
  state.recordDeliveryBlock = Number(receipt.blockNumber);
  writeJson(STATE_FILE, state);
  order = orderView(await contract.workOrders(workOrderId));
}
if (!order.delivered || order.deliveryHash !== deliveryHash) throw new Error('canonical delivery state mismatch');

let proof = await contract.paymentProof(workOrderId);
if (!proof[3]) {
  const payerContract = contract.connect(payer);
  const receipt = await mined(await payerContract.payForDeliveredWork(workOrderId, { value: PAYMENT_WEI }));
  state.paymentTx = receipt.hash;
  state.paymentBlock = Number(receipt.blockNumber);
  state.paymentReceiptStatus = Number(receipt.status);
  state.paymentWei = PAYMENT_WEI.toString();
  state.paymentZq = formatEther(PAYMENT_WEI);
  writeJson(STATE_FILE, state);
  proof = await contract.paymentProof(workOrderId);
}
if (!proof[2] || !proof[3] || proof[4]) throw new Error('invalid canonical work-order state');
if (!eqAddress(proof[0], payer.address)) throw new Error('contract payer mismatch');
if (proof[1] !== PAYMENT_WEI) throw new Error('contract revenue mismatch');

const createEvent = await latestEvent(contract, contract.filters.WorkOrderCreated(workOrderId), eventFromBlock);
const deliveryEvent = await latestEvent(contract, contract.filters.WorkDelivered(workOrderId), eventFromBlock);
const paymentEvent = await latestEvent(contract, contract.filters.ExternalRevenueReceived(workOrderId), eventFromBlock);
if (!createEvent || !deliveryEvent || !paymentEvent) throw new Error('canonical evidence events missing');
state.createWorkOrderTx = createEvent.transactionHash;
state.createWorkOrderBlock = Number(createEvent.blockNumber);
state.recordDeliveryTx = deliveryEvent.transactionHash;
state.recordDeliveryBlock = Number(deliveryEvent.blockNumber);
state.paymentTx = paymentEvent.transactionHash;
state.paymentBlock = Number(paymentEvent.blockNumber);
state.paymentWei = PAYMENT_WEI.toString();
state.paymentZq = formatEther(PAYMENT_WEI);

const tx = await provider.getTransaction(state.paymentTx);
const receipt = await provider.getTransactionReceipt(state.paymentTx);
if (!tx || !receipt) throw new Error('canonical payment transaction/receipt unavailable');
const paymentBlock = Number(receipt.blockNumber);
const beforeBalance = await provider.getBalance(owner.address, Math.max(0, paymentBlock - 1));
const afterBalance = await provider.getBalance(owner.address, paymentBlock);
state.paymentReceiptStatus = Number(receipt.status);
state.treasuryBalanceBeforeWei = beforeBalance.toString();
state.treasuryBalanceAfterWei = afterBalance.toString();
state.treasuryBalanceDeltaWei = (afterBalance - beforeBalance).toString();
state.reproducedAt = state.reproducedAt || new Date().toISOString();

const digest = await contract.proofDigest(workOrderId);
const code = await provider.getCode(state.contractAddress);
const publicManifest = {
  schema: 'zoryq-autonomous-external-work-proof/1.0',
  network: { name: state.network, chainId: state.chainId, chainIdHex: '0x5a5159' },
  contractAddress: state.contractAddress,
  contractCodePresent: code !== '0x',
  deploymentTx: state.deploymentTx,
  deploymentBlock: state.deploymentBlock,
  ownerAddress: state.ownerAddress,
  payerAddress: state.payerAddress,
  payerBoundary: state.payerBoundary,
  workOrderId: state.canonicalWorkOrderId,
  companyRef,
  spec: { text: SPEC_TEXT, hash: specHash, tx: state.createWorkOrderTx, block: state.createWorkOrderBlock },
  delivery: { text: DELIVERY_TEXT, hash: deliveryHash, tx: state.recordDeliveryTx, block: state.recordDeliveryBlock },
  payment: {
    tx: state.paymentTx,
    block: paymentBlock,
    receiptStatus: Number(receipt.status),
    from: tx.from,
    to: tx.to,
    valueWei: tx.value.toString(),
    valueZq: formatEther(tx.value)
  },
  treasuryReconciliation: {
    treasury: owner.address,
    balanceBeforePaymentBlockWei: beforeBalance.toString(),
    balanceAtPaymentBlockWei: afterBalance.toString(),
    observedBlockDeltaWei: (afterBalance - beforeBalance).toString(),
    expectedIncomingPaymentWei: PAYMENT_WEI.toString(),
    exactDelta: afterBalance - beforeBalance === PAYMENT_WEI,
    note: 'Block-level treasury delta is included as supporting evidence; the payment transaction value and contract state are the canonical transfer evidence.'
  },
  contractState: {
    payer: proof[0],
    revenueZqWei: proof[1].toString(),
    delivered: proof[2],
    paid: proof[3],
    cancelled: proof[4],
    proofDigest: digest
  },
  claimBoundary: {
    verified: 'separate-address native-ZQ testnet payment bound to declared work evidence and successful receipt',
    notVerified: ['independent third-party payer', 'legal consideration', 'market demand', 'profitability', 'independent AI labor', 'production readiness']
  },
  verifiedAt: new Date().toISOString()
};

if (!publicManifest.contractCodePresent) throw new Error('deployed contract bytecode missing');
if (publicManifest.payment.receiptStatus !== 1) throw new Error('canonical payment receipt is not successful');
if (eqAddress(publicManifest.payment.from, owner.address)) throw new Error('canonical payer is owner');
if (!eqAddress(publicManifest.payment.from, payer.address)) throw new Error('canonical payer differs from configured payer');
if (publicManifest.payment.valueWei !== PAYMENT_WEI.toString()) throw new Error('payment transaction value mismatch');
if (!eqAddress(proof[0], payer.address)) throw new Error('contract payer mismatch');
if (proof[1].toString() !== PAYMENT_WEI.toString()) throw new Error('contract revenue mismatch');

state.lastVerifiedAt = publicManifest.verifiedAt;
writeJson(STATE_FILE, state);
writeJson(PUBLIC_FILE, publicManifest, 0o644);
console.log('[zoryq-external-work-proof] ' + JSON.stringify(publicManifest));
