import fs from 'node:fs';
import { Contract, ContractFactory, HDNodeWallet, JsonRpcProvider, formatUnits, keccak256, toUtf8Bytes } from 'ethers';

const CHAIN_ID = 5919065;
const RPC = process.env.ZORYQ_INTERNAL_RPC || 'http://127.0.0.1:8082/rpc';
const MNEMONIC_FILE = process.env.ZORYQ_RETH_MNEMONIC_FILE || '/data/zoryq-reth-mnemonic.txt';
const ARTIFACT = process.env.ZORYQ_AUTONOMOUS_COMPANY_V2_ARTIFACT || '/app/protocol-out/ZoryqAutonomousCompanyV2.sol/ZoryqAutonomousCompanyV2.json';
const STATE_FILE = process.env.ZORYQ_AUTONOMOUS_COMPANY_V2_STATE || '/data/zoryq-autonomous-company-v2.json';
const NAME = 'ZORYQ Autonomous Studio';
const OBJECTIVE = 'Criar e vender produtos digitais para projetos Web3 com equipe autonoma';
const PROMPT = 'Crie uma empresa digital com US$100.';
const USD6 = 1_000_000n;

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch {}
}
function walletAt(phrase, index, provider) { return HDNodeWallet.fromPhrase(phrase, '', `m/44'/60'/0'/0/${index}`).connect(provider); }
async function mined(tx) { const r = await tx.wait(); if (!r || r.status !== 1) throw new Error(`transaction failed: ${tx.hash}`); return r; }
function usd(value) { return formatUnits(value, 6); }
function roleText(role) { try { return Buffer.from(role.slice(2), 'hex').toString('utf8').replace(/\0+$/,''); } catch { return role; } }

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) throw new Error(`wrong chain: ${network.chainId}`);
if (!fs.existsSync(MNEMONIC_FILE)) throw new Error('operator mnemonic file missing');
if (!fs.existsSync(ARTIFACT)) throw new Error('autonomous company v2 artifact missing');

const phrase = fs.readFileSync(MNEMONIC_FILE, 'utf8').trim();
const operator = walletAt(phrase, 20, provider);
const artifact = readJson(ARTIFACT);
const abi = artifact?.abi;
let bytecode = artifact?.bytecode?.object || '';
if (!abi || !bytecode) throw new Error('invalid autonomous company v2 artifact');
if (!bytecode.startsWith('0x')) bytecode = `0x${bytecode}`;

let state = readJson(STATE_FILE) || { schema: 2, chainId: CHAIN_ID, network: 'ZORYQ EVM Testnet' };
let contract;
if (state.contractAddress) {
  const code = await provider.getCode(state.contractAddress);
  if (code !== '0x') contract = new Contract(state.contractAddress, abi, operator);
}

if (!contract) {
  const factory = new ContractFactory(abi, bytecode, operator);
  const deployed = await factory.deploy();
  const receipt = await mined(deployed.deploymentTransaction());
  contract = deployed;
  state = {
    schema: 2,
    chainId: CHAIN_ID,
    network: 'ZORYQ EVM Testnet',
    contractAddress: await deployed.getAddress(),
    deploymentTx: receipt.hash,
    deployedBy: operator.address,
    deployedAt: new Date().toISOString(),
    canonicalPrompt: PROMPT,
    canonicalCompanyId: null,
    canonicalLaunchTx: null
  };
  writeJson(STATE_FILE, state);
}

if (!state.canonicalCompanyId) {
  const before = await contract.companyCount();
  const receipt = await mined(await contract.launchCompany(NAME, OBJECTIVE, 100n * USD6, keccak256(toUtf8Bytes(PROMPT))));
  const after = await contract.companyCount();
  state.canonicalCompanyId = Number(after > before ? after : before + 1n);
  state.canonicalLaunchTx = receipt.hash;
  state.canonicalLaunchedAt = new Date().toISOString();
  writeJson(STATE_FILE, state);
}

const id = BigInt(state.canonicalCompanyId);
const s = await contract.companySnapshot(id);
const agentIds = await contract.companyAgentIds(id);
const agents = [];
for (const agentId of agentIds) {
  const a = await contract.agents(agentId);
  agents.push({
    id: Number(a.id),
    role: roleText(a.role),
    vault: a.vault,
    permissions: Number(a.permissions),
    reputationBps: Number(a.reputationBps),
    jobsCompleted: Number(a.jobsCompleted),
    perCycleLimitDemoUsd: usd(a.perCycleLimit),
    earnedDemoUsd: usd(a.earned),
    active: a.active
  });
}
const job = await contract.jobs(1);
state.demoUsdAddress = s.token;
state.canonicalSnapshot = {
  name: s.name,
  objective: s.objective,
  owner: s.owner,
  treasury: s.treasury,
  demoUsd: s.token,
  treasuryBalanceDemoUsd: usd(s.treasuryBalance),
  initialBudgetDemoUsd: usd(s.initialBudget),
  revenueDemoUsd: usd(s.revenue),
  expensesDemoUsd: usd(s.expenses),
  profitAfterOperatingCostsDemoUsd: usd(s.profitAfterOperatingCosts),
  cycleCount: Number(s.cycleCount),
  teamSize: Number(s.teamSize),
  constitutionHash: s.constitutionHash,
  active: s.active,
  emergencyStopEnabled: s.emergencyStopEnabled,
  humanInterventions: Number(s.humanInterventions),
  agents,
  firstJob: {
    id: Number(job.id),
    companyId: Number(job.companyId),
    leadAgentId: Number(job.leadAgentId),
    verifierAgentId: Number(job.verifierAgentId),
    marketValueDemoUsd: usd(job.marketValue),
    costDemoUsd: usd(job.cost),
    specHash: job.specHash,
    resultHash: job.resultHash,
    verified: job.verified,
    settled: job.settled
  }
};
state.demoComplete = true;
state.lastVerifiedAt = new Date().toISOString();
writeJson(STATE_FILE, state);
console.log('[zoryq-company-v2] '+JSON.stringify(state));
