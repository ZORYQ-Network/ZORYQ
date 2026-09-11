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
function emptyDb(){return {version:1,profiles:{},posts:[],likes:{},follows:{}}}
function loadDb(){try{return {...emptyDb(),...safeJson(fs.readFileSync(DATA_FILE,'utf8'),emptyDb())}}catch{return emptyDb()}}
function saveDb(){fs.mkdirSync(DATA_DIR,{recursive:true});const tmp=`${DATA_FILE}.tmp`;fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DATA_FILE)}
let db=loadDb();
function addr(v){if(!isAddress(String(v||'')))throw Error('INVALID_ADDRESS');return getAddress(v).toLowerCase()}
function cleanText(v,max){return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)}
function cleanHandle(v){const x=String(v||'').trim().toLowerCase().replace(/^@/,'');if(!/^[a-z0-9_]{3,24}$/.test(x))throw Error('INVALID_HANDLE');return x}
function b64(v){return Buffer.from(v).toString('base64url')}
function signToken(address){const body=b64(JSON.stringify({address,exp:now()+SESSION_TTL_MS}));const sig=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verifyToken(token){if(!SESSION_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();const got=Buffer.from(sig,'base64url');if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;const p=safeJson(Buffer.from(body,'base64url').toString('utf8'),null);if(!p||p.exp<now())return null;try{return addr(p.address)}catch{return null}}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')}
function auth(req){const a=verifyToken(bearer(req));if(!a)throw Error('UNAUTHORIZED');return a}
async function body(req){let total=0;const chunks=[];for await(const c of req){total+=c.length;if(total>MAX_BODY)throw Error('BODY_TOO_LARGE');chunks.push(c)}return safeJson(Buffer.concat(chunks).toString('utf8')||'{}',{})}
function profileFor(address){const a=addr(address);const p=db.profiles[a]||{address:a,handle:`zq_${a.slice(2,8)}`,displayName:'ZORYQ User',bio:'',createdAt:now(),updatedAt:now()};const followers=Object.values(db.follows).filter(x=>x.target===a).length;const following=Object.values(db.follows).filter(x=>x.actor===a).length;const posts=db.posts.filter(x=>x.author===a).length;return {...p,followers,following,posts,reputation:{score:Math.min(100,10+posts*2+followers),version:'zoryq-reputation-v0'}}}
function postView(p,viewer){const likeCount=Object.values(db.likes).filter(x=>x.postId===p.id).length;return {...p,authorProfile:profileFor(p.author),likeCount,liked:viewer?Boolean(db.likes[`${viewer}:${p.id}`]):false}}
function isFollowing(actor,target){return Boolean(db.follows[`${actor}:${target}`])}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function rateAllowed(req){const key=clientIp(req);const t=now();const item=rate.get(key)||{t,n:0};if(t-item.t>60_000){item.t=t;item.n=0}item.n++;rate.set(key,item);return item.n<=120}
function socialJson(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'});res.end(JSON.stringify(obj))}
function fail(res,e){const m=String(e?.message||'ERROR');const status=m==='UNAUTHORIZED'?401:m==='BODY_TOO_LARGE'?413:['INVALID_ADDRESS','INVALID_HANDLE','EMPTY_POST','CANNOT_FOLLOW_SELF'].includes(m)?400:m==='HANDLE_TAKEN'?409:403;socialJson(res,status,{ok:false,error:m})}

export function socialReady(){return SESSION_SECRET.length>=32}
export async function handleSocial(req,res,u){
 try{
  if(req.method==='OPTIONS'){socialJson(res,204,{});return true}
  if(!rateAllowed(req)){socialJson(res,429,{ok:false,error:'RATE_LIMIT'});return true}
  const p=u.pathname.replace(/^\/social/,'')||'/';
  if(req.method==='GET'&&p==='/health'){socialJson(res,socialReady()?200:503,{ok:socialReady(),service:'zoryq-social',version:'0.1.0',walletAuth:true,persistentPath:DATA_FILE});return true}
  if(req.method==='GET'&&p==='/v1/auth/challenge'){
   const address=addr(u.searchParams.get('address'));const nonce=crypto.randomBytes(16).toString('hex');const issuedAt=new Date().toISOString();const message=`ZORYQ Social Sign-In\nAddress: ${getAddress(address)}\nNonce: ${nonce}\nIssued At: ${issuedAt}\n\nThis signature authenticates your ZORYQ profile. It does not authorize a transaction or transfer funds.`;challenges.set(address,{message,expires:now()+CHALLENGE_TTL_MS});socialJson(res,200,{ok:true,address,message,expiresInMs:CHALLENGE_TTL_MS});return true;
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
   const actor=auth(req);const b=await body(req);const content=cleanText(b.content,500);if(!content)throw Error('EMPTY_POST');const kind=['text','token','tx','dapp'].includes(b.kind)?b.kind:'text';const post={id:`post_${crypto.randomUUID()}`,author:actor,content,kind,attachment:b.attachment&&typeof b.attachment==='object'?b.attachment:null,createdAt:now()};db.posts.push(post);saveDb();socialJson(res,201,{ok:true,post:postView(post,actor)});return true;
  }
  const like=p.match(/^\/v1\/posts\/([^/]+)\/like$/);if(req.method==='POST'&&like){const actor=auth(req);const postId=like[1];if(!db.posts.some(x=>x.id===postId))throw Error('POST_NOT_FOUND');const key=`${actor}:${postId}`;if(db.likes[key])delete db.likes[key];else db.likes[key]={actor,postId,createdAt:now()};saveDb();socialJson(res,200,{ok:true,post:postView(db.posts.find(x=>x.id===postId),actor)});return true}
  const follow=p.match(/^\/v1\/follow\/(0x[a-fA-F0-9]{40})$/);if(req.method==='POST'&&follow){const actor=auth(req);const target=addr(follow[1]);if(actor===target)throw Error('CANNOT_FOLLOW_SELF');const key=`${actor}:${target}`;if(db.follows[key])delete db.follows[key];else db.follows[key]={actor,target,createdAt:now()};saveDb();socialJson(res,200,{ok:true,following:isFollowing(actor,target),profile:profileFor(target)});return true}
  socialJson(res,404,{ok:false,error:'SOCIAL_NOT_FOUND'});return true;
 }catch(e){fail(res,e);return true}
}
