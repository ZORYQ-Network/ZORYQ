import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const PRICE_CENTS=999n;
const PRICE_USD=9.99;
const PLAN="zoriq_verified_annual";
const TREASURY=(Deno.env.get("ZORIQ_VERIFIED_TREASURY")||"0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33").toLowerCase();
const CHAINS:Record<string,{name:string;rpcs:string[]}>= {
 "1":{name:"Ethereum",rpcs:["https://ethereum-rpc.publicnode.com","https://cloudflare-eth.com"]},
 "8453":{name:"Base",rpcs:["https://base-rpc.publicnode.com","https://mainnet.base.org"]},
 "42161":{name:"Arbitrum One",rpcs:["https://arbitrum-one-rpc.publicnode.com","https://arb1.arbitrum.io/rpc"]},
 "10":{name:"Optimism",rpcs:["https://optimism-rpc.publicnode.com","https://mainnet.optimism.io"]},
 "59144":{name:"Linea",rpcs:["https://linea-rpc.publicnode.com","https://rpc.linea.build"]},
 "534352":{name:"Scroll",rpcs:["https://scroll-rpc.publicnode.com","https://rpc.scroll.io"]},
 "324":{name:"zkSync Era",rpcs:["https://mainnet.era.zksync.io"]},
 "81457":{name:"Blast",rpcs:["https://rpc.blast.io"]},
 "130":{name:"Unichain",rpcs:["https://mainnet.unichain.org"]},
 "169":{name:"Manta Pacific",rpcs:["https://pacific-rpc.manta.network/http"]}
};
const norm=(x:any)=>String(x||"").toLowerCase();
const addressOk=(x:string)=>/^0x[0-9a-f]{40}$/.test(norm(x));
const txOk=(x:string)=>/^0x[0-9a-f]{64}$/.test(norm(x));

async function getUser(req:Request){const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!token)throw new Error("UNAUTHORIZED");const {data:{user},error}=await db.auth.getUser(token);if(error||!user)throw new Error("UNAUTHORIZED");return user}
async function rpc(chainId:string,method:string,params:any[]){const c=CHAINS[chainId];if(!c)throw new Error("unsupported_evm_chain");let last:any;for(const url of c.rpcs){try{const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(7000)});if(!r.ok)throw new Error(`rpc ${r.status}`);const j=await r.json();if(j.error)throw new Error(j.error.message||"rpc error");return j.result}catch(e){last=e}}throw last||new Error("rpc_unavailable")}
async function ethPriceScaled(){let last:any;try{const r=await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot",{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`coinbase ${r.status}`);const j=await r.json();const n=Number(j?.data?.amount);if(!Number.isFinite(n)||n<=0)throw new Error("invalid ETH price");return BigInt(Math.round(n*1e8))}catch(e){last=e}try{const r=await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`coingecko ${r.status}`);const j=await r.json();const n=Number(j?.ethereum?.usd);if(!Number.isFinite(n)||n<=0)throw new Error("invalid ETH price");return BigInt(Math.round(n*1e8))}catch(e){throw last||e}}
function ceilDiv(a:bigint,b:bigint){return (a+b-1n)/b}
function quoteWei(priceScaled:bigint){return ceilDiv(PRICE_CENTS*10n**18n*10n**8n,100n*priceScaled)}
function formatEth(wei:bigint){const s=wei.toString().padStart(19,"0");const out=`${s.slice(0,-18)}.${s.slice(-18)}`.replace(/0+$/g,"").replace(/\.$/,"");return out||"0"}
function parseEth(v:any){const s=String(v||"0").trim();if(!/^\d+(\.\d{1,18})?$/.test(s))throw new Error("invalid_amount");const [a,b=""]=s.split(".");return BigInt(a)*10n**18n+BigInt((b+"0".repeat(18)).slice(0,18))}
async function linkedWallet(userId:string,wallet:string){wallet=norm(wallet);if(!addressOk(wallet))throw new Error("invalid_wallet");const {data,error}=await db.from("user_wallets").select("address,verified_at").eq("user_id",userId).eq("chain_namespace","eip155").ilike("address",wallet).maybeSingle();if(error)throw error;if(!data?.verified_at)throw new Error("wallet_not_linked_or_verified");return wallet}
async function expireIfNeeded(userId:string){const {data}=await db.from("zoriq_verified_subscriptions").select("status,current_period_end,wallet_address").eq("user_id",userId).maybeSingle();if(data?.status==="active"&&new Date(data.current_period_end).getTime()<=Date.now()){await db.from("zoriq_verified_subscriptions").update({status:"expired",updated_at:new Date().toISOString()}).eq("user_id",userId);await db.from("profiles").update({verified:false,verified_tier:"none",verified_until:null,updated_at:new Date().toISOString()}).eq("id",userId);return{...data,status:"expired"}}return data}

Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});if(req.method!=="POST")return json({error:"method_not_allowed"},405);try{const user=await getUser(req);const body=await req.json().catch(()=>({}));const action=String(body.action||"");
 if(action==="config")return json({ok:true,plan_code:PLAN,price_usd:PRICE_USD,billing_period:"annual",duration_days:365,payment_asset:"ETH",recipient:TREASURY,chains:Object.entries(CHAINS).map(([chain_id,c])=>({chain_id,name:c.name,native:"ETH"}))});
 if(action==="status"){const data=await expireIfNeeded(user.id);return json({ok:true,verified:Boolean(data?.status==="active"&&new Date(data.current_period_end).getTime()>Date.now()),subscription:data||null})}
 if(action==="quote"){
   const chainId=String(body.chain_id||"");if(!CHAINS[chainId])throw new Error("unsupported_evm_chain");const wallet=await linkedWallet(user.id,String(body.wallet||""));const priceScaled=await ethPriceScaled();const wei=quoteWei(priceScaled),amountEth=formatEth(wei),expires=new Date(Date.now()+10*60*1000).toISOString();const priceNumber=Number(priceScaled)/1e8;
   const {data,error}=await db.from("payment_intents").insert({user_id:user.id,product_code:PLAN,purpose:"zoriq_verified_annual",chain_namespace:"eip155",chain_id:chainId,asset_symbol:"ETH",amount_due:amountEth,usd_value:PRICE_USD,recipient_address:TREASURY,status:"pending",expires_at:expires,metadata:{wallet,network:CHAINS[chainId].name,eth_usd_quote:priceNumber,duration_days:365}}).select("id,chain_id,asset_symbol,amount_due,usd_value,recipient_address,status,expires_at,metadata").single();if(error)throw error;return json({ok:true,intent:data,price_usd:PRICE_USD,amount_eth:amountEth,amount_wei:wei.toString(),eth_usd_quote:priceNumber});
 }
 if(action==="verify"){
   const intentId=String(body.intent_id||""),txHash=norm(body.tx_hash);if(!intentId||!txOk(txHash))throw new Error("invalid_payment_reference");const {data:intent,error:ie}=await db.from("payment_intents").select("*").eq("id",intentId).eq("user_id",user.id).eq("product_code",PLAN).eq("purpose","zoriq_verified_annual").maybeSingle();if(ie)throw ie;if(!intent)throw new Error("payment_intent_not_found");if(!["pending","submitted"].includes(intent.status))throw new Error(intent.status==="confirmed"?"payment_already_confirmed":"payment_intent_not_payable");if(intent.expires_at&&new Date(intent.expires_at).getTime()<Date.now())throw new Error("quote_expired");const chainId=String(intent.chain_id),wallet=await linkedWallet(user.id,String(intent.metadata?.wallet||""));const {data:used}=await db.from("zoriq_verified_payments").select("id,user_id").ilike("tx_hash",txHash).maybeSingle();if(used){if(used.user_id===user.id)return json({ok:true,already_confirmed:true,...(await expireIfNeeded(user.id))});throw new Error("transaction_already_used")}
   const [receipt,tx,chainHex]=await Promise.all([rpc(chainId,"eth_getTransactionReceipt",[txHash]),rpc(chainId,"eth_getTransactionByHash",[txHash]),rpc(chainId,"eth_chainId",[])]);if(!receipt||!tx)throw new Error("transaction_not_found_or_unconfirmed");if(receipt.status!=="0x1")throw new Error("transaction_failed");if(BigInt(chainHex).toString()!==chainId)throw new Error("wrong_chain");if(norm(tx.from)!==wallet)throw new Error("sender_mismatch");if(norm(tx.to)!==norm(intent.recipient_address)||norm(tx.to)!==TREASURY)throw new Error("recipient_mismatch");const paid=BigInt(tx.value||"0x0"),required=parseEth(intent.amount_due);if(paid<required)throw new Error("underpayment");
   const now=new Date();const {data:existing}=await db.from("zoriq_verified_subscriptions").select("current_period_end,status,started_at").eq("user_id",user.id).maybeSingle();const start=existing?.status==="active"&&new Date(existing.current_period_end).getTime()>Date.now()?new Date(existing.current_period_end):now;const end=new Date(start.getTime()+365*24*60*60*1000);
   const {error:pe}=await db.from("zoriq_verified_payments").insert({user_id:user.id,wallet_address:wallet,chain_id:chainId,network_name:CHAINS[chainId].name,tx_hash:txHash,amount_wei:paid.toString(),amount_eth:formatEth(paid),usd_value:PRICE_USD,eth_usd_quote:Number(intent.metadata?.eth_usd_quote||0)||null,recipient_address:TREASURY,status:"confirmed",metadata:{intent_id:intent.id,quoted_amount_eth:intent.amount_due}});if(pe)throw pe;
   const {error:se}=await db.from("zoriq_verified_subscriptions").upsert({user_id:user.id,wallet_address:wallet,status:"active",started_at:existing?.started_at||now.toISOString(),current_period_start:start.toISOString(),current_period_end:end.toISOString(),last_payment_tx:txHash,updated_at:now.toISOString()},{onConflict:"user_id"});if(se)throw se;
   await db.from("payment_intents").update({status:"confirmed",tx_hash:txHash,updated_at:now.toISOString()}).eq("id",intent.id).eq("user_id",user.id);
   await db.from("profiles").update({verified:true,verified_tier:"zoriq_verified",verified_until:end.toISOString(),updated_at:now.toISOString()}).eq("id",user.id);
   await db.from("notifications").insert({user_id:user.id,type:"verified",title:"ZORIQ Verified ativado",body:`Seu selo está ativo até ${end.toLocaleDateString("pt-BR")}.`,icon:"✓",is_read:false}).catch(()=>null);
   return json({ok:true,verified:true,plan_code:PLAN,price_usd:PRICE_USD,current_period_start:start.toISOString(),current_period_end:end.toISOString(),chain_id:chainId,network:CHAINS[chainId].name,tx_hash:txHash});
 }
 return json({error:"unknown_action"},404);
}catch(e:any){const m=String(e?.message||e);if(m==="UNAUTHORIZED")return json({error:"unauthorized"},401);return json({error:m},400)}});
