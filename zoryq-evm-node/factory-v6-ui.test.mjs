import fs from 'node:fs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

await import('./factory-v6-ui-preload.mjs');
const server=http.createServer((_req,res)=>{res.writeHead(404);res.end('fallback')});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const port=server.address().port;
try{
 const html=await fetch(`http://127.0.0.1:${port}/factory/studio-v6`).then(r=>r.text());
 if(!html.includes('AI APP FACTORY · v0.6'))throw Error('studio_v6_missing');
 if(!html.includes('Gerar APK exclusivo'))throw Error('apk_button_missing');
 if(!html.includes('Criar prompt detalhado'))throw Error('prompt_architect_ui_missing');
 const js=await fetch(`http://127.0.0.1:${port}/factory/studio-v6.js`).then(r=>r.text());
 for(const token of ['/factory/refine-prompt','/factory/compile','/factory/cloud/apps','/builds','zoryq-apk-pending'])if(!js.includes(token))throw Error(`browser_wiring_missing:${token}`);
 fs.writeFileSync('/tmp/factory-studio-v6.js',js);
 const check=spawnSync(process.execPath,['--check','/tmp/factory-studio-v6.js'],{encoding:'utf8'});
 if(check.status!==0)throw Error(`browser_js_syntax:${check.stderr}`);
 console.log(JSON.stringify({ok:true,studio:'v0.6',checks:{route:true,browserSyntax:true,promptArchitect:true,appCompiler:true,automaticApkQueue:true,resumePolling:true}}));
}finally{server.close()}
