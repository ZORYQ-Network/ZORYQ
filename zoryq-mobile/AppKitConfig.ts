import '@walletconnect/react-native-compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAppKit,type AppKitNetwork,type Storage} from '@reown/appkit-react-native';
import {EthersAdapter} from '@reown/appkit-ethers-react-native';

export const REOWN_PROJECT_ID=process.env.EXPO_PUBLIC_REOWN_PROJECT_ID||'';
export const ZORIQ_CHAIN_ID=5919065;
export const ZORIQ_CAIP_ID=`eip155:${ZORIQ_CHAIN_ID}`;
export const ZORIQ_RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc';
export const ZORIQ_EXPLORER=process.env.EXPO_PUBLIC_ZORYQ_EXPLORER||'https://zoryq-testnet.vercel.app/explorer.html';
const STORAGE_PREFIX='zoriq.reown.';

export const zoriqNetwork:AppKitNetwork={
 id:ZORIQ_CHAIN_ID,
 name:'ZORIQ EVM Testnet',
 nativeCurrency:{name:'ZORIQ',symbol:'ZQ',decimals:18},
 rpcUrls:{default:{http:[ZORIQ_RPC]}},
 blockExplorers:{default:{name:'ZORIQ Explorer',url:ZORIQ_EXPLORER}},
 chainNamespace:'eip155',
 caipNetworkId:ZORIQ_CAIP_ID,
 testnet:true
};

function encode(value:any){return JSON.stringify(value)}
function decode<T=any>(value:string|null):T|undefined{if(value==null)return undefined;try{return JSON.parse(value) as T}catch{return value as unknown as T}}
function storageKey(key:string){return `${STORAGE_PREFIX}${key}`}

const storage:Storage={
 async getKeys(){const keys=await AsyncStorage.getAllKeys();return keys.filter(k=>k.startsWith(STORAGE_PREFIX)).map(k=>k.slice(STORAGE_PREFIX.length))},
 async getEntries<T=any>(){const keys=await this.getKeys();const pairs=await AsyncStorage.multiGet(keys.map(storageKey));return pairs.map(([k,v],i)=>[keys[i],decode<T>(v)] as [string,T])},
 async getItem<T=any>(key:string){return decode<T>(await AsyncStorage.getItem(storageKey(key)))},
 async setItem<T=any>(key:string,value:T){await AsyncStorage.setItem(storageKey(key),encode(value))},
 async removeItem(key:string){await AsyncStorage.removeItem(storageKey(key))}
};

export const zoriqAppKit=REOWN_PROJECT_ID?createAppKit({
 projectId:REOWN_PROJECT_ID,
 networks:[zoriqNetwork],
 defaultNetwork:zoriqNetwork,
 adapters:[new EthersAdapter()],
 storage,
 metadata:{
  name:'ZORIQ',
  description:'ZORIQ Social + Wallet on the ZORIQ EVM Testnet',
  url:'https://zoryq-testnet.vercel.app',
  icons:['https://zoryq-testnet.vercel.app/favicon.ico'],
  redirect:{native:'zoriq://',universal:'https://zoryq-testnet.vercel.app'}
 }
}):null;
