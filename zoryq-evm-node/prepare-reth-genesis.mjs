import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { HDNodeWallet, Wallet, parseEther } from 'ethers';

const CHAIN_ID=5919065;
const BASE=process.env.ZORYQ_RETH_BASE_GENESIS||'/app/zoryq-reth-genesis.json';
const OUT=process.env.ZORYQ_RETH_CHAIN_SPEC||'/data/zoryq-reth-effective-genesis.json';
const DATA_DIR=process.env.ZORYQ_RETH_DATA_DIR||'/data/reth';
const MNEMONIC_FILE=process.env.ZORYQ_RETH_MNEMONIC_FILE||'/data/zoryq-reth-mnemonic.txt';
const MIGRATION_FILE=process.env.ZORYQ_RETH_MIGRATION_STATUS||'/data/zoryq-reth-migration.json';
const CHECKPOINT_ROOT=process.env.ZORYQ_CHECKPOINT_ROOT||'/data/zoryq-checkpoints';
const LEGACY_STATE=process.env.ZORYQ_STATE_PATH||'/data/zoryq-state.json';
const LEGACY_CURRENT=process.env.ZORYQ_LEGACY_CURRENT||'/data/zoryq-state.current.json.gz';
const LEGACY_PREVIOUS=process.env.ZORYQ_LEGACY_PREVIOUS||'/data/zoryq-state.previous.json.gz';
const MIGRATE=String(process.env.ZORYQ_MIGRATE_ANVIL_TO_RETH||'false').toLowerCase()==='true';
const OPERATOR_COUNT=Math.max(2,Number(process.env.ZORYQ_RETH_OPERATOR_COUNT||20));
const OPERATOR_BALANCE=process.env.ZORYQ_RETH_OPERATOR_BALANCE||'10000';
const TMP_GENESIS='/tmp/zoryq-reth-effective-genesis.json';
const TMP_ROLLBACK='/tmp/zoryq-anvil-rollback.json.gz';

fs.mkdirSync('/data',{recursive:true});
fs.mkdirSync(DATA_DIR,{recursive:true});
function hasEntries(dir){try{return fs.readdirSync(dir).length>0}catch{return false}}
function atomicWrite(file,text,mode=0o600){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.tmp-${process.pid}`;fs.writeFileSync(tmp,text,{encoding:'utf8',mode});fs.renameSync(tmp,file);try{fs.chmodSync(file,mode)}catch{}}
function loadJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function safeRm(file){try{fs.rmSync(file,{recursive:true,force:true})}catch{}}
function size(file){try{return fs.statSync(file).size}catch{return 0}}
function volumeStats(){try{const s=fs.statfsSync('/data');const total=Number(s.blocks)*Number(s.bsize),free=Number(s.bavail)*Number(s.bsize);return {total,free,used:total-free,percent:total?Math.round((1-free/total)*10000)/100:null}}catch{return {total:null,free:null,used:null,percent:null}}}
function loadOrCreateMnemonic(){const configured=String(process.env.ZORYQ_RETH_MNEMONIC||'').trim();if(configured){if(!fs.existsSync(MNEMONIC_FILE))atomicWrite(MNEMONIC_FILE,configured+'\n');return configured}try{const saved=fs.readFileSync(MNEMONIC_FILE,'utf8').trim();if(saved)return saved}catch{}const phrase=Wallet.createRandom().mnemonic?.phrase;if(!phrase)throw Error('unable_to_generate_reth_mnemonic');atomicWrite(MNEMONIC_FILE,phrase+'\n');return phrase}
function checkpointCandidates(){return [path.join(CHECKPOINT_ROOT,'current','state.hex.gz'),LEGACY_CURRENT,path.join(CHECKPOINT_ROOT,'previous','state.hex.gz'),LEGACY_PREVIOUS,LEGACY_STATE].filter(f=>fs.existsSync(f))}
function decodeAnvilState(file){
  const data=fs.readFileSync(file);
  if(file.endsWith('.json.gz'))return JSON.parse(gunzipSync(data).toString('utf8'));
  if(file.endsWith('.hex.gz')){
    const hex=gunzipSync(data).toString('ascii').trim();
    if(!/^[0-9a-fA-F]+$/.test(hex)||hex.length%2)throw Error(`invalid Anvil checkpoint hex: ${file}`);
    const packed=Buffer.from(hex,'hex');let jsonBytes;try{jsonBytes=gunzipSync(packed)}catch{jsonBytes=packed};return JSON.parse(jsonBytes.toString('utf8'));
  }
  const text=data.toString('utf8').trim();try{return JSON.parse(text)}catch{}
  if(/^[0-9a-fA-F]+$/.test(text)&&text.length%2===0){const packed=Buffer.from(text,'hex');let bytes;try{bytes=gunzipSync(packed)}catch{bytes=packed};return JSON.parse(bytes.toString('utf8'))}
  throw Error(`unsupported legacy Anvil state format: ${file}`);
}
function normalizeAccount(account={}){const out={balance:account.balance||'0x0'};if(account.nonce&&account.nonce!=='0x0')out.nonce=account.nonce;if(account.code&&account.code!=='0x')out.code=account.code;if(account.storage&&Object.keys(account.storage).length)out.storage=account.storage;return out}
function anvilAlloc(state){const accounts=state?.accounts||state?.state?.accounts;if(!accounts||typeof accounts!=='object')throw Error('Anvil state has no accounts map');const alloc={};for(const [address,account] of Object.entries(accounts)){if(/^0x[0-9a-fA-F]{40}$/.test(address))alloc[address]=normalizeAccount(account)}return alloc}
function checkpointMeta(source){try{return loadJson(path.join(path.dirname(source),'meta.json'))}catch{return null}}
function ensureRollbackCheckpoint(source,state){
  if(fs.existsSync(LEGACY_CURRENT))return {path:LEGACY_CURRENT,created:false};
  if(source.endsWith('.json.gz')){fs.copyFileSync(source,TMP_ROLLBACK);return {path:TMP_ROLLBACK,created:true};}
  const json=Buffer.from(JSON.stringify(state));fs.writeFileSync(TMP_ROLLBACK,gzipSync(json,{level:6}),{mode:0o600});
  const check=JSON.parse(gunzipSync(fs.readFileSync(TMP_ROLLBACK)).toString('utf8'));anvilAlloc(check);return {path:TMP_ROLLBACK,created:true};
}
function cleanupLegacyAfterStaging(rollback){
  safeRm(LEGACY_STATE);safeRm(LEGACY_PREVIOUS);safeRm(path.join(CHECKPOINT_ROOT,'previous'));
  if(rollback.created){safeRm(LEGACY_CURRENT);fs.renameSync(rollback.path,LEGACY_CURRENT);try{fs.chmodSync(LEGACY_CURRENT,0o600)}catch{}}
  if(fs.existsSync(LEGACY_CURRENT))safeRm(CHECKPOINT_ROOT);
}

if(fs.existsSync(OUT)){
  const current=loadJson(OUT);if(Number(current?.config?.chainId)!==CHAIN_ID)throw Error(`persisted Reth genesis chainId mismatch in ${OUT}`);
  if(!fs.existsSync(MNEMONIC_FILE)&&!String(process.env.ZORYQ_RETH_MNEMONIC||'').trim())throw Error('persisted Reth genesis exists but operator mnemonic is missing');
  console.log(`[zoryq-reth] using persisted effective genesis ${OUT}`);process.exit(0);
}
if(hasEntries(DATA_DIR))throw Error('Reth database exists but effective genesis is missing; refusing to guess chain specification');

const genesis=loadJson(BASE);if(Number(genesis?.config?.chainId)!==CHAIN_ID)throw Error('base Reth genesis chainId mismatch');genesis.alloc={...(genesis.alloc||{})};
const legacy=checkpointCandidates();let migration=null,rollback=null;
if(legacy.length){
  if(!MIGRATE)throw Error('legacy Anvil state detected. Set ZORYQ_MIGRATE_ANVIL_TO_RETH=true for the explicit one-time state migration');
  const source=legacy[0],before=volumeStats();console.log(`[zoryq-reth] migration preflight source=${source} bytes=${size(source)} volumeUsed=${before.percent}% freeBytes=${before.free}`);
  const state=decodeAnvilState(source),alloc=anvilAlloc(state);if(Object.keys(alloc).length===0)throw Error('migration produced zero accounts; refusing cutover');Object.assign(genesis.alloc,alloc);
  rollback=ensureRollbackCheckpoint(source,state);const meta=checkpointMeta(source);
  migration={version:2,from:'anvil',to:'reth-native-db',source,rollbackCheckpoint:LEGACY_CURRENT,accountsMigrated:Object.keys(alloc).length,legacyBlockNumber:meta?.blockNumber||null,legacyBlockHash:meta?.blockHash||null,createdAt:Date.now(),note:'Account state (balance, nonce, code, storage) migrated into a new Reth genesis allocation. One verified compressed Anvil rollback checkpoint is preserved. Legacy block/transaction history is not encoded in genesis state.'};
}

const mnemonic=loadOrCreateMnemonic(),operatorBalance=parseEther(OPERATOR_BALANCE),operators=[];
for(let i=0;i<OPERATOR_COUNT;i++){const wallet=HDNodeWallet.fromPhrase(mnemonic,'',`m/44'/60'/0'/0/${i}`);operators.push(wallet.address);const existing=genesis.alloc[wallet.address]||genesis.alloc[wallet.address.toLowerCase()]||{};let current=0n;try{current=BigInt(existing.balance||0)}catch{}genesis.alloc[wallet.address]={...existing,balance:'0x'+(current>operatorBalance?current:operatorBalance).toString(16)}}

fs.writeFileSync(TMP_GENESIS,JSON.stringify(genesis,null,2)+'\n',{encoding:'utf8',mode:0o600});
const staged=loadJson(TMP_GENESIS);if(Number(staged?.config?.chainId)!==CHAIN_ID||Object.keys(staged.alloc||{}).length===0)throw Error('staged Reth genesis validation failed');
if(migration)cleanupLegacyAfterStaging(rollback);
const outTmp=`${OUT}.tmp-${process.pid}`;safeRm(outTmp);fs.copyFileSync(TMP_GENESIS,outTmp);const copied=loadJson(outTmp);if(Number(copied?.config?.chainId)!==CHAIN_ID||Object.keys(copied.alloc||{}).length===0){safeRm(outTmp);throw Error('persistent Reth genesis validation failed')};fs.renameSync(outTmp,OUT);safeRm(TMP_GENESIS);try{fs.chmodSync(OUT,0o600)}catch{}
if(migration)atomicWrite(MIGRATION_FILE,JSON.stringify({...migration,operatorPool:operators,postCleanupVolume:volumeStats()},null,2)+'\n',0o600);
console.log(`[zoryq-reth] effective genesis prepared; accounts=${Object.keys(genesis.alloc).length}; operatorPool=${operators.length}; migrated=${!!migration}; volumeUsed=${volumeStats().percent}%`);
