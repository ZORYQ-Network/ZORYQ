import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { HDNodeWallet, Wallet, parseEther } from 'ethers';

const CHAIN_ID=5919065;
const BASE=process.env.ZORYQ_RETH_BASE_GENESIS||'/app/zoryq-reth-genesis.json';
const OUT=process.env.ZORYQ_RETH_CHAIN_SPEC||'/data/zoryq-reth-effective-genesis.json';
const DATA_DIR=process.env.ZORYQ_RETH_DATA_DIR||'/data/reth';
const MNEMONIC_FILE=process.env.ZORYQ_RETH_MNEMONIC_FILE||'/data/zoryq-reth-mnemonic.txt';
const MIGRATION_FILE=process.env.ZORYQ_RETH_MIGRATION_STATUS||'/data/zoryq-reth-migration.json';
const CHECKPOINT_ROOT=process.env.ZORYQ_CHECKPOINT_ROOT||'/data/zoryq-checkpoints';
const LEGACY_STATE=process.env.ZORYQ_STATE_PATH||'/data/zoryq-state.json';
const MIGRATE=String(process.env.ZORYQ_MIGRATE_ANVIL_TO_RETH||'false').toLowerCase()==='true';
const OPERATOR_COUNT=Math.max(2,Number(process.env.ZORYQ_RETH_OPERATOR_COUNT||20));
const OPERATOR_BALANCE=process.env.ZORYQ_RETH_OPERATOR_BALANCE||'10000';

fs.mkdirSync('/data',{recursive:true});
fs.mkdirSync(DATA_DIR,{recursive:true});
function hasEntries(dir){try{return fs.readdirSync(dir).length>0}catch{return false}}
function atomicWrite(file,text,mode=0o600){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}`;fs.writeFileSync(tmp,text,{encoding:'utf8',mode});fs.renameSync(tmp,file);try{fs.chmodSync(file,mode)}catch{}}
function loadJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function loadOrCreateMnemonic(){const configured=String(process.env.ZORYQ_RETH_MNEMONIC||'').trim();if(configured){if(!fs.existsSync(MNEMONIC_FILE))atomicWrite(MNEMONIC_FILE,configured+'\n');return configured}try{const saved=fs.readFileSync(MNEMONIC_FILE,'utf8').trim();if(saved)return saved}catch{}const phrase=Wallet.createRandom().mnemonic?.phrase;if(!phrase)throw Error('unable_to_generate_reth_mnemonic');atomicWrite(MNEMONIC_FILE,phrase+'\n');return phrase}
function checkpointCandidates(){return [path.join(CHECKPOINT_ROOT,'current','state.hex.gz'),path.join(CHECKPOINT_ROOT,'previous','state.hex.gz'),LEGACY_STATE].filter(f=>fs.existsSync(f))}
function decodeAnvilState(file){
  const data=fs.readFileSync(file);
  if(file.endsWith('.hex.gz')){
    const hex=gunzipSync(data).toString('ascii').trim();
    if(!/^[0-9a-fA-F]+$/.test(hex)||hex.length%2)throw Error(`invalid Anvil checkpoint hex: ${file}`);
    const packed=Buffer.from(hex,'hex');
    let jsonBytes;try{jsonBytes=gunzipSync(packed)}catch{jsonBytes=packed}
    return JSON.parse(jsonBytes.toString('utf8'));
  }
  const text=data.toString('utf8').trim();
  try{return JSON.parse(text)}catch{}
  if(/^[0-9a-fA-F]+$/.test(text)&&text.length%2===0){const packed=Buffer.from(text,'hex');let bytes;try{bytes=gunzipSync(packed)}catch{bytes=packed};return JSON.parse(bytes.toString('utf8'))}
  throw Error(`unsupported legacy Anvil state format: ${file}`);
}
function normalizeAccount(account={}){const out={balance:account.balance||'0x0'};if(account.nonce&&account.nonce!=='0x0')out.nonce=account.nonce;if(account.code&&account.code!=='0x')out.code=account.code;if(account.storage&&Object.keys(account.storage).length)out.storage=account.storage;return out}
function anvilAlloc(state){const accounts=state?.accounts||state?.state?.accounts;if(!accounts||typeof accounts!=='object')throw Error('Anvil state has no accounts map');const alloc={};for(const [address,account] of Object.entries(accounts)){if(/^0x[0-9a-fA-F]{40}$/.test(address))alloc[address]=normalizeAccount(account)}return alloc}
function checkpointMeta(source){try{return loadJson(path.join(path.dirname(source),'meta.json'))}catch{return null}}

if(fs.existsSync(OUT)){
  const current=loadJson(OUT);if(Number(current?.config?.chainId)!==CHAIN_ID)throw Error(`persisted Reth genesis chainId mismatch in ${OUT}`);
  if(!fs.existsSync(MNEMONIC_FILE)&&!String(process.env.ZORYQ_RETH_MNEMONIC||'').trim())throw Error('persisted Reth genesis exists but operator mnemonic is missing');
  console.log(`[zoryq-reth] using persisted effective genesis ${OUT}`);
  process.exit(0);
}
if(hasEntries(DATA_DIR))throw Error('Reth database exists but effective genesis is missing; refusing to guess chain specification');

const genesis=loadJson(BASE);if(Number(genesis?.config?.chainId)!==CHAIN_ID)throw Error('base Reth genesis chainId mismatch');
genesis.alloc={...(genesis.alloc||{})};
const legacy=checkpointCandidates();
let migration=null;
if(legacy.length){
  if(!MIGRATE)throw Error('legacy Anvil state detected. Set ZORYQ_MIGRATE_ANVIL_TO_RETH=true for the explicit one-time state migration');
  const source=legacy[0],state=decodeAnvilState(source),alloc=anvilAlloc(state);Object.assign(genesis.alloc,alloc);const meta=checkpointMeta(source);migration={version:1,from:'anvil',to:'reth-native-db',source,accountsMigrated:Object.keys(alloc).length,legacyBlockNumber:meta?.blockNumber||null,legacyBlockHash:meta?.blockHash||null,createdAt:Date.now(),note:'Account state (balance, nonce, code, storage) migrated into new Reth genesis. Legacy block/transaction history is not part of genesis state.'};
}

const mnemonic=loadOrCreateMnemonic();
const operatorBalance=parseEther(OPERATOR_BALANCE);
const operators=[];
for(let i=0;i<OPERATOR_COUNT;i++){
  const wallet=HDNodeWallet.fromPhrase(mnemonic,'',`m/44'/60'/0'/0/${i}`);
  operators.push(wallet.address);
  const existing=genesis.alloc[wallet.address]||genesis.alloc[wallet.address.toLowerCase()]||{};
  let current=0n;try{current=BigInt(existing.balance||0)}catch{}
  genesis.alloc[wallet.address]={...existing,balance:'0x'+(current>operatorBalance?current:operatorBalance).toString(16)};
}
atomicWrite(OUT,JSON.stringify(genesis,null,2)+'\n',0o600);
if(migration)atomicWrite(MIGRATION_FILE,JSON.stringify({...migration,operatorPool:operators},null,2)+'\n',0o600);
console.log(`[zoryq-reth] effective genesis prepared; accounts=${Object.keys(genesis.alloc).length}; operatorPool=${operators.length}; migrated=${!!migration}`);
