import * as SecureStore from 'expo-secure-store';
import {Contract,JsonRpcProvider,Wallet,formatUnits,isAddress,keccak256,parseUnits,toUtf8Bytes} from 'ethers';

const WALLET_KEY='zoryq.wallet.privateKey';
export const DEFAULT_SOCIAL_FEE_BPS=50; // 0.50%
export const MAX_SOCIAL_FEE_BPS=250; // contract hard cap: 2.50%

const ROUTER_ABI=[
 'function feeBps() view returns(uint16)',
 'function treasury() view returns(address)',
 'function quote(uint256) view returns(uint256 recipientAmount,uint256 protocolFee)',
 'function payNative(address recipient,bytes32 reference) payable',
 'function payToken(address token,address recipient,uint256 amount,bytes32 reference)'
];
const ERC20_ABI=[
 'function allowance(address owner,address spender) view returns(uint256)',
 'function approve(address spender,uint256 amount) returns(bool)',
 'function balanceOf(address owner) view returns(uint256)'
];

export type PaymentAsset={symbol:string;name:string;decimals:number;tokenAddress:null|string;kind:'native'|'erc20'};
export type PaymentNetwork={chainId:number;name:string;nativeSymbol:string;rpcUrls:string[];routerAddress:string|null;mainnet:boolean;assets:PaymentAsset[]};

function envRouter(chainId:number){
 const value=(process.env as any)[`EXPO_PUBLIC_ZORIQ_PAY_ROUTER_${chainId}`];
 return value&&isAddress(value)?value:null;
}

export const SOCIAL_PAYMENT_NETWORKS:PaymentNetwork[]=[
 {
  chainId:5919065,name:'ZORYQ Testnet',nativeSymbol:'ZQ',mainnet:false,
  rpcUrls:[process.env.EXPO_PUBLIC_ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc'],
  routerAddress:envRouter(5919065),
  assets:[
   {symbol:'ZQ',name:'ZORYQ Testnet',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'zUSD',name:'ZORYQ Test USD',decimals:18,tokenAddress:'0xd2121E96C6af936c0496fDB499c1D0613d26c2B9',kind:'erc20'}
  ]
 },
 {
  chainId:1,name:'Ethereum',nativeSymbol:'ETH',mainnet:true,
  rpcUrls:['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'],routerAddress:envRouter(1),
  assets:[
   {symbol:'ETH',name:'Ether',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',kind:'erc20'},
   {symbol:'USDT',name:'Tether USD',decimals:6,tokenAddress:'0xdAC17F958D2ee523a2206206994597C13D831ec7',kind:'erc20'}
  ]
 },
 {
  chainId:8453,name:'Base',nativeSymbol:'ETH',mainnet:true,
  rpcUrls:['https://base-rpc.publicnode.com','https://mainnet.base.org'],routerAddress:envRouter(8453),
  assets:[
   {symbol:'ETH',name:'Ether',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',kind:'erc20'}
  ]
 },
 {
  chainId:42161,name:'Arbitrum One',nativeSymbol:'ETH',mainnet:true,
  rpcUrls:['https://arbitrum-one-rpc.publicnode.com','https://arb1.arbitrum.io/rpc'],routerAddress:envRouter(42161),
  assets:[
   {symbol:'ETH',name:'Ether',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',kind:'erc20'}
  ]
 },
 {
  chainId:10,name:'Optimism',nativeSymbol:'ETH',mainnet:true,
  rpcUrls:['https://optimism-rpc.publicnode.com','https://mainnet.optimism.io'],routerAddress:envRouter(10),
  assets:[
   {symbol:'ETH',name:'Ether',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',kind:'erc20'}
  ]
 },
 {
  chainId:137,name:'Polygon',nativeSymbol:'POL',mainnet:true,
  rpcUrls:['https://polygon-bor-rpc.publicnode.com','https://polygon-rpc.com'],routerAddress:envRouter(137),
  assets:[
   {symbol:'POL',name:'POL',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',kind:'erc20'}
  ]
 },
 {
  chainId:43114,name:'Avalanche C-Chain',nativeSymbol:'AVAX',mainnet:true,
  rpcUrls:['https://avalanche-c-chain-rpc.publicnode.com','https://api.avax.network/ext/bc/C/rpc'],routerAddress:envRouter(43114),
  assets:[
   {symbol:'AVAX',name:'Avalanche',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',kind:'erc20'},
   {symbol:'USDT',name:'Tether USD',decimals:6,tokenAddress:'0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',kind:'erc20'}
  ]
 },
 {
  chainId:59144,name:'Linea',nativeSymbol:'ETH',mainnet:true,
  rpcUrls:['https://linea-rpc.publicnode.com','https://rpc.linea.build'],routerAddress:envRouter(59144),
  assets:[
   {symbol:'ETH',name:'Ether',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0x176211869cA2b568f2A7D4EE941E073a821EE1ff',kind:'erc20'}
  ]
 },
 {
  chainId:324,name:'ZKsync Era',nativeSymbol:'ETH',mainnet:true,
  rpcUrls:['https://mainnet.era.zksync.io'],routerAddress:envRouter(324),
  assets:[
   {symbol:'ETH',name:'Ether',decimals:18,tokenAddress:null,kind:'native'},
   {symbol:'USDC',name:'USD Coin',decimals:6,tokenAddress:'0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4',kind:'erc20'}
  ]
 }
];

export function enabledPaymentNetworks(){return SOCIAL_PAYMENT_NETWORKS.filter(x=>Boolean(x.routerAddress))}
export function findPaymentNetwork(chainId:number){return SOCIAL_PAYMENT_NETWORKS.find(x=>x.chainId===chainId)||null}
export function feePercentLabel(bps:number){return `${(bps/100).toFixed(2).replace('.',',')}%`}

export function previewSocialPayment(amount:string,asset:PaymentAsset,feeBps=DEFAULT_SOCIAL_FEE_BPS){
 const gross=parseUnits(amount||'0',asset.decimals);const fee=(gross*BigInt(feeBps))/10000n;const net=gross-fee;
 return {gross,fee,net,grossText:formatUnits(gross,asset.decimals),feeText:formatUnits(fee,asset.decimals),netText:formatUnits(net,asset.decimals)};
}

async function providerFor(network:PaymentNetwork){
 let last:any;
 for(const url of network.rpcUrls){
  try{const p=new JsonRpcProvider(url,network.chainId,{staticNetwork:true});await p.getBlockNumber();return p}catch(e){last=e}
 }
 throw last||new Error('rpc_unavailable');
}

export async function sendSocialProfilePayment(input:{recipient:string;network:PaymentNetwork;asset:PaymentAsset;amount:string;profileId:string}){
 const {recipient,network,asset,amount,profileId}=input;
 if(!isAddress(recipient))throw new Error('invalid_recipient');
 if(!network.routerAddress||!isAddress(network.routerAddress))throw new Error('payment_router_not_deployed');
 const privateKey=await SecureStore.getItemAsync(WALLET_KEY);if(!privateKey)throw new Error('wallet_missing');
 const provider=await providerFor(network);const signer=new Wallet(privateKey,provider);const router=new Contract(network.routerAddress,ROUTER_ABI,signer);
 const liveFeeBps=Number(await router.feeBps());if(liveFeeBps<0||liveFeeBps>MAX_SOCIAL_FEE_BPS)throw new Error('invalid_router_fee');
 const treasury=String(await router.treasury());if(!isAddress(treasury))throw new Error('invalid_treasury');
 const gross=parseUnits(amount,asset.decimals);if(gross<=0n)throw new Error('invalid_amount');
 const reference=keccak256(toUtf8Bytes(`zoriq-social:${profileId}:${network.chainId}:${asset.symbol}:${Date.now()}`));
 let approvalHash:string|null=null;
 let tx:any;
 if(asset.kind==='native'){
  const balance=await provider.getBalance(signer.address);if(balance<=gross)throw new Error('insufficient_funds');
  tx=await router.payNative(recipient,reference,{value:gross});
 }else{
  if(!asset.tokenAddress||!isAddress(asset.tokenAddress))throw new Error('invalid_token');
  const token=new Contract(asset.tokenAddress,ERC20_ABI,signer);const balance:bigint=await token.balanceOf(signer.address);if(balance<gross)throw new Error('insufficient_token_balance');
  const allowance:bigint=await token.allowance(signer.address,network.routerAddress);
  if(allowance<gross){const approve=await token.approve(network.routerAddress,gross);approvalHash=approve.hash;const approvalReceipt=await approve.wait(1);if(!approvalReceipt||approvalReceipt.status!==1)throw new Error('approval_failed')}
  tx=await router.payToken(asset.tokenAddress,recipient,gross,reference);
 }
 const receipt=await tx.wait(1);if(!receipt||receipt.status!==1)throw new Error('tx_failed');
 const preview=previewSocialPayment(amount,asset,liveFeeBps);
 return {txHash:tx.hash,approvalHash,chainId:network.chainId,network:network.name,asset:asset.symbol,treasury,feeBps:liveFeeBps,protocolFee:preview.feeText,recipientAmount:preview.netText,grossAmount:preview.grossText};
}
