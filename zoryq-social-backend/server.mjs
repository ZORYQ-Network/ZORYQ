import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {getAddress,isAddress,verifyMessage} from 'ethers';

const PORT=Number(process.env.PORT||8080);
const DATA_DIR=process.env.SOCIAL_DATA_DIR||'/data';
const DATA_FILE=path.join(DATA_DIR,'social.json');
const SESSION_SECRET=String(process.env.SOCIAL_SESSION_SECRET||'');
const MAX_BODY=64*1024;
const SESSION_TTL_MS=7*24*60*60*1000;
const CHALLENGE_TTL_MS=5*60*1000;
const challenges=new Map();
const rate=new Map();

function now(){return Date.now()}
function safeJson(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function emptyDb(){return {version:1,profiles:{},posts:[],likes:{},follows:{}}}
function loadDb(){try{return {...emptyDb(),...safeJson(fs.readFileSync(DATA_FILE,'utf8'),emptyDb())}}catch{return emptyDb()}}
function saveDb(db){fs.mkdirSync(DATA_DIR,{recursive:true});const tmp=`${DATA_FILE}.tmp`;fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DATA_FILE)}
let db=loadDb();

function json(res,status,obj){const body=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'});res.end(body)}
function text(res,status,body){res.writeHead(status,{'content-type':'text/plain; charset=utf-8'});res.end(body)}
function addr(v){if(!isAddress(String(v||'')))throw Error('INVALID_ADDRESS');return getAddress(v).toLowerCase()}
function cleanText(v,max){return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)}
function cleanHandle(v){const x=String(v||'').trim().toLowerCase().replace(/^@/,'');if(!/^[a-z0-9_]{3,24}$/.test(x))throw Error('INVALID_HANDLE');return x}
function id(prefix){return `${prefix}_${crypto.randomUUID()}`}
function b64(v){return Buffer.from(v).toString('base64url')}
function signToken(address){const payload={address,exp:now()+SESSION_TTL_MS};const body=b64(JSON.stringify(payload));const sig=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verifyToken(token){if(!SESSION_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();const got=Buffer.from(sig,'base64url');if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;const p=safeJson(Buffer.from(body,'base64url').toString('utf8'),null);if(!p||p.exp<now())return null;try{return addr(p.address)}catch{return null}}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')}
function auth(req){const a=verifyToken(bearer(req));if(!a)throw Error('UNAUTHORIZED');return a}
function profileFor(address){const a=addr(address);const p=db.profiles[a]||{address:a,handle:`zq_${a.slice(2,8)}`,displayName:'ZORYQ User',bio:'',createdAt:now(),updatedAt:now()};const followers=Object.values(db.follows).filter(x=>x.target===a).length;const following=Object.values(db.follows).filter(x=>x.actor===a).length;const posts=db.posts.filter(x=>x.author===a).length;return {...p,followers,following,posts,reputation:{score:Math.min(100,10+posts*2+followers),version:'zoryq-reputation-v0'}}}
function postView(p,viewer){const likeCount=Object.values(db.likes).filter(x=>x.postId===p.id).length;const liked=viewer?Boolean(db.likes[`${viewer}:${p.id}`]):false;return {...p,authorProfile:profileFor(p.author),likeCount,liked}}
function isFollowing(actor,target){return Boolean(db.follows[`${actor}:${target}`])}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function limit(req,res){const key=clientIp(req);const t=now();const item=rate.get(key)||{t,n:0};if(t-item.t>60_000){item.t=t;item.n=0}item.n++;rate.set(key,item);if(item.n>120){json(res,429,{ok:false,error:'RATE_LIMIT'});return false}return true}
async function body(req){return await new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(Buffer.byteLength(raw)>MAX_BODY){reject(Error('BODY_TOO_LARGE'));req.destroy()}});req.on('end',()=>resolve(safeJson(raw||'{}',{})));req.on('error',reject)})}
function route(url){return new URL(url,'http://zoryq.local')}

const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'});return res.end()}
  if(!limit(req,res))return;
  const u=route(req.url||'/');
  if(req.method==='GET'&&u.pathname==='/health')return json(res,200,{ok:true,service:'zoryq-social',version:'0.1.0',walletAuth:true,persistence:DATA_DIR});
  if(req.method==='GET'&&u.pathname==='/v1/auth/challenge'){
   const address=addr(u.searchParams.get('address'));const nonce=crypto.randomBytes(16).toString('hex');const issuedAt=new Date().toISOString();const message=`ZORYQ Social Sign-In\nAddress: ${getAddress(address)}\nNonce: ${nonce}\nIssued At: ${issuedAt}\n\nThis signature authenticates your ZORYQ profile. It does not authorize a transaction or transfer funds.`;challenges.set(address,{message,expires:now()+CHALLENGE_TTL_MS});return json(res,200,{ok:true,address,message,expiresInMs:CHALLENGE_TTL_MS});
  }
  if(req.method==='POST'&&u.pathname==='/v1/auth/verify'){
   const b=await body(req);const address=addr(b.address);const c=challenges.get(address);if(!c||c.expires<now())throw Error('CHALLENGE_EXPIRED');const recovered=addr(verifyMessage(c.message,String(b.signature||'')));if(recovered!==address)throw Error('SIGNATURE_MISMATCH');challenges.delete(address);if(!db.profiles[address]){db.profiles[address]=profileFor(address);saveDb(db)}return json(res,200,{ok:true,token:signToken(address),profile:profileFor(address)});
  }
  if(req.method==='GET'&&u.pathname.startsWith('/v1/profile/')){
   const address=addr(decodeURIComponent(u.pathname.split('/').pop()));const viewer=verifyToken(bearer(req));return json(res,200,{ok:true,profile:{...profileFor(address),followedByViewer:viewer?isFollowing(viewer,address):false}});
  }
  if(req.method==='PUT'&&u.pathname==='/v1/profile'){
   const actor=auth(req);const b=await body(req);const handle=cleanHandle(b.handle);for(const [a,p] of Object.entries(db.profiles)){if(a!==actor&&p.handle===handle)throw Error('HANDLE_TAKEN')}const old=profileFor(actor);db.profiles[actor]={...old,address:actor,handle,displayName:cleanText(b.displayName,48)||old.displayName,bio:cleanText(b.bio,180),updatedAt:now()};saveDb(db);return json(res,200,{ok:true,profile:profileFor(actor)});
  }
  if(req.method==='GET'&&u.pathname==='/v1/feed'){
   const viewer=verifyToken(bearer(req));const scope=u.searchParams.get('scope')||'for-you';let posts=[...db.posts];if(scope==='following'&&viewer){const follows=new Set(Object.values(db.follows).filter(x=>x.actor===viewer).map(x=>x.target));follows.add(viewer);posts=posts.filter(p=>follows.has(p.author))}posts.sort((a,b)=>b.createdAt-a.createdAt);return json(res,200,{ok:true,scope,items:posts.slice(0,50).map(p=>postView(p,viewer))});
  }
  if(req.method==='POST'&&u.pathname==='/v1/posts'){
   const actor=auth(req);const b=await body(req);const content=cleanText(b.content,500);if(!content)throw Error('EMPTY_POST');const kind=['text','token','tx','dapp'].includes(b.kind)?b.kind:'text';const post={id:id('post'),author:actor,content,kind,attachment:b.attachment&&typeof b.attachment==='object'?b.attachment:null,createdAt:now()};db.posts.push(post);saveDb(db);return json(res,201,{ok:true,post:postView(post,actor)});
  }
  const likeMatch=u.pathname.match(/^\/v1\/posts\/([^/]+)\/like$/);
  if(req.method==='POST'&&likeMatch){const actor=auth(req);const postId=likeMatch[1];if(!db.posts.some(p=>p.id===postId))throw Error('POST_NOT_FOUND');const key=`${actor}:${postId}`;if(db.likes[key])delete db.likes[key];else db.likes[key]={actor,postId,createdAt:now()};saveDb(db);const p=db.posts.find(x=>x.id===postId);return json(res,200,{ok:true,post:postView(p,actor)});}
  const followMatch=u.pathname.match(/^\/v1\/follow\/(0x[a-fA-F0-9]{40})$/);
  if(req.method==='POST'&&followMatch){const actor=auth(req);const target=addr(followMatch[1]);if(actor===target)throw Error('CANNOT_FOLLOW_SELF');const key=`${actor}:${target}`;if(db.follows[key])delete db.follows[key];else db.follows[key]={actor,target,createdAt:now()};saveDb(db);return json(res,200,{ok:true,following:isFollowing(actor,target),profile:profileFor(target)});}
  return json(res,404,{ok:false,error:'NOT_FOUND'});
 }catch(e){const m=String(e?.message||'ERROR');const status=m==='UNAUTHORIZED'?401:m==='BODY_TOO_LARGE'?413:['INVALID_ADDRESS','INVALID_HANDLE','EMPTY_POST','CANNOT_FOLLOW_SELF'].includes(m)?400:['HANDLE_TAKEN'].includes(m)?409:403;return json(res,status,{ok:false,error:m})}
});
server.listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({service:'zoryq-social',port:PORT,persistence:DATA_DIR,sessionSecretConfigured:Boolean(SESSION_SECRET)})));
