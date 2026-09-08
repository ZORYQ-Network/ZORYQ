import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT=Number(process.env.PORT||8080);
const APP_PORT=8082;
const WEB_ROOT='/app/web';

const app=spawn(process.execPath,['public-gateway.mjs'],{
  stdio:'inherit',
  env:{...process.env,PORT:String(APP_PORT)}
});
app.on('exit',(code,signal)=>{console.error('ZORYQ public gateway exited',{code,signal});process.exit(code||1)});
process.on('SIGTERM',()=>app.kill('SIGTERM'));
process.on('SIGINT',()=>app.kill('SIGINT'));

const txRoute=/^\/tx\/0x[0-9a-fA-F]{64}$/;
const addressRoute=/^\/address\/0x[0-9a-fA-F]{40}$/;
const blockRoute=/^\/block\/(?:0x[0-9a-fA-F]+|[0-9]+)$/;

function serveHtml(req,res,file){
  const full=path.join(WEB_ROOT,file);
  if(!full.startsWith(WEB_ROOT)||!fs.existsSync(full)){
    res.writeHead(404,{'content-type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({ok:false,error:'not_found'}));
  }
  res.writeHead(200,{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-cache',
    'x-zoryq-route':'public-eip3091'
  });
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(full).pipe(res);
}

function proxy(req,res){
  const p=http.request({
    hostname:'127.0.0.1',port:APP_PORT,path:req.url,method:req.method,
    headers:{...req.headers,host:`127.0.0.1:${APP_PORT}`}
  },u=>{res.writeHead(u.statusCode||502,u.headers);u.pipe(res)});
  p.on('error',e=>{res.writeHead(503,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:false,error:'public_gateway_unavailable',detail:e.message}))});
  req.pipe(p);
}

http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if((req.method==='GET'||req.method==='HEAD')&&(txRoute.test(url.pathname)||addressRoute.test(url.pathname)||blockRoute.test(url.pathname)))return serveHtml(req,res,'explorer.html');
  if((req.method==='GET'||req.method==='HEAD')&&(url.pathname==='/faucet'||url.pathname==='/faucet.html'))return serveHtml(req,res,'faucet.html');
  return proxy(req,res);
}).listen(PORT,'0.0.0.0',()=>console.log(`ZORYQ edge gateway listening on :${PORT}; app :${APP_PORT}`));
