import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Contract, HDNodeWallet, JsonRpcProvider, Wallet, getAddress, keccak256, parseEther, toUtf8Bytes, verifyMessage } from 'ethers';
import { aiCeoStatus, createAiCeoPlan } from './ai-ceo.mjs';

const PORT=Number(process.env.PORT||8080);
const RPC_PORT=8545;
const CHAIN_ID=5919065;
const CHAIN_HEX='0x5a5159';
const RETH_DATA_DIR=process.env.ZORYQ_RETH_DATA_DIR||'/data/reth';
const RETH_CHAIN_SPEC=process.env.ZORYQ_RETH_CHAIN_SPEC||'/app/zoryq-reth-genesis.json';
const RETH_MNEMONIC_FILE=process.env.ZORYQ_RETH_MNEMONIC_FILE||'/data/zoryq-reth-mnemonic.txt';
const PERSISTENCE_STATUS=process.env.ZORYQ_PERSISTENCE_STATUS||'/data/zoryq-persistence-status.json';
const FAUCET_FILE=process.env.ZORYQ_FAUCET_STATE||'/data/faucet.json';
const VALIDATOR_FILE=process.env.ZORYQ_VALIDATOR_STATE||'/data/validators.json';
const FAUCET_AMOUNT=process.env.ZORYQ_FAUCET_AMOUNT||'100';
const FAUCET_CONTRACT=String(process.env.ZORYQ_FAUCET_CONTRACT||'').trim();
const FAUCET_OPERATOR_KEY=String(process.env.ZORYQ_FAUCET_OPERATOR_KEY||'').trim();
const REQUIRE_X_ATTESTATION=String(process.env.ZORYQ_REQUIRE_X_ATTESTATION||'false').toLowerCase()==='true';
const OFFICIAL_X_HANDLE='ZORIQNetwork';
const BLOCKED_PREFIXES=['anvil_','hardhat_','evm_','debug_','trace_','admin_','engine_','miner_','personal_','reth_','txpool_'];
const BLOCKED_METHODS=new Set(['eth_accounts','eth_sendTransaction','eth_sign','eth_signTransaction','eth_signTypedData','eth_signTypedData_v3','eth_signTypedData_v4']);
const CHALLENGE_TTL=10*60*1000;
const HEARTBEAT_MAX_SKEW=5*60*1000;
const HEARTBEAT_HEALTHY_WINDOW=3*60*1000;
const FAUCET_ABI=['function fulfill(bytes32 claimId,address recipient)','function claimAmount() view returns(uint256)','function cooldown() view returns(uint256)','function paused() view returns(bool)'];
const LEGACY_STATE_MARKERS=['/data/zoryq-state.json','/data/zoryq-state.current.json.gz','/data/zoryq-state.previous.json.gz','/data/zoryq-checkpoints/current/meta.json','/data/zoryq-checkpoints/previous/meta.json'];

fs.mkdirSync('/data',{recursive:true});
fs.mkdirSync(RETH_DATA_DIR,{recursive:true});
function loadJson(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function saveJson(file,x){const tmp=`${file}.tmp`;fs.writeFileSync(tmp,JSON.stringify(x,null,2));fs.renameSync(tmp,file)}
function dirHasEntries(dir){try{return fs.readdirSync(dir).length>0}catch{return false}}
function legacyStateExists(){return LEGACY_STATE_MARKERS.some(file=>fs.existsSync(file))}
function loadOrCreateMnemonic(){
  const configured=String(process.env.ZORYQ_RETH_MNEMONIC||'').trim();
  if(configured)return configured;
  try{const saved=fs.readFileSync(RETH_MNEMONIC_FILE,'utf8').trim();if(saved)return saved}catch{}
  const phrase=Wallet.createRandom().mnemonic?.phrase;
  if(!phrase)throw Error('unable_to_generate_reth_mnemonic');
  const tmp=`${RETH_MNEMONIC_FILE}.tmp`;
  fs.writeFileSync(tmp,phrase+'\n',{encoding:'utf8',mode:0o600});
  fs.renameSync(tmp,RETH_MNEMONIC_FILE);
  try{fs.chmodSync(RETH_MNEMONIC_FILE,0o600)}catch{}
  return phrase;
}
function diskPercent(){try{const s=fs.statfsSync(RETH_DATA_DIR);const total=Number(s.blocks)*Number(s.bsize);const free=Number(s.bavail)*Number(s.bsize);return total>0?Math.round((1-free/total)*10000)/100:null}catch{return null}}

if(legacyStateExists()&&!dirHasEntries(RETH_DATA_DIR)&&String(process.env.ZORYQ_ALLOW_RETH_GENESIS_RESET||'false').toLowerCase()!=='true'){
  console.error('[zoryq-reth] FATAL: legacy Anvil state detected but no Reth database exists. Refusing an implicit chain reset. Perform an explicit migration/reset procedure first.');
  process.exit(71);
}

const RETH_MNEMONIC=loadOrCreateMnemonic();
const rethArgs=['node','--chain',RETH_CHAIN_SPEC,'--datadir',RETH_DATA_DIR,'--dev','--dev.block-time','2s','--dev.finality-depth','1','--dev.mnemonic',RETH_MNEMONIC,'--http','--http.addr','127.0.0.1','--http.port',String(RPC_PORT),'--http.api','eth,net,web3'];
const reth=spawn('reth',rethArgs,{stdio:['ignore','pipe','pipe']});
reth.stdout.on('data',d=>process.stdout.write('[reth] '+d));
reth.stderr.on('data',d=>process.stderr.write('[reth] '+d));
reth.on('exit',(code,signal)=>{console.error('Reth exited',{code,signal});process.exit(code||1)});
process.on('SIGTERM',()=>reth.kill('SIGTERM'));
process.on('SIGINT',()=>reth.kill('SIGINT'));

const localRpc='http://127.0.0.1:'+RPC_PORT;
let provider;
let rethClientVersion=null;
const challenges=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function rpcLocal(method,params=[]){const r=await fetch(localRpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(j.error.message||'rpc_error');return j.result}
async function rpcProxy(payload){const r=await fetch(localRpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});return {status:r.status,text:await r.text()}}
async function ready(){for(let i=0;i<240;i++){try{const id=await rpcLocal('eth_chainId');if(id===CHAIN_HEX){provider=new JsonRpcProvider(localRpc,CHAIN_ID,{staticNetwork:true});return}}catch{}await sleep(500)}throw Error('Reth execution client did not become ready')}
async function initializeNode(){
  await ready();
  rethClientVersion=String(await rpcLocal('web3_clientVersion'));
  if(!/reth/i.test(rethClientVersion))throw Error(`unexpected execution client ${rethClientVersion}`);
  const [id,blockHex]=await Promise.all([rpcLocal('eth_chainId'),rpcLocal('eth_blockNumber')]);
  if(id!==CHAIN_HEX)throw Error(`chain id mismatch ${id}`);
  saveJson(PERSISTENCE_STATUS,{ok:true,source:'reth_native_db',mode:'reth-native-db',lastSuccessAt:Date.now(),clientVersion:rethClientVersion,chainId:CHAIN_ID,blockNumber:Number(BigInt(blockHex)),dataDir:RETH_DATA_DIR,diskPercent:diskPercent(),message:'reth_native_database_ready'});
  console.log(`[zoryq-reth] execution client ready; chainId=${CHAIN_ID}; persistence=native-db`);
}
const nodeReady=initializeNode();
function persistenceInfo(){
  const status=loadJson(PERSISTENCE_STATUS,null);
  const readyForTraffic=!!status&&status.ok===true&&status.source==='reth_native_db'&&dirHasEntries(RETH_DATA_DIR);
  return {mode:'reth-native-db',nativeDatabase:dirHasEntries(RETH_DATA_DIR),readyForTraffic,status:status?.message||'initializing',lastSuccessAt:status?.lastSuccessAt||null,clientVersion:rethClientVersion||status?.clientVersion||null,blockNumber:status?.blockNumber??null,diskPercent:diskPercent()};
}
function cors(res){res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','content-type');res.setHeader('access-control-allow-methods','GET,POST,OPTIONS')}
function send(res,status,obj){cors(res);res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj))}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>2_000_000)throw Error('request too large')}return s?JSON.parse(s):{}}
function blocked(q){return !!q&&typeof q.method==='string'&&(BLOCKED_METHODS.has(q.method)||BLOCKED_PREFIXES.some(p=>q.method.startsWith(p)))}
function blockedReply(q){if(q?.id===undefined||q?.id===null)return null;return {jsonrpc:'2.0',id:q.id,error:{code:-32601,message:'Administrative or node-managed signing RPC method disabled on public ZORYQ endpoint'}}}
function registrationMessage(operator,nonce){return `ZORYQ Testnet Node Registration\nOperator: ${operator}\nNonce: ${nonce}\nChain ID: ${CHAIN_ID}`}
function cleanChallenges(){const now=Date.now();for(const [k,v] of challenges)if(now-v.createdAt>CHALLENGE_TTL)challenges.delete(k)}
function publicValidator(v){const now=Date.now();const healthy=!!v.lastHeartbeat&&now-v.lastHeartbeat<=HEARTBEAT_HEALTHY_WINDOW;const onlineMs=Math.max(0,Number(v.onlineMs||0));const hours=Math.floor(onlineMs/3600000);const validatorEstimate=hours*120+(onlineMs>=86400000?1500:0)+(onlineMs>=7*86400000?12000:0);return {nodeId:v.nodeId,operator:v.operator,createdAt:v.createdAt,lastHeartbeat:v.lastHeartbeat||null,lastBlock:v.lastBlock||null,heartbeatCount:v.heartbeatCount||0,onlineMs,healthy,pendingValidatorPointsEstimate:validatorEstimate}}
function safeEqHex(a,b){try{const aa=Buffer.from(String(a),'hex'),bb=Buffer.from(String(b),'hex');return aa.length===bb.length&&aa.length>0&&timingSafeEqual(aa,bb)}catch{return false}}
function onchainFaucetConfigured(){return /^0x[0-9a-fA-F]{40}$/.test(FAUCET_CONTRACT)&&/^0x[0-9a-fA-F]{64}$/.test(FAUCET_OPERATOR_KEY)}
function xAttestationValid(b){if(!REQUIRE_X_ATTESTATION)return true;return b?.followAttested===true&&String(b?.xHandle||'').replace(/^@/,'').toLowerCase()===OFFICIAL_X_HANDLE.toLowerCase()}
const devFaucetWallets=Array.from({length:20},(_,i)=>HDNodeWallet.fromPhrase(RETH_MNEMONIC,'',`m/44'/60'/0'/0/${i}`));
let faucetCursor=0;
let faucetSendQueue=Promise.resolve();
function enqueueFaucet(fn){const p=faucetSendQueue.catch(()=>{}).then(fn);faucetSendQueue=p.catch(()=>{});return p}
async function signedFaucetTransfer(address){return enqueueFaucet(async()=>{
  const value=parseEther(FAUCET_AMOUNT),reserve=parseEther('0.01');
  for(let attempt=0;attempt<devFaucetWallets.length;attempt++){
    const idx=(faucetCursor+attempt)%devFaucetWallets.length;
    const wallet=devFaucetWallets[idx].connect(provider);
    const balance=await provider.getBalance(wallet.address);
    if(balance<value+reserve)continue;
    const tx=await wallet.sendTransaction({to:address,value});
    const receipt=await tx.wait();
    if(!receipt||receipt.status!==1)throw Error('faucet_tx_failed');
    faucetCursor=(idx+1)%devFaucetWallets.length;
    return {txHash:tx.hash,blockNumber:receipt.blockNumber,operator:wallet.address};
  }
  throw Error('faucet_pool_depleted');
})}
async function faucetStatus(){
  const base={ok:true,amount:FAUCET_AMOUNT,symbol:'ZQ',officialX:'@'+OFFICIAL_X_HANDLE,xAttestationRequired:REQUIRE_X_ATTESTATION,mode:onchainFaucetConfigured()?'onchain':'signed-transfer'};
  if(!onchainFaucetConfigured())return {...base,executionClient:'reth',operatorPool:devFaucetWallets.length};
  try{const c=new Contract(getAddress(FAUCET_CONTRACT),FAUCET_ABI,provider);const [amount,cooldown,paused,balance]=await Promise.all([c.claimAmount(),c.cooldown(),c.paused(),provider.getBalance(FAUCET_CONTRACT)]);return {...base,contract:getAddress(FAUCET_CONTRACT),claimAmountWei:amount.toString(),cooldownSeconds:Number(cooldown),paused,balanceWei:balance.toString()}}catch{return {...base,healthy:false,error:'onchain_faucet_unreachable'}}
}

const server=http.createServer(async(req,res)=>{try{
 if(req.method==='OPTIONS'){cors(res);res.writeHead(204);return res.end()}
 await nodeReady;
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/health'){const block=await provider.getBlockNumber();const vals=Object.values(loadJson(VALIDATOR_FILE,{}));const healthy=vals.filter(v=>Date.now()-Number(v.lastHeartbeat||0)<=HEARTBEAT_HEALTHY_WINDOW).length;const persistence=persistenceInfo();return send(res,200,{ok:true,name:'ZORYQ EVM Testnet',chainId:CHAIN_ID,chainIdHex:CHAIN_HEX,symbol:'ZQ',block,evm:true,contracts:true,erc20:true,erc721:true,rpc:true,executionClient:'reth',executionClientVersion:rethClientVersion,registeredNodes:vals.length,healthyNodes:healthy,faucetMode:onchainFaucetConfigured()?'onchain':'signed-transfer',xFaucetGate:REQUIRE_X_ATTESTATION,readyForTraffic:persistence.readyForTraffic,persistence})}
 if(req.method==='GET'&&url.pathname==='/network'){return send(res,200,{chainName:'ZORYQ EVM Testnet',chainId:CHAIN_HEX,nativeCurrency:{name:'ZORYQ',symbol:'ZQ',decimals:18},executionClient:'reth',rpcUrls:[process.env.PUBLIC_RPC_URL||'SET_PUBLIC_RPC_URL'],blockExplorerUrls:[process.env.PUBLIC_EXPLORER_URL||'https://zoryq-testnet.vercel.app/explorer']})}
 if(req.method==='GET'&&url.pathname==='/ai-ceo/status'){return send(res,200,aiCeoStatus())}
 if(req.method==='POST'&&url.pathname==='/ai-ceo/plan'){
   const b=await body(req);
   try{return send(res,200,await createAiCeoPlan(provider,b))}catch(e){
     const code=e?.code;
     const status=code==='AI_NOT_CONFIGURED'||code==='AI_NOT_READY'?503:code==='AI_PROVIDER'?502:code==='AI_PLAN_POLICY'?422:code==='AI_BAD_INPUT'?400:500;
     console.error('[zoryq-ai-ceo]',code||'AI_ERROR',e?.message||e);
     return send(res,status,{ok:false,error:code||'AI_ERROR',message:e?.message||'ai_ceo_error'});
   }
 }
 if(req.method==='GET'&&url.pathname==='/faucet/status'){return send(res,200,await faucetStatus())}
 if(req.method==='POST'&&url.pathname==='/faucet'){
   const b=await body(req);let address;
   try{address=getAddress(String(b.address||''))}catch{return send(res,400,{ok:false,error:'invalid_address'})}
   if(!xAttestationValid(b))return send(res,403,{ok:false,error:'x_follow_attestation_required',officialX:'@'+OFFICIAL_X_HANDLE});
   const f=loadJson(FAUCET_FILE,{}),k=address.toLowerCase(),last=Number(f[k]||0),now=Date.now();
   if(now-last<86400000)return send(res,429,{ok:false,error:'cooldown',nextClaim:new Date(last+86400000).toISOString()});
   if(onchainFaucetConfigured()){
     try{const wallet=new Wallet(FAUCET_OPERATOR_KEY,provider);const c=new Contract(getAddress(FAUCET_CONTRACT),FAUCET_ABI,wallet);const claimId=keccak256(toUtf8Bytes(`zoryq-faucet:${address.toLowerCase()}:${now}:${randomUUID()}`));const tx=await c.fulfill(claimId,address);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('faucet_tx_failed');f[k]=now;saveJson(FAUCET_FILE,f);return send(res,200,{ok:true,address,amount:FAUCET_AMOUNT,symbol:'ZQ',mode:'onchain',txHash:tx.hash,claimId,contract:getAddress(FAUCET_CONTRACT)})}catch(e){console.error('Onchain faucet fulfill failed',e?.shortMessage||e?.message||e);return send(res,503,{ok:false,error:'onchain_faucet_unavailable'})}
   }
   try{const result=await signedFaucetTransfer(address);f[k]=now;saveJson(FAUCET_FILE,f);return send(res,200,{ok:true,address,amount:FAUCET_AMOUNT,symbol:'ZQ',mode:'signed-transfer',txHash:result.txHash,blockNumber:result.blockNumber})}catch(e){console.error('Signed faucet transfer failed',e?.shortMessage||e?.message||e);return send(res,503,{ok:false,error:e?.message==='faucet_pool_depleted'?'faucet_pool_depleted':'faucet_transfer_failed'})}
 }
 if(req.method==='GET'&&url.pathname==='/validator/challenge'){
   cleanChallenges();let operator;try{operator=getAddress(String(url.searchParams.get('operator')||''))}catch{return send(res,400,{ok:false,error:'invalid_operator'})}
   const nonce=randomBytes(18).toString('hex');challenges.set(operator.toLowerCase(),{nonce,createdAt:Date.now()});return send(res,200,{ok:true,operator,nonce,message:registrationMessage(operator,nonce),expiresInSeconds:CHALLENGE_TTL/1000})
 }
 if(req.method==='POST'&&url.pathname==='/validator/register'){
   cleanChallenges();const b=await body(req);let operator;try{operator=getAddress(String(b.operator||''))}catch{return send(res,400,{ok:false,error:'invalid_operator'})}
   const c=challenges.get(operator.toLowerCase());if(!c||c.nonce!==String(b.nonce||''))return send(res,400,{ok:false,error:'invalid_or_expired_challenge'});
   let signer;try{signer=getAddress(verifyMessage(registrationMessage(operator,c.nonce),String(b.signature||'')))}catch{return send(res,400,{ok:false,error:'invalid_signature'})}
   if(signer!==operator)return send(res,403,{ok:false,error:'signature_not_operator'});challenges.delete(operator.toLowerCase());
   const validators=loadJson(VALIDATOR_FILE,{});const nodeId=randomUUID();const secret=randomBytes(32).toString('hex');validators[nodeId]={nodeId,operator,secret,createdAt:Date.now(),lastHeartbeat:null,lastBlock:null,heartbeatCount:0,onlineMs:0};saveJson(VALIDATOR_FILE,validators);
   return send(res,201,{ok:true,nodeId,operator,secret,heartbeatUrl:(process.env.PUBLIC_RPC_URL||'').replace(/\/rpc$/,'')+'/validator/heartbeat',warning:'Store the node secret locally. It is shown only at registration and is not your wallet private key.'})
 }
 if(req.method==='POST'&&url.pathname==='/validator/heartbeat'){
   const b=await body(req);const nodeId=String(b.nodeId||''),ts=Number(b.timestamp),block=Number(b.block),mac=String(b.mac||'');if(!nodeId||!Number.isFinite(ts)||!Number.isFinite(block))return send(res,400,{ok:false,error:'invalid_heartbeat'});if(Math.abs(Date.now()-ts)>HEARTBEAT_MAX_SKEW)return send(res,400,{ok:false,error:'timestamp_out_of_range'});
   const validators=loadJson(VALIDATOR_FILE,{}),v=validators[nodeId];if(!v)return send(res,404,{ok:false,error:'node_not_found'});const expected=createHmac('sha256',v.secret).update(`${nodeId}:${ts}:${block}`).digest('hex');if(!safeEqHex(expected,mac))return send(res,403,{ok:false,error:'invalid_mac'});
   const chainBlock=await provider.getBlockNumber();if(Math.abs(chainBlock-block)>40)return send(res,400,{ok:false,error:'node_not_synced',chainBlock});const now=Date.now();if(v.lastHeartbeat){const delta=Math.max(0,Math.min(now-v.lastHeartbeat,HEARTBEAT_HEALTHY_WINDOW));v.onlineMs=Number(v.onlineMs||0)+delta}v.lastHeartbeat=now;v.lastBlock=block;v.heartbeatCount=Number(v.heartbeatCount||0)+1;validators[nodeId]=v;saveJson(VALIDATOR_FILE,validators);return send(res,200,{ok:true,...publicValidator(v),chainBlock})
 }
 if(req.method==='GET'&&url.pathname==='/validators'){const vals=Object.values(loadJson(VALIDATOR_FILE,{})).map(publicValidator).sort((a,b)=>b.pendingValidatorPointsEstimate-a.pendingValidatorPointsEstimate);return send(res,200,{ok:true,count:vals.length,validators:vals})}
 if(req.method==='GET'&&url.pathname.startsWith('/validator/')){const nodeId=decodeURIComponent(url.pathname.slice('/validator/'.length));const v=loadJson(VALIDATOR_FILE,{})[nodeId];if(!v)return send(res,404,{ok:false,error:'node_not_found'});return send(res,200,{ok:true,...publicValidator(v)})}
 if(req.method==='POST'&&(url.pathname==='/'||url.pathname==='/rpc')){
   const raw=await body(req);if(Array.isArray(raw)){if(raw.length===0)return send(res,200,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}});const results=await Promise.all(raw.map(async q=>{if(blocked(q))return blockedReply(q);const upstream=await rpcProxy(q);if(!upstream.text)return null;try{return JSON.parse(upstream.text)}catch{return {jsonrpc:'2.0',id:q?.id??null,error:{code:-32603,message:'Invalid upstream response'}}}}));const replies=results.filter(Boolean);cors(res);if(replies.length===0){res.writeHead(204);return res.end()}res.writeHead(200,{'content-type':'application/json; charset=utf-8'});return res.end(JSON.stringify(replies))}
   if(blocked(raw)){const reply=blockedReply(raw);if(!reply){cors(res);res.writeHead(204);return res.end()}return send(res,200,reply)}const upstream=await rpcProxy(raw);cors(res);res.writeHead(upstream.status,{'content-type':'application/json; charset=utf-8'});return res.end(upstream.text)
 }
 return send(res,404,{ok:false,error:'not_found'});
 }catch(e){console.error(e);return send(res,500,{ok:false,error:e?.message||'internal_error'})}});

try{
 await nodeReady;
 server.listen(PORT,'0.0.0.0',()=>console.log(`ZORYQ EVM gateway listening on :${PORT}; execution=reth; persistence=reth-native-db`));
}catch(error){
 console.error('[zoryq-reth] FATAL: boot readiness failed',error?.message||error);
 reth.kill('SIGTERM');
 process.exit(70);
}
