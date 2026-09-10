import fs from 'node:fs';
import { Contract, ContractFactory, HDNodeWallet, JsonRpcProvider, formatUnits, keccak256, toUtf8Bytes } from 'ethers';

const CHAIN_ID = 5919065;
const RPC = process.env.ZORYQ_INTERNAL_RPC || 'http://127.0.0.1:8082/rpc';
const MNEMONIC_FILE = process.env.ZORYQ_RETH_MNEMONIC_FILE || '/data/zoryq-reth-mnemonic.txt';
const ARTIFACT = process.env.ZORYQ_ONE_PROMPT_ARTIFACT || '/app/protocol-out/ZoryqOnePromptCompany.sol/ZoryqOnePromptCompany.json';
const STATE_FILE = process.env.ZORYQ_ONE_PROMPT_STATE || '/data/zoryq-one-prompt-company.json';
const PUBLIC_FILE = process.env.ZORYQ_ONE_PROMPT_PUBLIC_FILE || '/app/web/one-prompt-company-live.json';
const CANONICAL_PROMPT = 'Crie uma empresa digital com US$100.';
const USD6 = 1_000_000n;

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJson(file, value, mode = 0o600) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, mode); } catch {}
}
function walletAt(phrase, index, provider) { return HDNodeWallet.fromPhrase(phrase, '', `m/44'/60'/0'/0/${index}`).connect(provider); }
async function mined(tx) { const r = await tx.wait(); if (!r || r.status !== 1) throw new Error(`transaction failed: ${tx.hash}`); return r; }
function usd(value) { return formatUnits(value, 6); }

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) throw new Error(`wrong chain: ${network.chainId}`);
if (!fs.existsSync(MNEMONIC_FILE)) throw new Error('operator mnemonic file missing');
if (!fs.existsSync(ARTIFACT)) throw new Error('one-prompt company artifact missing');

const phrase = fs.readFileSync(MNEMONIC_FILE, 'utf8').trim();
const operator = walletAt(phrase, 20, provider);
const artifact = readJson(ARTIFACT);
const abi = artifact?.abi;
let bytecode = artifact?.bytecode?.object || '';
if (!abi || !bytecode) throw new Error('invalid one-prompt company artifact');
if (!bytecode.startsWith('0x')) bytecode = `0x${bytecode}`;

let state = readJson(STATE_FILE) || { schema: 1, chainId: CHAIN_ID, network: 'ZORYQ EVM Testnet' };
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
    schema: 1,
    chainId: CHAIN_ID,
    network: 'ZORYQ EVM Testnet',
    contractAddress: await deployed.getAddress(),
    deploymentTx: receipt.hash,
    deployedBy: operator.address,
    deployedAt: new Date().toISOString(),
    canonicalPrompt: CANONICAL_PROMPT,
    canonicalCompanyId: null,
    canonicalLaunchTx: null
  };
  writeJson(STATE_FILE, state);
}

if (!state.canonicalCompanyId) {
  const before = await contract.companyCount();
  const receipt = await mined(await contract.launchCompany(100n * USD6, keccak256(toUtf8Bytes(CANONICAL_PROMPT))));
  const after = await contract.companyCount();
  const companyId = after > before ? after : before + 1n;
  state.canonicalCompanyId = Number(companyId);
  state.canonicalLaunchTx = receipt.hash;
  state.canonicalLaunchedAt = new Date().toISOString();
  writeJson(STATE_FILE, state);
}

const companyId = BigInt(state.canonicalCompanyId);
const snapshot = await contract.companySnapshot(companyId);
const agentIds = await contract.companyAgentIds(companyId);
const agents = [];
for (const id of agentIds) {
  const a = await contract.agents(id);
  agents.push({
    id: Number(a.id),
    role: a.role,
    vault: a.vault,
    reputationBps: Number(a.reputationBps),
    jobsCompleted: Number(a.jobsCompleted),
    earnedDemoUsd: usd(a.earned)
  });
}
const firstJob = await contract.jobs(1);
state.demoUsdAddress = await contract.demoUsd();
state.canonicalSnapshot = {
  owner: snapshot.owner,
  treasury: snapshot.treasury,
  demoUsd: snapshot.token,
  treasuryBalanceDemoUsd: usd(snapshot.treasuryBalance),
  initialBudgetDemoUsd: usd(snapshot.initialBudget),
  revenueDemoUsd: usd(snapshot.revenue),
  expensesDemoUsd: usd(snapshot.expenses),
  profitAfterOperatingCostsDemoUsd: usd(snapshot.profitAfterOperatingCosts),
  cycleCount: Number(snapshot.cycleCount),
  teamSize: Number(snapshot.teamSize),
  constitutionHash: snapshot.constitutionHash,
  active: snapshot.active,
  agents,
  firstJob: {
    id: Number(firstJob.id),
    companyId: Number(firstJob.companyId),
    marketValueDemoUsd: usd(firstJob.marketValue),
    costDemoUsd: usd(firstJob.cost),
    specHash: firstJob.specHash,
    resultHash: firstJob.resultHash,
    verified: firstJob.verified,
    settled: firstJob.settled
  }
};
state.demoComplete = true;
state.lastVerifiedAt = new Date().toISOString();
writeJson(STATE_FILE, state);

const publicManifest = {
  schema: 'zoryq-one-prompt-company-live/0.1',
  network: { name: state.network, chainId: state.chainId, chainIdHex: '0x5a5159' },
  contractAddress: state.contractAddress,
  deploymentTx: state.deploymentTx,
  demoUsdAddress: state.demoUsdAddress,
  canonicalPrompt: state.canonicalPrompt,
  canonicalCompanyId: state.canonicalCompanyId,
  canonicalLaunchTx: state.canonicalLaunchTx,
  canonicalLaunchedAt: state.canonicalLaunchedAt,
  snapshot: state.canonicalSnapshot,
  verifiedAt: state.lastVerifiedAt,
  disclaimer: 'Public testnet demonstration only. dUSD is synthetic demo accounting and has no monetary value.'
};
writeJson(PUBLIC_FILE, publicManifest, 0o644);
console.log('[zoryq-company] '+JSON.stringify(publicManifest));
