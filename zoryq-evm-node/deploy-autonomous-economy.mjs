import fs from 'node:fs';
import { Contract, ContractFactory, HDNodeWallet, JsonRpcProvider, encodeBytes32String, formatEther, keccak256, parseEther, toUtf8Bytes } from 'ethers';

const CHAIN_ID = 5919065;
const RPC = process.env.ZORYQ_INTERNAL_RPC || 'http://127.0.0.1:8082/rpc';
const MNEMONIC_FILE = process.env.ZORYQ_RETH_MNEMONIC_FILE || '/data/zoryq-reth-mnemonic.txt';
const ARTIFACT = process.env.ZORYQ_AUTONOMOUS_ARTIFACT || '/app/protocol-out/ZoryqAutonomousEconomy.sol/ZoryqAutonomousEconomy.json';
const STATE_FILE = process.env.ZORYQ_AUTONOMOUS_STATE || '/data/zoryq-autonomous-economy.json';
const FORCE_DEMO = String(process.env.ZORYQ_AUTONOMOUS_FORCE_DEMO || 'false').toLowerCase() === 'true';

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch {}
}
function hash(text) { return keccak256(toUtf8Bytes(String(text))); }
function b32(text) { return encodeBytes32String(String(text).slice(0, 31)); }
function walletAt(phrase, index, provider) { return HDNodeWallet.fromPhrase(phrase, '', `m/44'/60'/0'/0/${index}`).connect(provider); }
async function mined(tx) { const r = await tx.wait(); if (!r || r.status !== 1) throw new Error(`transaction failed: ${tx.hash}`); return r; }
async function ensureGasWallet(funder, wallet, minimum = parseEther('2')) {
  const bal = await wallet.provider.getBalance(wallet.address);
  if (bal >= minimum) return null;
  return mined(await funder.sendTransaction({ to: wallet.address, value: minimum - bal }));
}
async function ensureAgent(contract, wallet, label, capabilities, proof) {
  const current = await contract.agents(wallet.address);
  if (current.controller && current.controller !== '0x0000000000000000000000000000000000000000') return null;
  return mined(await contract.connect(wallet).registerAgent(b32(label), hash(proof), hash(capabilities)));
}
function addTx(state, name, receipt) {
  if (!receipt) return;
  state.transactions ||= {};
  state.transactions[name] = receipt.hash;
}

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) throw new Error(`wrong chain: ${network.chainId}`);
if (!fs.existsSync(MNEMONIC_FILE)) throw new Error('operator mnemonic file missing');
if (!fs.existsSync(ARTIFACT)) throw new Error('autonomous economy artifact missing');

const phrase = fs.readFileSync(MNEMONIC_FILE, 'utf8').trim();
const artifact = readJson(ARTIFACT);
const abi = artifact?.abi;
let bytecode = artifact?.bytecode?.object || '';
if (!abi || !bytecode) throw new Error('invalid autonomous economy artifact');
if (!bytecode.startsWith('0x')) bytecode = `0x${bytecode}`;

// Indices 20-22 are outside the faucet account pool; 23 is reserved by Social relaying.
// 24-25 are deterministic demo agents and are funded only with testnet ZQ for gas.
const manager = walletAt(phrase, 20, provider);
const finance = walletAt(phrase, 21, provider);
const worker = walletAt(phrase, 22, provider);
const marketing = walletAt(phrase, 24, provider);
const developer = walletAt(phrase, 25, provider);

let state = readJson(STATE_FILE) || { schema: 1, chainId: CHAIN_ID, network: 'ZORYQ EVM Testnet' };
let contract;
if (state.contractAddress) {
  const code = await provider.getCode(state.contractAddress);
  if (code !== '0x') contract = new Contract(state.contractAddress, abi, manager);
}

if (!contract) {
  const factory = new ContractFactory(abi, bytecode, manager);
  const deployed = await factory.deploy();
  const deployReceipt = await deployed.deploymentTransaction().wait();
  contract = deployed;
  state = {
    schema: 1,
    chainId: CHAIN_ID,
    network: 'ZORYQ EVM Testnet',
    contractAddress: await deployed.getAddress(),
    deploymentTx: deployReceipt.hash,
    deployedBy: manager.address,
    deployedAt: new Date().toISOString(),
    demoComplete: false,
    transactions: {}
  };
  writeJson(STATE_FILE, state);
}

if (state.demoComplete && !FORCE_DEMO) {
  const out = { ...state };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

addTx(state, 'fundMarketingGas', await ensureGasWallet(manager, marketing));
addTx(state, 'fundDeveloperGas', await ensureGasWallet(manager, developer));

addTx(state, 'registerManager', await ensureAgent(contract, manager, 'AI CEO Manager', 'organization-management,task-routing,treasury-governance', 'ZORYQ live demo manager'));
addTx(state, 'registerFinance', await ensureAgent(contract, finance, 'AI Finance', 'payments,budget-control,audit,settlement', 'ZORYQ live demo finance'));
addTx(state, 'registerWorker', await ensureAgent(contract, worker, 'AI Creative Worker', 'design,copy,analysis,delivery', 'ZORYQ live demo worker'));
addTx(state, 'registerMarketing', await ensureAgent(contract, marketing, 'AI Marketing', 'campaigns,media-buying,task-creation', 'ZORYQ live demo marketing'));
addTx(state, 'registerDeveloper', await ensureAgent(contract, developer, 'AI Developer', 'software,compute,api-procurement', 'ZORYQ live demo developer'));
writeJson(STATE_FILE, state);

let organizationId = state.demo?.organizationId;
if (!organizationId) {
  const r = await mined(await contract.connect(manager).createOrganization(
    b32('ZORYQ Autonomous Studio'),
    hash('AI CEO + Finance + Marketing + Developer + Worker demo organization'),
    parseEther('50')
  ));
  addTx(state, 'createOrganization', r);
  organizationId = Number(await contract.organizationCount());
  state.demo = { organizationId };
  writeJson(STATE_FILE, state);
}

let org = await contract.organizationSummary(organizationId);
if (org.balance < parseEther('20')) {
  addTx(state, 'fundOrganization', await mined(await contract.connect(manager).fundOrganization(organizationId, { value: parseEther('20') })));
}

// Roles are composable. FINANCE is also the explicit spend permission in v0.1.
const ROLE_CEO = await contract.ROLE_CEO();
const ROLE_FINANCE = await contract.ROLE_FINANCE();
const ROLE_MARKETING = await contract.ROLE_MARKETING();
const ROLE_DEVELOPER = await contract.ROLE_DEVELOPER();
const ROLE_WORKER = await contract.ROLE_WORKER();
const ROLE_AUDITOR = await contract.ROLE_AUDITOR();

addTx(state, 'policyFinance', await mined(await contract.connect(manager).setAgentPolicy(organizationId, finance.address, ROLE_FINANCE | ROLE_AUDITOR, parseEther('1'), parseEther('5'), true)));
addTx(state, 'policyMarketing', await mined(await contract.connect(manager).setAgentPolicy(organizationId, marketing.address, ROLE_MARKETING | ROLE_FINANCE, parseEther('0.25'), parseEther('0.50'), true)));
addTx(state, 'policyDeveloper', await mined(await contract.connect(manager).setAgentPolicy(organizationId, developer.address, ROLE_DEVELOPER | ROLE_FINANCE, parseEther('0.20'), parseEther('0.40'), true)));
addTx(state, 'policyWorker', await mined(await contract.connect(manager).setAgentPolicy(organizationId, worker.address, ROLE_WORKER, 0, 0, true)));
addTx(state, 'policyManager', await mined(await contract.connect(manager).setAgentPolicy(organizationId, manager.address, ROLE_CEO, parseEther('2'), parseEther('10'), true)));

if (!state.demo?.budgetSpendDone) {
  addTx(state, 'marketingApiPayment', await mined(await contract.connect(marketing).agentSpend(organizationId, worker.address, parseEther('0.03'), hash('marketing-api'), hash('campaign data API purchase'))));
  addTx(state, 'developerComputePayment', await mined(await contract.connect(developer).agentSpend(organizationId, worker.address, parseEther('0.02'), hash('compute'), hash('build compute purchase'))));
  state.demo.budgetSpendDone = true;
  writeJson(STATE_FILE, state);
}

let organizationTaskId = state.demo?.organizationTaskId;
if (!organizationTaskId) {
  addTx(state, 'createCampaignTask', await mined(await contract.connect(marketing).createTask(
    organizationId,
    hash('Create a launch campaign for ZORYQ Autonomous Economy'),
    parseEther('2.5'),
    Math.floor(Date.now() / 1000) + 86400
  )));
  organizationTaskId = Number(await contract.taskCount());
  state.demo.organizationTaskId = organizationTaskId;
  writeJson(STATE_FILE, state);
}
let t = await contract.taskSummary(organizationTaskId);
if (Number(t.status) === 1) {
  addTx(state, 'campaignBid', await mined(await contract.connect(worker).bidForTask(organizationTaskId, parseEther('1.8'), hash('Campaign plan + creative + copy'))));
  addTx(state, 'campaignAssign', await mined(await contract.connect(manager).assignTask(organizationTaskId, worker.address)));
  t = await contract.taskSummary(organizationTaskId);
}
if (Number(t.status) === 2) {
  addTx(state, 'campaignSubmit', await mined(await contract.connect(worker).submitTask(organizationTaskId, hash('Campaign delivered: concept, copy, creative manifest'))));
  t = await contract.taskSummary(organizationTaskId);
}
if (Number(t.status) === 3) {
  addTx(state, 'campaignSettle', await mined(await contract.connect(finance).settleTask(organizationTaskId)));
}

let directTaskId = state.demo?.directTaskId;
if (!directTaskId) {
  addTx(state, 'createAgentToAgentTask', await mined(await contract.connect(manager).createDirectTask(
    hash('Analyze ZORYQ network metrics and prepare a concise report'),
    parseEther('1.2'),
    Math.floor(Date.now() / 1000) + 86400,
    { value: parseEther('1.2') }
  )));
  directTaskId = Number(await contract.taskCount());
  state.demo.directTaskId = directTaskId;
  writeJson(STATE_FILE, state);
}
let d = await contract.taskSummary(directTaskId);
if (Number(d.status) === 1) {
  addTx(state, 'directBid', await mined(await contract.connect(worker).bidForTask(directTaskId, parseEther('0.8'), hash('Metrics analysis proposal'))));
  addTx(state, 'directAssign', await mined(await contract.connect(manager).assignTask(directTaskId, worker.address)));
  d = await contract.taskSummary(directTaskId);
}
if (Number(d.status) === 2) {
  addTx(state, 'directSubmit', await mined(await contract.connect(worker).submitTask(directTaskId, hash('Metrics report delivered'))));
  d = await contract.taskSummary(directTaskId);
}
if (Number(d.status) === 3) {
  addTx(state, 'directSettle', await mined(await contract.connect(manager).settleTask(directTaskId)));
}

const workerSummary = await contract.agentSummary(worker.address);
const orgSummary = await contract.organizationSummary(organizationId);
state.demo = {
  ...state.demo,
  manager: manager.address,
  finance: finance.address,
  marketing: marketing.address,
  developer: developer.address,
  worker: worker.address,
  workerReputationBps: Number(workerSummary.reputationBps),
  workerSuccessfulTasks: Number(workerSummary.successfulTasks),
  workerGrossEarnedZQ: formatEther(workerSummary.grossEarned),
  organizationBalanceZQ: formatEther(orgSummary.balance),
  organizationLifetimeOutZQ: formatEther(orgSummary.lifetimeOut)
};
state.demoComplete = true;
state.demoCompletedAt = new Date().toISOString();
writeJson(STATE_FILE, state);
console.log(JSON.stringify(state, null, 2));
