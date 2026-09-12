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
const P2P_ADDR=process.env.ZORYQ_RETH_P2P_ADDR||'0.0.0.0';
const P2P_PORT=String(process.env.ZORYQ_RETH_P2P_PORT||'30303');
const rethArgs=['node','--chain',RETH_CHAIN_SPEC,'--datadir',RETH_DATA_DIR,'--addr',P2P_ADDR,'--port',P2P_PORT,'--dev','--dev.block-time','2s','--dev.finality-depth','1','--dev.mnemonic',RETH_MNEMONIC,'--http','--http.addr','127.0.0.1','--http.port',String(RPC_PORT),'--http.api','eth,net,web3,debug'];
const bootnodes=String(process.env.ZORYQ_RETH_BOOTNODES||'').trim();
const trustedPeers=String(process.env.ZORYQ_RETH_TRUSTED_PEERS||'').trim();
if(bootnodes)rethArgs.push('--bootnodes',bootnodes);
if(trustedPeers)rethArgs.push('--trusted-peers',trustedPeers);
const reth=spawn('reth',rethArgs,{stdio:['ignore','pipe','pipe'],env:process.env});
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
  try{
    const c=new Contract(FAUCET_CONTRACT,FAUCET_ABI,provider);
    const [amount,cooldown,paused]=await Promise.all([c.claimAmount(),c.cooldown(),c.paused()]);
    return {...base,contract:FAUCET_CONTRACT,claimAmountWei:amount.toString(),cooldownSeconds:Number(cooldown),paused:Boolean(paused)};
  }catch(e){return {...base,ok:false,contract:FAUCET_CONTRACT,error:e.message}}
}
function fileValidators(){const j=loadJson(VALIDATOR_FILE,{validators:{}});if(!j.validators||typeof j.validators!=='object')j.validators={};return j}
function saveValidators(x){saveJson(VALIDATOR_FILE,x)}
function randomHex(n){return randomBytes(n).toString('hex')}
function hmacHex(secret,msg){return createHmac('sha256',secret).update(msg).digest('hex')}
function challengeId(){return randomUUID()}
function nowIso(){return new Date().toISOString()}
function validatorChallenge(operator){cleanChallenges();const nonce=randomHex(24);const id=challengeId();const message=registrationMessage(operator,nonce);challenges.set(id,{operator,nonce,message,createdAt:Date.now()});return {challengeId:id,message,expiresAt:new Date(Date.now()+CHALLENGE_TTL).toISOString()}}
function takeChallenge(id){cleanChallenges();const c=challenges.get(id);if(c)challenges.delete(id);return c}
function issueNodeToken(nodeId,operator){const secret=randomHex(32);return {token:`zoryq_node_${nodeId}_${secret}`,hash:keccak256(toUtf8Bytes(secret)),secret}}
function parseNodeToken(token){const m=/^zoryq_node_([^_]+)_([0-9a-f]{64})$/.exec(String(token||''));return m?{nodeId:m[1],secret:m[2]}:null}
function heartbeatMessage(nodeId,timestamp,lastBlock){return `${nodeId}:${timestamp}:${lastBlock}`}
function verifyNodeAuth(token,node,provided,ts,lastBlock){const parsed=parseNodeToken(token);if(!parsed||parsed.nodeId!==node.nodeId)return false;const expectedSecretHash=keccak256(toUtf8Bytes(parsed.secret));if(expectedSecretHash!==node.tokenHash)return false;const expected=hmacHex(parsed.secret,heartbeatMessage(node.nodeId,ts,lastBlock));return safeEqHex(expected,provided)}
function findValidator(nodeId){const s=fileValidators();return {state:s,node:s.validators[nodeId]}}
function sanitizeError(e){return String(e?.message||e||'error').slice(0,500)}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS'){cors(res);res.writeHead(204);return res.end()}
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/health'){
      await nodeReady;
      const persistence=persistenceInfo();
      const healthy=persistence.readyForTraffic;
      const blockNumber=persistence.blockNumber;
      return send(res,healthy?200:503,{ok:healthy,evm:true,rpc:true,chainId:CHAIN_ID,chainIdHex:CHAIN_HEX,executionClient:'reth',clientVersion:rethClientVersion,blockNumber,chain:{chainId:CHAIN_ID,chainIdHex:CHAIN_HEX,executionClient:'reth',clientVersion:rethClientVersion,evm:true,rpc:true},persistence,aiCeo:aiCeoStatus()});
    }
    if(url.pathname==='/rpc'&&req.method==='POST'){
      const raw=await body(req);
      if(Array.isArray(raw)){
        const blockedItems=raw.filter(blocked);
        if(blockedItems.length){return send(res,200,raw.map(q=>blocked(q)?blockedReply(q):{jsonrpc:'2.0',id:q?.id??null,error:{code:-32600,message:'Batch rejected because it contains blocked RPC methods'}}).filter(Boolean))}
      }else if(blocked(raw)){return send(res,200,blockedReply(raw))}
      const out=await rpcProxy(raw);cors(res);res.writeHead(out.status,{'content-type':'application/json'});return res.end(out.text)
    }
    if(url.pathname==='/faucet/status')return send(res,200,await faucetStatus());
    if(url.pathname==='/validator/challenge'&&req.method==='POST'){
      const b=await body(req);let operator;try{operator=getAddress(String(b.operator||''))}catch{return send(res,400,{ok:false,error:'invalid_operator_address'})}
      return send(res,200,{ok:true,...validatorChallenge(operator)});
    }
    if(url.pathname==='/validator/register'&&req.method==='POST'){
      const b=await body(req);const c=takeChallenge(b.challengeId);if(!c)return send(res,400,{ok:false,error:'invalid_or_expired_challenge'});
      let recovered;try{recovered=getAddress(verifyMessage(c.message,String(b.signature||'')))}catch{return send(res,400,{ok:false,error:'invalid_signature'})}
      if(recovered!==c.operator)return send(res,403,{ok:false,error:'signature_operator_mismatch'});
      const s=fileValidators();const nodeId=randomHex(16);const auth=issueNodeToken(nodeId,c.operator);s.validators[nodeId]={nodeId,operator:c.operator,tokenHash:auth.hash,createdAt:Date.now(),lastHeartbeat:null,lastBlock:null,heartbeatCount:0,onlineMs:0};saveValidators(s);
      return send(res,200,{ok:true,nodeId,operator:c.operator,nodeToken:auth.token,heartbeatIntervalSeconds:60});
    }
    if(url.pathname==='/validator/heartbeat'&&req.method==='POST'){
      const b=await body(req);const found=findValidator(String(b.nodeId||''));if(!found.node)return send(res,404,{ok:false,error:'node_not_found'});
      const ts=Number(b.timestamp),lastBlock=Number(b.lastBlock);if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>HEARTBEAT_MAX_SKEW)return send(res,400,{ok:false,error:'invalid_timestamp'});
      if(!Number.isFinite(lastBlock)||lastBlock<0)return send(res,400,{ok:false,error:'invalid_last_block'});
      const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const sig=String(b.signature||'');if(!verifyNodeAuth(token,found.node,sig,ts,lastBlock))return send(res,401,{ok:false,error:'invalid_node_auth'});
      const now=Date.now();if(found.node.lastHeartbeat){const delta=Math.max(0,Math.min(now-found.node.lastHeartbeat,2*HEARTBEAT_HEALTHY_WINDOW));found.node.onlineMs=Number(found.node.onlineMs||0)+delta}found.node.lastHeartbeat=now;found.node.lastBlock=lastBlock;found.node.heartbeatCount=Number(found.node.heartbeatCount||0)+1;found.state.validators[found.node.nodeId]=found.node;saveValidators(found.state);
      return send(res,200,{ok:true,validator:publicValidator(found.node)});
    }
    if(url.pathname==='/validators'){
      const s=fileValidators();return send(res,200,{ok:true,validators:Object.values(s.validators).map(publicValidator)});
    }
    if(url.pathname==='/faucet/claim'&&req.method==='POST'){
      const b=await body(req);let address;try{address=getAddress(String(b.address||''))}catch{return send(res,400,{ok:false,error:'invalid_address'})}
      if(!xAttestationValid(b))return send(res,403,{ok:false,error:'x_attestation_required',officialX:'@'+OFFICIAL_X_HANDLE});
      const state=loadJson(FAUCET_FILE,{claims:{}});const key=address.toLowerCase();const last=Number(state.claims?.[key]?.at||0);const cooldownMs=24*60*60*1000;if(Date.now()-last<cooldownMs)return send(res,429,{ok:false,error:'faucet_cooldown',retryAfterSeconds:Math.ceil((cooldownMs-(Date.now()-last))/1000)});
      const transfer=await signedFaucetTransfer(address);state.claims=state.claims||{};state.claims[key]={at:Date.now(),txHash:transfer.txHash};saveJson(FAUCET_FILE,state);return send(res,200,{ok:true,address,amount:FAUCET_AMOUNT,symbol:'ZQ',...transfer});
    }
    if(url.pathname==='/ai-ceo/status')return send(res,200,aiCeoStatus());
    if(url.pathname==='/ai-ceo/plan'&&req.method==='POST'){
      await nodeReady;const b=await body(req);try{return send(res,200,{ok:true,...await createAiCeoPlan(provider,{companyId:b.companyId,directive:b.directive})})}catch(e){const code=e?.code||'';const status=code==='AI_BAD_INPUT'?400:code==='AI_NOT_CONFIGURED'||code==='AI_NOT_READY'?503:502;return send(res,status,{ok:false,error:sanitizeError(e),code})}
    }
    return send(res,404,{ok:false,error:'not_found'});
  }catch(e){return send(res,500,{ok:false,error:sanitizeError(e)})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`[zoryq-node] listening on :${PORT}`));