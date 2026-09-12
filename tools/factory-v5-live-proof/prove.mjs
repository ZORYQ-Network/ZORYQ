import { createHash, randomBytes } from 'node:crypto';

const FACTORY='https://zoryq-evm-node-live-production.up.railway.app';
const BUILDER='https://accomplished-appreciation-production-6355.up.railway.app';
const suffix=(process.env.GITHUB_RUN_ID||Date.now())+'-'+randomBytes(3).toString('hex');
const appId=('v5-apk-proof-'+suffix).replace(/[^A-Za-z0-9_-]/g,'').slice(0,70);
const appName='ZORYQ v0.5 APK Proof';
const demo={id:appId,name:appName,version:1,description:'Synthetic Factory APK proof',modules:[{id:'tasks',label:'Tarefas',fields:[{id:'title',label:'Título',type:'text'}]}]};
const encoded=Buffer.from(JSON.stringify(demo)).toString('base64url');
const appUrl=`${FACTORY}/project-launch#app=${encoded}`;

async function jfetch(url,opts={}){const r=await fetch(url,opts);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${r.status} ${url} ${JSON.stringify(j).slice(0,500)}`);return j}
const health=await jfetch(BUILDER+'/health',{headers:{origin:FACTORY}});
if(!health.ok)throw new Error('builder_health_failed');
if(!health.signingConfigured)throw new Error('release_signing_not_configured');
const started=await jfetch(BUILDER+'/factory/apk/build',{method:'POST',headers:{origin:FACTORY,'content-type':'application/json'},body:JSON.stringify({app_name:appName,app_id:appId,app_slug:'zoryq-v05-proof',app_url:appUrl})});
if(!started.id||!started.statusUrl)throw new Error('build_not_created');
let job=null;
for(let i=0;i<120;i++){
 await new Promise(r=>setTimeout(r,3000));
 job=await jfetch(BUILDER+started.statusUrl,{headers:{origin:FACTORY}});
 if(job.status==='ready'||job.status==='failed')break;
}
if(job?.status!=='ready')throw new Error(`apk_not_ready ${job?.status||'unknown'} ${job?.error||''}`);
if(job.signing!=='permanent-release-key')throw new Error(`unexpected_signing ${job.signing}`);
if(!/^network\.zoryq\.generated\.app[0-9a-f]{12}$/.test(job.packageId||''))throw new Error('invalid_package_id');
if(!/^[0-9a-f]{64}$/.test(job.sha256||''))throw new Error('invalid_sha256');
const apk=await fetch(BUILDER+job.downloadUrl,{headers:{origin:FACTORY}});if(!apk.ok)throw new Error(`apk_download_${apk.status}`);const bytes=Buffer.from(await apk.arrayBuffer());if(bytes.length<10000)throw new Error('apk_too_small');const actual=createHash('sha256').update(bytes).digest('hex');if(actual!==job.sha256)throw new Error('apk_sha_mismatch');
console.log(JSON.stringify({schema:'zoryq-factory-v05-direct-apk-proof/1',generatedAt:new Date().toISOString(),checks:{builderHealth:true,releaseSigningConfigured:true,buildCreated:true,buildReady:true,stablePackageIdentity:true,downloadReachable:true,sha256Matches:true},job:{id:job.id,packageId:job.packageId,versionName:job.versionName,signing:job.signing,sha256:job.sha256,size:bytes.length},claimBoundary:'Project-controlled live proof of a directly generated, release-signed APK. Physical-device installation is still user verification, not proven by this check.'},null,2));
