import * as SecureStore from 'expo-secure-store';
import {Contract,JsonRpcProvider,Wallet,formatUnits,isAddress,parseUnits} from 'ethers';

const WALLET_KEY='zoryq.wallet.privateKey';
export const NATIVE_TOKEN='0x0000000000000000000000000000000000000000';
export const ZORIQ_TREASURY='0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33';
export const ZORIQ_SWAP_FEE=0.005; // 0.50% when the verified LI.FI integrator is enabled.
const LIFI_INTEGRATOR=process.env.EXPO_PUBLIC_LIFI_INTEGRATOR||'';
const LIFI_FEE=Math.max(0,Math.min(0.025,Number(process.env.EXPO_PUBLIC_LIFI_FEE||String(ZORIQ_SWAP_FEE))));

const ERC20_ABI=[
 'function name() view returns(string)',
 'function symbol() view returns(string)',
 'function decimals() view returns(uint8)',
 'function balanceOf(address) view returns(uint256)',
 'function allowance(address,address) view returns(uint256)',
 'function approve(address,uint256) returns(bool)'
];

export type EvmNetwork={chainId:number;name:string;short:string;nativeSymbol:string;rpcUrls:string[];explorer:string;mainnet:boolean;lifi:boolean};
export type TokenRef={chainId:number;address:string;symbol:string;name:string;decimals:number;native:boolean;verified?:boolean};
export type ContractHit={network:EvmNetwork;token:TokenRef|null;hasCode:boolean;error?:string};
export type SwapQuote={raw:any;createdAt:number;fromNetwork:EvmNetwork;toNetwork:EvmNetwork;fromToken:TokenRef;toToken:TokenRef;usedSlippage:number;feeActive:boolean;feeRate:number;feeReason:string};

export const EVM_NETWORKS:EvmNetwork[]=[
 {chainId:5919065,name:'ZORYQ Testnet',short:'ZORYQ',nativeSymbol:'ZQ',rpcUrls:[process.env.EXPO_PUBLIC_ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc'],explorer:'https://zoryq-testnet.vercel.app/explorer.html',mainnet:false,lifi:false},
 {chainId:1,name:'Ethereum',short:'ETH',nativeSymbol:'ETH',rpcUrls:['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'],explorer:'https://etherscan.io',mainnet:true,lifi:true},
 {chainId:8453,name:'Base',short:'BASE',nativeSymbol:'ETH',rpcUrls:['https://base-rpc.publicnode.com','https://mainnet.base.org'],explorer:'https://basescan.org',mainnet:true,lifi:true},
 {chainId:42161,name:'Arbitrum One',short:'ARB',nativeSymbol:'ETH',rpcUrls:['https://arbitrum-one-rpc.publicnode.com','https://arb1.arbitrum.io/rpc'],explorer:'https://arbiscan.io',mainnet:true,lifi:true},
 {chainId:10,name:'Optimism',short:'OP',nativeSymbol:'ETH',rpcUrls:['https://optimism-rpc.publicnode.com','https://mainnet.optimism.io'],explorer:'https://optimistic.etherscan.io',mainnet:true,lifi:true},
 {chainId:137,name:'Polygon',short:'POL',nativeSymbol:'POL',rpcUrls:['https://polygon-bor-rpc.publicnode.com','https://polygon-rpc.com'],explorer:'https://polygonscan.com',mainnet:true,lifi:true},
 {chainId:43114,name:'Avalanche C-Chain',short:'AVAX',nativeSymbol:'AVAX',rpcUrls:['https://avalanche-c-chain-rpc.publicnode.com','https://api.avax.network/ext/bc/C/rpc'],explorer:'https://snowtrace.io',mainnet:true,lifi:true},
 {chainId:56,name:'BNB Smart Chain',short:'BNB',nativeSymbol:'BNB',rpcUrls:['https://bsc-rpc.publicnode.com','https://bsc-dataseed.binance.org'],explorer:'https://bscscan.com',mainnet:true,lifi:true},
 {chainId:59144,name:'Linea',short:'LINEA',nativeSymbol:'ETH',rpcUrls:['https://linea-rpc.publicnode.com','https://rpc.linea.build'],explorer:'https://lineascan.build',mainnet:true,lifi:true},
 {chainId:324,name:'ZKsync Era',short:'ZKSYNC',nativeSymbol:'ETH',rpcUrls:['https://mainnet.era.zksync.io'],explorer:'https://explorer.zksync.io',mainnet:true,lifi:true},
 {chainId:534352,name:'Scroll',short:'SCROLL',nativeSymbol:'ETH',rpcUrls:['https://scroll-rpc.publicnode.com','https://rpc.scroll.io'],explorer:'https://scrollscan.com',mainnet:true,lifi:true},
 {chainId:130,name:'Unichain',short:'UNI',nativeSymbol:'ETH',rpcUrls:['https://mainnet.unichain.org'],explorer:'https://uniscan.xyz',mainnet:true,lifi:true}
];

const USDC:Record<number,string>={
 1:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',8453:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',42161:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',10:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',137:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',43114:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',56:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',59144:'0x176211869cA2b568f2A7D4EE941E073a821EE1ff',324:'0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4'
};

function timeout<T>(p:Promise<T>,ms=6500){return Promise.race([p,new Promise<T>((_,r)=>setTimeout(()=>r(new Error('rpc_timeout')),ms))])}
export function networkById(chainId:number){return EVM_NETWORKS.find(n=>n.chainId===chainId)||null}
export function nativeToken(network:EvmNetwork):TokenRef{return {chainId:network.chainId,address:NATIVE_TOKEN,symbol:network.nativeSymbol,name:network.name+' native',decimals:18,native:true,verified:true}}
export function presetUsdc(network:EvmNetwork):TokenRef|null{const address=USDC[network.chainId];return address?{chainId:network.chainId,address,symbol:'USDC',name:'USD Coin',decimals:6,native:false,verified:true}:null}
export function swapFeeConfigured(){return Boolean(LIFI_INTEGRATOR&&LIFI_FEE>0)}
export function swapFeeInfo(){return {integrator:LIFI_INTEGRATOR,fee:LIFI_FEE,treasury:ZORIQ_TREASURY,configured:swapFeeConfigured()}}

export async function providerFor(network:EvmNetwork){
 let last:any;
 for(const url of network.rpcUrls){try{const p=new JsonRpcProvider(url,network.chainId,{staticNetwork:true});await timeout(p.getBlockNumber());return p}catch(e){last=e}}
 throw last||new Error('rpc_unavailable');
}

async function tokenMetadata(network:EvmNetwork,address:string):Promise<TokenRef|null>{
 try{
  const p=await providerFor(network);const code=await timeout(p.getCode(address));if(!code||code==='0x')return null;
  const c=new Contract(address,ERC20_ABI,p);
  const [symbol,name,decimals]=await Promise.all([timeout(c.symbol()),timeout(c.name()).catch(()=>''),timeout(c.decimals())]);
  const d=Number(decimals);if(!Number.isInteger(d)||d<0||d>36||!String(symbol))return null;
  return {chainId:network.chainId,address,symbol:String(symbol).slice(0,20),name:String(name||symbol).slice(0,60),decimals:d,native:false};
 }catch{return null}
}

export async function findTokenAcrossNetworks(address:string):Promise<ContractHit[]>{
 if(!isAddress(address))throw new Error('contract_invalid');
 const checks=EVM_NETWORKS.map(async network=>{
  try{
   const p=await providerFor(network);const code=await timeout(p.getCode(address));const hasCode=Boolean(code&&code!=='0x');if(!hasCode)return {network,token:null,hasCode:false} as ContractHit;
   const token=await tokenMetadata(network,address);return {network,token,hasCode:true} as ContractHit;
  }catch(e:any){return {network,token:null,hasCode:false,error:String(e?.message||e)} as ContractHit}
 });
 const all=await Promise.all(checks);return all.filter(x=>x.hasCode);
}

export async function getAssetBalance(network:EvmNetwork,token:TokenRef,address:string){
 const p=await providerFor(network);
 if(token.native)return formatUnits(await p.getBalance(address),18);
 const c=new Contract(token.address,ERC20_ABI,p);return formatUnits(await c.balanceOf(address),token.decimals);
}

async function requestQuote(params:URLSearchParams,withFee:boolean){
 const q=new URLSearchParams(params);
 if(withFee&&swapFeeConfigured()){q.set('integrator',LIFI_INTEGRATOR);q.set('fee',String(LIFI_FEE))}
 const r=await fetch(`https://li.quest/v1/quote?${q.toString()}`);const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(String(j?.message||j?.error?.message||j?.error||`quote_http_${r.status}`));
 if(!j?.transactionRequest?.to)throw new Error('quote_transaction_missing');
 return j;
}

export async function getSwapQuote(input:{fromNetwork:EvmNetwork;toNetwork:EvmNetwork;fromToken:TokenRef;toToken:TokenRef;amount:string;fromAddress:string;slippageMode:'auto'|'manual';manualSlippage?:number}) : Promise<SwapQuote>{
 const {fromNetwork,toNetwork,fromToken,toToken,amount,fromAddress}=input;
 if(!fromNetwork.lifi||!toNetwork.lifi)throw new Error('aggregator_chain_unsupported');
 if(!isAddress(fromAddress))throw new Error('wallet_invalid');
 if(fromToken.chainId!==fromNetwork.chainId||toToken.chainId!==toNetwork.chainId)throw new Error('token_chain_mismatch');
 const fromAmount=parseUnits(amount||'0',fromToken.decimals);if(fromAmount<=0n)throw new Error('amount_invalid');
 const base=new URLSearchParams({fromChain:String(fromNetwork.chainId),toChain:String(toNetwork.chainId),fromToken:fromToken.address,toToken:toToken.address,fromAmount:fromAmount.toString(),fromAddress,toAddress:fromAddress,order:'CHEAPEST'});
 const slips=input.slippageMode==='manual'?[Math.max(0.001,Math.min(0.05,Number(input.manualSlippage||0.005)))]:[0.005,0.01,0.02];
 let last:any;
 for(const slippage of slips){
  const params=new URLSearchParams(base);params.set('slippage',String(slippage));
  let feeActive=swapFeeConfigured();let feeReason=feeActive?'ZORIQ integrator fee habilitada':'Integrator fee ainda não configurada';
  try{
   let raw:any;
   try{raw=await requestQuote(params,feeActive)}catch(e){
    if(!feeActive)throw e;
    raw=await requestQuote(params,false);feeActive=false;feeReason='Cotação com fee recusada; rota obtida sem taxa ZORIQ';
   }
   return {raw,createdAt:Date.now(),fromNetwork,toNetwork,fromToken,toToken,usedSlippage:slippage,feeActive,feeRate:feeActive?LIFI_FEE:0,feeReason};
  }catch(e){last=e}
 }
 throw last||new Error('quote_unavailable');
}

export async function executeSwapQuote(quote:SwapQuote){
 if(Date.now()-quote.createdAt>55000)throw new Error('quote_expired');
 const privateKey=await SecureStore.getItemAsync(WALLET_KEY);if(!privateKey)throw new Error('wallet_missing');
 const p=await providerFor(quote.fromNetwork);const signer=new Wallet(privateKey,p);
 const action=quote.raw?.action||{};if(String(action.fromAddress||'').toLowerCase()!==signer.address.toLowerCase())throw new Error('quote_wallet_changed');
 const required=BigInt(String(action.fromAmount||'0'));
 let approvalHash:string|null=null;
 if(!quote.fromToken.native){
  const spender=String(quote.raw?.estimate?.approvalAddress||'');if(!isAddress(spender))throw new Error('approval_address_missing');
  const token=new Contract(quote.fromToken.address,ERC20_ABI,signer);const balance:bigint=await token.balanceOf(signer.address);if(balance<required)throw new Error('insufficient_token_balance');
  let allowance:bigint=await token.allowance(signer.address,spender);
  if(allowance<required){
   try{const a=await token.approve(spender,required);approvalHash=a.hash;const rr=await a.wait(1);if(!rr||rr.status!==1)throw new Error('approval_failed')}
   catch(first){
    if(allowance>0n){const z=await token.approve(spender,0n);const zr=await z.wait(1);if(!zr||zr.status!==1)throw new Error('approval_reset_failed');const a=await token.approve(spender,required);approvalHash=a.hash;const ar=await a.wait(1);if(!ar||ar.status!==1)throw new Error('approval_failed')}
    else throw first;
   }
  }
 }else{const bal=await p.getBalance(signer.address);if(bal<=required)throw new Error('insufficient_funds')}
 const tr=quote.raw.transactionRequest;if(Number(tr.chainId||quote.fromNetwork.chainId)!==quote.fromNetwork.chainId)throw new Error('quote_chain_mismatch');
 const tx:any={to:String(tr.to),data:String(tr.data||'0x'),value:BigInt(String(tr.value||'0x0'))};
 if(tr.gasLimit)tx.gasLimit=BigInt(String(tr.gasLimit));if(tr.gasPrice)tx.gasPrice=BigInt(String(tr.gasPrice));if(tr.maxFeePerGas)tx.maxFeePerGas=BigInt(String(tr.maxFeePerGas));if(tr.maxPriorityFeePerGas)tx.maxPriorityFeePerGas=BigInt(String(tr.maxPriorityFeePerGas));
 const sent=await signer.sendTransaction(tx);const receipt=await sent.wait(1);if(!receipt||receipt.status!==1)throw new Error('swap_source_failed');
 return {txHash:sent.hash,approvalHash,fromChain:quote.fromNetwork.chainId,toChain:quote.toNetwork.chainId,tool:String(quote.raw?.tool||''),feeActive:quote.feeActive};
}

export async function getTransferStatus(txHash:string,fromChain:number,toChain:number,tool=''){
 const q=new URLSearchParams({txHash,fromChain:String(fromChain),toChain:String(toChain)});if(tool)q.set('bridge',tool);
 const r=await fetch(`https://li.quest/v1/status?${q.toString()}`);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(j?.message||j?.error||`status_http_${r.status}`));return j;
}
