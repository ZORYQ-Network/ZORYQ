import '@walletconnect/react-native-compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAppKit,type AppKitNetwork,type Storage} from '@reown/appkit-react-native';
import {EthersAdapter} from '@reown/appkit-ethers-react-native';

export const REOWN_PROJECT_ID=process.env.EXPO_PUBLIC_REOWN_PROJECT_ID||'';
export const ZORIQ_CHAIN_ID=5919065;
export const ZORIQ_CAIP_ID=`eip155:${ZORIQ_CHAIN_ID}`;
export const ZORIQ_RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc';
export const ZORIQ_EXPLORER=process.env.EXPO_PUBLIC_ZORYQ_EXPLORER||'https://zoryq-testnet.vercel.app/explorer.html';

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

const storage:Storage={
 async getKeys(){return await AsyncStorage.getAllKeys()},
 async getEntries<T=any>(){const keys=await AsyncStorage.getAllKeys();const pairs=await AsyncStorage.multiGet(keys);return pairs.map(([k,v])=>[k,v?JSON.parse(v):undefined] as [string,T])},
 async getItem<T=any>(key:string){const value=await AsyncStorage.getItem(key);return value==null?undefined:JSON.parse(value) as T},
 async setItem<T=any>(key:string,value:T){await AsyncStorage.setItem(key,JSON.stringify(value))},
 async removeItem(key:string){await AsyncStorage.removeItem(key)}
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
