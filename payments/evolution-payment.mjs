import crypto from 'node:crypto';

export const EVOLUTION_PRICE_USD = '1.99';

export function normalizeAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error('INVALID_ADDRESS');
  }
  return value.toLowerCase();
}

export function assertChainEnabled(config, chainKey) {
  const chain = config?.chains?.[chainKey];
  if (!chain) throw new Error('UNSUPPORTED_CHAIN');
  if (!chain.enabled) throw new Error('CHAIN_DISABLED');
  if (!chain.treasuryAddress) throw new Error('TREASURY_UNSET');
  normalizeAddress(chain.treasuryAddress);
  return chain;
}

export function createPaymentIntent({ config, chainKey, asset, appId, evolutionId, requestHash, payer, quotedAmount, quoteSource = null, quoteExpiresAt = null, nonce = crypto.randomUUID() }) {
  const chain = assertChainEnabled(config, chainKey);
  const allowedAsset = chain.assets?.find((entry) => entry.symbol === asset);
  if (!allowedAsset || allowedAsset.enabled === false) throw new Error('ASSET_DISABLED');

  if (!appId || !evolutionId || !requestHash || !quotedAmount) throw new Error('INVALID_INTENT_INPUT');

  return Object.freeze({
    version: '1',
    appId,
    evolutionId,
    requestHash,
    priceUsd: EVOLUTION_PRICE_USD,
    chainKey,
    chainId: chain.chainId,
    treasuryAddress: normalizeAddress(chain.treasuryAddress),
    assetType: allowedAsset.type,
    assetSymbol: allowedAsset.symbol,
    assetAddress: allowedAsset.type === 'erc20' ? normalizeAddress(allowedAsset.address) : 'native',
    decimals: allowedAsset.decimals ?? 18,
    quotedAmount: String(quotedAmount),
    quoteSource,
    quoteExpiresAt,
    payer: payer ? normalizeAddress(payer) : null,
    nonce
  });
}

export function paymentReplayKey({ chainId, txHash, logIndex = 'native' }) {
  if (!chainId || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('INVALID_PAYMENT_KEY');
  return `${chainId}:${txHash.toLowerCase()}:${logIndex}`;
}

export function evolutionReplayKey(intent) {
  return `${intent.appId}:${intent.evolutionId}:${intent.nonce}`;
}

export function verifyNativePayment({ intent, transaction, receipt, currentChainId, consumedPayments = new Set(), consumedEvolutions = new Set(), now = new Date() }) {
  if (intent.assetType !== 'native') return { ok: false, code: 'WRONG_ASSET_TYPE' };
  if (Number(currentChainId) !== Number(intent.chainId)) return { ok: false, code: 'WRONG_CHAIN' };
  if (!receipt || Number(receipt.status) !== 1) return { ok: false, code: 'RECEIPT_FAILED' };
  if (!transaction) return { ok: false, code: 'TX_MISSING' };
  if (normalizeAddress(transaction.to) !== intent.treasuryAddress) return { ok: false, code: 'WRONG_TREASURY' };
  if (intent.payer && normalizeAddress(transaction.from) !== intent.payer) return { ok: false, code: 'WRONG_PAYER' };

  const expected = BigInt(intent.quotedAmount);
  const actual = BigInt(transaction.value ?? 0);
  if (actual < expected) return { ok: false, code: 'UNDERPAYMENT' };

  if (intent.quoteExpiresAt && now.getTime() > new Date(intent.quoteExpiresAt).getTime()) return { ok: false, code: 'STALE_QUOTE' };

  const txHash = receipt.transactionHash ?? transaction.hash;
  const payKey = paymentReplayKey({ chainId: intent.chainId, txHash });
  const evoKey = evolutionReplayKey(intent);
  if (consumedPayments.has(payKey)) return { ok: false, code: 'PAYMENT_REPLAY' };
  if (consumedEvolutions.has(evoKey)) return { ok: false, code: 'EVOLUTION_ALREADY_UNLOCKED' };

  return {
    ok: true,
    code: 'PAYMENT_VERIFIED',
    payKey,
    evoKey,
    evidence: {
      chainId: intent.chainId,
      txHash,
      treasury: intent.treasuryAddress,
      asset: intent.assetSymbol,
      amount: actual.toString(),
      receiptStatus: Number(receipt.status),
      blockNumber: receipt.blockNumber ?? null
    }
  };
}

export function verifyErc20Payment({ intent, receipt, currentChainId, transfer, consumedPayments = new Set(), consumedEvolutions = new Set(), now = new Date() }) {
  if (intent.assetType !== 'erc20') return { ok: false, code: 'WRONG_ASSET_TYPE' };
  if (Number(currentChainId) !== Number(intent.chainId)) return { ok: false, code: 'WRONG_CHAIN' };
  if (!receipt || Number(receipt.status) !== 1) return { ok: false, code: 'RECEIPT_FAILED' };
  if (!transfer) return { ok: false, code: 'TRANSFER_LOG_MISSING' };
  if (normalizeAddress(transfer.token) !== intent.assetAddress) return { ok: false, code: 'WRONG_TOKEN' };
  if (normalizeAddress(transfer.to) !== intent.treasuryAddress) return { ok: false, code: 'WRONG_TREASURY' };
  if (intent.payer && normalizeAddress(transfer.from) !== intent.payer) return { ok: false, code: 'WRONG_PAYER' };
  if (BigInt(transfer.value ?? 0) < BigInt(intent.quotedAmount)) return { ok: false, code: 'UNDERPAYMENT' };
  if (intent.quoteExpiresAt && now.getTime() > new Date(intent.quoteExpiresAt).getTime()) return { ok: false, code: 'STALE_QUOTE' };

  const txHash = receipt.transactionHash;
  const logIndex = transfer.logIndex ?? 0;
  const payKey = paymentReplayKey({ chainId: intent.chainId, txHash, logIndex });
  const evoKey = evolutionReplayKey(intent);
  if (consumedPayments.has(payKey)) return { ok: false, code: 'PAYMENT_REPLAY' };
  if (consumedEvolutions.has(evoKey)) return { ok: false, code: 'EVOLUTION_ALREADY_UNLOCKED' };

  return {
    ok: true,
    code: 'PAYMENT_VERIFIED',
    payKey,
    evoKey,
    evidence: {
      chainId: intent.chainId,
      txHash,
      logIndex,
      treasury: intent.treasuryAddress,
      asset: intent.assetSymbol,
      token: intent.assetAddress,
      amount: String(transfer.value),
      receiptStatus: Number(receipt.status),
      blockNumber: receipt.blockNumber ?? null
    }
  };
}

export function unlockEvolution({ verification, consumedPayments, consumedEvolutions }) {
  if (!verification?.ok || verification.code !== 'PAYMENT_VERIFIED') throw new Error('PAYMENT_NOT_VERIFIED');
  if (consumedPayments.has(verification.payKey)) throw new Error('PAYMENT_REPLAY');
  if (consumedEvolutions.has(verification.evoKey)) throw new Error('EVOLUTION_ALREADY_UNLOCKED');
  consumedPayments.add(verification.payKey);
  consumedEvolutions.add(verification.evoKey);
  return 'EVOLUTION_QUEUED';
}
