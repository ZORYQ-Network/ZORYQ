import http from 'node:http';
import {URL} from 'node:url';

const PORT=Number(process.env.PORT||8080);
const ZEROX_API_KEY=String(process.env.ZEROX_API_KEY||'').trim();
const TREASURY=String(process.env.ZORYQ_WALLET_TREASURY||'').trim();
const FEE_BPS=Math.max(0,Math.min(100,Number(process.env.ZORYQ_WALLET_SWAP_FEE_BPS||25)));
const ZEROX_URL='https://api.0x.org/swap/allowance-holder/quote';
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const NATIVE='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const SUPPORTED=new Set([1,2741,42161,43114,8453,80094,56,999,57073,59144,5000,143,9745,10,137,4663,534352,146,4217,130,480]);
const windows=new Map();
let inflight=0;
const MAX_INFLIGHT=32;
const LIMIT_PER_MINUTE=90;

function send(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(body));}
function validToken(v){return v===NATIVE||ADDRESS.test(v)}
function ready(){return ZEROX_API_KEY.length>10&&ADDRESS.test(TREASURY)&&FEE_BPS>=0&&FEE_BPS<=100}
function ipOf(req){return String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim().slice(0,128)}
function rateAllowed(ip){const now=Date.now();const w=windows.get(ip);if(!w||now-w.started>=60_000){windows.set(ip,{started:now,count:1});return true}if(w.count>=LIMIT_PER_MINUTE)return false;w.count++;return true}
async function readJson(req){let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>64_000)throw Error('request_too_large');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS')return send(res,204,{});
 const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
 if(req.method==='GET'&&u.pathname==='/health')return send(res,ready()?200:503,{ok:ready(),service:'zoryq-wallet-swap-backend',provider:'0x-swap-api-v2',feeBps:FEE_BPS,treasuryConfigured:ADDRESS.test(TREASURY),apiConfigured:ZEROX_API_KEY.length>10,supportedChainIds:[...SUPPORTED],protection:{limitPerMinute:LIMIT_PER_MINUTE,maxInflight:MAX_INFLIGHT}});
 if(req.method==='POST'&&u.pathname==='/quote'){
  if(!ready())return send(res,503,{ok:false,error:'SWAP_BACKEND_NOT_CONFIGURED'});
  const ip=ipOf(req);if(!rateAllowed(ip))return send(res,429,{ok:false,error:'RATE_LIMITED'});
  if(inflight>=MAX_INFLIGHT)return send(res,503,{ok:false,error:'TEMPORARILY_SATURATED'});
  inflight++;
  try{
   const b=await readJson(req);const chainId=Number(b.chainId);const sellToken=String(b.sellToken||'');const buyToken=String(b.buyToken||'');const sellAmount=String(b.sellAmount||'');const taker=String(b.taker||'');
   if(!SUPPORTED.has(chainId))return send(res,400,{ok:false,error:'UNSUPPORTED_CHAIN'});
   if(!validToken(sellToken)||!validToken(buyToken)||sellToken.toLowerCase()===buyToken.toLowerCase())return send(res,400,{ok:false,error:'INVALID_TOKEN_PAIR'});
   if(!/^[1-9][0-9]*$/.test(sellAmount)||sellAmount.length>80)return send(res,400,{ok:false,error:'INVALID_SELL_AMOUNT'});
   if(!ADDRESS.test(taker))return send(res,400,{ok:false,error:'INVALID_TAKER'});
   const q=new URL(ZEROX_URL);q.searchParams.set('chainId',String(chainId));q.searchParams.set('sellToken',sellToken);q.searchParams.set('buyToken',buyToken);q.searchParams.set('sellAmount',sellAmount);q.searchParams.set('taker',taker);
   if(FEE_BPS>0){q.searchParams.set('swapFeeRecipient',TREASURY);q.searchParams.set('swapFeeBps',String(FEE_BPS));q.searchParams.set('swapFeeToken',sellToken)}
   const upstream=await fetch(q,{headers:{'0x-api-key':ZEROX_API_KEY,'0x-version':'v2','accept':'application/json'}});const raw=await upstream.text();let data;try{data=JSON.parse(raw)}catch{data={error:'UPSTREAM_INVALID_JSON'}}
   if(!upstream.ok)return send(res,upstream.status,{ok:false,error:'UPSTREAM_QUOTE_FAILED',providerStatus:upstream.status,detail:data});
   return send(res,200,{ok:true,chainId,feePolicy:{feeBps:FEE_BPS,feeRecipient:TREASURY,feeToken:sellToken,hidden:false},quote:data});
  }catch(e){return send(res,400,{ok:false,error:e?.message||'INVALID_REQUEST'})}finally{inflight--}
 }
 return send(res,404,{ok:false,error:'NOT_FOUND'});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`[zoryq-wallet-swap] listening on :${PORT}; ready=${ready()}`));
