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

let state = readJson(STATE_FILE) || { schema: 1, chainId: CHAIN_ID, network: 'ZORYQ EVM Testnet' };
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
  state = {
    schema: 1,
    chainId: CHAIN_ID,
    network: 'ZORYQ EVM Testnet',
    contractAddress: await deployed.getAddress(),
    deploymentTx: receipt.hash,
    deploymentBlock: Number(receipt.blockNumber),
    deployedBy: owner.address,
    deployedAt: new Date().toISOString(),
    ownerAddress: owner.address,
    payerAddress: payer.address,
    payerBoundary: 'operator-separated testnet address; not an independent third party',
    canonicalWorkOrderId: null
  };
  writeJson(STATE_FILE, state);
}

const companyRef = keccak256(toUtf8Bytes(COMPANY_REF_TEXT));
const specHash = keccak256(toUtf8Bytes(SPEC_TEXT));
const deliveryHash = keccak256(toUtf8Bytes(DELIVERY_TEXT));

if (!state.canonicalWorkOrderId) {
  const createReceipt = await mined(await contract.createWorkOrder(owner.address, companyRef, specHash));
  const workOrderId = await contract.workOrderCount();
  const deliveryReceipt = await mined(await contract.recordDelivery(workOrderId, deliveryHash));
  const treasuryBalanceBefore = await provider.getBalance(owner.address);
  const payerContract = contract.connect(payer);
  const paymentReceipt = await mined(await payerContract.payForDeliveredWork(workOrderId, { value: PAYMENT_WEI }));
  const treasuryBalanceAfter = await provider.getBalance(owner.address);
  state.canonicalWorkOrderId = Number(workOrderId);
  state.createWorkOrderTx = createReceipt.hash;
  state.createWorkOrderBlock = Number(createReceipt.blockNumber);
  state.recordDeliveryTx = deliveryReceipt.hash;
  state.recordDeliveryBlock = Number(deliveryReceipt.blockNumber);
  state.paymentTx = paymentReceipt.hash;
  state.paymentBlock = Number(paymentReceipt.blockNumber);
  state.paymentReceiptStatus = Number(paymentReceipt.status);
  state.paymentWei = PAYMENT_WEI.toString();
  state.paymentZq = formatEther(PAYMENT_WEI);
  state.treasuryBalanceBeforeWei = treasuryBalanceBefore.toString();
  state.treasuryBalanceAfterWei = treasuryBalanceAfter.toString();
  state.treasuryBalanceDeltaWei = (treasuryBalanceAfter - treasuryBalanceBefore).toString();
  state.companyRef = companyRef;
  state.specHash = specHash;
  state.deliveryHash = deliveryHash;
  state.specArtifact = SPEC_TEXT;
  state.deliveryArtifact = DELIVERY_TEXT;
  state.reproducedAt = new Date().toISOString();
  writeJson(STATE_FILE, state);
}

const id = BigInt(state.canonicalWorkOrderId);
const proof = await contract.paymentProof(id);
const digest = await contract.proofDigest(id);
const code = await provider.getCode(state.contractAddress);
const tx = await provider.getTransaction(state.paymentTx);
const receipt = await provider.getTransactionReceipt(state.paymentTx);

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
  companyRef: state.companyRef,
  spec: { text: state.specArtifact, hash: state.specHash },
  delivery: { text: state.deliveryArtifact, hash: state.deliveryHash, tx: state.recordDeliveryTx, block: state.recordDeliveryBlock },
  payment: {
    tx: state.paymentTx,
    block: Number(receipt?.blockNumber || state.paymentBlock),
    receiptStatus: Number(receipt?.status ?? state.paymentReceiptStatus),
    from: tx?.from || state.payerAddress,
    to: tx?.to || state.contractAddress,
    valueWei: tx?.value?.toString() || state.paymentWei,
    valueZq: formatEther(tx?.value ?? BigInt(state.paymentWei))
  },
  treasuryReconciliation: {
    treasury: state.ownerAddress,
    balanceBeforeWei: state.treasuryBalanceBeforeWei,
    balanceAfterWei: state.treasuryBalanceAfterWei,
    observedDeltaWei: state.treasuryBalanceDeltaWei,
    expectedIncomingPaymentWei: state.paymentWei,
    note: 'Owner treasury also pays gas for owner-originated setup transactions; payment reconciliation uses the payer transaction plus contract state and recorded balances.'
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
if (publicManifest.payment.from.toLowerCase() === state.ownerAddress.toLowerCase()) throw new Error('canonical payer is owner');
if (publicManifest.payment.valueWei !== state.paymentWei) throw new Error('payment transaction value mismatch');
if (!proof[2] || !proof[3] || proof[4]) throw new Error('invalid canonical work-order state');
if (proof[0].toLowerCase() !== state.payerAddress.toLowerCase()) throw new Error('contract payer mismatch');
if (proof[1].toString() !== state.paymentWei) throw new Error('contract revenue mismatch');

writeJson(STATE_FILE, { ...state, lastVerifiedAt: publicManifest.verifiedAt });
writeJson(PUBLIC_FILE, publicManifest, 0o644);
console.log('[zoryq-external-work-proof] ' + JSON.stringify(publicManifest));
