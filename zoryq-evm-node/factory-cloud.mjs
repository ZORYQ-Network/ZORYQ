import fs from 'node:fs';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const STATE_FILE=process.env.ZORYQ_FACTORY_CLOUD_STATE||'/data/factory-cloud.json';
const SECRET_FILE=process.env.ZORYQ_FACTORY_CLOUD_SECRET_FILE||'/data/factory-cloud-secret';
const TOKEN_TTL_MS=7*24*60*60*1000;
const ROLES=['owner','admin','editor','viewer'];

function loadJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function saveJson(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file)}
function state(){const s=loadJson(STATE_FILE,{version:1,apps:{}});s.version=1;s.apps ||= {};return s}
function saveState(s){saveJson(STATE_FILE,s)}
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
function appSummary(app){return {id:app.id,name:app.spec?.name||app.id,version:app.spec?.version||1,modules:(app.spec?.modules||[]).map(m=>({id:m.id,label:m.label})),createdAt:app.createdAt,updatedAt:app.updatedAt}}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim()}
function auth(req,appId){const p=verifyToken(bearer(req));if(!p||p.appId!==appId)return null;return p}
function canWrite(role){return ['owner','admin','editor'].includes(role)}
function canAdmin(role){return ['owner','admin'].includes(role)}
function moduleExists(app,moduleId){return (app.spec?.modules||[]).some(m=>m.id===moduleId)}
function sanitizeSpec(spec){if(!spec||typeof spec!=='object'||!Array.isArray(spec.modules)||!spec.modules.length)throw Error('invalid_spec');const id=cleanId(spec.id);if(!id)throw Error('invalid_app_id');const modules=spec.modules.slice(0,30).map(m=>({
  ...m,
  id:cleanId(m.id,48),
  label:String(m.label||m.id||'Módulo').slice(0,80),
  fields:Array.isArray(m.fields)?m.fields.slice(0,50).map(f=>({...f,id:cleanId(f.id,48),label:String(f.label||f.id||'Campo').slice(0,100)})):[]
})).filter(m=>m.id&&m.fields.length);
if(!modules.length)throw Error('invalid_modules');return {...spec,id,modules,status:'experimental-cloud'} }
function makeToken(appId,user){return sign({appId,userId:user.id,email:user.email,role:user.role,iat:Date.now(),exp:Date.now()+TOKEN_TTL_MS})}
function readPath(pathname){return pathname.split('/').filter(Boolean)}

export async function handleFactoryCloud(req,res,{body,send}){
  const url=new URL(req.url,'http://127.0.0.1');
  if(!url.pathname.startsWith('/factory/cloud/'))return false;
  const parts=readPath(url.pathname);
  const s=state();
  try{
    if(req.method==='GET'&&url.pathname==='/factory/cloud/status'){
      return send(res,200,{ok:true,service:'zoryq-factory-cloud',schema:1,persistence:'railway-volume-json',auth:'scrypt+hmac',roles:ROLES,claimBoundary:'experimental; not production database or audited auth'}),true;
    }
    if(req.method==='POST'&&url.pathname==='/factory/cloud/apps'){
      const b=await body(req),spec=sanitizeSpec(b.spec),email=cleanEmail(b.ownerEmail),password=String(b.ownerPassword||'');
      if(!email||password.length<8)return send(res,400,{ok:false,error:'owner_email_and_password_8_required'}),true;
      if(s.apps[spec.id])return send(res,409,{ok:false,error:'app_already_exists'}),true;
      const user={id:randomUUID(),email,role:'owner',passwordHash:passwordHash(password),createdAt:Date.now()};
      const app={id:spec.id,spec,users:{[user.id]:user},records:{},createdAt:Date.now(),updatedAt:Date.now()};
      for(const m of spec.modules)app.records[m.id]=[];
      s.apps[spec.id]=app;saveState(s);
      return send(res,201,{ok:true,app:appSummary(app),token:makeToken(app.id,user),user:{id:user.id,email:user.email,role:user.role}}),true;
    }
    if(req.method==='POST'&&url.pathname==='/factory/cloud/login'){
      const b=await body(req),appId=cleanId(b.appId),email=cleanEmail(b.email),password=String(b.password||''),app=s.apps[appId];
      if(!app||!email)return send(res,401,{ok:false,error:'invalid_credentials'}),true;
      const user=Object.values(app.users||{}).find(u=>u.email===email);
      if(!user||!passwordOk(password,user.passwordHash))return send(res,401,{ok:false,error:'invalid_credentials'}),true;
      return send(res,200,{ok:true,app:appSummary(app),token:makeToken(appId,user),user:{id:user.id,email:user.email,role:user.role}}),true;
    }
    if(parts[0]==='factory'&&parts[1]==='cloud'&&parts[2]==='apps'&&parts[3]){
      const appId=cleanId(parts[3]),app=s.apps[appId];
      if(!app)return send(res,404,{ok:false,error:'app_not_found'}),true;
      const session=auth(req,appId);if(!session)return send(res,401,{ok:false,error:'auth_required'}),true;
      const user=app.users?.[session.userId];if(!user)return send(res,401,{ok:false,error:'user_not_found'}),true;
      if(req.method==='GET'&&parts.length===4)return send(res,200,{ok:true,app:appSummary(app),spec:app.spec,user:{id:user.id,email:user.email,role:user.role}}),true;
      if(req.method==='POST'&&parts[4]==='users'&&parts.length===5){
        if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;
        const b=await body(req),email=cleanEmail(b.email),password=String(b.password||''),role=cleanRole(b.role)||'viewer';
        if(!email||password.length<8||role==='owner')return send(res,400,{ok:false,error:'valid_user_required'}),true;
        if(Object.values(app.users).some(u=>u.email===email))return send(res,409,{ok:false,error:'email_exists'}),true;
        const nu={id:randomUUID(),email,role,passwordHash:passwordHash(password),createdAt:Date.now()};app.users[nu.id]=nu;app.updatedAt=Date.now();saveState(s);
        return send(res,201,{ok:true,user:{id:nu.id,email:nu.email,role:nu.role}}),true;
      }
      if(req.method==='GET'&&parts[4]==='users'&&parts.length===5){
        if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;
        return send(res,200,{ok:true,users:Object.values(app.users).map(u=>({id:u.id,email:u.email,role:u.role,createdAt:u.createdAt}))}),true;
      }
      if(req.method==='POST'&&parts[4]==='evolve'&&parts.length===5){
        if(!canAdmin(user.role))return send(res,403,{ok:false,error:'admin_required'}),true;
        const b=await body(req),next=sanitizeSpec({...b.spec,id:appId});
        for(const m of next.modules)if(!Array.isArray(app.records[m.id]))app.records[m.id]=[];
        app.spec={...next,version:Math.max(Number(app.spec?.version||1)+1,Number(next.version||1))};app.updatedAt=Date.now();saveState(s);
        return send(res,200,{ok:true,app:appSummary(app),spec:app.spec}),true;
      }
      if(parts[4]==='records'&&parts[5]){
        const moduleId=cleanId(parts[5],48);if(!moduleExists(app,moduleId))return send(res,404,{ok:false,error:'module_not_found'}),true;
        app.records[moduleId] ||= [];
        if(req.method==='GET'&&parts.length===6)return send(res,200,{ok:true,records:app.records[moduleId]}),true;
        if(req.method==='POST'&&parts.length===6){
          if(!canWrite(user.role))return send(res,403,{ok:false,error:'write_role_required'}),true;
          const b=await body(req),record={...(b.record||{}),id:randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),_createdBy:user.id};
          app.records[moduleId].unshift(record);app.updatedAt=Date.now();saveState(s);return send(res,201,{ok:true,record}),true;
        }
        if(parts[6]){
          const recordId=String(parts[6]),idx=app.records[moduleId].findIndex(r=>String(r.id)===recordId);if(idx<0)return send(res,404,{ok:false,error:'record_not_found'}),true;
          if(req.method==='PATCH'&&parts.length===7){if(!canWrite(user.role))return send(res,403,{ok:false,error:'write_role_required'}),true;const b=await body(req);app.records[moduleId][idx]={...app.records[moduleId][idx],...(b.record||{}),id:recordId,updatedAt:new Date().toISOString(),_updatedBy:user.id};app.updatedAt=Date.now();saveState(s);return send(res,200,{ok:true,record:app.records[moduleId][idx]}),true;}
          if(req.method==='DELETE'&&parts.length===7){if(!canWrite(user.role))return send(res,403,{ok:false,error:'write_role_required'}),true;const [deleted]=app.records[moduleId].splice(idx,1);app.updatedAt=Date.now();saveState(s);return send(res,200,{ok:true,deleted:{id:deleted.id}}),true;}
        }
      }
    }
    return send(res,404,{ok:false,error:'factory_cloud_route_not_found'}),true;
  }catch(e){const msg=String(e?.message||e);const status=msg.startsWith('invalid_')?400:500;return send(res,status,{ok:false,error:msg.slice(0,300)}),true;}
}
