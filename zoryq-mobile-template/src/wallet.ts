import 'react-native-get-random-values';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { bech32 } from '@scure/base';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { Buffer } from 'buffer';

export const API='https://juordakzclqefpuauzjq.supabase.co/functions/v1/zoryq-testnet';
export const CHAIN_ID='zoryq-testnet-1';
const ACCOUNT_DOMAIN='zoryq-mldsa65-v1:account';
const SIGN_DOMAIN='zoryq-sign-v1:';
const TX_DOMAIN='zoryq-tx-v1:';

function u32(v:number){const o=new Uint8Array(4);new DataView(o.buffer).setUint32(0,v,false);return o}
function b64(v:Uint8Array){return Buffer.from(v).toString('base64')}
function normalize(m:string){return m.trim().toLowerCase().replace(/\s+/g,' ')}
export function canonical(v:any):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'}
function derive(mnemonic:string){const m=normalize(mnemonic);if(!validateMnemonic(m,wordlist))throw new Error('Recovery phrase inválida.');const root=mnemonicToSeedSync(m);const seed=sha256(concatBytes(utf8ToBytes(ACCOUNT_DOMAIN),root,u32(0)));const pair=ml_dsa65.keygen(seed);root.fill(0);seed.fill(0);return pair}
function addressFromPk(pk:Uint8Array){return bech32.encode('zq',bech32.toWords(sha256(pk).slice(0,20)))}
export function createMnemonic(){return generateMnemonic(wordlist,128)}
export function validMnemonic(m:string){return validateMnemonic(normalize(m),wordlist)}
export function getIdentity(m:string){const p=derive(m);const out={address:addressFromPk(p.publicKey),publicKey:b64(p.publicKey)};p.secretKey.fill(0);return out}
export function signMessage(m:string,message:string){const p=derive(m);const signature=ml_dsa65.sign(p.secretKey,utf8ToBytes(SIGN_DOMAIN+message));const out={address:addressFromPk(p.publicKey),publicKey:b64(p.publicKey),signature:b64(signature),algorithm:'ML-DSA-65',domain:SIGN_DOMAIN};p.secretKey.fill(0);return out}
export function signTransaction(m:string,tx:any){const p=derive(m);const from=addressFromPk(p.publicKey);if(tx.from!==from){p.secretKey.fill(0);throw new Error('Origem da transação não corresponde à wallet.')}const unsigned={...tx,pubkey_format:'mldsa65-raw-v1',pubkey:b64(p.publicKey)};const signature=ml_dsa65.sign(p.secretKey,utf8ToBytes(TX_DOMAIN+canonical(unsigned)));p.secretKey.fill(0);return{...unsigned,signature:b64(signature)}}
export async function api(path:string,opts:any={}){const r=await fetch(API+path,{headers:{'Content-Type':'application/json'},...opts});const j=await r.json().catch(()=>({error:'Resposta inválida da rede'}));if(!r.ok)throw new Error(j.error||'Falha na ZORYQ Chain');return j}
