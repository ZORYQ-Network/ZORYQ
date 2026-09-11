import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {handleSocial} from './social.mjs';
import {handleSocialMedia} from './media.mjs';

const PORT=Number(process.env.PORT||8080);
const SWAP_PORT=8081;
const SWAP_SERVER=fileURLToPath(new URL('./server.mjs',import.meta.url));
const child=spawn(process.execPath,[SWAP_SERVER],{env:{...process.env,PORT:String(SWAP_PORT)},stdio:['ignore','inherit','inherit']});
child.on('exit',(code)=>{console.error(`[zoryq-gateway] swap worker exited code=${code}`);process.exit(code??1)});

function proxy(req,res){
 const upstream=http.request({hostname:'127.0.0.1',port:SWAP_PORT,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${SWAP_PORT}`}},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res)});
 upstream.on('error',e=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'SWAP_WORKER_UNAVAILABLE',detail:e.message}))});
 req.pipe(upstream);
}

const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
 if(u.pathname==='/gateway/health')return void (res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}),res.end(JSON.stringify({ok:true,service:'zoryq-wallet-gateway',swapWorker:child.exitCode===null,socialPrefix:'/social',mediaUpload:true})));
 if(u.pathname.startsWith('/social')){
  if(await handleSocialMedia(req,res,u))return;
  await handleSocial(req,res,u);return
 }
 proxy(req,res);
});

function shutdown(){server.close(()=>{child.kill('SIGTERM');process.exit(0)});setTimeout(()=>{child.kill('SIGKILL');process.exit(1)},5000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
server.listen(PORT,'0.0.0.0',()=>console.log(`[zoryq-gateway] listening on :${PORT}; swap worker :${SWAP_PORT}; social=/social`));
