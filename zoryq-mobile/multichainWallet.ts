import * as SecureStore from 'expo-secure-store';
import {Contract,JsonRpcProvider,Wallet,formatUnits,isAddress,parseUnits} from 'ethers';

const WALLET_KEY='zoryq.wallet.privateKey';
export const NATIVE_TOKEN='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const ZORIQ_TREASURY='0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33';
export const ZORIQ_SWAP_FEE=0.005;
export const ZORIQ_SWAP_FEE_BPS=50;
const VELORA_API='https://api.paraswap.io';

const ERC20_ABI=[
 'function name() view returns(string)',
 'function symbol() view returns(string)',
 'function decimals() view returns(uint8)',
 'function balanceOf(address) view returns(uint256)',
 'function allowance(address,address) view returns(uint256)',
 'function approve(address,uint256) returns(bool)'
];

export type EvmNetwork={chainId:number;name:string;short:string;nativeSymbol:string;rpcUrls:string[];explorer:string;mainnet:boolean;swap:boolean};
export type TokenRef={chainId:number;address:string;symbol:string;name:string;decimals:number;native:boolean;verified?:boolean};
export type ContractHit={network:EvmNetwork;token:TokenRef|null;hasCode:boolean;error?:string};
export type SwapQuote={raw:any;createdAt:number;network:EvmNetwork;fromToken:TokenRef;toToken:TokenRef;usedSlippage:number;feeActive:true;feeRate:number;feeRecipient:string;minimumOut:string};

export const EVM_NETWORKS:EvmNetwork[]=[
 {chainId:1,name:'Ethereum',short:'ETH',nativeSymbol:'ETH',rpcUrls:['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'],explorer:'https://etherscan.io',mainnet:true,swap:true},
 {chainId:8453,name:'Base',short:'BASE',nativeSymbol:'ETH',rpcUrls:['https://base-rpc.publicnode.com','https://mainnet.base.org'],explorer:'https://basescan.org',mainnet:true,swap:true},
 {chainId:42161,name:'Arbitrum One',short:'ARB',nativeSymbol:'ETH',rpcUrls:['https://arbitrum-one-rpc.publicnode.com','https://arb1.arbitrum.io/rpc'],explorer:'https://arbiscan.io',mainnet:true,swap:true},
 {chainId:10,name:'Optimism',short:'OP',nativeSymbol:'ETH',rpcUrls:['https://optimism-rpc.publicnode.com','https://mainnet.optimism.io'],explorer:'https://optimistic.etherscan.io',mainnet:true,swap:true},
 {chainId:137,name:'Polygon',short:'POL',nativeSymbol:'POL',rpcUrls:['https://polygon-bor-rpc.publicnode.com','https://polygon-rpc.com'],explorer:'https://polygonscan.com',mainnet:true,swap:true},
 {chainId:56,name:'BNB Smart Chain',short:'BNB',nativeSymbol:'BNB',rpcUrls:['https://bsc-rpc.publicnode.com','https://bsc-dataseed.binance.org'],explorer:'https://bscscan.com',mainnet:true,swap:true},
 {chainId:43114,name:'Avalanche C-Chain',short:'AVAX',nativeSymbol:'AVAX',rpcUrls:['https://avalanche-c-chain-rpc.publicnode.com','https://api.avax.network/ext/bc/C/rpc'],explorer:'https://snowtrace.io',mainnet:true,swap:true},
 {chainId:100,name:'Gnosis',short:'GNO',nativeSymbol:'xDAI',rpcUrls:['https://rpc.gnosischain.com'],explorer:'https://gnosisscan.io',mainnet:true,swap:true},
 {chainId:146,name:'Sonic',short:'SONIC',nativeSymbol:'S',rpcUrls:['https://rpc.soniclabs.com'],explorer:'https://sonicscan.org',mainnet:true,swap:true},
 {chainId:130,name:'Unichain',short:'UNI',nativeSymbol:'ETH',rpcUrls:['https://mainnet.unichain.org'],explorer:'https://uniscan.xyz',mainnet:true,swap:true}
];

const USDC:Record<number,string>={
 1:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
 8453:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 42161:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
 10:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
 137:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
 43114:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
 56:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
};

function timeout<T>(p:Promise<T>,ms=6500){return Promise.race([p,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('rpc_timeout')),ms))])}
export function networkById(chainId:number){return EVM_NETWORKS.find(n=>n.chainId===chainId)||null}
export function nativeToken(network:EvmNetwork):TokenRef{return {chainId:network.chainId,address:NATIVE_TOKEN,symbol:network.nativeSymbol,name:`${network.name} native`,decimals:18,native:true,verified:true}}
export function presetUsdc(network:EvmNetwork):TokenRef|null{const address=USDC[network.chainId];return address?{chainId:network.chainId,address,symbol:'USDC',name:'USD Coin',decimals:6,native:false,verified:true}:null}
export function swapFeeConfigured(){return true}
export function swapFeeInfo(){return {provider:'Velora',fee:ZORIQ_SWAP_FEE,feeBps:ZORIQ_SWAP_FEE_BPS,treasury:ZORIQ_TREASURY,configured:true}}

export async function providerFor(network:EvmNetwork){
 let last:any;
 for(const url of network.rpcUrls){
  try{const p=new JsonRpcProvider(url,network.chainId,{staticNetwork:true});await timeout(p.getBlockNumber());return p}catch(e){last=e}
 }
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
   const p=await providerFor(network);const code=await timeout(p.getCode(address));const hasCode=Boolean(code&&code!=='0x');
   if(!hasCode)return {network,token:null,hasCode:false} as ContractHit;
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

function minAfterSlippage(amount:bigint,bps:number){return amount*(10000n-BigInt(bps))/10000n}
async function requestVeloraSwap(params:URLSearchParams){
 const r=await fetch(`${VELORA_API}/swap?${params.toString()}`);const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(String(j?.error||j?.message||`velora_http_${r.status}`));
 if(!j?.priceRoute?.destAmount||!j?.txParams?.to||!j?.txParams?.data)throw new Error('fee_route_unavailable');
 return j;
}

export async function getSwapQuote(input:{network:EvmNetwork;fromToken:TokenRef;toToken:TokenRef;amount:string;fromAddress:string;slippageMode:'auto'|'manual';manualSlippage?:number}):Promise<SwapQuote>{
 const {network,fromToken,toToken,amount,fromAddress}=input;
 if(!network.swap)throw new Error('aggregator_chain_unsupported');
 if(!isAddress(fromAddress))throw new Error('wallet_invalid');
 if(fromToken.chainId!==network.chainId||toToken.chainId!==network.chainId)throw new Error('token_chain_mismatch');
 if(fromToken.address.toLowerCase()===toToken.address.toLowerCase())throw new Error('same_asset');
 const fromAmount=parseUnits(amount||'0',fromToken.decimals);if(fromAmount<=0n)throw new Error('amount_invalid');
 const manual=Math.round(Math.max(.1,Math.min(5,Number(input.manualSlippage||.5)))*100);
 const slips=input.slippageMode==='manual'?[manual]:[50,100,200];
 let last:any;
 for(const slippageBps of slips){
  try{
   const q=new URLSearchParams({
    srcToken:fromToken.address,destToken:toToken.address,amount:fromAmount.toString(),side:'SELL',network:String(network.chainId),userAddress:fromAddress,
    srcDecimals:String(fromToken.decimals),destDecimals:String(toToken.decimals),slippage:String(slippageBps),version:'6.2',
    partnerFeeBps:String(ZORIQ_SWAP_FEE_BPS),partnerAddress:ZORIQ_TREASURY,isDirectFeeTransfer:'true',excludeContractMethodsWithoutFeeModel:'true',ignoreBadUsdPrice:'true'
   });
   const raw=await requestVeloraSwap(q);const dest=BigInt(String(raw.priceRoute.destAmount));
   if(dest<=0n)throw new Error('quote_amount_invalid');
   return {raw,createdAt:Date.now(),network,fromToken,toToken,usedSlippage:slippageBps/10000,feeActive:true,feeRate:ZORIQ_SWAP_FEE,feeRecipient:ZORIQ_TREASURY,minimumOut:minAfterSlippage(dest,slippageBps).toString()};
  }catch(e){last=e}
 }
 throw last||new Error('fee_route_unavailable');
}

export async function executeSwapQuote(quote:SwapQuote){
 if(Date.now()-quote.createdAt>55000)throw new Error('quote_expired');
 if(!quote.feeActive||quote.feeRecipient.toLowerCase()!==ZORIQ_TREASURY.toLowerCase())throw new Error('fee_route_required');
 const privateKey=await SecureStore.getItemAsync(WALLET_KEY);if(!privateKey)throw new Error('wallet_missing');
 const p=await providerFor(quote.network);const signer=new Wallet(privateKey,p);
 const route=quote.raw?.priceRoute||{};const txp=quote.raw?.txParams||{};
 if(String(txp.from||signer.address).toLowerCase()!==signer.address.toLowerCase())throw new Error('quote_wallet_changed');
 const required=BigInt(String(route.srcAmount||'0'));if(required<=0n)throw new Error('quote_amount_invalid');
 let approvalHash:string|null=null;
 if(!quote.fromToken.native){
  const spender=String(route.tokenTransferProxy||route.contractAddress||txp.to||'');if(!isAddress(spender))throw new Error('approval_address_missing');
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
 if(!isAddress(String(txp.to||'')))throw new Error('quote_destination_invalid');
 const tx:any={to:String(txp.to),data:String(txp.data),value:BigInt(String(txp.value||'0'))};
 if(txp.gas)tx.gasLimit=BigInt(String(txp.gas));if(txp.gasPrice)tx.gasPrice=BigInt(String(txp.gasPrice));
 const sent=await signer.sendTransaction(tx);const receipt=await sent.wait(1);if(!receipt||receipt.status!==1)throw new Error('swap_failed');
 return {txHash:sent.hash,approvalHash,chainId:quote.network.chainId,explorer:`${quote.network.explorer}/tx/${sent.hash}`,feeActive:true,feeRecipient:ZORIQ_TREASURY};
}
