import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE=process.env.ZORYQ_FACTORY_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const REPO=process.env.GITHUB_REPOSITORY||'ZORYQ-Network/ZORYQ';
const TEMPLATE=path.resolve('apps/budget-dapp-android');
const MAX=Math.max(1,Math.min(2,Number(process.env.ZORYQ_APK_WORKER_MAX||2)));

function run(cmd,args,opts={}){
 const r=spawnSync(cmd,args,{stdio:'inherit',encoding:'utf8',...opts});
 if(r.error||r.status!==0)throw new Error(`${cmd} failed: ${r.status ?? r.error?.message}`);
 return r;
}
function output(cmd,args,opts={}){const r=spawnSync(cmd,args,{encoding:'utf8',...opts});return {ok:!r.error&&r.status===0,stdout:String(r.stdout||'').trim(),stderr:String(r.stderr||'').trim()};}
function replaceFiles(root,job){
 const java=path.join(root,'app/src/main/java/network/zoryq/budgetforecast/MainActivity.java');
 const manifest=path.join(root,'app/src/main/AndroidManifest.xml');
 const gradle=path.join(root,'app/build.gradle');
 let src=fs.readFileSync(java,'utf8');
 const url=String(job.appUrl).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
 src=src.replace(/private static final String FACTORY_URL = .*?;/,`private static final String FACTORY_URL = "${url}";`);
 src=src.replace(' ZORYQ-App-Runner-Android/1.1',' ZORYQ-Exclusive-App-Android/0.3');
 fs.writeFileSync(java,src);
 let m=fs.readFileSync(manifest,'utf8');
 const safeName=String(job.appName||'ZORYQ App').replace(/&/g,'&amp;').replace(/"/g,'&quot;').slice(0,60);
 m=m.replace(/android:label="[^"]*"/,`android:label="${safeName}"`);
 fs.writeFileSync(manifest,m);
 const stable=(String(job.appSlug||'generated')+String(job.id||'').replace(/-/g,'').slice(0,8)).replace(/[^a-z0-9]/g,'').slice(0,28)||'generatedapp';
 let g=fs.readFileSync(gradle,'utf8');
 g=g.replace("applicationId 'network.zoryq.budgetforecast'",`applicationId 'network.zoryq.generated.${stable}'`);
 fs.writeFileSync(gradle,g);
}

const response=await fetch(`${BASE}/factory/cloud/build-queue?limit=${MAX}`,{headers:{'user-agent':'ZORYQ-Factory-APK-Worker/0.3'}});
if(!response.ok)throw new Error(`queue_http_${response.status}`);
const queue=await response.json();
if(!Array.isArray(queue.jobs))throw new Error('invalid_queue');
if(!queue.jobs.length){console.log(JSON.stringify({ok:true,worker:'zoryq-factory-apk-worker/0.3',processed:0,message:'queue_empty'}));process.exit(0);}
if(!fs.existsSync(TEMPLATE))throw new Error('android_template_missing');

const evidence=[];
for(const job of queue.jobs.slice(0,MAX)){
 if(!/^factory-apk-[0-9a-f-]{36}$/.test(String(job.releaseTag||'')))throw new Error('invalid_release_tag');
 if(!/^ZORYQ-[a-z0-9-]{1,40}\.apk$/.test(String(job.fileName||'')))throw new Error('invalid_apk_filename');
 if(!String(job.appUrl||'').startsWith(BASE+'/project-launch#app='))throw new Error('invalid_app_url');
 const existing=output('gh',['release','view',job.releaseTag,'--repo',REPO]);
 if(existing.ok){evidence.push({id:job.id,status:'already_published',downloadUrl:job.downloadUrl});continue;}
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'zoryq-apk-'));
 fs.cpSync(TEMPLATE,work,{recursive:true});
 replaceFiles(work,job);
 run('gradle',[':app:assembleDebug','--no-daemon'],{cwd:work});
 const built=path.join(work,'app/build/outputs/apk/debug/app-debug.apk');
 if(!fs.existsSync(built))throw new Error('apk_not_built');
 const dist=path.join(work,job.fileName);fs.copyFileSync(built,dist);
 const sha=output('sha256sum',[dist]);if(!sha.ok)throw new Error('sha256_failed');
 const digest=sha.stdout.split(/\s+/)[0];
 const notes=[
  'ZORYQ AI App Factory experimental per-app Android build.',
  `App: ${job.appName}`,
  `Build ID: ${job.id}`,
  `SHA-256: ${digest}`,
  '',
  'This is a debug-signed experimental APK generated for the ZORYQ Testnet product surface. It is not Play Store release signing and does not imply an independent security audit.'
 ].join('\n');
 run('gh',['release','create',job.releaseTag,dist,'--repo',REPO,'--target','zoryq-evm-testnet-node','--title',`ZORYQ Factory APK · ${job.appName}`,'--notes',notes,'--prerelease']);
 evidence.push({id:job.id,status:'published',downloadUrl:job.downloadUrl,sha256:digest});
}
console.log(JSON.stringify({ok:true,worker:'zoryq-factory-apk-worker/0.3',processed:evidence.length,builds:evidence},null,2));
