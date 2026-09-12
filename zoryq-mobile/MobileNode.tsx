import 'react-native-get-random-values';
import React,{useCallback,useEffect,useState} from 'react';
import {Alert,NativeModules,PermissionsAndroid,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Wallet} from 'ethers';

const BASE=(process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app').replace(/\/$/,'');
const WALLET_KEY='zoryq.wallet.privateKey';
const LEGACY_NODE_ID='zoryq.mobile.node.id';
const LEGACY_NODE_SECRET='zoryq.mobile.node.secret';
const LEGACY_NODE_OPERATOR='zoryq.mobile.node.operator';
const NativeNode:any=NativeModules.ZoryqNodeService;

type NodeStatus={paired:boolean;running:boolean;healthy:boolean;nodeId:string;operator:string;block:number;heartbeatCount:number;pendingPoints:number;lastHeartbeat:number;error:string};
const empty:NodeStatus={paired:false,running:false,healthy:false,nodeId:'',operator:'',block:-1,heartbeatCount:0,pendingPoints:0,lastHeartbeat:0,error:''};

async function json(url:string,init?:RequestInit){const r=await fetch(url,init);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(j?.error||`HTTP ${r.status}`));return j}
function short(v:string){return v?v.slice(0,8)+'…'+v.slice(-6):'—'}

export default function MobileNode(){
  const [status,setStatus]=useState<NodeStatus>(empty);
  const [busy,setBusy]=useState(false);
  const [nativeReady]=useState(Boolean(NativeNode?.status&&NativeNode?.configure&&NativeNode?.start));

  const load=useCallback(async()=>{
    if(!nativeReady)return;
    try{
      const s=await NativeNode.status();
      setStatus({paired:Boolean(s?.paired),running:Boolean(s?.running),healthy:Boolean(s?.healthy),nodeId:String(s?.nodeId||''),operator:String(s?.operator||''),block:Number(s?.block??-1),heartbeatCount:Number(s?.heartbeatCount||0),pendingPoints:Number(s?.pendingPoints||0),lastHeartbeat:Number(s?.lastHeartbeat||0),error:String(s?.error||'')});
    }catch(e:any){setStatus(v=>({...v,error:String(e?.message||e)}))}
  },[nativeReady]);

  useEffect(()=>{
    let alive=true;let timer:any;
    (async()=>{
      if(!nativeReady)return;
      try{
        const current=await NativeNode.status();
        if(!current?.paired){
          const [id,secret,operator]=await Promise.all([SecureStore.getItemAsync(LEGACY_NODE_ID),SecureStore.getItemAsync(LEGACY_NODE_SECRET),SecureStore.getItemAsync(LEGACY_NODE_OPERATOR)]);
          if(id&&secret&&operator){
            await NativeNode.configure(id,secret,operator,BASE);
            await Promise.all([SecureStore.deleteItemAsync(LEGACY_NODE_ID),SecureStore.deleteItemAsync(LEGACY_NODE_SECRET),SecureStore.deleteItemAsync(LEGACY_NODE_OPERATOR)]);
          }
        }
      }catch{}
      if(alive)await load();
      timer=setInterval(()=>{if(alive)load()},5000);
    })();
    return()=>{alive=false;if(timer)clearInterval(timer)};
  },[load,nativeReady]);

  async function pair(){
    if(!nativeReady)return Alert.alert('Mobile Node','Serviço nativo não carregado. Instale o APK release mais recente da ZORIQ.');
    setBusy(true);
    try{
      const pk=await SecureStore.getItemAsync(WALLET_KEY);
      if(!pk)throw new Error('Crie ou restaure a Wallet ZORIQ no aparelho antes de registrar o Mobile Node.');
      const wallet=new Wallet(pk);
      const ch=await json(`${BASE}/validator/challenge?operator=${encodeURIComponent(wallet.address)}`);
      if(!ch?.message||!ch?.nonce)throw new Error('Challenge de registro inválido.');
      const signature=await wallet.signMessage(String(ch.message));
      const reg=await json(`${BASE}/validator/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operator:wallet.address,nonce:ch.nonce,signature})});
      if(!reg?.nodeId||!reg?.secret)throw new Error('Coordenador não retornou Node ID/Secret.');
      await NativeNode.configure(String(reg.nodeId),String(reg.secret),wallet.address,BASE);
      await Promise.all([SecureStore.deleteItemAsync(LEGACY_NODE_ID),SecureStore.deleteItemAsync(LEGACY_NODE_SECRET),SecureStore.deleteItemAsync(LEGACY_NODE_OPERATOR)]);
      await load();
      Alert.alert('Mobile Node registrado','O Node Secret foi criptografado pelo Android Keystore. Sua seed/private key não foi enviada ao coordenador.');
    }catch(e:any){Alert.alert('Mobile Node',String(e?.message||e));}
    finally{setBusy(false)}
  }

  async function requestNotification(){
    if(Platform.OS==='android'&&Number(Platform.Version)>=33){
      try{await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)}catch{}
    }
  }
  async function start(){
    if(!status.paired)return pair();
    setBusy(true);
    try{await requestNotification();await NativeNode.start();await new Promise(r=>setTimeout(r,500));await load();}
    catch(e:any){Alert.alert('Iniciar Mobile Node',String(e?.message||e));}
    finally{setBusy(false)}
  }
  async function stop(){setBusy(true);try{await NativeNode.stop();await load()}catch(e:any){Alert.alert('Parar Mobile Node',String(e?.message||e))}finally{setBusy(false)}}
  async function reset(){
    Alert.alert('Remover Mobile Node','Isso apaga o registro local deste aparelho. A wallet não será apagada.',[
      {text:'Cancelar',style:'cancel'},{text:'Remover',style:'destructive',onPress:async()=>{try{await NativeNode.clear();await load()}catch{}}}
    ]);
  }

  const label=status.running?(status.healthy?'ATIVO':'INICIANDO / DEGRADADO'):(status.paired?'PRONTO':'NÃO REGISTRADO');
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>ZORYQ MOBILE NODE</Text>
    <Text style={s.title}>Node persistente no Android.</Text>
    <Text style={s.copy}>Depois de iniciado, o serviço roda em primeiro plano com notificação fixa, envia heartbeat a cada 60 segundos, reinicia após reboot/atualização do app e não depende de manter a tela aberta.</Text>

    <View style={s.hero}><View style={[s.dot,status.running&&status.healthy?s.dotOn:status.running?s.dotWarn:null]}/><View style={{flex:1}}><Text style={s.heroLabel}>{label}</Text><Text style={s.heroSub}>Chain ID 5919065 · Foreground Service · heartbeat 60s</Text></View></View>
    <View style={s.grid}>
      <Card k="NODE ID" v={status.nodeId?short(status.nodeId):'—'}/><Card k="OPERADOR" v={status.operator?short(status.operator):'—'}/><Card k="BLOCO" v={status.block<0?'—':String(Math.trunc(status.block))}/><Card k="HEARTBEATS" v={String(Math.trunc(status.heartbeatCount))}/><Card k="PONTOS PENDENTES" v={String(Math.trunc(status.pendingPoints))}/><Card k="ÚLTIMO SINAL" v={status.lastHeartbeat>0?new Date(status.lastHeartbeat).toLocaleTimeString('pt-BR'):'—'}/>
    </View>

    {!status.paired?<Pressable disabled={busy} onPress={pair} style={s.primary}><Text style={s.primaryText}>{busy?'REGISTRANDO…':'REGISTRAR MOBILE NODE'}</Text></Pressable>:status.running?<Pressable disabled={busy} onPress={stop} style={s.stop}><Text style={s.stopText}>{busy?'PARANDO…':'PARAR NODE'}</Text></Pressable>:<Pressable disabled={busy} onPress={start} style={s.primary}><Text style={s.primaryText}>{busy?'INICIANDO…':'INICIAR NODE PERSISTENTE'}</Text></Pressable>}

    {status.paired?<View style={s.actions}><Pressable onPress={()=>NativeNode.openBatterySettings?.()} style={s.secondary}><Text style={s.secondaryText}>Otimização de bateria</Text></Pressable><Pressable onPress={()=>NativeNode.openNotificationSettings?.()} style={s.secondary}><Text style={s.secondaryText}>Notificação do Node</Text></Pressable></View>:null}
    {status.paired&&!status.running?<Pressable onPress={reset} style={s.remove}><Text style={s.removeText}>Remover registro deste aparelho</Text></Pressable>:null}

    {!nativeReady?<View style={s.error}><Text style={s.errorText}>Serviço nativo indisponível nesta instalação.</Text></View>:null}
    {status.error?<View style={s.error}><Text style={s.errorText}>{status.error}</Text></View>:null}

    <View style={s.info}><Text style={s.infoTitle}>Proteção e persistência</Text><Text style={s.infoText}>• Node Secret criptografado com Android Keystore.\n• Seed/private key ficam fora do serviço.\n• Notificação permanente enquanto o node estiver ativo.\n• START_STICKY para recuperação do serviço.\n• BOOT_COMPLETED/MY_PACKAGE_REPLACED para retomada automática.\n• Status do bloco, uptime lógico, heartbeats e pontos pendentes no app.</Text></View>
    <View style={s.warning}><Text style={s.warningTitle}>Importante</Text><Text style={s.warningText}>Alguns fabricantes Android aplicam economia de bateria agressiva. Se o aparelho matar o serviço, abra “Otimização de bateria” e permita execução sem restrição para o ZORIQ. Este recurso é o Validator Agent móvel da Testnet; ainda não é um execution node/validator independente da rede.</Text></View>
  </ScrollView>
}

function Card({k,v}:{k:string;v:string}){return <View style={s.card}><Text style={s.cardK}>{k}</Text><Text numberOfLines={1} style={s.cardV}>{v}</Text></View>}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#07080d'},content:{padding:18,paddingBottom:120},eyebrow:{color:'#65e6c4',fontSize:11,fontWeight:'900',letterSpacing:1.8},title:{color:'#fff',fontSize:30,fontWeight:'900',lineHeight:34,marginTop:10},copy:{color:'#9aa8bd',fontSize:14,lineHeight:21,marginTop:10,marginBottom:18},hero:{borderWidth:1,borderColor:'#26344a',backgroundColor:'#0d121a',borderRadius:20,padding:18,flexDirection:'row',alignItems:'center',gap:12},dot:{width:14,height:14,borderRadius:7,backgroundColor:'#667085'},dotOn:{backgroundColor:'#49e58b'},dotWarn:{backgroundColor:'#f6c453'},heroLabel:{color:'#fff',fontSize:17,fontWeight:'900'},heroSub:{color:'#708098',fontSize:11,marginTop:3},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:14},card:{width:'48%',borderWidth:1,borderColor:'#1d2838',backgroundColor:'#0b1017',borderRadius:16,padding:14},cardK:{color:'#687892',fontSize:9,fontWeight:'900',letterSpacing:1},cardV:{color:'#fff',fontSize:15,fontWeight:'900',marginTop:5},primary:{backgroundColor:'#baff45',borderRadius:16,padding:17,alignItems:'center',marginTop:18},primaryText:{color:'#071009',fontWeight:'900',fontSize:13},stop:{backgroundColor:'#32141e',borderWidth:1,borderColor:'#8d3047',borderRadius:16,padding:17,alignItems:'center',marginTop:18},stopText:{color:'#ff8296',fontWeight:'900'},actions:{flexDirection:'row',gap:10,marginTop:10},secondary:{flex:1,borderWidth:1,borderColor:'#273246',borderRadius:15,padding:13,alignItems:'center'},secondaryText:{color:'#9eb0c9',fontWeight:'800',fontSize:11},remove:{borderWidth:1,borderColor:'#4b2430',borderRadius:15,padding:13,alignItems:'center',marginTop:10},removeText:{color:'#d98295',fontWeight:'800'},error:{backgroundColor:'#2a1118',borderWidth:1,borderColor:'#6b2837',padding:14,borderRadius:14,marginTop:14},errorText:{color:'#ff91a1',fontSize:12,lineHeight:18},info:{backgroundColor:'#0d121a',borderWidth:1,borderColor:'#1f2c3d',padding:16,borderRadius:18,marginTop:18},infoTitle:{color:'#fff',fontSize:15,fontWeight:'900'},infoText:{color:'#9aa8bd',fontSize:12,lineHeight:21,marginTop:8},warning:{backgroundColor:'#17140b',borderWidth:1,borderColor:'#4f421b',padding:16,borderRadius:18,marginTop:12},warningTitle:{color:'#ffd36b',fontWeight:'900'},warningText:{color:'#c1ae7b',fontSize:11,lineHeight:18,marginTop:6}});
