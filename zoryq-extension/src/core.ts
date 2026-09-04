import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { bech32 } from '@scure/base';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const DOMAIN = 'zoryq-mldsa65-v1:account';

function normalize(m: string) { return m.trim().toLowerCase().replace(/\s+/g, ' '); }
function u32(v: number) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, v, false); return out; }

export function createPhrase() { return generateMnemonic(wordlist, 128); }
export function validPhrase(m: string) { return validateMnemonic(normalize(m), wordlist); }

export function identity(mnemonic: string, accountIndex = 0) {
  const m = normalize(mnemonic);
  if (!validPhrase(m)) throw new Error('Invalid BIP-39 recovery phrase');
  const root = mnemonicToSeedSync(m);
  const keySeed = sha256(concatBytes(utf8ToBytes(DOMAIN), root, u32(accountIndex)));
  const { publicKey, secretKey } = ml_dsa65.keygen(keySeed);
  const payload = sha256(publicKey).slice(0, 20);
  const address = bech32.encode('zq', bech32.toWords(payload));
  root.fill(0); keySeed.fill(0); secretKey.fill(0);
  return { address, derivation: 'zoryq-mldsa65-v1' };
}
