import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isAddress,getAddress} from 'ethers';

const DATA_DIR=process.env.COMMUNITY_DATA_DIR||'/data';
const DATA_FILE=path.join(DATA_DIR,'communities.json');
const SESSION_SECRET=String(process.env.SOCIAL_SESSION_SECRET||'');
const MAX_BODY=64*1024;
const rate=new Map();

function now(){return Date.now()}
function safeJson(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function emptyDb(){return {version:1,communities:[],channels:[],members:[],messages:[]}}
function loadDb(){try{return {...emptyDb(),...safeJson(fs.readFileSync(DATA_FILE,'utf8'),emptyDb())}}catch{return emptyDb()}}
let db=loadDb();
function saveDb(){fs.mkdirSync(DATA_DIR,{recursive:true});const tmp=`${DATA_FILE}.tmp`;fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,DATA_FILE)}
function addr(v){if(!isAddress(String(v||'')))return null;return getAddress(v).toLowerCase()}
function verifyToken(token){if(!SESSION_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();let got;try{got=Buffer.from(sig,'base64url')}catch{return null}if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;const p=safeJson(Buffer.from(body,'base64url').toString('utf8'),null);if(!p||p.exp<now())return null;return addr(p.address)}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')}
function auth(req){const a=verifyToken(bearer(req));if(!a)throw Error('UNAUTHORIZED');return a}
function clean(v,max){return String(v||'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)}
function slug(v){const s=String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(s))throw Error('INVALID_SLUG');return s}
async function body(req){let total=0;const chunks=[];for await(const c of req){total+=c.length;if(total>MAX_BODY)throw Error('BODY_TOO_LARGE');chunks.push(c)}return safeJson(Buffer.concat(chunks).toString('utf8')||'{}',{})}
function member(communityId,address){return db.members.find(x=>x.communityId===communityId&&x.address===address)||null}
function communityView(c,viewer){const members=db.members.filter(x=>x.communityId===c.id).length;const channels=db.channels.filter(x=>x.communityId===c.id).length;const m=viewer?member(c.id,viewer):null;return {...c,members,channels,joined:Boolean(m),viewerRole:m?.role||null}}
function channelView(c){return {...c,messageCount:db.messages.filter(x=>x.channelId===c.id).length}}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()}
function allowed(req){const key=clientIp(req);const t=now();const r=rate.get(key)||{t,n:0};if(t-r.t>60_000){r.t=t;r.n=0}r.n++;rate.set(key,r);return r.n<=180}
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(obj))}
function fail(res,e){const m=String(e?.message||'ERROR');const status=m==='UNAUTHORIZED'?401:m==='BODY_TOO_LARGE'?413:['INVALID_SLUG','EMPTY_NAME','EMPTY_MESSAGE','NOT_MEMBER','NOT_ALLOWED','COMMUNITY_NOT_FOUND','CHANNEL_NOT_FOUND'].includes(m)?400:m==='SLUG_TAKEN'?409:403;json(res,status,{ok:false,error:m})}

export async function handleCommunities(req,res,u){
 try{
  if(req.method==='OPTIONS'){json(res,204,{});return true}
  if(!allowed(req)){json(res,429,{ok:false,error:'RATE_LIMIT'});return true}
  const p=u.pathname.replace(/^\/community/,'')||'/';
  if(req.method==='GET'&&p==='/health'){json(res,200,{ok:true,service:'zoryq-communities',version:'0.1.0',walletAuth:true,persistentPath:DATA_FILE,features:['communities','members','channels','public-messages']});return true}
  if(req.method==='GET'&&p==='/v1/communities'){const viewer=verifyToken(bearer(req));const items=[...db.communities].sort((a,b)=>b.createdAt-a.createdAt).map(c=>communityView(c,viewer));json(res,200,{ok:true,items});return true}
  if(req.method==='POST'&&p==='/v1/communities'){
   const actor=auth(req);const b=await body(req);const name=clean(b.name,64);if(!name)throw Error('EMPTY_NAME');const s=slug(b.slug||name);if(db.communities.some(x=>x.slug===s))throw Error('SLUG_TAKEN');const id=`com_${crypto.randomUUID()}`;const c={id,slug:s,name,description:clean(b.description,240),owner:actor,visibility:'public',gate:{type:'public'},createdAt:now()};db.communities.push(c);db.members.push({communityId:id,address:actor,role:'owner',joinedAt:now()});const channel={id:`ch_${crypto.randomUUID()}`,communityId:id,slug:'general',name:'Geral',description:'Canal principal da comunidade',createdBy:actor,createdAt:now()};db.channels.push(channel);saveDb();json(res,201,{ok:true,community:communityView(c,actor),channel:channelView(channel)});return true
  }
  const details=p.match(/^\/v1\/communities\/([^/]+)$/);if(req.method==='GET'&&details){const c=db.communities.find(x=>x.id===details[1]||x.slug===details[1]);if(!c)throw Error('COMMUNITY_NOT_FOUND');const viewer=verifyToken(bearer(req));json(res,200,{ok:true,community:communityView(c,viewer),channels:db.channels.filter(x=>x.communityId===c.id).map(channelView)});return true}
  const join=p.match(/^\/v1\/communities\/([^/]+)\/join$/);if(req.method==='POST'&&join){const actor=auth(req);const c=db.communities.find(x=>x.id===join[1]||x.slug===join[1]);if(!c)throw Error('COMMUNITY_NOT_FOUND');const existing=member(c.id,actor);if(existing&&existing.role!=='owner')db.members=db.members.filter(x=>!(x.communityId===c.id&&x.address===actor));else if(!existing)db.members.push({communityId:c.id,address:actor,role:'member',joinedAt:now()});saveDb();json(res,200,{ok:true,community:communityView(c,actor)});return true}
  const channels=p.match(/^\/v1\/communities\/([^/]+)\/channels$/);if(req.method==='POST'&&channels){const actor=auth(req);const c=db.communities.find(x=>x.id===channels[1]||x.slug===channels[1]);if(!c)throw Error('COMMUNITY_NOT_FOUND');const m=member(c.id,actor);if(!m||m.role!=='owner')throw Error('NOT_ALLOWED');const b=await body(req);const name=clean(b.name,48);if(!name)throw Error('EMPTY_NAME');const s=slug(b.slug||name);if(db.channels.some(x=>x.communityId===c.id&&x.slug===s))throw Error('SLUG_TAKEN');const ch={id:`ch_${crypto.randomUUID()}`,communityId:c.id,slug:s,name,description:clean(b.description,180),createdBy:actor,createdAt:now()};db.channels.push(ch);saveDb();json(res,201,{ok:true,channel:channelView(ch)});return true}
  const messages=p.match(/^\/v1\/channels\/([^/]+)\/messages$/);if(req.method==='GET'&&messages){const ch=db.channels.find(x=>x.id===messages[1]);if(!ch)throw Error('CHANNEL_NOT_FOUND');const items=db.messages.filter(x=>x.channelId===ch.id).sort((a,b)=>a.createdAt-b.createdAt).slice(-200);json(res,200,{ok:true,channel:channelView(ch),items});return true}
  if(req.method==='POST'&&messages){const actor=auth(req);const ch=db.channels.find(x=>x.id===messages[1]);if(!ch)throw Error('CHANNEL_NOT_FOUND');if(!member(ch.communityId,actor))throw Error('NOT_MEMBER');const b=await body(req);const content=clean(b.content,2000);if(!content)throw Error('EMPTY_MESSAGE');const msg={id:`msg_${crypto.randomUUID()}`,communityId:ch.communityId,channelId:ch.id,author:actor,content,createdAt:now()};db.messages.push(msg);if(db.messages.length>50_000)db.messages=db.messages.slice(-50_000);saveDb();json(res,201,{ok:true,message:msg});return true}
  json(res,404,{ok:false,error:'COMMUNITY_NOT_FOUND'});return true
 }catch(e){fail(res,e);return true}
}
