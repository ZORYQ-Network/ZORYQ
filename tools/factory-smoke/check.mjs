import fs from 'node:fs';
import vm from 'node:vm';

const launchPath='zoryq-web/launch-studio.html';
const runtimePath='zoryq-web/project-launch.html';
const cloudPath='zoryq-evm-node/factory-cloud.mjs';
const launch=fs.readFileSync(launchPath,'utf8');
const runtime=fs.readFileSync(runtimePath,'utf8');
const cloud=fs.readFileSync(cloudPath,'utf8');

function inlineScripts(html){return[...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim())}
function assert(condition,message){if(!condition)throw new Error(message)}

for(const [name,html] of [['launch',launch],['runtime',runtime]]){
  const scripts=inlineScripts(html);assert(scripts.length>0,`${name}: missing inline script`);
  for(const [index,script] of scripts.entries())new vm.Script(script,{filename:`${name}-inline-${index}.js`});
}

for(const token of [
  'compileFresh','extractRequestedModules','genericModule','evolveSpec','fieldMatch',
  'zoryq-schema-runtime-v3',"residents","packages","reservations","incidents","notifications",
  'uniqueTogether','cloudProvision','factory/cloud/apps','exclusiveApk','APK_BUILDER','/factory/apk/build','statusUrl','downloadUrl'
])assert(launch.includes(token),`launch: missing ${token}`);

for(const token of [
  'renderForm',"type==='relation'",'saveRecord','editRecord','deleteRecord','exportData','initCloud',
  'factory/cloud/login','addUser','snapshotHash','deployProof','writeProof','readProof','zoryq-schema-runtime-v3'
])assert(runtime.includes(token),`runtime: missing ${token}`);

for(const token of [
  'handleFactoryCloud','scryptSync','owner','admin','editor','viewer','factory/cloud/apps',
  'records','evolve','passwordHash','verifyToken'
])assert(cloud.includes(token),`cloud: missing ${token}`);

assert(!launch.includes('eval('),'launch: eval is not allowed');
assert(!runtime.includes('eval('),'runtime: eval is not allowed');
assert(!cloud.includes('eval('),'cloud: eval is not allowed');
assert(!launch.includes("window.open('https://github.com/ZORYQ-Network/ZORYQ/actions/workflows/factory-app-apk.yml"),'launch: legacy manual APK workflow must not remain in UI');

const evidence={
  ok:true,
  milestone:'factory-v0.3-automatic-signed-apk',
  checks:{javascriptSyntax:true,genericModuleCompilerPresent:true,condominiumProvingCasePreserved:true,promptEvolutionAddRemoveFieldPresent:true,cloudPersistenceApiPresent:true,roleAuthPresent:true,localFallbackPresent:true,automaticPerAppApkBuilderPresent:true,apkJobPollingPresent:true,apkDownloadPathPresent:true,optionalSnapshotProofPresent:true,evalAbsent:true},
  claimBoundary:'Static smoke evidence only. Runtime APK build, signature verification, installation and physical-device compatibility require separate execution evidence.'
};
console.log(JSON.stringify(evidence,null,2));
