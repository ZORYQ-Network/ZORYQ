import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { once } from 'node:events';

const RPC_HOST=process.env.ZORYQ_INTERNAL_RPC_HOST||'127.0.0.1';
const RPC_PORT=Number(process.env.ZORYQ_INTERNAL_RPC_PORT||8545);
const ROOT=process.env.ZORYQ_CHECKPOINT_ROOT||'/data/zoryq-checkpoints';
const STATUS=process.env.ZORYQ_PERSISTENCE_STATUS||'/data/zoryq-persistence-status.json';
const EXPECTED_CHAIN_ID='0x5a5159';
const EXPECTED_CHAIN_ID_DEC=5919065;
const BOOT_RECOVERY=String(process.env.ZORYQ_BOOT_RECOVERY||'false').toLowerCase()==='true';
const CURRENT=path.join(ROOT,'current'),PREVIOUS=path.join(ROOT,'previous');
const candidates=[CURRENT,PREVIOUS];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let restoreInterval=null;
function durableStatus(value){const tmp=`${STATUS}.tmp-${process.pid}`;fs.writeFileSync(tmp,JSON.stringify(value));const fd=fs.openSync(tmp,'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,STATUS)}
function cleanupBootResidue(){if(!BOOT_RECOVERY||!fs.existsSync(ROOT))return;fs.rmSync(path.join(ROOT,'.writer-lock'),{recursive:true,force:true});for(const name of fs.readdirSync(ROOT))if(name.startsWith('.tmp-'))fs.rmSync(path.join(ROOT,name),{recursive:true,force:true})}
async function sha256(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex')}
async function jsonRpc(method,params=[]){const body=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method,params}));return await new Promise((resolve,reject)=>{const req=http.request({host:RPC_HOST,port:RPC_PORT,path:'/',method:'POST',headers:{'content-type':'application/json','content-length':String(body.length)}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>2_000_000)req.destroy(new Error('RPC response too large'))});res.on('end',()=>{try{const parsed=JSON.parse(text||'{}');if(res.statusCode!==200)throw new Error(`${method} HTTP ${res.statusCode}`);if(parsed.error)throw new Error(`${method}: ${parsed.error.message||'rpc_error'}`);resolve(parsed.result)}catch(error){reject(error)}})});req.setTimeout(30_000,()=>req.destroy(new Error(`${method} timeout`)));req.on('error',reject);req.end(body)})}
async function waitRpc(){for(let i=0;i<120;i++){try{const id=await jsonRpc('eth_chainId',[]);if(String(id).toLowerCase()===EXPECTED_CHAIN_ID)return}catch{}await sleep(250)}throw new Error('internal Anvil RPC not ready')}
async function pauseMining(){restoreInterval=await jsonRpc('anvil_getIntervalMining',[]);await jsonRpc('evm_setIntervalMining',[0]);await sleep(100)}
async function resumeMining(){const interval=Math.max(1,Number(restoreInterval??2));restoreInterval=null;try{await jsonRpc('evm_setIntervalMining',[interval])}catch(error){console.error('[zoryq-state] failed to resume interval mining after restore',error?.message||error)}}
function loadMeta(dir){
  if(!fs.existsSync(dir))return null;
  const file=path.join(dir,'meta.json'),blob=path.join(dir,'state.hex.gz');
  if(!fs.existsSync(file)||!fs.existsSync(blob))throw new Error(`incomplete checkpoint generation in ${path.basename(dir)}`);
  const meta=JSON.parse(fs.readFileSync(file,'utf8'));
  if(meta?.version!==1||meta?.format!=='anvil_dumpState_hex_gzip_v1')throw new Error('unsupported checkpoint metadata');
  if(Number(meta.chainId)!==EXPECTED_CHAIN_ID_DEC||String(meta.chainIdHex).toLowerCase()!==EXPECTED_CHAIN_ID)throw new Error('checkpoint chain id mismatch');
  if(!/^0x[0-9a-f]+$/i.test(String(meta.blockNumber)))throw new Error('checkpoint block number invalid');
  if(!/^0x[0-9a-f]{64}$/i.test(String(meta.blockHash)))throw new Error('checkpoint block hash invalid');
  if(!/^[0-9a-f]{64}$/i.test(String(meta.checkpointSha256)))throw new Error('checkpoint digest invalid');
  return {dir,file,blob,meta};
}
async function validateCandidate(candidate){const info=loadMeta(candidate);if(!info)return null;const digest=await sha256(info.blob);if(digest!==String(info.meta.checkpointSha256).toLowerCase())throw new Error(`checkpoint digest mismatch in ${path.basename(candidate)}`);const stat=fs.statSync(info.blob);if(Number(info.meta.compressedBytes)!==stat.size)throw new Error(`checkpoint size mismatch in ${path.basename(candidate)}`);if(Number(info.meta.hexChars)<=0||Number(info.meta.hexChars)%2!==0)throw new Error(`checkpoint hex length invalid in ${path.basename(candidate)}`);return info}
async function loadBlob(info){return await new Promise((resolve,reject)=>{const req=http.request({host:RPC_HOST,port:RPC_PORT,path:'/',method:'POST',headers:{'content-type':'application/json','transfer-encoding':'chunked'}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>2_000_000)req.destroy(new Error('anvil_loadState response too large'))});res.on('end',()=>{try{const parsed=JSON.parse(text||'{}');if(res.statusCode!==200)throw new Error(`anvil_loadState HTTP ${res.statusCode}`);if(parsed.error)throw new Error(`anvil_loadState: ${parsed.error.message||'rpc_error'}`);if(parsed.result!==true)throw new Error(`anvil_loadState returned ${JSON.stringify(parsed.result)}`);resolve(true)}catch(error){reject(error)}})});req.setTimeout(120_000,()=>req.destroy(new Error('anvil_loadState timeout')));req.on('error',reject);req.write('{"jsonrpc":"2.0","id":1,"method":"anvil_loadState","params":["0x');const input=fs.createReadStream(info.blob),gunzip=createGunzip();input.pipe(gunzip);let count=0;(async()=>{try{for await(const chunk of gunzip){const text=chunk.toString('ascii');if(!/^[0-9a-f]*$/.test(text))throw new Error('checkpoint contains non-hex data');count+=text.length;if(!req.write(text))await once(req,'drain')}if(count!==Number(info.meta.hexChars))throw new Error(`checkpoint payload length mismatch ${count} != ${info.meta.hexChars}`);req.end('"]}')}catch(error){req.destroy(error)}})()})}
async function verifyHead(meta){const id=await jsonRpc('eth_chainId',[]);if(String(id).toLowerCase()!==EXPECTED_CHAIN_ID)throw new Error(`restored chain id mismatch ${id}`);const blockNumber=String(await jsonRpc('eth_blockNumber',[])).toLowerCase();if(blockNumber!==String(meta.blockNumber).toLowerCase())throw new Error(`restored block mismatch ${blockNumber} != ${meta.blockNumber}`);const block=await jsonRpc('eth_getBlockByNumber',[blockNumber,false]);if(String(block?.hash||'').toLowerCase()!==String(meta.blockHash).toLowerCase())throw new Error(`restored block hash mismatch ${block?.hash} != ${meta.blockHash}`)}
async function main(){cleanupBootResidue();await waitRpc();await pauseMining();let lastError=null,currentRejected=false;try{for(const dir of candidates){try{const info=await validateCandidate(dir);if(!info)continue;await loadBlob(info);await verifyHead(info.meta);if(dir===PREVIOUS&&currentRejected){fs.rmSync(CURRENT,{recursive:true,force:true});console.log('[zoryq-state] quarantined rejected current generation after previous fallback')}const now=Date.now();durableStatus({version:4,chainId:EXPECTED_CHAIN_ID_DEC,ok:true,message:'boot_checkpoint_restored',source:'anvil_dumpState_blob',restoredFrom:path.basename(dir),lastAttemptAt:now,lastSuccessAt:now,consecutiveFailures:0,checkpointSha256:info.meta.checkpointSha256,blockNumber:info.meta.blockNumber,blockHash:info.meta.blockHash,rawStateBytes:info.meta.rawStateBytes,compressedBytes:info.meta.compressedBytes});console.log(`[zoryq-state] RPC blob checkpoint restored from ${path.basename(dir)} block=${info.meta.blockNumber} hash=${info.meta.blockHash} sha256=${info.meta.checkpointSha256}`);return}catch(error){lastError=error;if(dir===CURRENT&&fs.existsSync(CURRENT))currentRejected=true;console.error(`[zoryq-state] checkpoint candidate ${path.basename(dir)} rejected:`,error?.message||error)}}throw lastError||new Error('no valid RPC blob checkpoint available')}finally{await resumeMining()}}
await main();
