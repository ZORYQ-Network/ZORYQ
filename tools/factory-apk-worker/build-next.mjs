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
function xmlEscape(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function androidTool(name){
 const home=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
 if(!home)return null;
 const root=path.join(home,'build-tools');
 if(!fs.existsSync(root))return null;
 const versions=fs.readdirSync(root).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
 for(const version of versions){const p=path.join(root,version,name);if(fs.existsSync(p))return p;}
 return null;
}
function replaceFiles(root,job){
 const originalJava=path.join(root,'app/src/main/java/network/zoryq/budgetforecast/MainActivity.java');
 const manifest=path.join(root,'app/src/main/AndroidManifest.xml');
 const gradle=path.join(root,'app/build.gradle');
 const stable=(String(job.appSlug||'generated')+String(job.id||'').replace(/-/g,'').slice(0,8)).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,27)||'generated';
 const packageId=`network.zoryq.generated.app${stable}`;
 const packagePath=path.join(root,'app/src/main/java',...packageId.split('.'));
 const java=path.join(packagePath,'MainActivity.java');

 let src=fs.readFileSync(originalJava,'utf8');
 const url=String(job.appUrl).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
 src=src.replace(/^package\s+network\.zoryq\.budgetforecast;/m,`package ${packageId};`);
 src=src.replace(/private static final String FACTORY_URL = .*?;/,`private static final String FACTORY_URL = "${url}";`);
 src=src.replace(' ZORYQ-App-Runner-Android/1.1',' ZORYQ-Exclusive-App-Android/0.8');
 fs.mkdirSync(packagePath,{recursive:true});
 fs.writeFileSync(java,src);
 fs.rmSync(originalJava,{force:true});

 let m=fs.readFileSync(manifest,'utf8');
 const safeName=xmlEscape(String(job.appName||'ZORYQ App').slice(0,60));
 m=m.replace(/android:label="[^"]*"/,`android:label="${safeName}"`);
 m=m.replace(/android:name="\.MainActivity"/,`android:name="${packageId}.MainActivity"`);
 fs.writeFileSync(manifest,m);

 let g=fs.readFileSync(gradle,'utf8');
 g=g.replace("namespace 'network.zoryq.budgetforecast'",`namespace '${packageId}'`);
 g=g.replace("applicationId 'network.zoryq.budgetforecast'",`applicationId '${packageId}'`);
 fs.writeFileSync(gradle,g);
 return packageId;
}
function verifyApk(apk,expectedPackage){
 run('unzip',['-t',apk]);
 const apksigner=androidTool('apksigner');
 const aapt2=androidTool('aapt2');
 const zipalign=androidTool('zipalign');
 if(!apksigner||!aapt2||!zipalign)throw new Error('android_build_tools_missing_for_apk_verification');
 run(apksigner,['verify','--verbose','--print-certs',apk]);
 run(zipalign,['-c','-p','4',apk]);
 const badging=output(aapt2,['dump','badging',apk]);
 if(!badging.ok)throw new Error(`aapt2_badging_failed: ${badging.stderr}`);
 if(!badging.stdout.includes(`package: name='${expectedPackage}'`))throw new Error(`apk_package_mismatch: expected ${expectedPackage}`);
 if(!badging.stdout.includes('launchable-activity:'))throw new Error('apk_missing_launchable_activity');
 return badging.stdout.split('\n').filter(x=>x.startsWith('package:')||x.startsWith('sdkVersion:')||x.startsWith('targetSdkVersion:')||x.startsWith('launchable-activity:')).join(' | ');
}

const response=await fetch(`${BASE}/factory/cloud/build-queue?limit=${MAX}`,{headers:{'user-agent':'ZORYQ-Factory-APK-Worker/0.8'}});
if(!response.ok)throw new Error(`queue_http_${response.status}`);
const queue=await response.json();
if(!Array.isArray(queue.jobs))throw new Error('invalid_queue');
if(!queue.jobs.length){console.log(JSON.stringify({ok:true,worker:'zoryq-factory-apk-worker/0.8',processed:0,message:'queue_empty'}));process.exit(0);}
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
 const packageId=replaceFiles(work,job);
 run('gradle',[':app:assembleDebug','--no-daemon'],{cwd:work});
 const built=path.join(work,'app/build/outputs/apk/debug/app-debug.apk');
 if(!fs.existsSync(built))throw new Error('apk_not_built');
 const validation=verifyApk(built,packageId);
 const dist=path.join(work,job.fileName);fs.copyFileSync(built,dist);
 const sha=output('sha256sum',[dist]);if(!sha.ok)throw new Error('sha256_failed');
 const digest=sha.stdout.split(/\s+/)[0];
 const size=fs.statSync(dist).size;
 const notes=[
  'ZORYQ AI App Factory experimental per-app Android build.',
  `App: ${job.appName}`,
  `Build ID: ${job.id}`,
  `Package ID: ${packageId}`,
  `APK bytes: ${size}`,
  `SHA-256: ${digest}`,
  `Installability checks: ZIP integrity OK; APK signature OK; zipalign OK; Android manifest/package/launcher parsed OK.`,
  `Badging: ${validation}`,
  '',
  'This is a debug-signed experimental APK generated for the ZORYQ Testnet product surface. It is not Play Store release signing and does not imply an independent security audit.'
 ].join('\n');
 run('gh',['release','create',job.releaseTag,dist,'--repo',REPO,'--target','zoryq-evm-testnet-node','--title',`ZORYQ Factory APK · ${job.appName}`,'--notes',notes,'--prerelease']);
 evidence.push({id:job.id,status:'published',downloadUrl:job.downloadUrl,sha256:digest,packageId,size,validation});
}
console.log(JSON.stringify({ok:true,worker:'zoryq-factory-apk-worker/0.8',processed:evidence.length,builds:evidence},null,2));
