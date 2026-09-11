export type NetworkConfig={
  id:string;
  name:string;
  shortName:string;
  chainId:number;
  symbol:string;
  rpcUrl:string;
  explorerUrl:string;
  mainnet:boolean;
  supports0x:boolean;
};

const zoryqBase=process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app';

// Curated defaults use HTTPS RPCs. The wallet also supports user-added EVM networks,
// so a new APK is not required every time an EVM chain is added.
export const BUILTIN_NETWORKS:NetworkConfig[]=[
  {id:'zoryq-testnet',name:'ZORYQ EVM Testnet',shortName:'ZORYQ',chainId:5919065,symbol:'ZQ',rpcUrl:process.env.EXPO_PUBLIC_ZORYQ_RPC||`${zoryqBase}/rpc`,explorerUrl:`${zoryqBase}/explorer`,mainnet:false,supports0x:false},
  {id:'ethereum',name:'Ethereum Mainnet',shortName:'ETH',chainId:1,symbol:'ETH',rpcUrl:'https://ethereum-rpc.publicnode.com',explorerUrl:'https://etherscan.io',mainnet:true,supports0x:true},
  {id:'base',name:'Base',shortName:'BASE',chainId:8453,symbol:'ETH',rpcUrl:'https://mainnet.base.org',explorerUrl:'https://basescan.org',mainnet:true,supports0x:true},
  {id:'arbitrum',name:'Arbitrum One',shortName:'ARB',chainId:42161,symbol:'ETH',rpcUrl:'https://arb1.arbitrum.io/rpc',explorerUrl:'https://arbiscan.io',mainnet:true,supports0x:true},
  {id:'optimism',name:'OP Mainnet',shortName:'OP',chainId:10,symbol:'ETH',rpcUrl:'https://mainnet.optimism.io',explorerUrl:'https://optimistic.etherscan.io',mainnet:true,supports0x:true},
  {id:'polygon',name:'Polygon PoS',shortName:'POL',chainId:137,symbol:'POL',rpcUrl:'https://polygon-rpc.com',explorerUrl:'https://polygonscan.com',mainnet:true,supports0x:true},
  {id:'bnb',name:'BNB Smart Chain',shortName:'BSC',chainId:56,symbol:'BNB',rpcUrl:'https://bsc-dataseed.bnbchain.org',explorerUrl:'https://bscscan.com',mainnet:true,supports0x:true},
  {id:'avalanche',name:'Avalanche C-Chain',shortName:'AVAX',chainId:43114,symbol:'AVAX',rpcUrl:'https://api.avax.network/ext/bc/C/rpc',explorerUrl:'https://subnets.avax.network/c-chain',mainnet:true,supports0x:true},
  {id:'gnosis',name:'Gnosis Chain',shortName:'GNO',chainId:100,symbol:'xDAI',rpcUrl:'https://rpc.gnosischain.com',explorerUrl:'https://gnosisscan.io',mainnet:true,supports0x:false},
  {id:'linea',name:'Linea',shortName:'LINEA',chainId:59144,symbol:'ETH',rpcUrl:'https://rpc.linea.build',explorerUrl:'https://lineascan.build',mainnet:true,supports0x:true},
  {id:'scroll',name:'Scroll',shortName:'SCROLL',chainId:534352,symbol:'ETH',rpcUrl:'https://rpc.scroll.io',explorerUrl:'https://scrollscan.com',mainnet:true,supports0x:true},
  {id:'zksync',name:'zkSync Era',shortName:'ZKSYNC',chainId:324,symbol:'ETH',rpcUrl:'https://mainnet.era.zksync.io',explorerUrl:'https://explorer.zksync.io',mainnet:true,supports0x:false},
  {id:'celo',name:'Celo',shortName:'CELO',chainId:42220,symbol:'CELO',rpcUrl:'https://forno.celo.org',explorerUrl:'https://celoscan.io',mainnet:true,supports0x:true},
  {id:'mantle',name:'Mantle',shortName:'MNT',chainId:5000,symbol:'MNT',rpcUrl:'https://rpc.mantle.xyz',explorerUrl:'https://mantlescan.xyz',mainnet:true,supports0x:false},
  {id:'blast',name:'Blast',shortName:'BLAST',chainId:81457,symbol:'ETH',rpcUrl:'https://rpc.blast.io',explorerUrl:'https://blastscan.io',mainnet:true,supports0x:true},
  {id:'opbnb',name:'opBNB',shortName:'opBNB',chainId:204,symbol:'BNB',rpcUrl:'https://opbnb-mainnet-rpc.bnbchain.org',explorerUrl:'https://opbnb.bscscan.com',mainnet:true,supports0x:false},
  {id:'sonic',name:'Sonic',shortName:'SONIC',chainId:146,symbol:'S',rpcUrl:'https://rpc.soniclabs.com',explorerUrl:'https://sonicscan.org',mainnet:true,supports0x:false}
];

export function networkKey(n:NetworkConfig){return `${n.chainId}:${n.rpcUrl}`}
export function mergeNetworks(custom:NetworkConfig[]){
  const seen=new Set<number>();
  return [...BUILTIN_NETWORKS,...custom].filter(n=>{if(seen.has(n.chainId))return false;seen.add(n.chainId);return true});
}
