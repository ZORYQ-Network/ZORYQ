import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT=Number(process.env.PORT||8080);
const CHAIN_PORT=8090;
const SOCIAL_PORT=8086;
const WEB_ROOT='/app/web';
const SOCIAL_HTML=path.join(WEB_ROOT,'zoriq-social.html');
const EFFECTIVE_GENESIS=process.env.ZORYQ_RETH_CHAIN_SPEC||'/data/zoryq-reth-effective-genesis.json';
const MIGRATION_FILE=process.env.ZORYQ_RETH_MIGRATION_STATUS||'/data/zoryq-reth-migration.json';
const CHAIN_HEAP_MB=Math.max(64,Number(process.env.ZORYQ_TRAFFIC_HEAP_MB||96));
const SOCIAL_HEAP_MB=Math.max(64,Number(process.env.ZORYQ_SOCIAL_HEAP_MB||128));
const MEMORY_LOG_MS=Math.max(30_000,Number(process.env.ZORYQ_MEMORY_LOG_MS||60_000));

function child(name,command,args,env={}){
  const p=spawn(command,args,{stdio:'inherit',env:{...process.env,...env}});
  p.on('exit',(code,signal)=>{console.error(`[zoryq-product] ${name} exited`,{code,signal});shutdown(code||1)});
  return p;
}
let exiting=false;
let chain=null,social=null;
function shutdown(code=0){if(exiting)return;exiting=true;try{chain?.kill('SIGTERM')}catch{}try{social?.kill('SIGTERM')}catch{}setTimeout(()=>process.exit(code),250).unref()}
process.on('SIGTERM',()=>shutdown(0));process.on('SIGINT',()=>shutdown(130));

function readRssKb(pid){try{const status=fs.readFileSync(`/proc/${pid}/status`,'utf8');const m=status.match(/^VmRSS:\s+(\d+)\s+kB$/m);return m?Number(m[1]):null}catch{return null}}
function readCmd(pid){try{return fs.readFileSync(`/proc/${pid}/cmdline`,'utf8').replace(/\0/g,' ').trim()}catch{return ''}}
function processSnapshot(){
  const rows=[];
  try{
    for(const name of fs.readdirSync('/proc')){
      if(!/^\d+$/.test(name))continue;
      const pid=Number(name),cmd=readCmd(pid);
      if(!cmd||(!cmd.includes('node')&&!cmd.includes('reth')&&!cmd.includes('npm')))continue;
      rows.push({pid,rssMb:Math.round((Number(readRssKb(pid)||0)/1024)*10)/10,cmd:cmd.slice(0,180)});
    }
  }catch{}
  rows.sort((a,b)=>b.rssMb-a.rssMb);
  const own=process.memoryUsage();
  console.log('[zoryq-memory]',JSON.stringify({at:new Date().toISOString(),totalObservedMb:Math.round(rows.reduce((n,x)=>n+x.rssMb,0)*10)/10,product:{rssMb:Math.round(own.rss/104857.6)/10,heapUsedMb:Math.round(own.heapUsed/104857.6)/10,heapTotalMb:Math.round(own.heapTotal/104857.6)/10},processes:rows}));
}
setTimeout(processSnapshot,15_000).unref?.();
setInterval(processSnapshot,MEMORY_LOG_MS).unref?.();

const allowMigratedLegacy=fs.existsSync(MIGRATION_FILE)?'true':String(process.env.ZORYQ_ALLOW_RETH_GENESIS_RESET||'false');
chain=child('chain',process.execPath,[`--max-old-space-size=${CHAIN_HEAP_MB}`,'traffic-gateway.mjs'],{PORT:String(CHAIN_PORT),ZORYQ_RETH_CHAIN_SPEC:EFFECTIVE_GENESIS,ZORYQ_ALLOW_RETH_GENESIS_RESET:allowMigratedLegacy});
social=child('social',process.execPath,[`--max-old-space-size=${SOCIAL_HEAP_MB}`,'social-service.mjs'],{PORT:String(SOCIAL_PORT),ZORYQ_CHAIN_BASE:`http://127.0.0.1:${CHAIN_PORT}`});

function proxy(req,res,port,rewrite=null){const targetPath=rewrite?rewrite(req.url||'/'):(req.url||'/');const p=http.request({hostname:'127.0.0.1',port,path:targetPath,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`}},u=>{res.writeHead(u.statusCode||502,u.headers);u.pipe(res)});p.on('error',e=>{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:'upstream_unavailable',detail:e.message}))});req.pipe(p)}
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(JSON.stringify(obj))}
function socialPage(res){if(!fs.existsSync(SOCIAL_HTML))return json(res,404,{ok:false,error:'social_surface_missing'});res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-zoryq-product':'social'});fs.createReadStream(SOCIAL_HTML).pipe(res)}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});let j={};try{j=await r.json()}catch{}return {ok:r.ok,status:r.status,json:j}}
async function health(res){const [c,s]=await Promise.allSettled([getJson(`http://127.0.0.1:${CHAIN_PORT}/health`),getJson(`http://127.0.0.1:${SOCIAL_PORT}/status`)]);const chainResult=c.status==='fulfilled'?c.value:{ok:false,status:503,json:{error:'chain_unreachable'}},socialResult=s.status==='fulfilled'?s.value:{ok:false,status:503,json:{error:'social_unreachable'}};const ok=chainResult.ok&&socialResult.ok&&socialResult.json?.chainReady===true;const base=chainResult.json||{};return json(res,ok?200:503,{...base,ok,readyForTraffic:ok&&base.readyForTraffic!==false,product:{wallet:'ZORYQ Wallet',social:{ok:socialResult.ok,...socialResult.json},explorer:true,faucet:true},release:'full-product-rc'});}

const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/','http://localhost');if(req.method==='OPTIONS')return json(res,204,{});if(req.method==='GET'&&url.pathname==='/health')return health(res);if(req.method==='GET'&&['/social','/zoriq','/zoriq-social','/zoriq-social.html'].includes(url.pathname))return socialPage(res);if(url.pathname.startsWith('/api/social'))return proxy(req,res,SOCIAL_PORT,p=>p.replace(/^\/api\/social/,'')||'/');return proxy(req,res,CHAIN_PORT)});
server.listen(PORT,'0.0.0.0',()=>console.log(`[zoryq-product] gateway listening on :${PORT}; chain=:${CHAIN_PORT}; social=:${SOCIAL_PORT}; heapMb=${process.env.ZORYQ_PRODUCT_HEAP_MB||96}`));
