import assert from 'node:assert/strict';
import { createPaymentIntent, verifyNativePayment, verifyErc20Payment, unlockEvolution } from './evolution-payment.mjs';

const treasury = '0x1111111111111111111111111111111111111111';
const payer = '0x2222222222222222222222222222222222222222';
const token = '0x3333333333333333333333333333333333333333';
const txHash = '0x' + 'ab'.repeat(32);

const disabled = {
  priceUsd: '1.99',
  chains: { base: { chainId: 8453, enabled: false, treasuryAddress: null, assets: [] } }
};
assert.throws(() => createPaymentIntent({ config: disabled, chainKey: 'base', asset: 'USDC', appId: 'a', evolutionId: 'e', requestHash: '0x01', quotedAmount: '1990000' }), /CHAIN_DISABLED/);

const config = {
  priceUsd: '1.99',
  chains: {
    base: {
      chainId: 8453,
      enabled: true,
      treasuryAddress: treasury,
      assets: [
        { symbol: 'ETH', type: 'native', decimals: 18, enabled: true },
        { symbol: 'USDC', type: 'erc20', address: token, decimals: 6, enabled: true }
      ]
    }
  }
};

const nativeIntent = createPaymentIntent({ config, chainKey: 'base', asset: 'ETH', appId: 'app-1', evolutionId: 'evo-1', requestHash: '0x01', payer, quotedAmount: '1000', quoteExpiresAt: '2099-01-01T00:00:00Z', nonce: 'n1' });
let result = verifyNativePayment({ intent: nativeIntent, currentChainId: 8453, transaction: { to: treasury, from: payer, value: '1000', hash: txHash }, receipt: { status: 1, transactionHash: txHash, blockNumber: 10 } });
assert.equal(result.ok, true);

result = verifyNativePayment({ intent: nativeIntent, currentChainId: 8453, transaction: { to: '0x4444444444444444444444444444444444444444', from: payer, value: '1000', hash: txHash }, receipt: { status: 1, transactionHash: txHash } });
assert.equal(result.code, 'WRONG_TREASURY');

result = verifyNativePayment({ intent: nativeIntent, currentChainId: 8453, transaction: { to: treasury, from: payer, value: '999', hash: txHash }, receipt: { status: 1, transactionHash: txHash } });
assert.equal(result.code, 'UNDERPAYMENT');

result = verifyNativePayment({ intent: nativeIntent, currentChainId: 1, transaction: { to: treasury, from: payer, value: '1000', hash: txHash }, receipt: { status: 1, transactionHash: txHash } });
assert.equal(result.code, 'WRONG_CHAIN');

const ercIntent = createPaymentIntent({ config, chainKey: 'base', asset: 'USDC', appId: 'app-1', evolutionId: 'evo-2', requestHash: '0x02', payer, quotedAmount: '1990000', nonce: 'n2' });
result = verifyErc20Payment({ intent: ercIntent, currentChainId: 8453, receipt: { status: 1, transactionHash: txHash, blockNumber: 11 }, transfer: { token, from: payer, to: treasury, value: '1990000', logIndex: 2 } });
assert.equal(result.ok, true);

const consumedPayments = new Set();
const consumedEvolutions = new Set();
assert.equal(unlockEvolution({ verification: result, consumedPayments, consumedEvolutions }), 'EVOLUTION_QUEUED');
assert.throws(() => unlockEvolution({ verification: result, consumedPayments, consumedEvolutions }), /PAYMENT_REPLAY/);

result = verifyErc20Payment({ intent: ercIntent, currentChainId: 8453, receipt: { status: 0, transactionHash: txHash }, transfer: { token, from: payer, to: treasury, value: '1990000', logIndex: 2 } });
assert.equal(result.code, 'RECEIPT_FAILED');

console.log('evolution-payment tests: PASS');
