import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ContractFactory,
  HDNodeWallet,
  JsonRpcProvider,
  Wallet,
  keccak256,
  parseEther,
} = require('../../zoryq-evm-node/node_modules/ethers');
const solc = require('../../zoryq-evm-node/node_modules/solc');

const CONCURRENT_RPC = process.env.ZORYQ_CONCURRENT_RPC || 'http://127.0.0.1:8081/rpc';
const SERIAL_RPC = process.env.ZORYQ_SERIAL_RPC || 'http://127.0.0.1:8082/rpc';
const CONCURRENT_BASE = process.env.ZORYQ_CONCURRENT_BASE || CONCURRENT_RPC.replace(/\/rpc$/, '');
const SERIAL_BASE = process.env.ZORYQ_SERIAL_BASE || SERIAL_RPC.replace(/\/rpc$/, '');
const CHAIN_ID = 5919065;
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const OUT = process.env.ZORYQ_SERIAL_EQ_OUT || 'serial-equivalence-results.json';

const providerA = new JsonRpcProvider(CONCURRENT_RPC, CHAIN_ID, { staticNetwork: true });
const providerB = new JsonRpcProvider(SERIAL_RPC, CHAIN_ID, { staticNetwork: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function derive(index, provider) {
  return HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
}

async function assertPrefunded(provider, address) {
  const balance = await provider.getBalance(address);
  assert(balance > 0n, `genesis account is not funded: ${address}`);
  return balance;
}

async function waitReady(base) {
  for (let i = 0; i < 90; i += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) {
        const body = await response.json();
        const chainId = body?.chain?.chainId ?? body?.chainId;
        if (Number(chainId) === CHAIN_ID) return body;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error(`node did not become ready: ${base}`);
}

const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ZoryqConcurrencyProbe {
  mapping(bytes32 => uint256) public slots;
  mapping(address => uint256) public tokenBalance;
  mapping(bytes32 => uint256) public agentSpent;
  uint256 public reserveA;
  uint256 public reserveB;
  event Touched(bytes32 indexed key, uint256 value);
  constructor() { reserveA = 1000000; reserveB = 1000000; }
  function setHot(uint256 value) external { slots[keccak256("hot")] = value; emit Touched(keccak256("hot"), value); }
  function incrementHot() external { bytes32 k=keccak256("hot"); slots[k]+=1; emit Touched(k,slots[k]); }
  function setPartition(bytes32 key,uint256 value) external { slots[key]=value; emit Touched(key,value); }
  function mintSelf(uint256 amount) external { tokenBalance[msg.sender]+=amount; }
  function transferToken(address to,uint256 amount) external { require(tokenBalance[msg.sender]>=amount,"balance"); tokenBalance[msg.sender]-=amount; tokenBalance[to]+=amount; }
  function dexUpdate(uint256 addA,uint256 addB) external { reserveA+=addA; reserveB+=addB; }
  function agentSpend(bytes32 agent,uint256 amount,uint256 budget) external { uint256 next=agentSpent[agent]+amount; require(next<=budget,"budget"); agentSpent[agent]=next; }
  function alwaysRevert() external pure { revert("expected"); }
}`;

function compileProbe() {
  const input = {
    language: 'Solidity',
    sources: { 'ZoryqConcurrencyProbe.sol': { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  assert.equal(errors.length, 0, errors.map((e) => e.formattedMessage).join('\n'));
  return output.contracts['ZoryqConcurrencyProbe.sol'].ZoryqConcurrencyProbe;
}

async function deploySame(artifact) {
  const deployerA = derive(0, providerA);
  const deployerB = derive(0, providerB);
  await assertPrefunded(providerA, deployerA.address);
  await assertPrefunded(providerB, deployerB.address);

  const factoryA = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, deployerA);
  const factoryB = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, deployerB);
  const contractA = await factoryA.deploy();
  const contractB = await factoryB.deploy();
  await contractA.waitForDeployment();
  await contractB.waitForDeployment();
  assert.equal((await contractA.getAddress()).toLowerCase(), (await contractB.getAddress()).toLowerCase());
  return { contractA, contractB };
}

async function prepareWallets(count) {
  const walletsA = [];
  const walletsB = [];
  for (let i = 1; i <= count; i += 1) {
    const a = derive(i, providerA);
    const b = derive(i, providerB);
    assert.equal(a.address.toLowerCase(), b.address.toLowerCase());
    await assertPrefunded(providerA, a.address);
    await assertPrefunded(providerB, b.address);
    walletsA.push(a);
    walletsB.push(b);
  }
  return { walletsA, walletsB };
}

async function signCall(wallet, to, data, nonce, gasPrice) {
  return wallet.signTransaction({
    chainId: CHAIN_ID,
    nonce,
    to,
    data,
    gasLimit: 500000n,
    gasPrice,
    type: 0,
    value: 0n,
  });
}

async function signTransfer(wallet, to, value, nonce, gasPrice) {
  return wallet.signTransaction({
    chainId: CHAIN_ID,
    nonce,
    to,
    value,
    gasLimit: 21000n,
    gasPrice,
    type: 0,
  });
}

async function sendConcurrent(rawItems) {
  const submissions = await Promise.all(rawItems.map(async (item) => {
    const hash = await providerA.broadcastTransaction(item.raw).then((tx) => tx.hash);
    return { ...item, hash };
  }));
  const receipts = [];
  for (const item of submissions) {
    const receipt = await providerA.waitForTransaction(item.hash, 1, 120000);
    assert(receipt, `missing receipt ${item.hash}`);
    receipts.push({
      ...item,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.index,
      status: Number(receipt.status),
      gasUsed: receipt.gasUsed.toString(),
    });
  }
  return receipts.sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
}

async function replaySerial(canonical) {
  const receipts = [];
  for (const item of canonical) {
    const tx = await providerB.broadcastTransaction(item.raw);
    // waitForTransaction returns the mined receipt even when status=0, which is
    // required here because reverted transactions are part of the canonical
    // workload and must be compared rather than treated as harness failures.
    const receipt = await providerB.waitForTransaction(tx.hash, 1, 120000);
    assert(receipt, `missing serial receipt ${item.hash}`);
    receipts.push({
      hash: tx.hash,
      workload: item.workload,
      status: Number(receipt.status),
      gasUsed: receipt.gasUsed.toString(),
    });
  }
  return receipts;
}

async function stateDigest(contract, provider, wallets) {
  const hotKey = keccak256(Buffer.from('hot'));
  const partitions = ['p0', 'p1', 'p2', 'p3'].map((v) => keccak256(Buffer.from(v)));
  const agents = ['agent-a', 'agent-b'].map((v) => keccak256(Buffer.from(v)));
  const state = {
    head: await provider.getBlockNumber(),
    hot: (await contract.slots(hotKey)).toString(),
    partitions: {},
    tokenBalances: {},
    nativeBalances: {},
    reserves: [(await contract.reserveA()).toString(), (await contract.reserveB()).toString()],
    agentSpent: {},
  };
  for (const key of partitions) state.partitions[key] = (await contract.slots(key)).toString();
  for (const wallet of wallets) {
    state.tokenBalances[wallet.address] = (await contract.tokenBalance(wallet.address)).toString();
    state.nativeBalances[wallet.address] = (await provider.getBalance(wallet.address)).toString();
  }
  for (const key of agents) state.agentSpent[key] = (await contract.agentSpent(key)).toString();
  const comparable = { ...state };
  delete comparable.head;
  return { state, digest: sha256(JSON.stringify(comparable)) };
}

async function main() {
  const healthA = await waitReady(CONCURRENT_BASE);
  const healthB = await waitReady(SERIAL_BASE);
  assert.equal(Number(healthA?.chain?.chainId ?? healthA?.chainId), CHAIN_ID);
  assert.equal(Number(healthB?.chain?.chainId ?? healthB?.chainId), CHAIN_ID);

  const artifact = compileProbe();
  const { contractA, contractB } = await deploySame(artifact);
  const contractAddress = await contractA.getAddress();
  const { walletsA, walletsB } = await prepareWallets(8);
  const gasPrice = (await providerA.getFeeData()).gasPrice || 1000000000n;
  const rawItems = [];
  const nextNonce = new Map();

  for (const wallet of walletsA) nextNonce.set(wallet.address, await providerA.getTransactionCount(wallet.address));
  const takeNonce = (wallet) => {
    const n = nextNonce.get(wallet.address);
    nextNonce.set(wallet.address, n + 1);
    return n;
  };
  const pushCall = async (workload, wallet, fn, args) => {
    const data = contractA.interface.encodeFunctionData(fn, args);
    const nonce = takeNonce(wallet);
    const raw = await signCall(wallet, contractAddress, data, nonce, gasPrice);
    rawItems.push({ workload, from: wallet.address, nonce, to: contractAddress, data, raw, inputHash: keccak256(raw) });
  };
  const pushTransfer = async (workload, wallet, to, value) => {
    const nonce = takeNonce(wallet);
    const raw = await signTransfer(wallet, to, value, nonce, gasPrice);
    rawItems.push({ workload, from: wallet.address, nonce, to, value: value.toString(), raw, inputHash: keccak256(raw) });
  };

  // 1. Independent transfers across disjoint accounts.
  for (let i = 0; i < 4; i += 1) await pushTransfer('independent-transfers', walletsA[i], walletsA[i + 4].address, parseEther('0.01'));

  // 2. Same-sender nonce contention: signed sequential nonces are submitted concurrently.
  for (let i = 0; i < 4; i += 1) await pushTransfer('same-sender-nonce-contention', walletsA[0], walletsA[7].address, 1000n + BigInt(i));

  // 3. Many writers to one storage slot. Final value depends on canonical execution order.
  for (let i = 0; i < 6; i += 1) await pushCall('single-storage-hotspot', walletsA[i], 'setHot', [100n + BigInt(i)]);

  // 4. Independent contract storage partitions.
  for (let i = 0; i < 4; i += 1) await pushCall('independent-storage-partitions', walletsA[i], 'setPartition', [keccak256(Buffer.from(`p${i}`)), 1000n + BigInt(i)]);

  // Seed token balances identically inside the measured transaction set.
  for (let i = 0; i < 6; i += 1) await pushCall('erc20-hotspot-seed', walletsA[i], 'mintSelf', [1000n]);
  // 5. ERC-20-like hotspot recipient contention.
  for (let i = 0; i < 6; i += 1) await pushCall('erc20-hotspot-recipient', walletsA[i], 'transferToken', [walletsA[7].address, 100n]);

  // 6. DEX-like reserve updates from independent senders.
  for (let i = 0; i < 6; i += 1) await pushCall('dex-like-reserve-updates', walletsA[i], 'dexUpdate', [10n + BigInt(i), 20n + BigInt(i)]);

  // 7. Agent batches with overlapping budgets/allowances; some should revert once the budget is exhausted.
  const agentA = keccak256(Buffer.from('agent-a'));
  const agentB = keccak256(Buffer.from('agent-b'));
  for (let i = 0; i < 4; i += 1) await pushCall('agent-overlapping-budget', walletsA[i], 'agentSpend', [agentA, 30n, 100n]);
  for (let i = 4; i < 8; i += 1) await pushCall('agent-overlapping-budget', walletsA[i], 'agentSpend', [agentB, 26n, 100n]);

  // 8. Explicit reverted transactions mixed with successful transactions.
  await pushCall('mixed-revert-success', walletsA[0], 'incrementHot', []);
  await pushCall('mixed-revert-success', walletsA[1], 'alwaysRevert', []);
  await pushCall('mixed-revert-success', walletsA[2], 'incrementHot', []);
  await pushCall('mixed-revert-success', walletsA[3], 'alwaysRevert', []);

  const canonical = await sendConcurrent(rawItems);
  const serialReceipts = await replaySerial(canonical);
  const concurrentStatuses = canonical.map((r) => ({ hash: r.hash, workload: r.workload, status: r.status }));
  const serialStatuses = serialReceipts.map((r) => ({ hash: r.hash, workload: r.workload, status: r.status }));
  const receiptStatusEqual = JSON.stringify(concurrentStatuses) === JSON.stringify(serialStatuses);

  const stateA = await stateDigest(contractA, providerA, walletsA);
  const stateB = await stateDigest(contractB, providerB, walletsB);
  const stateEqual = stateA.digest === stateB.digest;
  const revertedCount = canonical.filter((r) => r.status === 0).length;

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    chainId: CHAIN_ID,
    contractAddress,
    workloadClasses: [...new Set(rawItems.map((x) => x.workload))],
    orderedTransactionInputSet: canonical.map(({ raw, ...item }) => item),
    concurrentReceipts: canonical.map(({ raw, data, ...item }) => item),
    serialReferenceReceipts: serialReceipts,
    concurrentState: stateA.state,
    serialReferenceState: stateB.state,
    concurrentStateDigest: stateA.digest,
    serialReferenceStateDigest: stateB.digest,
    equality: {
      finalState: stateEqual,
      receiptStatuses: receiptStatusEqual,
    },
    failedOrRevertedTransactionCount: revertedCount,
    conflictCount: null,
    reexecutionCount: null,
    conflictTelemetry: 'UNAVAILABLE_IN_CURRENT_EXECUTION_PATH',
    gateBStatus: stateEqual && receiptStatusEqual ? 'PARTIAL_BLOCKED_CONFLICT_TELEMETRY' : 'FAIL',
    claimPolicy: 'This harness does not prove parallel execution. Gate B cannot pass until the execution path exposes conflict and re-execution evidence and the same serial-equivalence assertions pass against that path.',
  };

  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    output: OUT,
    transactions: canonical.length,
    revertedCount,
    stateEqual,
    receiptStatusEqual,
    gateBStatus: result.gateBStatus,
    concurrentStateDigest: stateA.digest,
    serialReferenceStateDigest: stateB.digest,
  }, null, 2));

  assert.equal(receiptStatusEqual, true, 'concurrent receipt statuses differ from canonical serial replay');
  assert.equal(stateEqual, true, 'concurrent final state differs from canonical serial replay');
}

main().catch(async (error) => {
  const failure = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gateBStatus: 'FAIL',
    error: error?.stack || String(error),
  };
  await writeFile(OUT, `${JSON.stringify(failure, null, 2)}\n`).catch(() => {});
  console.error(error);
  process.exit(1);
});