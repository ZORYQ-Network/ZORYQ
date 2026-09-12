import { randomBytes } from 'node:crypto';

const BASE=process.env.ZORYQ_FACTORY_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const suffix=(process.env.GITHUB_RUN_ID||Date.now())+'-'+randomBytes(3).toString('hex');
const email=`apk-proof-${suffix}@example.test`;
const password='ZoryqApk-'+randomBytes(10).toString('hex');

async function request(path,{method='GET',body,token,allowed=[200]}={}){
 const headers={};if(body!==undefined)headers['content-type']='application/json';if(token)headers.authorization=`Bearer ${token}`;
 const r=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});let j={};try{j=await r.json()}catch{}
 if(!allowed.includes(r.status))throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(j).slice(0,300)}`);return {status:r.status,json:j};
}
async function waitQueue(){for(let i=0;i<30;i++){try{const r=await request('/factory/cloud/status');if(r.json?.apkBuilds?.queue===true)return r.json}catch{}await new Promise(r=>setTimeout(r,5000));}throw new Error('apk_queue_not_live');}
await waitQueue();
const compiled=await request('/factory/compile',{method:'POST',body:{prompt:'Crie um aplicativo simples de tarefas com prioridade e prazo',cloud:true,chain:false}});
const spec={...compiled.json.spec,name:`APK Proof ${suffix.slice(-6)}`};
const created=await request('/factory/cloud/apps',{method:'POST',body:{spec,ownerEmail:email,ownerPassword:password,provenance:'github-apk-live-proof'},allowed:[201]});
const token=created.json.token,appId=created.json.app.id;
const queued=await request(`/factory/cloud/apps/${appId}/builds`,{method:'POST',token,body:{},allowed:[202]});
const build=queued.json.build;
if(!build?.id||!build?.downloadUrl)throw new Error('build_not_queued');
let final=build;
for(let i=0;i<48;i++){
 await new Promise(r=>setTimeout(r,15000));
 const s=await request(`/factory/cloud/apps/${appId}/builds/${build.id}`,{token});final=s.json.build;
 if(final.status==='succeeded')break;
}
if(final.status!=='succeeded')throw new Error(`apk_not_published status=${final.status}`);
const head=await fetch(final.downloadUrl,{method:'HEAD',redirect:'follow'});if(!head.ok)throw new Error(`apk_download_http_${head.status}`);
const evidence={schema:'zoryq-factory-apk-live-proof/0.4',generatedAt:new Date().toISOString(),base:BASE,appId,build:{id:build.id,status:final.status,kind:final.kind,fileName:final.fileName,releaseTag:final.releaseTag,downloadUrl:final.downloadUrl,http:head.status},checks:{queue:true,authenticatedRequest:true,scheduledWorker:true,releasePublished:true,downloadReachable:true},claimBoundary:'Project-controlled end-to-end proof of automatic experimental debug APK delivery. This is not production Android signing, Play Store distribution, an independent security audit, or independent human adoption.'};
console.log(JSON.stringify(evidence,null,2));
