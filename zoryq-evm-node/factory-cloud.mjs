import fs from 'node:fs';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const STATE_FILE=process.env.ZORYQ_FACTORY_CLOUD_STATE||'/data/factory-cloud.json';
const BACKUP_FILE=process.env.ZORYQ_FACTORY_CLOUD_BACKUP||'/data/factory-cloud.backup.json';
const JOURNAL_FILE=process.env.ZORYQ_FACTORY_CLOUD_JOURNAL||'/data/factory-cloud-journal.ndjson';
const SECRET_FILE=process.env.ZORYQ_FACTORY_CLOUD_SECRET_FILE||'/data/factory-cloud-secret';
const TOKEN_TTL_MS=Number(process.env.ZORYQ_FACTORY_TOKEN_TTL_MS||24*60*60*1000);
const ROLES=['owner','admin','editor','viewer'];
const MAX_APPS=Number(process.env.ZORYQ_FACTORY_MAX_APPS||2500);
const MAX_USERS_PER_APP=Number(process.env.ZORYQ_FACTORY_MAX_USERS_PER_APP||100);
const MAX_RECORDS_PER_MODULE=Number(process.env.ZORYQ_FACTORY_MAX_RECORDS_PER_MODULE||10000);
const MAX_AUDIT=Number(process.env.ZORYQ_FACTORY_MAX_AUDIT||2000);
const MAX_RECORD_BYTES=Number(process.env.ZORYQ_FACTORY_MAX_RECORD_BYTES||64_000);

function loadJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function backupPrimary(){try{if(fs.existsSync(STATE_FILE))fs.copyFileSync(STATE_FILE,BACKUP_FILE)}catch{}}
function appendJournal(event){try{fs.appendFileSync(JOURNAL_FILE,JSON.stringify({...event,at:new Date().toISOString()})+'\n',{encoding:'utf8',mode:0o600})}catch{}}
function saveJson(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file)}
function initialState(){return {version:2,apps:{},meta:{createdAt:Date.now(),lastWriteAt:null,writes:0,recoveredFromBackup:false}}}
function state(){
  let s=loadJson(STATE_FILE,null);
  if(!s){const b=loadJson(BACKUP_FILE,null);if(b){s=b;s.meta ||= {};s.meta.recoveredFromBackup=true;appendJournal({type:'state_recovered_from_backup'});}else s=initialState();}
  s.version=2;s.apps ||= {};s.meta ||= {};s.meta.writes=Number(s.meta.writes||0);return s;
}
function saveState(s,event){
  backupPrimary();s.version=2;s.meta ||= {};s.meta.lastWriteAt=Date.now();s.meta.writes=Number(s.meta.writes||0)+1;saveJson(STATE_FILE,s);appendJournal(event||{type:'state_write'});
}
function secret(){try{const v=fs.readFileSync(SECRET_FILE,'utf8').trim();if(v)return v}catch{}const v=randomBytes(48).toString('hex');fs.writeFileSync(SECRET_FILE,v+'\n',{mode:0o600});return v}
const TOKEN_SECRET=secret();
function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function sign(payload){const raw=b64(JSON.stringify(payload));const mac=createHmac('sha256',TOKEN_SECRET).update(raw).digest('base64url');return raw+'.'+mac}
function verifyToken(token){try{const [raw,mac]=String(token||'').split('.');if(!raw||!mac)return null;const expected=createHmac('sha256',TOKEN_SECRET).update(raw).digest();const actual=Buffer.from(mac,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const p=JSON.parse(unb64(raw));if(!p.exp||Date.now()>p.exp)return null;return p}catch{return null}}
function passwordHash(password,salt=randomBytes(16).toString('hex')){const digest=scryptSync(String(password),salt,64).toString('hex');return `${salt}:${digest}`}
function passwordOk(password,stored){try{const [salt,hex]=String(stored||'').split(':');const a=Buffer.from(hex,'hex'),b=scryptSync(String(password),salt,64);return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}}
function cleanId(v,max=72){return String(v||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'').slice(0,max)}
function cleanEmail(v){const s=String(v||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:null}
function cleanRole(v){return ROLES.includes(v)?v:null}
function publicUser(u){return {id:u.id,email:u.email,role:u.role,createdAt:u.createdAt,lastLoginAt:u.lastLoginAt||null}}
function appSummary(app){return {id:app.id,name:app.spec?.name||app.id,version:app.spec?.version||1,revision:Number(app.revision||1),modules:(app.spec?.modules||[]).map(m=>({id:m.id,label:m.label})),createdAt:app.createdAt,updatedAt:app.updatedAt}}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()}
function auth(req,appId){const p=verifyToken(bearer(req));if(!p||p.appId!==appId)return null;return p}
function canWrite(role){return ['owner','admin','editor'].includes(role)}
function canAdmin(role){return ['owner','admin'].includes(role)}
function moduleExists(app,moduleId){return (app.spec?.modules||[]).some(m=>m.id===moduleId)}
function sanitizeSpec(spec){
 if(!spec||typeof spec!=='object'||!Array.isArray(spec.modules)||!spec.modules.length)throw Error('invalid_spec');
 const id=cleanId(spec.id);if(!id)throw Error('invalid_app_id');
 const modules=spec.modules.slice(0,30).map(m=>({...m,id:cleanId(m.id,48),label:String(m.label||m.id||'Módulo').slice(0,80),fields:Array.isArray(m.fields)?m.fields.slice(0,50).map(f=>({...f,id:cleanId(f.id,48),label:String(f.label||f.id||'Campo').slice(0,100)})):[]})).filter(m=>m.id&&m.fields.length);
 if(!modules.length)throw Error('invalid_modules');return {...spec,id,modules,status:'experimental-cloud-v2'};
}
function makeToken(appId,user){return sign({appId,userId:user.id,email:user.email,role:user.role,iat:Date.now(),exp:Date.now()+TOKEN_TTL_MS})}
function readPath(pathname){return pathname.split('/').filter(Boolean)}
function audit(app,user,type,meta={}){app.audit ||= [];app.audit.unshift({id:randomUUID(),at:new Date().toISOString(),userId:user?.id||null,role:user?.role||null,type,meta});if(app.audit.length>MAX_AUDIT)app.audit.length=MAX_AUDIT;}
function bump(app){app.revision=Number(app.revision||1)+1;app.updatedAt=Date.now()}
function expectedRevision(req,bodyObj){const h=Number(req.headers['if-match']);const b=Number(bodyObj?.revision);return Number.isFinite(h)&&h>0?h:(Number.isFinite(b)&&b>0?b:null)}
function requireRevision(app,req,b){const exp=expectedRevision(req,b);if(exp!==null&&exp!==Number(app.revision||1))return {ok:false,currentRevision:Number(app.revision||1)};return {ok:true}}
function validateRecordPayload(record){if(!record||typeof record!=='object'||Array.isArray(record))throw Error('invalid_record');const bytes=Buffer.byteLength(JSON.stringify(record));if(bytes>MAX_RECORD_BYTES)throw Error('record_too_large');return record}
function storageStats(s){let users=0,records=0,auditEvents=0;for(const app of Object.values(s.apps)){users+=Object.keys(app.users||{}).length;auditEvents+=(app.audit||[]).length;for(const arr of Object.values(app.records||{}))records+=Array.isArray(arr)?arr.length:0;}let journalBytes=0;try{journalBytes=fs.statSync(JOURNAL_FILE).size}catch{}let stateBytes=0;try{stateBytes=fs.statSync(STATE_FILE).size}catch{}return {apps:Object.keys(s.apps).length,users,records,auditEvents,stateBytes,journalBytes};}

export async function handleFactoryCloud(req,res,{body,send}){
 const url=new URL(req.url,'http://127.0.0.1');if(!url.pathname.startsWith('/factory/cloud/'))return false;const parts=readPath(url.pathname);const s=state();
 try{
  if(req.method==='GET'&&url.pathname==='/factory/cloud/status')return send(res,200,{ok:true,service:'zoryq-factory-cloud',schema:2,persistence:'railway-volume-json+atomic-backup+append-journal',auth:'scrypt+hmac-expiring-session',sessionTtlMs:TOKEN_TTL_MS,roles:ROLES,quotas:{maxApps:MAX_APPS,maxUsersPerApp:MAX_USERS_PER_APP,maxRecordsPerModule:MAX_RECORDS_PER_MODULE,maxRecordBytes:MAX_RECORD_BYTES},storage:storageStats(s),recoveredFromBackup:!!s.meta?.recoveredFromBackup,claimBoundary:'durability-hardened experimental cloud store; not PostgreSQL, audited auth, multi-region durability, or production database certification'}),true;
  if(req.method==='POST'&&url.pathname==='/factory/cloud/apps'){
   const b=await body(req),spec=sanitizeSpec(b.spec),email=cleanEmail(b.ownerEmail),password=String(b.ownerPassword||'');if(!email||password.length<8)return send(res,400,{ok:false,error:'owner_email_and_password_8_required'}),true;if(s.apps[spec.id])return send(res,409,{ok:false,error:'app_already_exists'}),true;if(Object.keys(s.apps).length>=MAX_APPS)return send(res,429,{ok:false,error:'app_quota_reached'}),true;
   const user={id:randomUUID(),email,role:'owner',passwordHash:passwordHash(password),createdAt:Date.now(),lastLoginAt:Date.now()};const app={id:spec.id,spec,users:{[user.id]:user},records:{},audit:[],revision:1,createdAt:Date.now(),updatedAt:Date.now(),provenance:String(b.provenance||'browser').slice(0,40)};for(const m of spec.modules)app.records[m.id]=[];audit(app,user,'app.created',{provenance:app.provenance});s.apps[spec.id]=app;saveState(s,{type:'app.created',appId:app.id,revision:app.revision});return send(res,201,{ok:true,app:appSummary(app),token:makeToken(app.id,user),user:publicUser(user)}),true;
  }
  if(req.method==='POST'&&url.pathname==='/factory/cloud/login'){
   const b=await body(req),appId=cleanId(b.appId),email=cleanEmail(b.email),password=String(b.password||''),app=s.apps[appId];if(!app||!email)return send(res,401,{ok:false,error:'invalid_credentials'}),true;const user=Object.values(app.users||{}).find(u=>u.email===email);if(!user||!passwordOk(password,user.passwordHash))return send(res,401,{ok:false,error:'invalid_credentials'}),true;user.lastLoginAt=Date.now();audit(app,user,'auth.login');saveState(s,{type:'auth.login',appId,revision:app.revision});return send(res,200,{ok:true,app:appSummary(app),token:makeToken(appId,user),user:publicUser(user)}),true;
  }
  if(parts[0]==='factory'&&parts[1]==='cloud'&&parts[2]==='apps'&&parts[3]){
   const appId=cleanId(parts[3]),app=s.apps[appId];if(!app)return send(res,404,{ok:false,error:'app_not_found'}),true;app.revision=Number(app.revision||1);app.audit ||= [];const session=auth(req,appId);if(!session)return send(res,401,{ok:false,error:'auth_required'}),true;const user=app.users?.[session.userId];if(!user)return send(res,401,{ok:false,error:'user_not_found'}),true;
   if(req.method==='GET'&&parts.length===4)return send(res,200,{ok:true,app:appSummary(app),spec:app.spec,user:publicUser(user)}),true;
   if(req.method==='GET'&&parts[4]==='export'&&parts.length===5){if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;audit(app,user,'app.exported');saveState(s,{type:'app.exported',appId,revision:app.revision});return send(res,200,{ok:true,export:{schema:'zoryq-factory-export/1',generatedAt:new Date().toISOString(),app:appSummary(app),spec:app.spec,records:app.records,users:Object.values(app.users).map(publicUser),audit:app.audit.slice(0,250)}}),true;}
   if(req.method==='GET'&&parts[4]==='audit'&&parts.length===5){if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;return send(res,200,{ok:true,revision:app.revision,audit:app.audit.slice(0,500)}),true;}
   if(req.method==='POST'&&parts[4]==='users'&&parts.length===5){if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;const b=await body(req),email=cleanEmail(b.email),password=String(b.password||''),role=cleanRole(b.role)||'viewer';if(!email||password.length<8||role==='owner')return send(res,400,{ok:false,error:'valid_user_required'}),true;if(Object.keys(app.users||{}).length>=MAX_USERS_PER_APP)return send(res,429,{ok:false,error:'user_quota_reached'}),true;if(Object.values(app.users).some(u=>u.email===email))return send(res,409,{ok:false,error:'email_exists'}),true;const nu={id:randomUUID(),email,role,passwordHash:passwordHash(password),createdAt:Date.now()};app.users[nu.id]=nu;bump(app);audit(app,user,'user.created',{userId:nu.id,role});saveState(s,{type:'user.created',appId,revision:app.revision});return send(res,201,{ok:true,revision:app.revision,user:publicUser(nu)}),true;}
   if(req.method==='GET'&&parts[4]==='users'&&parts.length===5){if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;return send(res,200,{ok:true,revision:app.revision,users:Object.values(app.users).map(publicUser)}),true;}
   if(req.method==='POST'&&parts[4]==='evolve'&&parts.length===5){if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;const b=await body(req);const rev=requireRevision(app,req,b);if(!rev.ok)return send(res,409,{ok:false,error:'revision_conflict',currentRevision:rev.currentRevision}),true;const next=sanitizeSpec({...b.spec,id:appId});for(const m of next.modules)if(!Array.isArray(app.records[m.id]))app.records[m.id]=[];app.spec={...next,version:Math.max(Number(app.spec?.version||1)+1,Number(next.version||1))};bump(app);audit(app,user,'app.evolved',{version:app.spec.version,moduleCount:app.spec.modules.length});saveState(s,{type:'app.evolved',appId,revision:app.revision});return send(res,200,{ok:true,app:appSummary(app),spec:app.spec,revision:app.revision}),true;}
   if(parts[4]==='records'&&parts[5]){
    const moduleId=cleanId(parts[5],48);if(!moduleExists(app,moduleId))return send(res,404,{ok:false,error:'module_not_found'}),true;app.records[moduleId] ||= [];
    if(req.method==='GET'&&parts.length===6)return send(res,200,{ok:true,revision:app.revision,records:app.records[moduleId]}),true;
    if(req.method==='POST'&&parts.length===6){if(!canWrite(user.role))return send(res,403,{ok:false,error:'write_role_required'}),true;if(app.records[moduleId].length>=MAX_RECORDS_PER_MODULE)return send(res,429,{ok:false,error:'record_quota_reached'}),true;const b=await body(req);const rev=requireRevision(app,req,b);if(!rev.ok)return send(res,409,{ok:false,error:'revision_conflict',currentRevision:rev.currentRevision}),true;const payload=validateRecordPayload(b.record||{}),record={...payload,id:randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),_createdBy:user.id};app.records[moduleId].unshift(record);bump(app);audit(app,user,'record.created',{moduleId,recordId:record.id});saveState(s,{type:'record.created',appId,moduleId,recordId:record.id,revision:app.revision});return send(res,201,{ok:true,revision:app.revision,record}),true;}
    if(parts[6]){const recordId=String(parts[6]),idx=app.records[moduleId].findIndex(r=>String(r.id)===recordId);if(idx<0)return send(res,404,{ok:false,error:'record_not_found'}),true;
     if(req.method==='PATCH'&&parts.length===7){if(!canWrite(user.role))return send(res,403,{ok:false,error:'write_role_required'}),true;const b=await body(req);const rev=requireRevision(app,req,b);if(!rev.ok)return send(res,409,{ok:false,error:'revision_conflict',currentRevision:rev.currentRevision}),true;const payload=validateRecordPayload(b.record||{});app.records[moduleId][idx]={...app.records[moduleId][idx],...payload,id:recordId,updatedAt:new Date().toISOString(),_updatedBy:user.id};bump(app);audit(app,user,'record.updated',{moduleId,recordId});saveState(s,{type:'record.updated',appId,moduleId,recordId,revision:app.revision});return send(res,200,{ok:true,revision:app.revision,record:app.records[moduleId][idx]}),true;}
     if(req.method==='DELETE'&&parts.length===7){if(!canWrite(user.role))return send(res,403,{ok:false,error:'write_role_required'}),true;const b=await body(req).catch(()=>({}));const rev=requireRevision(app,req,b);if(!rev.ok)return send(res,409,{ok:false,error:'revision_conflict',currentRevision:rev.currentRevision}),true;const [deleted]=app.records[moduleId].splice(idx,1);bump(app);audit(app,user,'record.deleted',{moduleId,recordId});saveState(s,{type:'record.deleted',appId,moduleId,recordId,revision:app.revision});return send(res,200,{ok:true,revision:app.revision,deleted:{id:deleted.id}}),true;}
    }
   }
  }
  return send(res,404,{ok:false,error:'factory_cloud_route_not_found'}),true;
 }catch(e){const msg=String(e?.message||e);const status=/^(invalid_|record_too_|prompt_too_|request_too_)/.test(msg)?400:500;return send(res,status,{ok:false,error:msg.slice(0,300)}),true;}
}
