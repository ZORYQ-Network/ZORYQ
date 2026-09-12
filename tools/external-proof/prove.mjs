import { JsonRpcProvider, Wallet, formatEther } from 'ethers';

const RPC = process.env.ZORYQ_RPC_URL || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const FAUCET = process.env.ZORYQ_FAUCET_URL || 'https://zoryq-evm-node-live-production.up.railway.app/faucet/claim';
const EXPECTED_CHAIN_ID = 5919065n;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const provider = new JsonRpcProvider(RPC, Number(EXPECTED_CHAIN_ID), { staticNetwork: true });
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`chain_id_mismatch expected=${EXPECTED_CHAIN_ID} actual=${network.chainId}`);
  }

  // Fresh random wallet exists only in this process. Its private key is never printed or written.
  const wallet = Wallet.createRandom().connect(provider);
  const evidence = {
    schema: 'zoryq-external-first-transaction-proof/1.0',
    startedAt: new Date().toISOString(),
    chainId: Number(network.chainId),
    rpc: RPC,
    faucet: FAUCET,
    freshWalletAddress: wallet.address,
    faucetRequest: null,
    fundedBalanceWei: null,
    signedTransaction: null,
    receipt: null,
    completedAt: null,
    limitations: []
  };

  const faucetResponse = await fetch(FAUCET, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: wallet.address })
  });
  const faucetBody = await faucetResponse.json().catch(() => ({}));
  evidence.faucetRequest = {
    httpStatus: faucetResponse.status,
    ok: faucetResponse.ok,
    txHash: faucetBody.txHash || null,
    amount: faucetBody.amount || null,
    symbol: faucetBody.symbol || null,
    error: faucetBody.error || null,
    retryAfterSeconds: faucetBody.retryAfterSeconds || null
  };
  if (!faucetResponse.ok) {
    console.log(JSON.stringify(evidence, null, 2));
    throw new Error(`faucet_failed_http_${faucetResponse.status}:${faucetBody.error || 'unknown'}`);
  }

  let balance = 0n;
  for (let i = 0; i < 60; i += 1) {
    balance = await provider.getBalance(wallet.address);
    if (balance > 0n) break;
    await sleep(1000);
  }
  if (balance <= 0n) throw new Error('funded_balance_not_observed');
  evidence.fundedBalanceWei = balance.toString();
  evidence.fundedBalanceZq = formatEther(balance);

  const recipient = Wallet.createRandom().address;
  const tx = await wallet.sendTransaction({ to: recipient, value: 1n });
  evidence.signedTransaction = {
    hash: tx.hash,
    from: wallet.address,
    to: recipient,
    valueWei: '1'
  };

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('transaction_receipt_failed');
  evidence.receipt = {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status
  };
  evidence.completedAt = new Date().toISOString();

  console.log(JSON.stringify(evidence, null, 2));
}

main().catch(error => {
  console.error(`[zoryq-external-proof] ${error.message}`);
  process.exit(1);
});
