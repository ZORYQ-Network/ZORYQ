import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PUBLIC_PORT=Number(process.env.PORT||8080);
const INTERNAL_PORT=8081;
const WEB_ROOT='/app/web';
const STATIC_ROUTES=new Map([
  ['/', 'start.html'],
  ['/start', 'start.html'],
  ['/start.html', 'start.html'],
  ['/testnet', 'testnet-lab.html'],
  ['/testnet-lab', 'testnet-lab.html'],
  ['/testnet-lab.html', 'testnet-lab.html'],
  ['/explorer', 'explorer.html'],
  ['/explorer.html', 'explorer.html'],
  ['/leaderboard', 'leaderboard.html'],
  ['/leaderboard.html', 'leaderboard.html'],
  ['/network-clock', 'network-clock.html'],
  ['/network-clock.html', 'network-clock.html'],
  ['/launch-studio', 'launch-studio.html'],
  ['/launch-studio.html', 'launch-studio.html'],
  ['/node', 'node.html'],
  ['/node.html', 'node.html'],
  ['/docs', 'docs.html'],
  ['/docs.html', 'docs.html'],
  ['/config.js', 'config.js'],
  ['/app.js', 'app.js'],
  ['/styles.css', 'styles.css']
]);

const backend=spawn(process.execPath,['server.mjs'],{
  stdio:'inherit',
  env:{...process.env,PORT:String(INTERNAL_PORT),PUBLIC_RPC_URL:process.env.PUBLIC_RPC_URL||`https://zoryq-evm-node-live-production.up.railway.app/rpc`}
});
backend.on('exit',(code,signal)=>{console.error('ZORYQ backend exited',{code,signal});process.exit(code||1)});
process.on('SIGTERM',()=>backend.kill('SIGTERM'));
process.on('SIGINT',()=>backend.kill('SIGINT'));

const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function serveStatic(res,file){
  const full=path.join(WEB_ROOT,file);
  if(!full.startsWith(WEB_ROOT)||!fs.existsSync(full)||!fs.statSync(full).isFile())return false;
  res.writeHead(200,{'content-type':mime[path.extname(full)]||'application/octet-stream','cache-control':path.extname(full)==='.html'?'no-cache':'public, max-age=300','x-zoryq-surface':'railway-web-fallback'});
  fs.createReadStream(full).pipe(res);return true;
}
function proxy(req,res){
  const opts={hostname:'127.0.0.1',port:INTERNAL_PORT,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${INTERNAL_PORT}`}};
  const p=http.request(opts,u=>{res.writeHead(u.statusCode||502,u.headers);u.pipe(res)});
  p.on('error',e=>{res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'backend_unavailable',detail:e.message}))});
  req.pipe(p);
}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if((req.method==='GET'||req.method==='HEAD')&&STATIC_ROUTES.has(url.pathname)){
    if(req.method==='HEAD'){res.writeHead(200,{'content-type':mime[path.extname(STATIC_ROUTES.get(url.pathname))]||'text/html; charset=utf-8','x-zoryq-surface':'railway-web-fallback'});return res.end()}
    if(serveStatic(res,STATIC_ROUTES.get(url.pathname)))return;
  }
  proxy(req,res);
});
server.listen(PUBLIC_PORT,'0.0.0.0',()=>console.log(`ZORYQ public gateway listening on :${PUBLIC_PORT}; backend :${INTERNAL_PORT}`));
