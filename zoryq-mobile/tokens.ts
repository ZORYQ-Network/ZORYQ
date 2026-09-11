export type WatchedToken={chainId:number;address:string;symbol:string;name:string;decimals:number;source:'preset'|'custom'};

// Small, deliberately curated starter list. Users can add any ERC-20 by contract;
// the wallet never assumes a token is trustworthy merely because it is watched.
export const TOKEN_PRESETS:WatchedToken[]=[
  {chainId:1,address:'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',symbol:'USDC',name:'USD Coin',decimals:6,source:'preset'},
  {chainId:1,address:'0xdAC17F958D2ee523a2206206994597C13D831ec7',symbol:'USDT',name:'Tether USD',decimals:6,source:'preset'},
  {chainId:1,address:'0x6B175474E89094C44Da98b954EedeAC495271d0F',symbol:'DAI',name:'Dai Stablecoin',decimals:18,source:'preset'},
  {chainId:8453,address:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',symbol:'USDC',name:'USD Coin',decimals:6,source:'preset'},
  {chainId:42161,address:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',symbol:'USDC',name:'USD Coin',decimals:6,source:'preset'},
  {chainId:10,address:'0x0b2C639c533813f4Aa9D7837CAf62653d097FF85',symbol:'USDC',name:'USD Coin',decimals:6,source:'preset'},
  {chainId:137,address:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',symbol:'USDC',name:'USD Coin',decimals:6,source:'preset'},
  {chainId:56,address:'0x55d398326f99059fF775485246999027B3197955',symbol:'USDT',name:'Tether USD',decimals:18,source:'preset'},
  {chainId:43114,address:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',symbol:'USDC',name:'USD Coin',decimals:6,source:'preset'}
];

export function presetsFor(chainId:number){return TOKEN_PRESETS.filter(t=>t.chainId===chainId)}
export function tokenKey(t:Pick<WatchedToken,'chainId'|'address'>){return `${t.chainId}:${t.address.toLowerCase()}`}
