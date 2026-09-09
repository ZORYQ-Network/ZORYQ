import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { HDNodeWallet, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes, verifyMessage } from 'ethers';

const PORT=Number(process.env.PORT||8086);
const CHAIN_ID=5919065;
const CHAIN_BASE=process.env.ZORYQ_CHAIN_BASE||'http://127.0.0.1:8090';
const STORE_FILE=process.env.ZORYQ_SOCIAL_STORE||'/data/zoryq-social-events.ndjson';
const MEDIA_DIR=process.env.ZORYQ_SOCIAL_MEDIA_DIR||'/data/zoryq-social-media';
const MNEMONIC_FILE=process.env.ZORYQ_RETH_MNEMONIC_FILE||'/data/zoryq-reth-mnemonic.txt';
const RELAYER_INDEX=Math.max(20,Number(process.env.ZORYQ_SOCIAL_RELAYER_INDEX||23));
const ANCHOR_ENABLED=String(process.env.ZORYQ_SOCIAL_ANCHOR||'true').toLowerCase()!=='false';
const CHALLENGE_TTL_MS=10*60*1000;
const ACTION_LIMIT_PER_MINUTE=30;
const SOCIAL_PREFIX='5a4f5259515f534f4349414c5f56313a';
const MAX_AVATAR_BYTES=350_000;
const RANK_CACHE_MS=30_000;

fs.mkdirSync(path.dirname(STORE_FILE),{recursive:true});
fs.mkdirSync(MEDIA_DIR,{recursive:true});
const provider=new JsonRpcProvider(`${CHAIN_BASE}/rpc`,CHAIN_ID,{staticNetwork:true});
const profiles=new Map();
const usernames=new Map();
const posts=new Map();
const likes=new Map();
const reposts=new Map();
const bookmarks=new Map();
const follows=new Map();
const communities=new Map();
const communitySlugs=new Map();
const communityMembers=new Map();
const challenges=new Map();
const rate=new Map();
let anchoredActions=0;
let relayer=null;
let anchorQueue=Promise.resolve();
let rankCache={at:0,rows:[]};

function normalizeAddress(value){try{return getAddress(String(value||''))}catch{return null}}
function norm(a){return String(a||'').toLowerCase()}
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object'){return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`}return JSON.stringify(value)}
function payloadHash(payload){return keccak256(toUtf8Bytes(canonical(payload)))}
function cleanUsername(value){const v=String(value||'').trim().toLowerCase();return /^[a-z0-9_]{3,24}$/.test(v)?v:null}
function cleanSlug(value){const v=String(value||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');return /^[a-z0-9][a-z0-9_-]{2,39}$/.test(v)?v:null}
function text(value,max){return String(value||'').trim().slice(0,max)}
function httpsUrl(value){const v=String(value||'').trim();if(!v)return'';if(/^\/api\/social\/media\/avatar\/0x[0-9a-fA-F]{40}/.test(v))return v;try{const u=new URL(v);return u.protocol==='https:'&&v.length<=500?v:''}catch{return''}}
function ensureSet(map,key){if(!map.has(key))map.set(key,new Set());return map.get(key)}
function appendEvent(event){const line=JSON.stringify(event)+'\n';const fd=fs.openSync(STORE_FILE,'a',0o600);try{fs.writeSync(fd,line,null,'utf8');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function safeWrite(file,buf){const tmp=`${file}.tmp-${process.pid}-${Date.now()}`;fs.writeFileSync(tmp,buf,{mode:0o600});fs.renameSync(tmp,file)}
function avatarPath(address){return path.join(MEDIA_DIR,`${norm(address)}.avatar`)}
function avatarMetaPath(address){return path.join(MEDIA_DIR,`${norm(address)}.avatar.json`)}
function materializeAvatar(address,payload){
  const raw=String(payload?.avatarData||'');
  if(!raw)return httpsUrl(payload?.avatarUrl);
  const m=raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!m)throw Error('invalid_avatar_data');
  const buf=Buffer.from(m[2],'base64');
  if(!buf.length||buf.length>MAX_AVATAR_BYTES)throw Error('avatar_too_large');
  const sha=createHash('sha256').update(buf).digest('hex');
  safeWrite(avatarPath(address),buf);
  safeWrite(avatarMetaPath(address),Buffer.from(JSON.stringify({mime:m[1],sha,size:buf.length,updatedAt:Date.now()})));
  return `/api/social/media/avatar/${address}?v=${sha.slice(0,12)}`;
}
function applyEvent(event){
  const a=norm(event.address);
  if(event.type==='profile'){
    const old=profiles.get(a);if(old?.username)usernames.delete(old.username);
    const p={address:event.address,username:event.payload.username,displayName:event.payload.displayName,bio:event.payload.bio||'',avatarUrl:event.payload.avatarUrl||'',coverUrl:event.payload.coverUrl||'',website:event.payload.website||'',location:event.payload.location||'',category:event.payload.category||'creator',acceptsPayments:event.payload.acceptsPayments!==false,createdAt:old?.createdAt||event.createdAt,updatedAt:event.createdAt,anchorTxHash:event.anchorTxHash||old?.anchorTxHash||null};
    profiles.set(a,p);usernames.set(p.username,a);return;
  }
  if(event.type==='post'){posts.set(event.id,{id:event.id,address:event.address,text:event.payload.text,mediaUrl:event.payload.mediaUrl||'',replyTo:event.payload.replyTo||null,communityId:event.payload.communityId||null,createdAt:event.createdAt,anchorTxHash:event.anchorTxHash||null});return}
  if(event.type==='like'){const s=ensureSet(likes,event.postId);event.active?s.add(a):s.delete(a);return}
  if(event.type==='repost'){const s=ensureSet(reposts,event.postId);event.active?s.add(a):s.delete(a);return}
  if(event.type==='bookmark'){const s=ensureSet(bookmarks,a);event.active?s.add(event.postId):s.delete(event.postId);return}
  if(event.type==='follow'){const s=ensureSet(follows,a);event.active?s.add(norm(event.target)):s.delete(norm(event.target));return}
  if(event.type==='community'){
    const c={id:event.id,owner:event.address,slug:event.payload.slug,name:event.payload.name,description:event.payload.description||'',avatarUrl:event.payload.avatarUrl||'',website:event.payload.website||'',tokenAddress:event.payload.tokenAddress||'',createdAt:event.createdAt,anchorTxHash:event.anchorTxHash||null};
    communities.set(c.id,c);communitySlugs.set(c.slug,c.id);ensureSet(communityMembers,c.id).add(a);return;
  }
  if(event.type==='community_join'){const s=ensureSet(communityMembers,event.communityId);event.active?s.add(a):s.delete(a);return}
  if(event.type==='anchor')anchoredActions++;
}
function replay(){if(!fs.existsSync(STORE_FILE))return;const fd=fs.openSync(STORE_FILE,'r');try{const buf=Buffer.allocUnsafe(64*1024);let carry='';for(;;){const n=fs.readSync(fd,buf,0,buf.length,null);if(!n)break;const chunk=carry+buf.subarray(0,n).toString('utf8');const lines=chunk.split('\n');carry=lines.pop()||'';for(const line of lines){if(!line)continue;try{applyEvent(JSON.parse(line))}catch{}}}if(carry)try{applyEvent(JSON.parse(carry))}catch{}}finally{fs.closeSync(fd)}}
replay();

function publicProfile(address,viewer=''){
  const a=norm(address),p=profiles.get(a);if(!p)return null;
  let followerCount=0;for(const s of follows.values())if(s.has(a))followerCount++;
  const followingCount=follows.get(a)?.size||0;
  const postCount=[...posts.values()].filter(x=>norm(x.address)===a).length;
  const communitiesCreated=[...communities.values()].filter(c=>norm(c.owner)===a).length;
  const communitiesJoined=[...communityMembers.entries()].filter(([,s])=>s.has(a)).length;
  return {...p,followers:followerCount,following:followingCount,posts:postCount,communitiesCreated,communitiesJoined,viewerFollowing:viewer?ensureSet(follows,norm(viewer)).has(a):false};
}
function publicCommunity(c,viewer=''){const members=communityMembers.get(c.id)||new Set();const postCount=[...posts.values()].filter(p=>p.communityId===c.id).length;return {...c,members:members.size,posts:postCount,viewerJoined:viewer?members.has(norm(viewer)):false}}
function postView(post,viewer=''){
  const v=norm(viewer),likeSet=likes.get(post.id)||new Set(),repostSet=reposts.get(post.id)||new Set(),bookmarkSet=bookmarks.get(v)||new Set();
  const replyCount=[...posts.values()].filter(p=>p.replyTo===post.id).length;
  return {...post,author:publicProfile(post.address,v)||{address:post.address,username:shortAddress(post.address),displayName:shortAddress(post.address),bio:'',avatarUrl:''},community:post.communityId?publicCommunity(communities.get(post.communityId)||{},v):null,likes:likeSet.size,reposts:repostSet.size,replies:replyCount,liked:v?likeSet.has(v):false,reposted:v?repostSet.has(v):false,saved:v?bookmarkSet.has(post.id):false};
}
function shortAddress(a){return `${String(a).slice(0,6)}…${String(a).slice(-4)}`}
function cleanChallenges(){const now=Date.now();for(const [id,c] of challenges)if(c.expiresAt<=now)challenges.delete(id)}
function allowedRate(address){const k=norm(address),now=Date.now(),arr=(rate.get(k)||[]).filter(t=>now-t<60000);if(arr.length>=ACTION_LIMIT_PER_MINUTE)return false;arr.push(now);rate.set(k,arr);return true}
function validatePayload(action,payload,address){
  if(action==='profile'){
    const username=cleanUsername(payload?.username);if(!username)throw Error('invalid_username');
    const displayName=text(payload?.displayName,40);if(!displayName)throw Error('display_name_required');
    const bio=text(payload?.bio,220),avatarUrl=httpsUrl(payload?.avatarUrl),coverUrl=httpsUrl(payload?.coverUrl),website=httpsUrl(payload?.website),location=text(payload?.location,60),category=['creator','builder','project','community','trader'].includes(payload?.category)?payload.category:'creator';
    const owner=usernames.get(username);if(owner&&owner!==norm(address))throw Error('username_taken');
    const avatarData=String(payload?.avatarData||'');if(avatarData.length>520_000)throw Error('avatar_payload_too_large');
    return {username,displayName,bio,avatarUrl,avatarData,coverUrl,website,location,category,acceptsPayments:payload?.acceptsPayments!==false};
  }
  if(action==='post'){
    const body=text(payload?.text,800);if(!body)throw Error('post_text_required');
    const mediaUrl=httpsUrl(payload?.mediaUrl);const replyTo=payload?.replyTo?String(payload.replyTo):null;const communityId=payload?.communityId?String(payload.communityId):null;
    if(replyTo&&!posts.has(replyTo))throw Error('reply_target_not_found');
    if(communityId&&!communities.has(communityId))throw Error('community_not_found');
    return {text:body,mediaUrl,replyTo,communityId};
  }
  if(['like','repost','bookmark'].includes(action)){const postId=String(payload?.postId||'');if(!posts.has(postId))throw Error('post_not_found');return {postId}}
  if(action==='follow'){const target=normalizeAddress(payload?.target);if(!target)throw Error('invalid_target');if(norm(target)===norm(address))throw Error('cannot_follow_self');return {target}}
  if(action==='community_create'){
    const name=text(payload?.name,50);if(!name)throw Error('community_name_required');const slug=cleanSlug(payload?.slug||name);if(!slug)throw Error('invalid_community_slug');if(communitySlugs.has(slug))throw Error('community_slug_taken');
    const tokenAddress=payload?.tokenAddress?normalizeAddress(payload.tokenAddress):null;if(payload?.tokenAddress&&!tokenAddress)throw Error('invalid_token_address');
    return {name,slug,description:text(payload?.description,260),avatarUrl:httpsUrl(payload?.avatarUrl),website:httpsUrl(payload?.website),tokenAddress:tokenAddress||''};
  }
  if(action==='community_join'){const communityId=String(payload?.communityId||'');if(!communities.has(communityId))throw Error('community_not_found');return {communityId}}
  throw Error('unsupported_social_action');
}
function challengeMessage({address,action,challengeId,expiresAt,hash}){return `ZORYQ Social Authorization\nChain ID: ${CHAIN_ID}\nWallet: ${address}\nAction: ${action}\nChallenge: ${challengeId}\nPayload Hash: ${hash}\nExpires: ${expiresAt}`}
async function getRelayer(){if(relayer)return relayer;const phrase=fs.readFileSync(MNEMONIC_FILE,'utf8').trim();if(!phrase)throw Error('social_relayer_mnemonic_missing');relayer=HDNodeWallet.fromPhrase(phrase,'',`m/44'/60'/0'/0/${RELAYER_INDEX}`).connect(provider);return relayer}
async function anchorSocial(event){if(!ANCHOR_ENABLED||event.type==='bookmark')return null;const eventHash=keccak256(toUtf8Bytes(canonical({version:1,chainId:CHAIN_ID,...event,anchorTxHash:undefined})));const data='0x'+SOCIAL_PREFIX+eventHash.slice(2);const run=async()=>{const wallet=await getRelayer();const balance=await provider.getBalance(wallet.address);if(balance===0n)throw Error('social_relayer_unfunded');const tx=await wallet.sendTransaction({to:wallet.address,value:0n,data});const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('social_anchor_failed');return tx.hash};const p=anchorQueue.catch(()=>{}).then(run);anchorQueue=p.catch(()=>{});return p}
function toggleState(action,address,payload){const a=norm(address),postId=payload.postId;if(action==='like')return !ensureSet(likes,postId).has(a);if(action==='repost')return !ensureSet(reposts,postId).has(a);if(action==='bookmark')return !ensureSet(bookmarks,a).has(postId);if(action==='follow')return !ensureSet(follows,a).has(norm(payload.target));if(action==='community_join')return !ensureSet(communityMembers,payload.communityId).has(a);return true}
async function commitChallenge(challengeId,signature){cleanChallenges();const c=challenges.get(String(challengeId||''));if(!c)throw Error('challenge_not_found_or_expired');challenges.delete(c.id);if(!allowedRate(c.address))throw Error('social_rate_limit');let signer;try{signer=getAddress(verifyMessage(c.message,String(signature||'')))}catch{throw Error('invalid_signature')}if(norm(signer)!==norm(c.address))throw Error('signature_wallet_mismatch');const createdAt=Date.now();let event;
  if(c.action==='profile'){const avatarUrl=materializeAvatar(c.address,c.payload);const payload={...c.payload,avatarUrl};delete payload.avatarData;event={version:1,type:'profile',address:c.address,payload,createdAt}}
  else if(c.action==='post')event={version:1,type:'post',id:randomUUID(),address:c.address,payload:c.payload,createdAt};
  else if(['like','repost','bookmark'].includes(c.action))event={version:1,type:c.action,address:c.address,postId:c.payload.postId,active:toggleState(c.action,c.address,c.payload),createdAt};
  else if(c.action==='follow')event={version:1,type:'follow',address:c.address,target:c.payload.target,active:toggleState(c.action,c.address,c.payload),createdAt};
  else if(c.action==='community_create')event={version:1,type:'community',id:randomUUID(),address:c.address,payload:c.payload,createdAt};
  else if(c.action==='community_join')event={version:1,type:'community_join',address:c.address,communityId:c.payload.communityId,active:toggleState(c.action,c.address,c.payload),createdAt};
  else throw Error('unsupported_social_action');
  const txHash=await anchorSocial(event);if(txHash)event.anchorTxHash=txHash;appendEvent(event);applyEvent(event);rankCache.at=0;if(txHash){const anchorEvent={version:1,type:'anchor',address:c.address,action:c.action,eventId:event.id||null,txHash,createdAt:Date.now()};appendEvent(anchorEvent);applyEvent(anchorEvent)}
  if(event.type==='profile')return {ok:true,action:'profile',profile:publicProfile(c.address,c.address),anchorTxHash:txHash};
  if(event.type==='post')return {ok:true,action:'post',post:postView(posts.get(event.id),c.address),anchorTxHash:txHash};
  if(['like','repost','bookmark'].includes(event.type))return {ok:true,action:event.type,active:event.active,post:postView(posts.get(event.postId),c.address),anchorTxHash:txHash};
  if(event.type==='follow')return {ok:true,action:'follow',active:event.active,profile:publicProfile(event.target,c.address),anchorTxHash:txHash};
  if(event.type==='community')return {ok:true,action:'community_create',community:publicCommunity(communities.get(event.id),c.address),anchorTxHash:txHash};
  if(event.type==='community_join')return {ok:true,action:'community_join',active:event.active,community:publicCommunity(communities.get(event.communityId),c.address),anchorTxHash:txHash};
  return {ok:true};
}
function socialStats(address){const a=norm(address);const ownPosts=[...posts.values()].filter(p=>norm(p.address)===a);const postIds=new Set(ownPosts.map(p=>p.id));let likesReceived=0,repostsReceived=0;for(const [id,s] of likes)if(postIds.has(id))likesReceived+=s.size;for(const [id,s] of reposts)if(postIds.has(id))repostsReceived+=s.size;let followers=0;for(const s of follows.values())if(s.has(a))followers++;const created=[...communities.values()].filter(c=>norm(c.owner)===a).length;const joined=[...communityMembers.values()].filter(s=>s.has(a)).length;return {posts:ownPosts.length,likesReceived,repostsReceived,followers,communitiesCreated:created,communitiesJoined:joined}}
function levelFor(xp){if(xp>=15000)return'Vanguard';if(xp>=8000)return'Architect';if(xp>=4000)return'Operator';if(xp>=2000)return'Builder';if(xp>=750)return'Pioneer';return'Explorer'}
async function reputation(address){const a=normalizeAddress(address);if(!a)throw Error('invalid_address');const stats=socialStats(a);let txCount=0,balance='0';try{[txCount,balance]=await Promise.all([provider.getTransactionCount(a),provider.getBalance(a).then(x=>x.toString())])}catch{}
  const networkXp=Math.min(txCount,1000)*10;
  const socialXp=(profiles.has(norm(a))?100:0)+Math.min(stats.posts,100)*20+Math.min(stats.likesReceived,500)*2+Math.min(stats.repostsReceived,250)*5+Math.min(stats.followers,250)*8+Math.min(stats.communitiesCreated,10)*150+Math.min(stats.communitiesJoined,50)*15;
  const pendingXp=networkXp+socialXp;return {address:a,pendingXp,finalizedXp:0,totalDisplayXp:pendingXp,level:levelFor(pendingXp),network:{transactionsSent:txCount,balanceWei:balance,xp:networkXp},social:{...stats,xp:socialXp},airdrop:{status:'unannounced',guaranteed:false,disclosure:'XP is testnet reputation. It does not guarantee any token or airdrop allocation.'}};
}
async function ranking(limit=100){const now=Date.now();if(now-rankCache.at<RANK_CACHE_MS)return rankCache.rows.slice(0,limit);const addresses=[...profiles.values()].map(p=>p.address);const rows=[];for(let i=0;i<addresses.length;i+=12){const chunk=addresses.slice(i,i+12);rows.push(...await Promise.all(chunk.map(async a=>{const r=await reputation(a);return {...r,profile:publicProfile(a)}})))}rows.sort((a,b)=>b.pendingXp-a.pendingXp||a.address.localeCompare(b.address));rows.forEach((r,i)=>r.rank=i+1);rankCache={at:now,rows};return rows.slice(0,limit)}
function send(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(JSON.stringify(obj))}
async function readBody(req,max=700000){let s='';for await(const chunk of req){s+=chunk;if(s.length>max)throw Error('request_too_large')}return s?JSON.parse(s):{}}
async function chainReady(){try{const [net,block]=await Promise.all([provider.getNetwork(),provider.getBlockNumber()]);return {ok:Number(net.chainId)===CHAIN_ID,block}}catch{return {ok:false,block:null}}}
function serveAvatar(res,address){const a=normalizeAddress(address);if(!a)return send(res,400,{ok:false,error:'invalid_address'});const file=avatarPath(a),metaFile=avatarMetaPath(a);if(!fs.existsSync(file)||!fs.existsSync(metaFile))return send(res,404,{ok:false,error:'avatar_not_found'});let meta={};try{meta=JSON.parse(fs.readFileSync(metaFile,'utf8'))}catch{}res.writeHead(200,{'content-type':meta.mime||'image/jpeg','cache-control':'public, max-age=86400, immutable','etag':meta.sha?`"${meta.sha}"`:undefined});fs.createReadStream(file).pipe(res)}

const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS')return send(res,204,{});const url=new URL(req.url||'/','http://localhost');
  if(req.method==='GET'&&url.pathname==='/status'){const chain=await chainReady();return send(res,chain.ok?200:503,{ok:chain.ok,service:'zoryq-social',chainId:CHAIN_ID,chainReady:chain.ok,block:chain.block,profiles:profiles.size,posts:posts.size,communities:communities.size,anchoredActions,anchorEnabled:ANCHOR_ENABLED,store:'append-only-event-log',features:['profiles','avatar-upload','feed','likes','reposts','bookmarks','follows','communities','payments-by-profile','xp-ranking']})}
  if(req.method==='GET'&&url.pathname.startsWith('/media/avatar/'))return serveAvatar(res,url.pathname.split('/').pop());
  if(req.method==='POST'&&url.pathname==='/challenge'){cleanChallenges();const b=await readBody(req),address=normalizeAddress(b.address),action=String(b.action||'');if(!address)return send(res,400,{ok:false,error:'invalid_address'});let payload;try{payload=validatePayload(action,b.payload||{},address)}catch(e){return send(res,400,{ok:false,error:e.message})}const id=randomUUID(),expiresAt=Date.now()+CHALLENGE_TTL_MS,hash=payloadHash(payload),message=challengeMessage({address,action,challengeId:id,expiresAt,hash});challenges.set(id,{id,address,action,payload,expiresAt,message});return send(res,200,{ok:true,challengeId:id,message,expiresAt,payloadHash:hash,chainId:CHAIN_ID})}
  if(req.method==='POST'&&url.pathname==='/commit'){const b=await readBody(req);try{return send(res,200,await commitChallenge(b.challengeId,b.signature))}catch(e){const code=['challenge_not_found_or_expired','invalid_signature','signature_wallet_mismatch'].includes(e.message)?401:e.message==='social_rate_limit'?429:400;return send(res,code,{ok:false,error:e.message})}}
  if(req.method==='GET'&&url.pathname==='/feed'){const viewer=normalizeAddress(url.searchParams.get('viewer'))||'',limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')||25))),before=Number(url.searchParams.get('before')||Date.now()+1),communityId=url.searchParams.get('communityId')||'';const rows=[...posts.values()].filter(p=>p.createdAt<before&&(!communityId||p.communityId===communityId)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,limit).map(p=>postView(p,viewer));return send(res,200,{ok:true,posts:rows,nextBefore:rows.length?rows[rows.length-1].createdAt:null})}
  if(req.method==='GET'&&url.pathname==='/profile'){const viewer=normalizeAddress(url.searchParams.get('viewer'))||'';let address=normalizeAddress(url.searchParams.get('address'));if(!address){const u=cleanUsername(url.searchParams.get('username'));if(u){const a=usernames.get(u);if(a)address=profiles.get(a)?.address||a}}if(!address)return send(res,404,{ok:false,error:'profile_not_found'});const profile=publicProfile(address,viewer);if(!profile)return send(res,404,{ok:false,error:'profile_not_found'});const ownPosts=[...posts.values()].filter(p=>norm(p.address)===norm(address)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,30).map(p=>postView(p,viewer));return send(res,200,{ok:true,profile,posts:ownPosts,reputation:await reputation(address)})}
  if(req.method==='GET'&&url.pathname==='/bookmarks'){const viewer=normalizeAddress(url.searchParams.get('viewer'));if(!viewer)return send(res,400,{ok:false,error:'viewer_required'});const ids=[...(bookmarks.get(norm(viewer))||new Set())];const rows=ids.map(id=>posts.get(id)).filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt).map(p=>postView(p,viewer));return send(res,200,{ok:true,posts:rows})}
  if(req.method==='GET'&&url.pathname==='/reputation'){try{return send(res,200,{ok:true,reputation:await reputation(url.searchParams.get('address'))})}catch(e){return send(res,400,{ok:false,error:e.message})}}
  if(req.method==='GET'&&url.pathname==='/ranking'){const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||50)));return send(res,200,{ok:true,kind:'pending-testnet-xp',rows:await ranking(limit),disclosure:'Ranking reflects pending testnet reputation and does not guarantee an airdrop.'})}
  if(req.method==='GET'&&url.pathname==='/communities'){const viewer=normalizeAddress(url.searchParams.get('viewer'))||'';const rows=[...communities.values()].sort((a,b)=>b.createdAt-a.createdAt).map(c=>publicCommunity(c,viewer));return send(res,200,{ok:true,communities:rows})}
  if(req.method==='GET'&&url.pathname==='/community'){const viewer=normalizeAddress(url.searchParams.get('viewer'))||'';let id=String(url.searchParams.get('id')||'');if(!id){const slug=cleanSlug(url.searchParams.get('slug'));id=slug?communitySlugs.get(slug)||'':''}const c=communities.get(id);if(!c)return send(res,404,{ok:false,error:'community_not_found'});const rows=[...posts.values()].filter(p=>p.communityId===id).sort((a,b)=>b.createdAt-a.createdAt).slice(0,50).map(p=>postView(p,viewer));return send(res,200,{ok:true,community:publicCommunity(c,viewer),posts:rows})}
  return send(res,404,{ok:false,error:'not_found'});
}catch(e){console.error('[zoryq-social]',e);return send(res,500,{ok:false,error:e?.message||'internal_error'})}});
server.listen(PORT,'127.0.0.1',()=>console.log(`[zoryq-social] listening on 127.0.0.1:${PORT}; anchor=${ANCHOR_ENABLED}`));
