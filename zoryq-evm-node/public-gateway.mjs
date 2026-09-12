import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Interface, JsonRpcProvider } from 'ethers';

const PUBLIC_PORT=Number(process.env.PORT||8080);
const INTERNAL_PORT=8081;
const WEB_ROOT='/app/web';
const SCORE_FILE=process.env.ZORYQ_GENESIS_SCORE_STATE||'/data/genesis-score.json';
const ENS_SEPOLIA_RPC=process.env.ENS_SEPOLIA_RPC||'https://ethereum-sepolia-rpc.publicnode.com';
const ENS_PROVIDER=new JsonRpcProvider(ENS_SEPOLIA_RPC,11155111,{staticNetwork:true});
const ENS_UNIVERSAL_RESOLVER='0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe';
const ENS_UNIVERSAL_IFACE=new Interface([
  'function reverse(bytes lookupAddress,uint256 coinType) view returns(string primary,address resolver,address reverseResolver)'
]);
const SWAP='0x8205F34B803eDd79DDCA414F00e12eCdDEdDacbE'.toLowerCase();
const STAKE='0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1'.toLowerCase();
const ACTION_POINTS=Object.freeze({x_follow:50,faucet:100,swap:250,stake:300,x_share:200,ens_identity:150});
const SOCIAL_ACTIONS=new Set(['x_follow','x_share']);
const ONCHAIN_ACTIONS=new Set(['swap','stake']);
const STATIC_ROUTES=new Map([
  ['/', 'start.html'],['/start', 'start.html'],['/start.html', 'start.html'],
  ['/testnet', 'testnet-lab.html'],['/testnet-lab', 'testnet-lab.html'],['/testnet-lab.html', 'testnet-lab.html'],
  ['/explorer', 'explorer.html'],['/explorer.html', 'explorer.html'],
  ['/leaderboard', 'leaderboard.html'],['/leaderboard.html', 'leaderboard.html'],
  ['/intelligence', 'intelligence.html'],['/intelligence.html', 'intelligence.html'],
  ['/network-clock', 'network-clock.html'],['/network-clock.html', 'network-clock.html'],
  ['/launch-studio', 'launch-studio.html'],['/launch-studio.html', 'launch-studio.html'],
  ['/node', 'node.html'],['/node.html', 'node.html'],['/docs', 'docs.html'],['/docs.html', 'docs.html'],
  ['/config.js', 'config.js'],['/app.js', 'app.js'],['/styles.css', 'styles.css'],['/x-follow-gate.js','x-follow-gate.js'],['/genesis-client.js','genesis-client.js']
]);

fs.mkdirSync('/data',{recursive:true});
const backend=spawn(process.execPath,['server.mjs'],{stdio:'inherit',env:{...process.env,PORT:String(INTERNAL_PORT),PUBLIC_RPC_URL:process.env.PUBLIC_RPC_URL||'https://zoryq-evm-node-live-production.up.railway.app/rpc'}});
backend.on('exit',(code,signal)=>{console.error('ZORYQ backend exited',{code,signal});process.exit(code||1)});
process.on('SIGTERM',()=>backend.kill('SIGTERM'));
process.on('SIGINT',()=>backend.kill('SIGINT'));

const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function sendJson(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(JSON.stringify(obj))}
function serveStatic(res,file){const full=path.join(WEB_ROOT,file);if(!full.startsWith(WEB_ROOT)||!fs.existsSync(full)||!fs.statSync(full).isFile())return false;const headers={'content-type':mime[path.extname(full)]||'application/octet-stream','cache-control':path.extname(full)==='.html'?'no-cache':'public, max-age=300','x-zoryq-surface':'railway-web-fallback'};if(file==='start.html'){let html=fs.readFileSync(full,'utf8');if(!html.includes('/genesis-client.js'))html=html.replace('</body>','<script src="/genesis-client.js"></script></body>');res.writeHead(200,headers);res.end(html);return true}res.writeHead(200,headers);fs.createReadStream(full).pipe(res);return true}
function loadScore(){try{const s=JSON.parse(fs.readFileSync(SCORE_FILE,'utf8'));s.version=3;s.wallets ||= {};s.usedProofs ||= {};return s}catch{return {version:3,wallets:{},usedProofs:{}}}}
function saveScore(s){const tmp=SCORE_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,2));fs.renameSync(tmp,file)}
function normAddress(a){const s=String(a||'').toLowerCase();return /^0x[0-9a-f]{40}$/.test(s)?s:null}
function txHash(v){const s=String(v||'').toLowerCase();return /^0x[0-9a-f]{64}$/.test(s)?s:null}
function digest(v){return '0x'+createHash('sha256').update(String(v)).digest('hex')}
function campaign(v){const s=String(v||'').toLowerCase();return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(s)?s:null}
function xShareProof(v){try{const u=new URL(String(v||'').trim());if(!['x.com','www.x.com'].includes(u.hostname.toLowerCase()))return null;const m=u.pathname.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/);return m?`x-status:${m[2]}`:null}catch{return null}}
async function resolveEnsIdentity(address){
  const base={address,network:'ethereum-sepolia',chainId:11155111,ensVersion:'v2-beta',universalResolver:ENS_UNIVERSAL_RESOLVER,verification:'universal-resolver-v2'};
  try{
    await ENS_PROVIDER.getBlockNumber();
    const data=ENS_UNIVERSAL_IFACE.encodeFunctionData('reverse',[address,60n]);
    const raw=await ENS_PROVIDER.call({to:ENS_UNIVERSAL_RESOLVER,data,enableCcipRead:true});
    const [primary,resolver,reverseResolver]=ENS_UNIVERSAL_IFACE.decodeFunctionResult('reverse',raw);
    const ensName=String(primary||'').trim()||null;
    if(!ensName)return {ok:true,...base,ensName:null,verified:false,reason:'primary_name_not_set'};
    return {ok:true,...base,ensName,forwardAddress:address,verified:true,resolver:String(resolver),reverseResolver:String(reverseResolver)};
  }catch(e){
    const code=String(e?.code||'');
    const detail=e?.shortMessage||e?.reason||e?.message||String(e);
    if(code==='CALL_EXCEPTION'||/revert|reverseaddressmismatch|resolvernotfound|resolvernotcontract/i.test(String(detail))){
      return {ok:true,...base,ensName:null,verified:false,reason:'primary_name_not_set_or_forward_mismatch'};
    }
    return {ok:false,...base,error:'ensv2_lookup_unavailable',detail:String(detail)};
  }
}
function walletStatus(address){const state=loadScore(),w=state.wallets[address]||{actions:{}};const actions=Object.values(w.actions||{}).sort((a,b)=>a.createdAt-b.createdAt);const pendingTotal=actions.reduce((n,a)=>n+Number(a.points||0),0);const verifiedOnchain=actions.filter(a=>a.verification==='onchain').reduce((n,a)=>n+Number(a.points||0),0);const verifiedExternal=actions.filter(a=>a.verification==='external-ensv2').reduce((n,a)=>n+Number(a.points||0),0);const socialPending=actions.filter(a=>a.verification==='self-attested').reduce((n,a)=>n+Number(a.points||0),0);const genesisRequired=['x_follow','faucet','swap','stake'];const completed=genesisRequired.filter(k=>actions.some(a=>a.action===k)).length;return {ok:true,address,pendingScore:pendingTotal,verifiedOnchainScore:verifiedOnchain,verifiedExternalScore:verifiedExternal,socialPendingScore:socialPending,finalizedOnchainScore:0,genesis:{completed,total:genesisRequired.length,eligible:completed===genesisRequired.length,status:completed===genesisRequired.length?'pending-finalization':'in-progress'},actions}}
function networkIntelligence(){const state=loadScore();const wallets=Object.entries(state.wallets||{});const byAction={};let total=0,onchain=0,external=0,socialPending=0,eligibleWallets=0;for(const [address,w] of wallets){const actions=Object.values(w.actions||{});const kinds=new Set();for(const a of actions){total++;kinds.add(a.action);byAction[a.action]=(byAction[a.action]||0)+1;if(a.verification==='onchain')onchain++;else if(a.verification==='external-ensv2')external++;else if(a.verification==='self-attested')socialPending++;}if(['x_follow','faucet','swap','stake'].every(k=>kinds.has(k)))eligibleWallets++;}return {ok:true,generatedAt:new Date().toISOString(),wallets:wallets.length,actions:{total,onchain,external,socialPending},byAction,genesis:{eligibleWallets,finalizedOnchainScore:0},disclosure:'Metrics are derived from ZORYQ Genesis records. On-chain actions are receipt-verified; external identity and self-attested social actions are separated. No score finalization is live.'}}
function record(address,action,{proofRef='',txHash='',campaignId='genesis-v1',verification='server',metadata={}}={}){const state=loadScore();const w=state.wallets[address] ||= {actions:{}};w.actions ||= {};let key;if(action==='x_share'){if(!campaignId)return {error:'campaign_required'};key=`x_share:${campaignId}`}else key=action;if(w.actions[key])return {duplicate:true,status:walletStatus(address)};const points=ACTION_POINTS[action];if(!points)return {error:'unsupported_action'};const proofHash=proofRef?digest(proofRef):null;const proofOwner=proofHash?state.usedProofs[proofHash]:null;if(proofOwner&&proofOwner!==`${address}:${key}`)return {error:'proof_already_used'};const entry={action,points,verification,campaignId,proofRef:proofHash,txHash:txHash||null,metadata,createdAt:Date.now()};w.actions[key]=entry;if(proofHash)state.usedProofs[proofHash]=`${address}:${key}`;saveScore(state);return {ok:true,entry,status:walletStatus(address)}}
async function readReq(req,max=100000){let s='';for await(const c of req){s+=c;if(s.length>max)throw Error('request_too_large')}return s}
async function rpc(method,params=[]){const r=await fetch(`http://127.0.0.1:${INTERNAL_PORT}/rpc`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(j.error.message||'rpc_error');return j.result}
async function verifyOnchain(address,action,hash){const [receipt,tx]=await Promise.all([rpc('eth_getTransactionReceipt',[hash]),rpc('eth_getTransactionByHash',[hash])]);if(!receipt||receipt.status!=='0x1'||!tx)return {ok:false,error:'transaction_not_confirmed'};if(String(tx.from||'').toLowerCase()!==address)return {ok:false,error:'transaction_sender_mismatch'};const to=String(tx.to||'').toLowerCase();if(action==='swap'&&to!==SWAP)return {ok:false,error:'not_swap_transaction'};if(action==='stake'&&to!==STAKE)return {ok:false,error:'not_stake_transaction'};return {ok:true}}
function proxy(req,res){const opts={hostname:'127.0.0.1',port:INTERNAL_PORT,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${INTERNAL_PORT}`}};const p=http.request(opts,u=>{res.writeHead(u.statusCode||502,u.headers);u.pipe(res)});p.on('error',e=>sendJson(res,503,{ok:false,error:'backend_unavailable',detail:e.message}));req.pipe(p)}
async function proxyFaucet(req,res){const raw=await readReq(req);let input={};try{input=raw?JSON.parse(raw):{}}catch{return sendJson(res,400,{ok:false,error:'invalid_json'})}const body=JSON.stringify(input);const p=http.request({hostname:'127.0.0.1',port:INTERNAL_PORT,path:'/faucet',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},u=>{let out='';u.on('data',c=>out+=c);u.on('end',()=>{if((u.statusCode||500)<300){const address=normAddress(input.address);if(address){let result={};try{result=JSON.parse(out)}catch{}record(address,'faucet',{proofRef:result.txHash||result.claimId||`server-faucet:${address}:${Date.now()}`,txHash:result.txHash||'',verification:'server'})}}res.writeHead(u.statusCode||502,u.headers);res.end(out)})});p.on('error',e=>sendJson(res,503,{ok:false,error:'backend_unavailable',detail:e.message}));p.end(body)}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url||'/','http://localhost');if(req.method==='OPTIONS')return sendJson(res,204,{});if((req.method==='GET'||req.method==='HEAD')&&STATIC_ROUTES.has(url.pathname)){if(req.method==='HEAD'){res.writeHead(200,{'content-type':mime[path.extname(STATIC_ROUTES.get(url.pathname))]||'text/html; charset=utf-8','x-zoryq-surface':'railway-web-fallback'});return res.end()}if(serveStatic(res,STATIC_ROUTES.get(url.pathname)))return}
if(req.method==='GET'&&url.pathname==='/identity/ens'){const address=normAddress(url.searchParams.get('address'));if(!address)return sendJson(res,400,{ok:false,error:'invalid_address'});const identity=await resolveEnsIdentity(address);return sendJson(res,identity.ok?200:503,identity)}
if(req.method==='GET'&&url.pathname==='/genesis/network')return sendJson(res,200,networkIntelligence());
if(req.method==='GET'&&url.pathname==='/genesis/status'){const address=normAddress(url.searchParams.get('address'));if(!address)return sendJson(res,400,{ok:false,error:'invalid_address'});return sendJson(res,200,walletStatus(address))}
if(req.method==='POST'&&url.pathname==='/genesis/action'){const raw=await readReq(req),b=raw?JSON.parse(raw):{},address=normAddress(b.address),action=String(b.action||'');if(!address)return sendJson(res,400,{ok:false,error:'invalid_address'});if(!ACTION_POINTS[action])return sendJson(res,400,{ok:false,error:'unsupported_action'});
if(action==='ens_identity'){const identity=await resolveEnsIdentity(address);if(!identity.ok)return sendJson(res,503,identity);if(!identity.verified||!identity.ensName)return sendJson(res,400,{ok:false,error:'verified_ensv2_primary_name_required',identity});const r=record(address,action,{proofRef:`ensv2:${identity.ensName.toLowerCase()}:${address}`,verification:'external-ensv2',metadata:{ensName:identity.ensName,network:identity.network,ensVersion:identity.ensVersion,verification:identity.verification,universalResolver:identity.universalResolver}});if(r.error)return sendJson(res,409,{ok:false,error:r.error});return sendJson(res,200,{...r,identity,notice:'ENSv2 primary name verified by the canonical Universal Resolver on Ethereum Sepolia. Score is not finalized on ZORYQ until an on-chain finalization step exists.'})}
if(SOCIAL_ACTIONS.has(action)){const campaignId=campaign(b.campaignId||'genesis-v1');if(!campaignId)return sendJson(res,400,{ok:false,error:'invalid_campaign'});if(action==='x_follow'&&String(b.xHandle||'').replace(/^@/,'').toLowerCase()!=='zoriqnetwork')return sendJson(res,400,{ok:false,error:'official_x_handle_required'});let proofRef=b.proofRef||`${action}:${address}`;if(action==='x_share'){proofRef=xShareProof(b.proofRef);if(!proofRef)return sendJson(res,400,{ok:false,error:'valid_x_post_url_required'})}const r=record(address,action,{proofRef,campaignId,verification:'self-attested'});if(r.error)return sendJson(res,409,{ok:false,error:r.error});return sendJson(res,200,{...r,notice:'Social points are pending until X OAuth/API verification is enabled.'})}
if(ONCHAIN_ACTIONS.has(action)){const hash=txHash(b.txHash);if(!hash)return sendJson(res,400,{ok:false,error:'tx_hash_required'});const v=await verifyOnchain(address,action,hash);if(!v.ok)return sendJson(res,400,v);const r=record(address,action,{proofRef:hash,txHash:hash,verification:'onchain'});if(r.error)return sendJson(res,409,{ok:false,error:r.error});return sendJson(res,200,r)}return sendJson(res,400,{ok:false,error:'action_not_directly_recordable'})}
if(req.method==='POST'&&url.pathname==='/faucet')return proxyFaucet(req,res);return proxy(req,res)}catch(e){console.error('public gateway error',e);return sendJson(res,500,{ok:false,error:e?.message||'internal_error'})}});
server.listen(PUBLIC_PORT,'0.0.0.0',()=>console.log(`ZORYQ public gateway listening on :${PUBLIC_PORT}; backend :${INTERNAL_PORT}`));