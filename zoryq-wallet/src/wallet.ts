import 'react-native-get-random-values';

import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { bech32 } from '@scure/base';
import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export const ZORYQ_WALLET_DERIVATION = 'zoryq-mldsa65-v1';
export const ZORYQ_HRP = 'zq';

export type ZoryqWalletIdentity = {
  address: string;
  publicKeyHex: string;
  derivation: string;
  accountIndex: number;
};

function normalizeMnemonic(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function u32be(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error('Invalid account index');
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

function deriveMlDsaSeed(mnemonic: string, accountIndex = 0) {
  const normalized = normalizeMnemonic(mnemonic);
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid BIP-39 recovery phrase');
  }

  const root = mnemonicToSeedSync(normalized);
  const domain = utf8ToBytes(`${ZORYQ_WALLET_DERIVATION}:account`);
  const child = sha256(concatBytes(domain, root, u32be(accountIndex)));
  root.fill(0);
  return child;
}

export function createRecoveryPhrase(words: 12 | 24 = 12) {
  return generateMnemonic(wordlist, words === 24 ? 256 : 128);
}

export function isValidRecoveryPhrase(mnemonic: string) {
  return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
}

export function deriveIdentity(
  mnemonic: string,
  accountIndex = 0,
): ZoryqWalletIdentity {
  const keySeed = deriveMlDsaSeed(mnemonic, accountIndex);
  const { publicKey, secretKey } = ml_dsa65.keygen(keySeed);
  const digest = sha256(publicKey).slice(0, 20);
  const address = bech32.encode(ZORYQ_HRP, bech32.toWords(digest));

  keySeed.fill(0);
  secretKey.fill(0);

  return {
    address,
    publicKeyHex: bytesToHex(publicKey),
    derivation: ZORYQ_WALLET_DERIVATION,
    accountIndex,
  };
}

export function signMessage(
  mnemonic: string,
  message: Uint8Array,
  accountIndex = 0,
) {
  const keySeed = deriveMlDsaSeed(mnemonic, accountIndex);
  const { publicKey, secretKey } = ml_dsa65.keygen(keySeed);
  const signature = ml_dsa65.sign(message, secretKey);
  const result = {
    publicKeyHex: bytesToHex(publicKey),
    signatureHex: bytesToHex(signature),
  };
  keySeed.fill(0);
  secretKey.fill(0);
  return result;
}
