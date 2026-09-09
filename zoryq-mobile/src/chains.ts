export type ChainConfig={
  id:string;
  name:string;
  shortName:string;
  chainId:number;
  rpcUrl:string;
  symbol:string;
  decimals:number;
  explorerUrl:string;
  testnet?:boolean;
  builtin?:boolean;
};

export const ZORYQ_BASE=process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
export const ZORYQ_RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||`${ZORYQ_BASE}/rpc`;
export const ZORYQ_CHAIN_ID=5919065;

export const BUILTIN_CHAINS:ChainConfig[]=[
  {id:'zoryq',name:'ZORYQ EVM Testnet',shortName:'ZORYQ',chainId:ZORYQ_CHAIN_ID,rpcUrl:ZORYQ_RPC,symbol:'ZQ',decimals:18,explorerUrl:`${ZORYQ_BASE}/explorer`,testnet:true,builtin:true},
  {id:'ethereum',name:'Ethereum',shortName:'ETH',chainId:1,rpcUrl:'https://ethereum-rpc.publicnode.com',symbol:'ETH',decimals:18,explorerUrl:'https://etherscan.io',builtin:true},
  {id:'base',name:'Base',shortName:'BASE',chainId:8453,rpcUrl:'https://mainnet.base.org',symbol:'ETH',decimals:18,explorerUrl:'https://basescan.org',builtin:true},
  {id:'arbitrum',name:'Arbitrum One',shortName:'ARB',chainId:42161,rpcUrl:'https://arb1.arbitrum.io/rpc',symbol:'ETH',decimals:18,explorerUrl:'https://arbiscan.io',builtin:true},
  {id:'optimism',name:'Optimism',shortName:'OP',chainId:10,rpcUrl:'https://mainnet.optimism.io',symbol:'ETH',decimals:18,explorerUrl:'https://optimistic.etherscan.io',builtin:true},
  {id:'polygon',name:'Polygon',shortName:'POL',chainId:137,rpcUrl:'https://polygon-rpc.com',symbol:'POL',decimals:18,explorerUrl:'https://polygonscan.com',builtin:true},
  {id:'bnb',name:'BNB Smart Chain',shortName:'BSC',chainId:56,rpcUrl:'https://bsc-dataseed.bnbchain.org',symbol:'BNB',decimals:18,explorerUrl:'https://bscscan.com',builtin:true},
  {id:'avalanche',name:'Avalanche C-Chain',shortName:'AVAX',chainId:43114,rpcUrl:'https://api.avax.network/ext/bc/C/rpc',symbol:'AVAX',decimals:18,explorerUrl:'https://snowtrace.io',builtin:true}
];

export function chainStorageId(chain:ChainConfig){return String(chain.chainId)}
export function chainById(chains:ChainConfig[],chainId:number){return chains.find(c=>c.chainId===chainId)||chains[0]}
export function normalizeRpcUrl(value:string){return String(value||'').trim().replace(/\/$/,'')}
export function normalizeExplorerUrl(value:string){return String(value||'').trim().replace(/\/$/,'')}
export function explorerTx(chain:ChainConfig,hash:string){const base=normalizeExplorerUrl(chain.explorerUrl);return chain.chainId===ZORYQ_CHAIN_ID?`${base}/tx/${hash}`:`${base}/tx/${hash}`}
export function explorerAddress(chain:ChainConfig,address:string){const base=normalizeExplorerUrl(chain.explorerUrl);return chain.chainId===ZORYQ_CHAIN_ID?`${base}/address/${address}`:`${base}/address/${address}`}
