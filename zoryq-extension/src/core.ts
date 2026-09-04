import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { bech32 } from '@scure/base';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const DOMAIN = 'zoryq-mldsa65-v1:account';
const SIGN_DOMAIN = 'zoryq-sign-v1:';
const TX_DOMAIN = 'zoryq-tx-v1:';

function normalize(m: string) { return m.trim().toLowerCase().replace(/\s+/g, ' '); }
function u32(v: number) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, v, false); return out; }
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function canonicalJson(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
}

function deriveKeypair(mnemonic: string, accountIndex = 0) {
  const m = normalize(mnemonic);
  if (!validPhrase(m)) throw new Error('Invalid BIP-39 recovery phrase');
  const root = mnemonicToSeedSync(m);
  const keySeed = sha256(concatBytes(utf8ToBytes(DOMAIN), root, u32(accountIndex)));
  const pair = ml_dsa65.keygen(keySeed);
  root.fill(0);
  keySeed.fill(0);
  return pair;
}

function addressFromPublicKey(publicKey: Uint8Array) {
  const payload = sha256(publicKey).slice(0, 20);
  return bech32.encode('zq', bech32.toWords(payload));
}

export function createPhrase() { return generateMnemonic(wordlist, 128); }
export function validPhrase(m: string) { return validateMnemonic(normalize(m), wordlist); }

export function identity(mnemonic: string, accountIndex = 0) {
  const { publicKey, secretKey } = deriveKeypair(mnemonic, accountIndex);
  const address = addressFromPublicKey(publicKey);
  secretKey.fill(0);
  return { address, publicKey: b64(publicKey), derivation: 'zoryq-mldsa65-v1' };
}

export function signMessage(mnemonic: string, message: string, accountIndex = 0) {
  if (!message || message.length > 8192) throw new Error('Invalid message length.');
  const { publicKey, secretKey } = deriveKeypair(mnemonic, accountIndex);
  const signature = ml_dsa65.sign(secretKey, utf8ToBytes(SIGN_DOMAIN + message));
  const address = addressFromPublicKey(publicKey);
  secretKey.fill(0);
  return { address, publicKey:b64(publicKey), signature:b64(signature), algorithm:'ML-DSA-65', domain:SIGN_DOMAIN };
}

export function signTransaction(mnemonic: string, tx: Record<string, any>, accountIndex = 0) {
  const { publicKey, secretKey } = deriveKeypair(mnemonic, accountIndex);
  const address = addressFromPublicKey(publicKey);
  if (tx.from !== address) { secretKey.fill(0); throw new Error('Transaction sender does not match unlocked wallet.'); }
  const unsigned = { ...tx, pubkey_format:'mldsa65-raw-v1', pubkey:b64(publicKey) };
  delete (unsigned as any).signature;
  const signature = ml_dsa65.sign(secretKey, utf8ToBytes(TX_DOMAIN + canonicalJson(unsigned)));
  secretKey.fill(0);
  return { ...unsigned, signature:b64(signature) };
}
