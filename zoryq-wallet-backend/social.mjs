import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {getAddress,isAddress,verifyMessage} from 'ethers';

const DATA_DIR=process.env.SOCIAL_DATA_DIR||'/data';
const DATA_FILE=path.join(DATA_DIR,'social.json');
const SESSION_SECRET=String(process.env.SOCIAL_SESSION_SECRET||'');
const SESSION_TTL_MS=7*24*60*60*1000;
const CHALLENGE_TTL_MS=5*60*1000;
const MAX_BODY=64*1024;
const challenges=new Map();
const rate=new Map();

function now(){return Date.now()}
function safeJson(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function emptyDb(){return {version:2,profiles:{},posts:[],likes:{},follows:{},comments:[],reports:[]}}
function normalizeDb(input){const base=emptyDb();return {...base,...input,profiles:input?.profiles||{},posts:Array.isArray(input?.posts)?input.posts:[],likes:input?.likes||{},follows:input?.follows||{},comments:Array.isArray(input?.comments)?input.comments:[],reports:Array.isArray(input?.reports)?input.reports:[]}}
function loadDb(){try{return normalizeDb(safeJson(fs.readFileSync(DATA_FILE,'utf8'),emptyDb()))}catch{return emptyDb()}}
function saveDb(){fs.mkdirSync(DATA_DIR,{recursive:true});const tmp=`${DATA_FILE}.tmp`;fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DATA_FILE)}
let db=loadDb();
function addr(v){if(!isAddress(String(v||'')))throw Error('INVALID_ADDRESS');return getAddress(v).toLowerCase()}
function cleanText(v,max){return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)}
function cleanHandle(v){const x=String(v||'').trim().toLowerCase().replace(/^@/,'');if(!/^[a-z0-9_]{3,24}$/.test(x))throw Error('INVALID_HANDLE');return x}
function positiveChainId(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error('INVALID_CHAIN_ID');return n}
function safeHttps(v){let u;try{u=new URL(String(v||''))}catch{throw Error('INVALID_DAPP_URL')}if(u.protocol!=='https:'||u.username||u.password)throw Error('INVALID_DAPP_URL');return u.toString().slice(0,500)}
function validatedAttachment(kind,a){if(kind==='text')return null;if(!a||typeof a!=='object')throw Error('ATTACHMENT_REQUIRED');if(kind==='token')return {type:'token',chainId:positiveChainId(a.chainId),address:addr(a.address),symbol:cleanText(a.symbol,16)||'TOKEN',name:cleanText(a.name,64)};if(kind==='tx'){const hash=String(a.hash||'');if(!/^0x[a-fA-F0-9]{64}$/.test(hash))throw Error('INVALID_TX_HASH');return {type:'tx',chainId:positiveChainId(a.chainId),hash:hash.toLowerCase()}}if(kind==='dapp')return {type:'dapp',chainId:a.chainId==null?null:positiveChainId(a.chainId),url:safeHttps(a.url),name:cleanText(a.name,64)||'dApp'};throw Error('INVALID_POST_KIND')}
function b64(v){return Buffer.from(v).toString('base64url')}
function signToken(address){const body=b64(JSON.stringify({address,exp:now()+SESSION_TTL_MS}));const sig=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verifyToken(token){if(!SESSION_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();const got=Buffer.from(sig,'base64url');if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;const p=safeJson(Buffer.from(body,'base64url').toString('utf8'),null);if(!p||p.exp<now())return null;try{return addr(p.address)}catch{return null}}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')}
function auth(req){const a=verifyToken(bearer(req));if(!a)throw Error('UNAUTHORIZED');return a}
async function body(req){let total=0;const chunks=[];for await(const c of req){total+=c.length;if(total>MAX_BODY)throw Error('BODY_TOO_LARGE');chunks.push(c)}return safeJson(Buffer.concat(chunks).toString('utf8')||'{}',{})}
function profileFor(address){const a=addr(address);const p=db.profiles[a]||{address:a,handle:`zq_${a.slice(2,8)}`,displayName:'ZORYQ User',bio:'',createdAt:now(),updatedAt:now()};const followers=Object.values(db.follows).filter(x=>x.target===a).length;const following=Object.values(db.follows).filter(x=>x.actor===a).length;const posts=db.posts.filter(x=>x.author===a).length;const comments=db.comments.filter(x=>x.author===a).length;return {...p,followers,following,posts,reputation:{score:Math.min(100,10+posts*2+comments+followers),version:'zoryq-reputation-v0'}}}
function commentView(c){return {...c,authorProfile:profileFor(c.author)}}
function postView(p,viewer){const likeCount=Object.values(db.likes).filter(x=>x.postId===p.id).length;const commentCount=db.comments.filter(x=>x.postId===p.id).length;return {...p,authorProfile:profileFor(p.author),likeCount,commentCount,liked:viewer?Boolean(db.likes[`${viewer}:${p.id}`]):false}}
function isFollowing(actor,target){return Boolean(db.follows[`${actor}:${target}`])}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function rateAllowed(req){const key=clientIp(req);const t=now();const item=rate.get(key)||{t,n:0};if(t-item.t>60_000){item.t=t;item.n=0}item.n++;rate.set(key,item);if(rate.size>10_000){for(const [k,v] of rate){if(t-v.t>120_000)rate.delete(k)}}return item.n<=120}
function pruneChallenges(){const t=now();if(challenges.size>5_000){for(const [k,v] of challenges){if(v.expires<t)challenges.delete(k)}}}
function socialJson(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'});res.end(JSON.stringify(obj))}
function fail(res,e){const m=String(e?.message||'ERROR');const bad=['INVALID_ADDRESS','INVALID_HANDLE','EMPTY_POST','EMPTY_COMMENT','CANNOT_FOLLOW_SELF','INVALID_CHAIN_ID','INVALID_DAPP_URL','INVALID_TX_HASH','ATTACHMENT_REQUIRED','INVALID_POST_KIND','INVALID_REPORT_REASON'];const status=m==='UNAUTHORIZED'?401:m==='BODY_TOO_LARGE'?413:bad.includes(m)?400:m==='HANDLE_TAKEN'?409:403;socialJson(res,status,{ok:false,error:m})}

export function socialReady(){return SESSION_SECRET.length>=32}
export async function handleSocial(req,res,u){
 try{
  if(req.method==='OPTIONS'){socialJson(res,204,{});return true}
  if(!rateAllowed(req)){socialJson(res,429,{ok:false,error:'RATE_LIMIT'});return true}
  const p=u.pathname.replace(/^\/social/,'')||'/';
  if(req.method==='GET'&&p==='/health'){socialJson(res,socialReady()?200:503,{ok:socialReady(),service:'zoryq-social',version:'0.2.0',walletAuth:true,persistentPath:DATA_FILE,features:['profiles','feed','posts','likes','follows','comments','reports','verified-web3-cards']});return true}
  if(req.method==='GET'&&p==='/v1/auth/challenge'){
   pruneChallenges();const address=addr(u.searchParams.get('address'));const nonce=crypto.randomBytes(16).toString('hex');const issuedAt=new Date().toISOString();const message=`ZORYQ Social Sign-In\nAddress: ${getAddress(address)}\nNonce: ${nonce}\nIssued At: ${issuedAt}\n\nThis signature authenticates your ZORYQ profile. It does not authorize a transaction or transfer funds.`;challenges.set(address,{message,expires:now()+CHALLENGE_TTL_MS});socialJson(res,200,{ok:true,address,message,expiresInMs:CHALLENGE_TTL_MS});return true;
  }
  if(req.method==='POST'&&p==='/v1/auth/verify'){
   const b=await body(req);const address=addr(b.address);const c=challenges.get(address);if(!c||c.expires<now())throw Error('CHALLENGE_EXPIRED');const recovered=addr(verifyMessage(c.message,String(b.signature||'')));if(recovered!==address)throw Error('SIGNATURE_MISMATCH');challenges.delete(address);if(!db.profiles[address]){db.profiles[address]=profileFor(address);saveDb()}socialJson(res,200,{ok:true,token:signToken(address),profile:profileFor(address)});return true;
  }
  if(req.method==='GET'&&p.startsWith('/v1/profile/')){const address=addr(decodeURIComponent(p.split('/').pop()));const viewer=verifyToken(bearer(req));socialJson(res,200,{ok:true,profile:{...profileFor(address),followedByViewer:viewer?isFollowing(viewer,address):false}});return true}
  if(req.method==='PUT'&&p==='/v1/profile'){
   const actor=auth(req);const b=await body(req);const handle=cleanHandle(b.handle);for(const [a,profile] of Object.entries(db.profiles)){if(a!==actor&&profile.handle===handle)throw Error('HANDLE_TAKEN')}const old=profileFor(actor);db.profiles[actor]={...old,address:actor,handle,displayName:cleanText(b.displayName,48)||old.displayName,bio:cleanText(b.bio,180),updatedAt:now()};saveDb();socialJson(res,200,{ok:true,profile:profileFor(actor)});return true;
  }
  if(req.method==='GET'&&p==='/v1/feed'){
   const viewer=verifyToken(bearer(req));const scope=u.searchParams.get('scope')||'for-you';let posts=[...db.posts];if(scope==='following'&&viewer){const follows=new Set(Object.values(db.follows).filter(x=>x.actor===viewer).map(x=>x.target));follows.add(viewer);posts=posts.filter(post=>follows.has(post.author))}posts.sort((a,b)=>b.createdAt-a.createdAt);socialJson(res,200,{ok:true,scope,items:posts.slice(0,50).map(post=>postView(post,viewer))});return true;
  }
  if(req.method==='POST'&&p==='/v1/posts'){
   const actor=auth(req);const b=await body(req);const content=cleanText(b.content,500);if(!content)throw Error('EMPTY_POST');const kind=['text','token','tx','dapp'].includes(b.kind)?b.kind:'text';const attachment=validatedAttachment(kind,b.attachment);const post={id:`post_${crypto.randomUUID()}`,author:actor,content,kind,attachment,createdAt:now()};db.posts.push(post);saveDb();socialJson(res,201,{ok:true,post:postView(post,actor)});return true;
  }
  const comments=p.match(/^\/v1\/posts\/([^/]+)\/comments$/);
  if(req.method==='GET'&&comments){const postId=comments[1];if(!db.posts.some(x=>x.id===postId))throw Error('POST_NOT_FOUND');const items=db.comments.filter(x=>x.postId===postId).sort((a,b)=>a.createdAt-b.createdAt).slice(-100).map(commentView);socialJson(res,200,{ok:true,postId,items});return true}
  if(req.method==='POST'&&comments){const actor=auth(req);const postId=comments[1];if(!db.posts.some(x=>x.id===postId))throw Error('POST_NOT_FOUND');const b=await body(req);const content=cleanText(b.content,280);if(!content)throw Error('EMPTY_COMMENT');const comment={id:`comment_${crypto.randomUUID()}`,postId,author:actor,content,createdAt:now()};db.comments.push(comment);saveDb();socialJson(res,201,{ok:true,comment:commentView(comment),post:postView(db.posts.find(x=>x.id===postId),actor)});return true}
  const report=p.match(/^\/v1\/posts\/([^/]+)\/report$/);
  if(req.method==='POST'&&report){const actor=auth(req);const postId=report[1];if(!db.posts.some(x=>x.id===postId))throw Error('POST_NOT_FOUND');const b=await body(req);const reason=cleanText(b.reason,120);if(!reason)throw Error('INVALID_REPORT_REASON');if(!db.reports.some(x=>x.postId===postId&&x.reporter===actor))db.reports.push({id:`report_${crypto.randomUUID()}`,postId,reporter:actor,reason,createdAt:now(),status:'open'});saveDb();socialJson(res,202,{ok:true,reported:true});return true}
  const like=p.match(/^\/v1\/posts\/([^/]+)\/like$/);if(req.method==='POST'&&like){const actor=auth(req);const postId=like[1];if(!db.posts.some(x=>x.id===postId))throw Error('POST_NOT_FOUND');const key=`${actor}:${postId}`;if(db.likes[key])delete db.likes[key];else db.likes[key]={actor,postId,createdAt:now()};saveDb();socialJson(res,200,{ok:true,post:postView(db.posts.find(x=>x.id===postId),actor)});return true}
  const follow=p.match(/^\/v1\/follow\/(0x[a-fA-F0-9]{40})$/);if(req.method==='POST'&&follow){const actor=auth(req);const target=addr(follow[1]);if(actor===target)throw Error('CANNOT_FOLLOW_SELF');const key=`${actor}:${target}`;if(db.follows[key])delete db.follows[key];else db.follows[key]={actor,target,createdAt:now()};saveDb();socialJson(res,200,{ok:true,following:isFollowing(actor,target),profile:profileFor(target)});return true}
  socialJson(res,404,{ok:false,error:'SOCIAL_NOT_FOUND'});return true;
 }catch(e){fail(res,e);return true}
}
