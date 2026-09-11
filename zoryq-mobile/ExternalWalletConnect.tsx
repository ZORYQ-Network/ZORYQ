import React,{useEffect,useState} from 'react';
import {Alert,Pressable,StyleSheet,Text,View} from 'react-native';
import {AppKit,AppKitProvider,useAccount,useAppKit,useProvider} from '@reown/appkit-react-native';
import {REOWN_PROJECT_ID,ZORIQ_CAIP_ID,ZORIQ_CHAIN_ID,ZORIQ_EXPLORER,ZORIQ_RPC,zoriqAppKit,zoriqNetwork} from './AppKitConfig';

function shortAddress(address?:string){return address?`${address.slice(0,6)}…${address.slice(-4)}`:''}

function ConnectedWalletControl(){
 const {open,disconnect,switchNetwork}=useAppKit();
 const {address,isConnected,chainId}=useAccount();
 const {provider,providerType}=useProvider();
 const [switching,setSwitching]=useState(false);

 async function forceZoriq(){
  if(!isConnected)return;
  setSwitching(true);
  try{
   if(String(chainId)!==String(ZORIQ_CHAIN_ID)){
    try{await switchNetwork(zoriqNetwork)}catch(firstError){
     const evmProvider:any=providerType==='eip155'?provider:null;
     if(!evmProvider?.request)throw firstError;
     const chainIdHex=`0x${ZORIQ_CHAIN_ID.toString(16)}`;
     try{await evmProvider.request({method:'wallet_switchEthereumChain',params:[{chainId:chainIdHex}]})}
     catch(error:any){
      const code=Number(error?.code||error?.data?.originalError?.code||0);
      if(code!==4902&&code!==-32603)throw error;
      await evmProvider.request({method:'wallet_addEthereumChain',params:[{
       chainId:chainIdHex,
       chainName:'ZORIQ EVM Testnet',
       nativeCurrency:{name:'ZORIQ',symbol:'ZQ',decimals:18},
       rpcUrls:[ZORIQ_RPC],
       blockExplorerUrls:[ZORIQ_EXPLORER]
      }]});
      await evmProvider.request({method:'wallet_switchEthereumChain',params:[{chainId:chainIdHex}]});
     }
    }
   }
  }catch(e:any){Alert.alert('Rede ZORIQ',String(e?.message||e||'A wallet não aceitou a troca de rede.'))}
  finally{setSwitching(false)}
 }

 useEffect(()=>{if(isConnected&&String(chainId)!==String(ZORIQ_CHAIN_ID))forceZoriq()},[isConnected,chainId]);

 if(!isConnected)return <Pressable style={s.button} onPress={()=>open({view:'Connect'})}><Text style={s.buttonText}>Conectar wallet</Text><Text style={s.buttonSub}>Escolher wallet instalada → ZORIQ</Text></Pressable>;
 return <View style={s.connected}><View style={{flex:1}}><Text style={s.connectedLabel}>WALLET EXTERNA</Text><Text style={s.connectedAddress}>{shortAddress(address)}</Text><Text style={[s.network,String(chainId)===String(ZORIQ_CHAIN_ID)?s.ok:s.warn]}>{String(chainId)===String(ZORIQ_CHAIN_ID)?'● ZORIQ EVM Testnet':'○ Ajustando para ZORIQ…'}</Text></View><Pressable style={s.mini} onPress={()=>open({view:'Account'})}><Text style={s.miniText}>Conta</Text></Pressable><Pressable style={s.mini} disabled={switching} onPress={forceZoriq}><Text style={s.miniText}>{switching?'…':'ZORIQ'}</Text></Pressable><Pressable style={s.mini} onPress={()=>disconnect()}><Text style={s.miniText}>Sair</Text></Pressable></View>
}

export default function ExternalWalletConnect(){
 if(!zoriqAppKit)return <Pressable style={[s.button,s.disabled]} onPress={()=>Alert.alert('Conectar wallet','A conexão com wallets externas está preparada, mas este build não recebeu EXPO_PUBLIC_REOWN_PROJECT_ID. Configure um Project ID da Reown para habilitar WalletConnect e a lista de wallets instaladas.')}><Text style={s.buttonText}>Conectar wallet</Text><Text style={s.buttonSub}>Wallets externas · configuração pendente</Text></Pressable>;
 return <AppKitProvider instance={zoriqAppKit}><ConnectedWalletControl/><View pointerEvents="box-none" style={s.modalLayer}><AppKit/></View></AppKitProvider>;
}

export const externalWalletConfig={configured:Boolean(REOWN_PROJECT_ID),chainId:ZORIQ_CHAIN_ID,caipNetworkId:ZORIQ_CAIP_ID};

const s=StyleSheet.create({
 button:{position:'absolute',right:14,bottom:18,minWidth:190,backgroundColor:'#baff45',borderRadius:16,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:'#ddff9b',shadowColor:'#000',shadowOpacity:.35,shadowRadius:12,shadowOffset:{width:0,height:8},elevation:10,zIndex:30},
 disabled:{backgroundColor:'#1a2230',borderColor:'#354156'},buttonText:{color:'#071000',fontSize:12,fontWeight:'900'},buttonSub:{color:'#284214',fontSize:9,fontWeight:'800',marginTop:2},
 connected:{position:'absolute',left:12,right:12,bottom:12,backgroundColor:'#0d1420',borderWidth:1,borderColor:'#2a3a51',borderRadius:18,padding:12,flexDirection:'row',alignItems:'center',gap:7,zIndex:30,elevation:10},connectedLabel:{color:'#5cffad',fontSize:8,fontWeight:'900',letterSpacing:1.4},connectedAddress:{color:'#fff',fontSize:13,fontWeight:'900',marginTop:2},network:{fontSize:9,fontWeight:'800',marginTop:3},ok:{color:'#5cffad'},warn:{color:'#ffcf66'},mini:{borderWidth:1,borderColor:'#34445b',borderRadius:10,paddingHorizontal:9,paddingVertical:8},miniText:{color:'#dfe9f8',fontSize:9,fontWeight:'900'},modalLayer:{position:'absolute',inset:0,zIndex:1000}
});
