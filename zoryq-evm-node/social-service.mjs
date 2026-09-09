import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HDNodeWallet, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes, verifyMessage } from 'ethers';

const PORT=Number(process.env.PORT||8086);
const CHAIN_ID=5919065;
const CHAIN_BASE=process.env.ZORYQ_CHAIN_BASE||'http://127.0.0.1:8090';
const STORE_FILE=process.env.ZORYQ_SOCIAL_STORE||'/data/zoryq-social-events.ndjson';
const MNEMONIC_FILE=process.env.ZORYQ_RETH_MNEMONIC_FILE||'/data/zoryq-reth-mnemonic.txt';
const RELAYER_INDEX=Math.max(20,Number(process.env.ZORYQ_SOCIAL_RELAYER_INDEX||23));
const ANCHOR_ENABLED=String(process.env.ZORYQ_SOCIAL_ANCHOR||'true').toLowerCase()!=='false';
const CHALLENGE_TTL_MS=10*60*1000;
const ACTION_LIMIT_PER_MINUTE=30;
const SOCIAL_PREFIX='5a4f5259515f534f4349414c5f56313a';

fs.mkdirSync(path.dirname(STORE_FILE),{recursive:true});
const provider=new JsonRpcProvider(`${CHAIN_BASE}/rpc`,CHAIN_ID,{staticNetwork:true});
const profiles=new Map();
const usernames=new Map();
const posts=new Map();
const likes=new Map();
const reposts=new Map();
const bookmarks=new Map();
const follows=new Map();
const challenges=new Map();
const rate=new Map();
let anchoredActions=0;
let relayer=null;
let anchorQueue=Promise.resolve();

function normalizeAddress(value){try{return getAddress(String(value||''))}catch{return null}}
function norm(a){return String(a||'').toLowerCase()}
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object'){return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`}return JSON.stringify(value)}
function payloadHash(payload){return keccak256(toUtf8Bytes(canonical(payload)))}
function cleanUsername(value){const v=String(value||'').trim().toLowerCase();return /^[a-z0-9_]{3,24}$/.test(v)?v:null}
function text(value,max){return String(value||'').trim().slice(0,max)}
function httpsUrl(value){const v=String(value||'').trim();if(!v)return'';try{const u=new URL(v);return u.protocol==='https:'&&v.length<=500?v:''}catch{return''}}
function ensureSet(map,key){if(!map.has(key))map.set(key,new Set());return map.get(key)}
function appendEvent(event){const line=JSON.stringify(event)+'\n';const fd=fs.openSync(STORE_FILE,'a',0o600);try{fs.writeSync(fd,line,null,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function applyEvent(event){
  const a=norm(event.address);
  if(event.type==='profile'){
    const old=profiles.get(a);if(old?.username)usernames.delete(old.username);
    const p={address:event.address,username:event.payload.username,displayName:event.payload.displayName,bio:event.payload.bio||'',avatarUrl:event.payload.avatarUrl||'',createdAt:old?.createdAt||event.createdAt,updatedAt:event.createdAt,anchorTxHash:event.anchorTxHash||old?.anchorTxHash||null};
    profiles.set(a,p);usernames.set(p.username,a);return;
  }
  if(event.type==='post'){
    posts.set(event.id,{id:event.id,address:event.address,text:event.payload.text,mediaUrl:event.payload.mediaUrl||'',replyTo:event.payload.replyTo||null,createdAt:event.createdAt,anchorTxHash:event.anchorTxHash||null});return;
  }
  if(event.type==='like'){const s=ensureSet(likes,event.postId);event.active?s.add(a):s.delete(a);return}
  if(event.type==='repost'){const s=ensureSet(reposts,event.postId);event.active?s.add(a):s.delete(a);return}
  if(event.type==='bookmark'){const s=ensureSet(bookmarks,a);event.active?s.add(event.postId):s.delete(event.postId);return}
  if(event.type==='follow'){const s=ensureSet(follows,a);event.active?s.add(norm(event.target)):s.delete(norm(event.target));return}
  if(event.type==='anchor')anchoredActions++;
}
function replay(){if(!fs.existsSync(STORE_FILE))return;const lines=fs.readFileSync(STORE_FILE,'utf8').split('\n').filter(Boolean);for(const line of lines){try{applyEvent(JSON.parse(line))}catch{}}}
replay();

function publicProfile(address,viewer=''){
  const a=norm(address),p=profiles.get(a);if(!p)return null;
  let followerCount=0;for(const s of follows.values())if(s.has(a))followerCount++;
  const followingCount=follows.get(a)?.size||0;
  const postCount=[...posts.values()].filter(x=>norm(x.address)===a).length;
  return {...p,followers:followerCount,following:followingCount,posts:postCount,viewerFollowing:viewer?ensureSet(follows,norm(viewer)).has(a):false};
}
function postView(post,viewer=''){
  const v=norm(viewer),likeSet=likes.get(post.id)||new Set(),repostSet=reposts.get(post.id)||new Set(),bookmarkSet=bookmarks.get(v)||new Set();
  const replyCount=[...posts.values()].filter(p=>p.replyTo===post.id).length;
  return {...post,author:publicProfile(post.address,v)||{address:post.address,username:shortAddress(post.address),displayName:shortAddress(post.address),bio:'',avatarUrl:''},likes:likeSet.size,reposts:repostSet.size,replies:replyCount,liked:v?likeSet.has(v):false,reposted:v?repostSet.has(v):false,saved:v?bookmarkSet.has(post.id):false};
}
function shortAddress(a){return `${String(a).slice(0,6)}…${String(a).slice(-4)}`}
function cleanChallenges(){const now=Date.now();for(const [id,c] of challenges)if(c.expiresAt<=now)challenges.delete(id)}
function allowedRate(address){const k=norm(address),now=Date.now(),arr=(rate.get(k)||[]).filter(t=>now-t<60000);if(arr.length>=ACTION_LIMIT_PER_MINUTE)return false;arr.push(now);rate.set(k,arr);return true}
function validatePayload(action,payload,address){
  if(action==='profile'){
    const username=cleanUsername(payload?.username);if(!username)throw Error('invalid_username');
    const displayName=text(payload?.displayName,40);if(!displayName)throw Error('display_name_required');
    const bio=text(payload?.bio,160),avatarUrl=httpsUrl(payload?.avatarUrl);
    const owner=usernames.get(username);if(owner&&owner!==norm(address))throw Error('username_taken');
    return {username,displayName,bio,avatarUrl};
  }
  if(action==='post'){
    const body=text(payload?.text,500);if(!body)throw Error('post_text_required');
    const mediaUrl=httpsUrl(payload?.mediaUrl);const replyTo=payload?.replyTo?String(payload.replyTo):null;
    if(replyTo&&!posts.has(replyTo))throw Error('reply_target_not_found');
    return {text:body,mediaUrl,replyTo};
  }
  if(['like','repost','bookmark'].includes(action)){
    const postId=String(payload?.postId||'');if(!posts.has(postId))throw Error('post_not_found');return {postId};
  }
  if(action==='follow'){
    const target=normalizeAddress(payload?.target);if(!target)throw Error('invalid_target');if(norm(target)===norm(address))throw Error('cannot_follow_self');return {target};
  }
  throw Error('unsupported_social_action');
}
function challengeMessage({address,action,challengeId,expiresAt,hash}){return `ZORYQ Social Authorization\nChain ID: ${CHAIN_ID}\nWallet: ${address}\nAction: ${action}\nChallenge: ${challengeId}\nPayload Hash: ${hash}\nExpires: ${expiresAt}`}
async function getRelayer(){if(relayer)return relayer;const phrase=fs.readFileSync(MNEMONIC_FILE,'utf8').trim();if(!phrase)throw Error('social_relayer_mnemonic_missing');relayer=HDNodeWallet.fromPhrase(phrase,'',`m/44'/60'/0'/0/${RELAYER_INDEX}`).connect(provider);return relayer}
async function anchorSocial(event){if(!ANCHOR_ENABLED||event.type==='bookmark')return null;const eventHash=keccak256(toUtf8Bytes(canonical({version:1,chainId:CHAIN_ID,...event,anchorTxHash:undefined})));const data='0x'+SOCIAL_PREFIX+eventHash.slice(2);const run=async()=>{const wallet=await getRelayer();const balance=await provider.getBalance(wallet.address);if(balance===0n)throw Error('social_relayer_unfunded');const tx=await wallet.sendTransaction({to:wallet.address,value:0n,data});const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('social_anchor_failed');return tx.hash};const p=anchorQueue.catch(()=>{}).then(run);anchorQueue=p.catch(()=>{});return p}
function toggleState(action,address,payload){const a=norm(address),postId=payload.postId;if(action==='like')return !ensureSet(likes,postId).has(a);if(action==='repost')return !ensureSet(reposts,postId).has(a);if(action==='bookmark')return !ensureSet(bookmarks,a).has(postId);if(action==='follow')return !ensureSet(follows,a).has(norm(payload.target));return true}
async function commitChallenge(challengeId,signature){cleanChallenges();const c=challenges.get(String(challengeId||''));if(!c)throw Error('challenge_not_found_or_expired');challenges.delete(c.id);if(!allowedRate(c.address))throw Error('social_rate_limit');let signer;try{signer=getAddress(verifyMessage(c.message,String(signature||'')))}catch{throw Error('invalid_signature')}if(norm(signer)!==norm(c.address))throw Error('signature_wallet_mismatch');const createdAt=Date.now();let event;
  if(c.action==='profile')event={version:1,type:'profile',address:c.address,payload:c.payload,createdAt};
  else if(c.action==='post')event={version:1,type:'post',id:randomUUID(),address:c.address,payload:c.payload,createdAt};
  else if(['like','repost','bookmark'].includes(c.action))event={version:1,type:c.action,address:c.address,postId:c.payload.postId,active:toggleState(c.action,c.address,c.payload),createdAt};
  else if(c.action==='follow')event={version:1,type:'follow',address:c.address,target:c.payload.target,active:toggleState(c.action,c.address,c.payload),createdAt};
  else throw Error('unsupported_social_action');
  const txHash=await anchorSocial(event);if(txHash)event.anchorTxHash=txHash;appendEvent(event);applyEvent(event);if(txHash){const anchorEvent={version:1,type:'anchor',address:c.address,action:c.action,eventId:event.id||null,txHash,createdAt:Date.now()};appendEvent(anchorEvent);applyEvent(anchorEvent)}
  if(event.type==='profile')return {ok:true,action:'profile',profile:publicProfile(c.address,c.address),anchorTxHash:txHash};
  if(event.type==='post')return {ok:true,action:'post',post:postView(posts.get(event.id),c.address),anchorTxHash:txHash};
  if(['like','repost','bookmark'].includes(event.type))return {ok:true,action:event.type,active:event.active,post:postView(posts.get(event.postId),c.address),anchorTxHash:txHash};
  if(event.type==='follow')return {ok:true,action:'follow',active:event.active,profile:publicProfile(event.target,c.address),anchorTxHash:txHash};
  return {ok:true};
}
function send(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(JSON.stringify(obj))}
async function readBody(req,max=200000){let s='';for await(const chunk of req){s+=chunk;if(s.length>max)throw Error('request_too_large')}return s?JSON.parse(s):{}}
async function chainReady(){try{const [net,block]=await Promise.all([provider.getNetwork(),provider.getBlockNumber()]);return {ok:Number(net.chainId)===CHAIN_ID,block}}catch{return {ok:false,block:null}}}

const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS')return send(res,204,{});const url=new URL(req.url||'/','http://localhost');
  if(req.method==='GET'&&url.pathname==='/status'){const chain=await chainReady();return send(res,chain.ok?200:503,{ok:chain.ok,service:'zoryq-social',chainId:CHAIN_ID,chainReady:chain.ok,block:chain.block,profiles:profiles.size,posts:posts.size,anchoredActions,anchorEnabled:ANCHOR_ENABLED,store:'append-only-event-log'});}
  if(req.method==='POST'&&url.pathname==='/challenge'){cleanChallenges();const b=await readBody(req),address=normalizeAddress(b.address),action=String(b.action||'');if(!address)return send(res,400,{ok:false,error:'invalid_address'});let payload;try{payload=validatePayload(action,b.payload||{},address)}catch(e){return send(res,400,{ok:false,error:e.message})}const id=randomUUID(),expiresAt=Date.now()+CHALLENGE_TTL_MS,hash=payloadHash(payload),message=challengeMessage({address,action,challengeId:id,expiresAt,hash});challenges.set(id,{id,address,action,payload,expiresAt,message});return send(res,200,{ok:true,challengeId:id,message,expiresAt,payloadHash:hash,chainId:CHAIN_ID});}
  if(req.method==='POST'&&url.pathname==='/commit'){const b=await readBody(req);try{return send(res,200,await commitChallenge(b.challengeId,b.signature))}catch(e){const code=['challenge_not_found_or_expired','invalid_signature','signature_wallet_mismatch'].includes(e.message)?401:e.message==='social_rate_limit'?429:400;return send(res,code,{ok:false,error:e.message})}}
  if(req.method==='GET'&&url.pathname==='/feed'){const viewer=normalizeAddress(url.searchParams.get('viewer'))||'',limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')||25))),before=Number(url.searchParams.get('before')||Date.now()+1);const rows=[...posts.values()].filter(p=>p.createdAt<before).sort((a,b)=>b.createdAt-a.createdAt).slice(0,limit).map(p=>postView(p,viewer));return send(res,200,{ok:true,posts:rows,nextBefore:rows.length?rows[rows.length-1].createdAt:null});}
  if(req.method==='GET'&&url.pathname==='/profile'){const viewer=normalizeAddress(url.searchParams.get('viewer'))||'';let address=normalizeAddress(url.searchParams.get('address'));if(!address){const u=cleanUsername(url.searchParams.get('username'));if(u){const a=usernames.get(u);if(a)address=profiles.get(a)?.address||a}}if(!address)return send(res,404,{ok:false,error:'profile_not_found'});const profile=publicProfile(address,viewer);if(!profile)return send(res,404,{ok:false,error:'profile_not_found'});const ownPosts=[...posts.values()].filter(p=>norm(p.address)===norm(address)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,30).map(p=>postView(p,viewer));return send(res,200,{ok:true,profile,posts:ownPosts});}
  if(req.method==='GET'&&url.pathname==='/bookmarks'){const viewer=normalizeAddress(url.searchParams.get('viewer'));if(!viewer)return send(res,400,{ok:false,error:'viewer_required'});const ids=[...(bookmarks.get(norm(viewer))||new Set())];const rows=ids.map(id=>posts.get(id)).filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt).map(p=>postView(p,viewer));return send(res,200,{ok:true,posts:rows});}
  return send(res,404,{ok:false,error:'not_found'});
}catch(e){console.error('[zoryq-social]',e);return send(res,500,{ok:false,error:e?.message||'internal_error'})}});
server.listen(PORT,'127.0.0.1',()=>console.log(`[zoryq-social] listening on 127.0.0.1:${PORT}; anchor=${ANCHOR_ENABLED}`));
