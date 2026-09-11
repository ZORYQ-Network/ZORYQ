import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isAddress,getAddress} from 'ethers';

const DATA_DIR=process.env.MESSAGE_DATA_DIR||'/data';
const DATA_FILE=path.join(DATA_DIR,'messages.json');
const SESSION_SECRET=String(process.env.SOCIAL_SESSION_SECRET||'');
const MAX_BODY=64*1024;
const rate=new Map();

function now(){return Date.now()}
function safeJson(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function emptyDb(){return {version:1,conversations:[],messages:[]}}
function loadDb(){try{return {...emptyDb(),...safeJson(fs.readFileSync(DATA_FILE,'utf8'),emptyDb())}}catch{return emptyDb()}}
let db=loadDb();
function saveDb(){fs.mkdirSync(DATA_DIR,{recursive:true});const tmp=`${DATA_FILE}.tmp`;fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DATA_FILE)}
function addr(v){if(!isAddress(String(v||'')))return null;return getAddress(v).toLowerCase()}
function verifyToken(token){if(!SESSION_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();let got;try{got=Buffer.from(sig,'base64url')}catch{return null}if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;const p=safeJson(Buffer.from(body,'base64url').toString('utf8'),null);if(!p||p.exp<now())return null;return addr(p.address)}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')}
function auth(req){const a=verifyToken(bearer(req));if(!a)throw Error('UNAUTHORIZED');return a}
function clean(v,max){return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)}
async function body(req){let total=0;const chunks=[];for await(const c of req){total+=c.length;if(total>MAX_BODY)throw Error('BODY_TOO_LARGE');chunks.push(c)}return safeJson(Buffer.concat(chunks).toString('utf8')||'{}',{})}
function convoFor(a,b){const x=[a,b].sort();return db.conversations.find(c=>c.participants[0]===x[0]&&c.participants[1]===x[1])||null}
function canRead(c,a){return c?.participants?.includes(a)}
function convoView(c,a){const msgs=db.messages.filter(x=>x.conversationId===c.id);const last=msgs[msgs.length-1]||null;const unread=msgs.filter(x=>x.sender!==a&&!(x.readBy||[]).includes(a)).length;return {...c,lastMessage:last?{id:last.id,sender:last.sender,content:last.content,createdAt:last.createdAt}:null,unread}}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function allowed(req){const key=clientIp(req);const t=now();const r=rate.get(key)||{t,n:0};if(t-r.t>60_000){r.t=t;r.n=0}r.n++;rate.set(key,r);return r.n<=180}
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(obj))}
function fail(res,e){const m=String(e?.message||'ERROR');const status=m==='UNAUTHORIZED'?401:m==='BODY_TOO_LARGE'?413:['INVALID_PARTICIPANT','EMPTY_MESSAGE','CANNOT_MESSAGE_SELF','CONVERSATION_NOT_FOUND','NOT_PARTICIPANT'].includes(m)?400:403;json(res,status,{ok:false,error:m})}

export async function handleMessages(req,res,u){
 try{
  if(req.method==='OPTIONS'){json(res,204,{});return true}
  if(!allowed(req)){json(res,429,{ok:false,error:'RATE_LIMIT'});return true}
  const p=u.pathname.replace(/^\/message/,'')||'/';
  if(req.method==='GET'&&p==='/health'){json(res,200,{ok:true,service:'zoryq-messages',version:'0.1.0',walletAuth:true,persistentPath:DATA_FILE,encryption:'transport-and-access-control',e2e:false});return true}
  if(req.method==='GET'&&p==='/v1/conversations'){const actor=auth(req);const items=db.conversations.filter(c=>canRead(c,actor)).sort((a,b)=>b.updatedAt-a.updatedAt).map(c=>convoView(c,actor));json(res,200,{ok:true,items});return true}
  if(req.method==='POST'&&p==='/v1/conversations'){const actor=auth(req);const b=await body(req);const other=addr(b.participant);if(!other)throw Error('INVALID_PARTICIPANT');if(other===actor)throw Error('CANNOT_MESSAGE_SELF');let c=convoFor(actor,other);if(!c){const participants=[actor,other].sort();c={id:`dm_${crypto.randomUUID()}`,participants,createdBy:actor,createdAt:now(),updatedAt:now()};db.conversations.push(c);saveDb()}json(res,201,{ok:true,conversation:convoView(c,actor)});return true}
  const messages=p.match(/^\/v1\/conversations\/([^/]+)\/messages$/);if(req.method==='GET'&&messages){const actor=auth(req);const c=db.conversations.find(x=>x.id===messages[1]);if(!c)throw Error('CONVERSATION_NOT_FOUND');if(!canRead(c,actor))throw Error('NOT_PARTICIPANT');const items=db.messages.filter(x=>x.conversationId===c.id).sort((a,b)=>a.createdAt-b.createdAt).slice(-300);json(res,200,{ok:true,conversation:convoView(c,actor),items});return true}
  if(req.method==='POST'&&messages){const actor=auth(req);const c=db.conversations.find(x=>x.id===messages[1]);if(!c)throw Error('CONVERSATION_NOT_FOUND');if(!canRead(c,actor))throw Error('NOT_PARTICIPANT');const b=await body(req);const content=clean(b.content,4000);if(!content)throw Error('EMPTY_MESSAGE');const msg={id:`dmmsg_${crypto.randomUUID()}`,conversationId:c.id,sender:actor,content,createdAt:now(),readBy:[actor]};db.messages.push(msg);c.updatedAt=now();if(db.messages.length>100_000)db.messages=db.messages.slice(-100_000);saveDb();json(res,201,{ok:true,message:msg,conversation:convoView(c,actor)});return true}
  const read=p.match(/^\/v1\/conversations\/([^/]+)\/read$/);if(req.method==='POST'&&read){const actor=auth(req);const c=db.conversations.find(x=>x.id===read[1]);if(!c)throw Error('CONVERSATION_NOT_FOUND');if(!canRead(c,actor))throw Error('NOT_PARTICIPANT');for(const m of db.messages){if(m.conversationId===c.id&&!m.readBy?.includes(actor))m.readBy=[...(m.readBy||[]),actor]}saveDb();json(res,200,{ok:true,conversation:convoView(c,actor)});return true}
  json(res,404,{ok:false,error:'MESSAGE_NOT_FOUND'});return true
 }catch(e){fail(res,e);return true}
}
