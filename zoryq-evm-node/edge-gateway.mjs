import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT=Number(process.env.PORT||8080);
const APP_PORT=8082;
const ADMIN_PORT=8083;
const WEB_ROOT='/app/web';
const PROTOCOL_ROOT='/app/protocol-out';

const app=spawn(process.execPath,['public-gateway.mjs'],{stdio:'inherit',env:{...process.env,PORT:String(APP_PORT)}});
const admin=spawn(process.execPath,['admin-control.mjs'],{stdio:'inherit',env:{...process.env,PORT:String(ADMIN_PORT)}});
function childExit(name){return(code,signal)=>{console.error(`${name} exited`,{code,signal});process.exit(code||1)}}
app.on('exit',childExit('ZORYQ public gateway'));
admin.on('exit',childExit('ZORYQ admin control verifier'));
process.on('SIGTERM',()=>{app.kill('SIGTERM');admin.kill('SIGTERM')});
process.on('SIGINT',()=>{app.kill('SIGINT');admin.kill('SIGINT')});

const txRoute=/^\/tx\/0x[0-9a-fA-F]{64}$/;
const addressRoute=/^\/address\/0x[0-9a-fA-F]{40}$/;
const blockRoute=/^\/block\/(?:0x[0-9a-fA-F]+|[0-9]+)$/;
const tokenRoute=/^\/token\/0x[0-9a-fA-F]{40}$/;
const protocolArtifacts=new Map([
  ['/protocol-artifacts/dexV1.json','ZoryqDexV1.sol/ZoryqDexV1.json'],
  ['/protocol-artifacts/lending.json','ZoryqLendingLab.sol/ZoryqLendingLab.json'],
  ['/protocol-artifacts/projectRegistry.json','ZoryqProjectRegistry.sol/ZoryqProjectRegistry.json']
]);

function servePath(req,res,root,file,contentType='text/html; charset=utf-8'){
  const full=path.resolve(root,file);
  if(!full.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile()){
    res.writeHead(404,{'content-type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({ok:false,error:'not_found'}));
  }
  res.writeHead(200,{'content-type':contentType,'cache-control':contentType.startsWith('text/html')?'no-cache':'public, max-age=300','x-zoryq-route':'public-edge','access-control-allow-origin':'*'});
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(full).pipe(res);
}
function serveFile(req,res,file,contentType='text/html; charset=utf-8'){return servePath(req,res,WEB_ROOT,file,contentType)}
function proxyTo(port,req,res){const p=http.request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`}},u=>{res.writeHead(u.statusCode||502,u.headers);u.pipe(res)});p.on('error',e=>{res.writeHead(503,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:false,error:'gateway_unavailable',detail:e.message}))});req.pipe(p)}
function proxy(req,res){return proxyTo(APP_PORT,req,res)}

http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  const readable=req.method==='GET'||req.method==='HEAD';
  if(url.pathname.startsWith('/admin/control/'))return proxyTo(ADMIN_PORT,req,res);
  if(readable&&protocolArtifacts.has(url.pathname))return servePath(req,res,PROTOCOL_ROOT,protocolArtifacts.get(url.pathname),'application/json; charset=utf-8');
  if(readable&&(txRoute.test(url.pathname)||addressRoute.test(url.pathname)||blockRoute.test(url.pathname)||tokenRoute.test(url.pathname)))return serveFile(req,res,'explorer.html');
  if(readable&&(url.pathname==='/faucet'||url.pathname==='/faucet.html'))return serveFile(req,res,'faucet.html');
  if(readable&&(url.pathname==='/swap'||url.pathname==='/swap.html'))return serveFile(req,res,'swap.html');
  if(readable&&(url.pathname==='/stake'||url.pathname==='/stake.html'))return serveFile(req,res,'stake.html');
  if(readable&&(url.pathname==='/lending'||url.pathname==='/lending.html'))return serveFile(req,res,'lending.html');
  if(readable&&(url.pathname==='/developer'||url.pathname==='/developers'||url.pathname==='/developer.html'))return serveFile(req,res,'developer.html');
  if(readable&&(url.pathname==='/build'||url.pathname==='/quickstart'||url.pathname==='/build.html'))return serveFile(req,res,'build.html');
  if(readable&&(url.pathname==='/metrics'||url.pathname==='/traction'||url.pathname==='/metrics.html'))return serveFile(req,res,'metrics.html');
  if(readable&&(url.pathname==='/ecosystem'||url.pathname==='/builders'||url.pathname==='/investors'||url.pathname==='/ecosystem.html'))return serveFile(req,res,'ecosystem.html');
  if(readable&&(url.pathname==='/intelligence'||url.pathname==='/genesis-intelligence'||url.pathname==='/intelligence.html'))return serveFile(req,res,'intelligence.html');
  if(readable&&(url.pathname==='/admin-control'||url.pathname==='/admin-control.html'))return serveFile(req,res,'admin-control.html');
  if(readable&&(url.pathname==='/protocol-launch'||url.pathname==='/protocol-launch.html'))return serveFile(req,res,'protocol-launch.html');
  if(readable&&(url.pathname==='/network-maturity'||url.pathname==='/network-maturity.html'))return serveFile(req,res,'network-maturity.html');
  if(readable&&url.pathname==='/network-maturity.json')return serveFile(req,res,'network-maturity.json','application/json; charset=utf-8');
  if(readable&&url.pathname==='/defi-common.js')return serveFile(req,res,'defi-common.js','application/javascript; charset=utf-8');
  if(readable&&url.pathname==='/llms.txt')return serveFile(req,res,'llms.txt','text/plain; charset=utf-8');
  if(readable&&url.pathname==='/.well-known/zoryq-agent.json')return serveFile(req,res,'.well-known-zoryq-agent.json','application/json; charset=utf-8');
  if(readable&&url.pathname==='/agent/action-schema.json')return serveFile(req,res,'zoryq-action-schema.json','application/schema+json; charset=utf-8');
  if(readable&&url.pathname==='/agent/project-schema.json')return serveFile(req,res,'zoryq-project-schema.json','application/schema+json; charset=utf-8');
  if(readable&&url.pathname==='/agent/project-intelligence-schema.json')return serveFile(req,res,'project-intelligence-schema.json','application/schema+json; charset=utf-8');
  if(readable&&url.pathname==='/agent/builder-reputation.json')return serveFile(req,res,'builder-reputation.json','application/json; charset=utf-8');
  return proxy(req,res);
}).listen(PORT,'0.0.0.0',()=>console.log(`ZORYQ edge gateway listening on :${PORT}; app :${APP_PORT}; admin :${ADMIN_PORT}`));
