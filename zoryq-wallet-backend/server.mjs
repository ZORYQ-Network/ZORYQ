import http from 'node:http';
import {URL} from 'node:url';

const PORT=Number(process.env.PORT||8080);
const ZEROX_API_KEY=String(process.env.ZEROX_API_KEY||'').trim();
const TREASURY=String(process.env.ZORYQ_WALLET_TREASURY||'').trim();
const FEE_BPS=Math.max(0,Math.min(100,Number(process.env.ZORYQ_WALLET_SWAP_FEE_BPS||25)));
const KYBER_CLIENT_ID=String(process.env.KYBER_CLIENT_ID||'ZORYQ-Wallet').trim().slice(0,64)||'ZORYQ-Wallet';
const ZEROX_URL='https://api.0x.org/swap/allowance-holder/quote';
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const NATIVE='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ZEROX_SUPPORTED=new Set([1,2741,42161,43114,8453,80094,56,999,57073,59144,5000,143,9745,10,137,4663,534352,146,4217,130,480]);
const KYBER_CHAINS=new Map([
 [1,'ethereum'],[56,'bsc'],[42161,'arbitrum'],[137,'polygon'],[10,'optimism'],[43114,'avalanche'],[8453,'base'],[59144,'linea'],[5000,'mantle'],[146,'sonic'],[80094,'berachain'],[2020,'ronin'],[130,'unichain'],[999,'hyperevm'],[9745,'plasma'],[42793,'etherlink'],[143,'monad']
]);
const SUPPORTED=new Set([...ZEROX_SUPPORTED,...KYBER_CHAINS.keys()]);
const windows=new Map();
let inflight=0;
const MAX_INFLIGHT=32;
const LIMIT_PER_MINUTE=90;

function send(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(body));}
function validToken(v){return v===NATIVE||ADDRESS.test(v)}
function configured(){return ADDRESS.test(TREASURY)&&FEE_BPS>0&&FEE_BPS<=100}
function ipOf(req){return String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim().slice(0,128)}
function rateAllowed(ip){const now=Date.now();const w=windows.get(ip);if(!w||now-w.started>=60_000){windows.set(ip,{started:now,count:1});return true}if(w.count>=LIMIT_PER_MINUTE)return false;w.count++;return true}
async function readJson(req){let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>64_000)throw Error('request_too_large');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
async function jsonResponse(r){const raw=await r.text();try{return JSON.parse(raw)}catch{return {error:'UPSTREAM_INVALID_JSON',raw:raw.slice(0,256)}}}
function sameAddress(a,b){return String(a||'').toLowerCase()===String(b||'').toLowerCase()}
function feeAmount(sellAmount){return ((BigInt(sellAmount)*BigInt(FEE_BPS))/10000n).toString()}

async function quote0x({chainId,sellToken,buyToken,sellAmount,taker}){
 const q=new URL(ZEROX_URL);q.searchParams.set('chainId',String(chainId));q.searchParams.set('sellToken',sellToken);q.searchParams.set('buyToken',buyToken);q.searchParams.set('sellAmount',sellAmount);q.searchParams.set('taker',taker);q.searchParams.set('swapFeeRecipient',TREASURY);q.searchParams.set('swapFeeBps',String(FEE_BPS));q.searchParams.set('swapFeeToken',sellToken);
 const upstream=await fetch(q,{headers:{'0x-api-key':ZEROX_API_KEY,'0x-version':'v2','accept':'application/json'},signal:AbortSignal.timeout(15000)});const data=await jsonResponse(upstream);
 if(!upstream.ok)throw Object.assign(Error('ZEROX_QUOTE_FAILED'),{status:upstream.status,detail:data});
 const f=data?.fees?.integratorFee||data?.fees?.integratorFees?.[0];
 if(!f||BigInt(String(f.amount||'0'))<=0n||!sameAddress(f.token,sellToken))throw Error('ZEROX_FEE_NOT_VERIFIED');
 if(!data?.transaction?.to||!ADDRESS.test(String(data.transaction.to)))throw Error('ZEROX_TRANSACTION_INVALID');
 return {ok:true,provider:'0x-swap-api-v2',chainId,feePolicy:{feeBps:FEE_BPS,feeRecipient:TREASURY,feeToken:sellToken,hidden:false},quote:data};
}

async function quoteKyber({chainId,sellToken,buyToken,sellAmount,taker}){
 const chain=KYBER_CHAINS.get(chainId);if(!chain)throw Error('KYBER_CHAIN_UNSUPPORTED');
 const headers={'x-client-id':KYBER_CLIENT_ID,'accept':'application/json'};
 const routeUrl=new URL(`https://aggregator-api.kyberswap.com/${chain}/api/v1/routes`);
 routeUrl.searchParams.set('tokenIn',sellToken);routeUrl.searchParams.set('tokenOut',buyToken);routeUrl.searchParams.set('amountIn',sellAmount);routeUrl.searchParams.set('gasInclude','true');routeUrl.searchParams.set('chargeFeeBy','currency_in');routeUrl.searchParams.set('feeReceiver',TREASURY);routeUrl.searchParams.set('isInBps','true');routeUrl.searchParams.set('feeAmount',String(FEE_BPS));routeUrl.searchParams.set('origin',taker);
 const routeRes=await fetch(routeUrl,{headers,signal:AbortSignal.timeout(15000)});const routeJson=await jsonResponse(routeRes);
 if(!routeRes.ok||!routeJson?.data?.routeSummary)throw Object.assign(Error('KYBER_ROUTE_FAILED'),{status:routeRes.status,detail:routeJson});
 const routeSummary=routeJson.data.routeSummary;const routerAddress=String(routeJson.data.routerAddress||routeSummary.routerAddress||'');
 if(!ADDRESS.test(routerAddress))throw Error('KYBER_ROUTER_INVALID');
 const extra=routeSummary.extraFee||{};
 if(!sameAddress(extra.feeReceiver,TREASURY)||String(extra.feeAmount)!==String(FEE_BPS)||String(extra.chargeFeeBy)!=='currency_in'||String(extra.isInBps)!=='true')throw Error('KYBER_FEE_NOT_VERIFIED');
 const buildRes=await fetch(`https://aggregator-api.kyberswap.com/${chain}/api/v1/route/build`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({routeSummary,sender:taker,recipient:taker,slippageTolerance:50,source:'ZORYQ-Wallet',enableGasEstimation:true}),signal:AbortSignal.timeout(15000)});const buildJson=await jsonResponse(buildRes);
 if(!buildRes.ok||!buildJson?.data?.data)throw Object.assign(Error('KYBER_BUILD_FAILED'),{status:buildRes.status,detail:buildJson});
 const built=buildJson.data;const txTo=String(built.routerAddress||routerAddress);
 if(!sameAddress(txTo,routerAddress)||!ADDRESS.test(txTo))throw Error('KYBER_ROUTER_MISMATCH');
 const out=String(built.amountOut||routeSummary.amountOut||'');if(!/^[1-9][0-9]*$/.test(out))throw Error('KYBER_OUTPUT_INVALID');
 const integratorFee=feeAmount(sellAmount);if(BigInt(integratorFee)<=0n)throw Error('SWAP_TOO_SMALL_FOR_FEE');
 return {ok:true,provider:'kyberswap-aggregator-v1',chainId,feePolicy:{feeBps:FEE_BPS,feeRecipient:TREASURY,feeToken:sellToken,hidden:false},quote:{sellToken,buyToken,sellAmount,buyAmount:out,fees:{integratorFee:{amount:integratorFee,token:sellToken,type:'volume'}},allowanceTarget:sellToken===NATIVE?null:routerAddress,issues:{allowance:sellToken===NATIVE?null:{spender:routerAddress}},transaction:{to:txTo,data:String(built.data),value:sellToken===NATIVE?sellAmount:'0',gas:String(built.gas||routeSummary.gas||'0')}}};
}

async function getQuote(args){
 if(ZEROX_API_KEY.length>10&&ZEROX_SUPPORTED.has(args.chainId)){
  try{return await quote0x(args)}catch(e){if(!KYBER_CHAINS.has(args.chainId))throw e;console.warn(`[zoryq-wallet-swap] 0x failed, falling back to Kyber: ${e.message}`)}
 }
 return quoteKyber(args);
}

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS')return send(res,204,{});
 const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
 if(req.method==='GET'&&u.pathname==='/health')return send(res,configured()?200:503,{ok:configured(),service:'zoryq-wallet-swap-backend',providerPreference:ZEROX_API_KEY.length>10?'0x-then-kyber':'kyberswap-public',feeBps:FEE_BPS,treasury:ADDRESS.test(TREASURY)?TREASURY:null,treasuryConfigured:ADDRESS.test(TREASURY),zeroXApiConfigured:ZEROX_API_KEY.length>10,kyberPublicConfigured:true,supportedChainIds:[...SUPPORTED],protection:{limitPerMinute:LIMIT_PER_MINUTE,maxInflight:MAX_INFLIGHT}});
 if(req.method==='POST'&&u.pathname==='/quote'){
  if(!configured())return send(res,503,{ok:false,error:'SWAP_BACKEND_NOT_CONFIGURED'});
  const ip=ipOf(req);if(!rateAllowed(ip))return send(res,429,{ok:false,error:'RATE_LIMITED'});
  if(inflight>=MAX_INFLIGHT)return send(res,503,{ok:false,error:'TEMPORARILY_SATURATED'});
  inflight++;
  try{
   const b=await readJson(req);const chainId=Number(b.chainId);const sellToken=String(b.sellToken||'');const buyToken=String(b.buyToken||'');const sellAmount=String(b.sellAmount||'');const taker=String(b.taker||'');
   if(!SUPPORTED.has(chainId)||(!KYBER_CHAINS.has(chainId)&&!(ZEROX_API_KEY.length>10&&ZEROX_SUPPORTED.has(chainId))))return send(res,400,{ok:false,error:'UNSUPPORTED_CHAIN'});
   if(!validToken(sellToken)||!validToken(buyToken)||sellToken.toLowerCase()===buyToken.toLowerCase())return send(res,400,{ok:false,error:'INVALID_TOKEN_PAIR'});
   if(!/^[1-9][0-9]*$/.test(sellAmount)||sellAmount.length>80)return send(res,400,{ok:false,error:'INVALID_SELL_AMOUNT'});
   if(!ADDRESS.test(taker))return send(res,400,{ok:false,error:'INVALID_TAKER'});
   const result=await getQuote({chainId,sellToken,buyToken,sellAmount,taker});
   if(!sameAddress(result.feePolicy.feeRecipient,TREASURY)||result.feePolicy.feeBps!==FEE_BPS)throw Error('TREASURY_FEE_POLICY_MISMATCH');
   return send(res,200,result);
  }catch(e){console.error('[zoryq-wallet-swap]',e?.message||e);return send(res,Number(e?.status)||502,{ok:false,error:e?.message||'QUOTE_FAILED',detail:e?.detail||undefined})}finally{inflight--}
 }
 return send(res,404,{ok:false,error:'NOT_FOUND'});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`[zoryq-wallet-swap] listening on :${PORT}; configured=${configured()}; provider=${ZEROX_API_KEY.length>10?'0x-then-kyber':'kyberswap-public'}`));
