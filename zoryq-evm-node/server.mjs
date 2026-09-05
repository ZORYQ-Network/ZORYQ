import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { JsonRpcProvider, getAddress, parseEther, toBeHex, verifyMessage } from 'ethers';

const PORT=Number(process.env.PORT||8080);
const RPC_PORT=8545;
const CHAIN_ID=5919065;
const CHAIN_HEX='0x5a5159';
const STATE=process.env.ZORYQ_STATE_PATH||'/data/zoryq-state.json';
const FAUCET_FILE=process.env.ZORYQ_FAUCET_STATE||'/data/faucet.json';
const VALIDATOR_FILE=process.env.ZORYQ_VALIDATOR_STATE||'/data/validators.json';
const FAUCET_AMOUNT=process.env.ZORYQ_FAUCET_AMOUNT||'100';
const BLOCKED_PREFIXES=['anvil_','hardhat_','evm_','debug_'];
const CHALLENGE_TTL=10*60*1000;
const HEARTBEAT_MAX_SKEW=5*60*1000;
const HEARTBEAT_HEALTHY_WINDOW=3*60*1000;

fs.mkdirSync('/data',{recursive:true});
const args=['--host','127.0.0.1','--port',String(RPC_PORT),'--chain-id',String(CHAIN_ID),'--block-time','2','--accounts','0','--state',STATE,'--state-interval','5','--preserve-historical-states'];
const anvil=spawn('anvil',args,{stdio:['ignore','pipe','pipe']});
anvil.stdout.on('data',d=>process.stdout.write('[anvil] '+d));
anvil.stderr.on('data',d=>process.stderr.write('[anvil] '+d));
anvil.on('exit',c=>{console.error('Anvil exited',c);process.exit(c||1)});
process.on('SIGTERM',()=>anvil.kill('SIGTERM'));
process.on('SIGINT',()=>anvil.kill('SIGINT'));

const localRpc='http://127.0.0.1:'+RPC_PORT;
let provider;
const challenges=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function rpcLocal(method,params=[]){const r=await fetch(localRpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(j.error.message||'rpc_error');return j.result}
async function rpcProxy(payload){const r=await fetch(localRpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});return {status:r.status,text:await r.text()}}
async function ready(){for(let i=0;i<120;i++){try{const id=await rpcLocal('eth_chainId');if(id===CHAIN_HEX){provider=new JsonRpcProvider(localRpc,CHAIN_ID,{staticNetwork:true});return}}catch{}await sleep(500)}throw Error('EVM node did not become ready')}
const nodeReady=ready();
function cors(res){res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','content-type');res.setHeader('access-control-allow-methods','GET,POST,OPTIONS')}
function send(res,status,obj){cors(res);res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj))}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>2_000_000)throw Error('request too large')}return s?JSON.parse(s):{}}
function blocked(q){return !!q&&typeof q.method==='string'&&BLOCKED_PREFIXES.some(p=>q.method.startsWith(p))}
function blockedReply(q){if(q?.id===undefined||q?.id===null)return null;return {jsonrpc:'2.0',id:q.id,error:{code:-32601,message:'Administrative RPC method disabled on public ZORYQ endpoint'}}}
function loadJson(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function saveJson(file,x){fs.writeFileSync(file,JSON.stringify(x,null,2))}
function registrationMessage(operator,nonce){return `ZORYQ Testnet Node Registration\nOperator: ${operator}\nNonce: ${nonce}\nChain ID: ${CHAIN_ID}`}
function cleanChallenges(){const now=Date.now();for(const [k,v] of challenges)if(now-v.createdAt>CHALLENGE_TTL)challenges.delete(k)}
function publicValidator(v){const now=Date.now();const healthy=!!v.lastHeartbeat&&now-v.lastHeartbeat<=HEARTBEAT_HEALTHY_WINDOW;const onlineMs=Math.max(0,Number(v.onlineMs||0));const hours=Math.floor(onlineMs/3600000);const validatorEstimate=hours*120+(onlineMs>=86400000?1500:0)+(onlineMs>=7*86400000?12000:0);return {nodeId:v.nodeId,operator:v.operator,createdAt:v.createdAt,lastHeartbeat:v.lastHeartbeat||null,lastBlock:v.lastBlock||null,heartbeatCount:v.heartbeatCount||0,onlineMs,healthy,pendingValidatorPointsEstimate:validatorEstimate}}
function safeEqHex(a,b){try{const aa=Buffer.from(String(a),'hex'),bb=Buffer.from(String(b),'hex');return aa.length===bb.length&&aa.length>0&&timingSafeEqual(aa,bb)}catch{return false}}

const server=http.createServer(async(req,res)=>{try{
 if(req.method==='OPTIONS'){cors(res);res.writeHead(204);return res.end()}
 await nodeReady;
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/health'){const block=await provider.getBlockNumber();const vals=Object.values(loadJson(VALIDATOR_FILE,{}));const healthy=vals.filter(v=>Date.now()-Number(v.lastHeartbeat||0)<=HEARTBEAT_HEALTHY_WINDOW).length;return send(res,200,{ok:true,name:'ZORYQ EVM Testnet',chainId:CHAIN_ID,chainIdHex:CHAIN_HEX,symbol:'ZQ',block,evm:true,contracts:true,erc20:true,erc721:true,rpc:true,registeredNodes:vals.length,healthyNodes:healthy})}
 if(req.method==='GET'&&url.pathname==='/network'){return send(res,200,{chainName:'ZORYQ EVM Testnet',chainId:CHAIN_HEX,nativeCurrency:{name:'ZORYQ',symbol:'ZQ',decimals:18},rpcUrls:[process.env.PUBLIC_RPC_URL||'SET_PUBLIC_RPC_URL'],blockExplorerUrls:[process.env.PUBLIC_EXPLORER_URL||'https://zoryq-testnet.vercel.app/explorer.html']})}
 if(req.method==='POST'&&url.pathname==='/faucet'){
   const b=await body(req);let address;
   try{address=getAddress(String(b.address||''))}catch{return send(res,400,{ok:false,error:'invalid_address'})}
   const f=loadJson(FAUCET_FILE,{}),k=address.toLowerCase(),last=Number(f[k]||0),now=Date.now();
   if(now-last<86400000)return send(res,429,{ok:false,error:'cooldown',nextClaim:new Date(last+86400000).toISOString()});
   const current=BigInt(await rpcLocal('eth_getBalance',[address,'latest']));const next=current+parseEther(FAUCET_AMOUNT);
   await rpcLocal('anvil_setBalance',[address,toBeHex(next)]);f[k]=now;saveJson(FAUCET_FILE,f);
   return send(res,200,{ok:true,address,amount:FAUCET_AMOUNT,symbol:'ZQ',balance:next.toString()})
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
server.listen(PORT,'0.0.0.0',()=>console.log(`ZORYQ EVM gateway listening on :${PORT}`));
