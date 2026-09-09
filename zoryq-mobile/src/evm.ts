import {Contract,HDNodeWallet,JsonRpcProvider,Wallet,formatUnits,getAddress,isAddress,parseUnits} from 'ethers';
import type {ChainConfig} from './chains';

export type AppWallet=Wallet|HDNodeWallet;
export type TokenMeta={address:string;name:string;symbol:string;decimals:number;chainId:number;custom?:boolean};
export type TokenHolding=TokenMeta&{balance:string;raw:string};

const ERC20_ABI=[
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to,uint256 amount) returns (bool)'
];

export function providerFor(chain:ChainConfig){return new JsonRpcProvider(chain.rpcUrl,chain.chainId,{staticNetwork:true})}

export async function verifyChainRpc(chain:ChainConfig){
  const provider=new JsonRpcProvider(chain.rpcUrl);
  const network=await provider.getNetwork();
  const actual=Number(network.chainId);
  if(actual!==chain.chainId)throw new Error(`RPC informou Chain ID ${actual}, esperado ${chain.chainId}`);
  await provider.getBlockNumber();
  return true;
}

export async function inspectToken(provider:JsonRpcProvider,address:string,chainId:number):Promise<TokenMeta>{
  if(!isAddress(address))throw new Error('Endereço de token inválido');
  const normalized=getAddress(address);
  const code=await provider.getCode(normalized);
  if(!code||code==='0x')throw new Error('Nenhum contrato encontrado nesse endereço');
  const contract=new Contract(normalized,ERC20_ABI,provider);
  const [name,symbol,decimals]=await Promise.all([contract.name(),contract.symbol(),contract.decimals()]);
  const d=Number(decimals);
  if(!Number.isInteger(d)||d<0||d>36)throw new Error('Decimals inválidos');
  const safeSymbol=String(symbol||'').trim().slice(0,16);
  const safeName=String(name||'').trim().slice(0,64);
  if(!safeSymbol)throw new Error('Token sem símbolo ERC-20 válido');
  return {address:normalized,name:safeName||safeSymbol,symbol:safeSymbol,decimals:d,chainId,custom:true};
}

export async function tokenHolding(provider:JsonRpcProvider,token:TokenMeta,owner:string):Promise<TokenHolding>{
  const contract=new Contract(token.address,ERC20_ABI,provider);
  const raw:bigint=await contract.balanceOf(owner);
  return {...token,raw:raw.toString(),balance:formatUnits(raw,token.decimals)};
}

export async function loadTokenHoldings(provider:JsonRpcProvider,tokens:TokenMeta[],owner:string){
  const rows=await Promise.all(tokens.map(async token=>{try{return await tokenHolding(provider,token,owner)}catch{return {...token,raw:'0',balance:'0'} as TokenHolding}}));
  return rows;
}

export async function sendToken(wallet:AppWallet,token:TokenMeta,to:string,amount:string){
  if(!isAddress(to))throw new Error('Endereço de destino inválido');
  const value=parseUnits(amount,token.decimals);
  if(value<=0n)throw new Error('Quantidade inválida');
  const contract=new Contract(token.address,ERC20_ABI,wallet);
  return contract.transfer(getAddress(to),value);
}
