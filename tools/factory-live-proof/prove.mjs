import { randomBytes } from 'node:crypto';

const BASE=process.env.ZORYQ_FACTORY_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const run=String(process.env.GITHUB_RUN_ID||Date.now());
const suffix=randomBytes(4).toString('hex');
const appId=`live-proof-${run}-${suffix}`.toLowerCase().slice(0,70);
const ownerEmail=`owner-${suffix}@example.com`;
const ownerPassword=`Proof-${randomBytes(12).toString('hex')}!`;
let ownerToken='';

async function request(path,{method='GET',body,token=ownerToken,expected}={}){
  const headers={accept:'application/json'};
  if(body!==undefined)headers['content-type']='application/json';
  if(token)headers.authorization=`Bearer ${token}`;
  const res=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await res.text();
  let json={};try{json=text?JSON.parse(text):{}}catch{throw new Error(`${method} ${path}: non-json ${res.status} ${text.slice(0,160)}`)}
  const allowed=Array.isArray(expected)?expected:(expected?[expected]:[200,201]);
  if(!allowed.includes(res.status))throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(json).slice(0,300)}`);
  return {status:res.status,json};
}
function check(value,message){if(!value)throw new Error(message)}

const evidence={schema:'zoryq-factory-live-proof/0.2',generatedAt:new Date().toISOString(),base:BASE,checks:{},claimBoundary:'Project-controlled GitHub runner on external infrastructure. Proves public reproducibility of the current Factory v0.2 flow, not independent human adoption, universal software generation, audited security, or production readiness.'};

const status=await request('/factory/cloud/status');
check(status.json.ok===true,'cloud status not ok');
evidence.checks.cloudStatus={ok:true,persistence:status.json.persistence,auth:status.json.auth,roles:status.json.roles};

for(const path of ['/launch-studio','/project-launch']){
  const res=await fetch(BASE+path,{redirect:'follow'});
  const html=await res.text();
  check(res.ok,`${path} HTTP ${res.status}`);
  check(/ZORYQ/i.test(html),`${path} missing ZORYQ marker`);
  evidence.checks[path.slice(1)]={ok:true,http:res.status,bytes:Buffer.byteLength(html)};
}

const spec={v:3,version:1,id:appId,name:'Factory Live Proof',description:'Synthetic CI evidence only',domain:'proof',runtime:'zoryq-schema-runtime-v3',status:'experimental',cloud:{enabled:true,status:'active'},chain:false,modules:[
  {id:'residents',label:'Moradores',icon:'👤',titleField:'name',fields:[{id:'name',label:'Nome',type:'text',required:true},{id:'unit',label:'Unidade',type:'text'}]},
  {id:'packages',label:'Encomendas',icon:'📦',titleField:'code',fields:[{id:'code',label:'Código',type:'text',required:true},{id:'residentId',label:'Morador',type:'relation',source:'residents',labelField:'name'}]}
]};

const created=await request('/factory/cloud/apps',{method:'POST',body:{spec,ownerEmail,ownerPassword},token:''});
ownerToken=created.json.token;
check(ownerToken&&created.json.user?.role==='owner','owner bootstrap failed');
evidence.checks.createApp={ok:true,http:created.status,appId,role:created.json.user.role};

const login=await request('/factory/cloud/login',{method:'POST',body:{appId,email:ownerEmail,password:ownerPassword},token:''});
ownerToken=login.json.token;
check(ownerToken,'owner login failed');
evidence.checks.ownerLogin={ok:true,http:login.status,role:login.json.user.role};

const editorEmail=`editor-${suffix}@example.com`,editorPassword=`Editor-${randomBytes(10).toString('hex')}!`;
const user=await request(`/factory/cloud/apps/${appId}/users`,{method:'POST',body:{email:editorEmail,password:editorPassword,role:'editor'}});
check(user.json.user?.role==='editor','editor creation failed');
const editorLogin=await request('/factory/cloud/login',{method:'POST',body:{appId,email:editorEmail,password:editorPassword},token:''});
const editorToken=editorLogin.json.token;
check(editorToken,'editor login failed');
evidence.checks.roles={ok:true,owner:'owner',created:'editor'};

const resident=await request(`/factory/cloud/apps/${appId}/records/residents`,{method:'POST',token:editorToken,body:{record:{name:'Demo Resident',unit:'0101'}}});
const residentId=resident.json.record?.id;check(residentId,'resident create failed');
const pkg=await request(`/factory/cloud/apps/${appId}/records/packages`,{method:'POST',token:editorToken,body:{record:{code:'PKG-DEMO',residentId}}});
check(pkg.json.record?.id,'package create failed');
let rows=await request(`/factory/cloud/apps/${appId}/records/residents`,{token:editorToken});
check(rows.json.records?.some(r=>r.id===residentId),'cloud record not readable');
evidence.checks.cloudCrud={ok:true,residents:rows.json.records.length,linkedPackage:true};

const evolved={...spec,version:2,modules:[...spec.modules,{id:'vehicles',label:'Veículos',icon:'🚗',titleField:'plate',fields:[{id:'plate',label:'Placa',type:'text',required:true}]}]};
const evolution=await request(`/factory/cloud/apps/${appId}/evolve`,{method:'POST',body:{spec:evolved}});
check(evolution.json.spec?.modules?.some(m=>m.id==='vehicles'),'evolution did not add vehicles');
rows=await request(`/factory/cloud/apps/${appId}/records/residents`);
check(rows.json.records?.some(r=>r.id===residentId),'evolution lost prior data');
evidence.checks.evolution={ok:true,version:evolution.json.spec.version,addedModule:'vehicles',preservedExistingRecord:true};

const viewerEmail=`viewer-${suffix}@example.com`,viewerPassword=`Viewer-${randomBytes(10).toString('hex')}!`;
await request(`/factory/cloud/apps/${appId}/users`,{method:'POST',body:{email:viewerEmail,password:viewerPassword,role:'viewer'}});
const viewerLogin=await request('/factory/cloud/login',{method:'POST',body:{appId,email:viewerEmail,password:viewerPassword},token:''});
const denied=await request(`/factory/cloud/apps/${appId}/records/residents`,{method:'POST',token:viewerLogin.json.token,body:{record:{name:'Must Fail'}},expected:403});
check(denied.json.error==='write_role_required','viewer write was not denied');
evidence.checks.viewerReadOnly={ok:true,http:denied.status,error:denied.json.error};

// Never emit passwords or session tokens. The temporary synthetic app remains only as test data until a cleanup endpoint exists.
evidence.syntheticAppId=appId;
console.log(JSON.stringify(evidence,null,2));
