import 'react-native-get-random-values';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Wallet,computeHmac,toUtf8Bytes} from 'ethers';

const BASE=(process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app').replace(/\/$/,'');
const WALLET_KEY='zoryq.wallet.privateKey';
const NODE_ID_KEY='zoryq.mobile.node.id';
const NODE_SECRET_KEY='zoryq.mobile.node.secret';
const NODE_OPERATOR_KEY='zoryq.mobile.node.operator';
const INTERVAL_MS=60000;

type NodeStatus={
  paired:boolean;
  running:boolean;
  healthy:boolean|null;
  nodeId:string;
  operator:string;
  block:number|null;
  heartbeatCount:number;
  pendingPoints:number;
  lastHeartbeat:number|null;
  error:string;
};

const empty:NodeStatus={paired:false,running:false,healthy:null,nodeId:'',operator:'',block:null,heartbeatCount:0,pendingPoints:0,lastHeartbeat:null,error:''};

async function json(url:string,init?:RequestInit){
  const r=await fetch(url,init);const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(String(j?.error||`HTTP ${r.status}`));
  return j;
}
async function rpc(method:string,params:any[]=[]){
  const j=await json(`${BASE}/rpc`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(j.error)throw new Error(String(j.error?.message||'RPC error'));
  return j.result;
}
function short(v:string){return v?v.slice(0,8)+'…'+v.slice(-6):'—'}

export default function MobileNode(){
  const [status,setStatus]=useState<NodeStatus>(empty);
  const [busy,setBusy]=useState(false);
  const timer=useRef<ReturnType<typeof setInterval>|null>(null);
  const runningRef=useRef(false);

  const load=useCallback(async()=>{
    const [nodeId,secret,operator]=await Promise.all([
      SecureStore.getItemAsync(NODE_ID_KEY),SecureStore.getItemAsync(NODE_SECRET_KEY),SecureStore.getItemAsync(NODE_OPERATOR_KEY)
    ]);
    setStatus(s=>({...s,paired:Boolean(nodeId&&secret),nodeId:nodeId||'',operator:operator||''}));
  },[]);

  useEffect(()=>{load();return()=>{if(timer.current)clearInterval(timer.current)}},[load]);
  useEffect(()=>{const sub=AppState.addEventListener('change',next=>{
    if(next!=='active'&&runningRef.current)setStatus(s=>({...s,error:'Android pausou o app. Reabra o ZORIQ para retomar os heartbeats do Mobile Node.'}));
    if(next==='active'&&runningRef.current)heartbeat().catch(()=>{});
  });return()=>sub.remove()},[]);

  async function pair(){
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
      await Promise.all([
        SecureStore.setItemAsync(NODE_ID_KEY,String(reg.nodeId)),
        SecureStore.setItemAsync(NODE_SECRET_KEY,String(reg.secret)),
        SecureStore.setItemAsync(NODE_OPERATOR_KEY,wallet.address)
      ]);
      setStatus(s=>({...s,paired:true,nodeId:String(reg.nodeId),operator:wallet.address,error:''}));
      Alert.alert('Mobile Node registrado','Node ID e Node Secret foram salvos no SecureStore. Sua seed/private key não foi enviada ao coordenador.');
    }catch(e:any){Alert.alert('Mobile Node',String(e?.message||e));}
    finally{setBusy(false)}
  }

  async function heartbeat(){
    const [nodeId,secret]=await Promise.all([SecureStore.getItemAsync(NODE_ID_KEY),SecureStore.getItemAsync(NODE_SECRET_KEY)]);
    if(!nodeId||!secret)throw new Error('Mobile Node ainda não registrado.');
    const hex=await rpc('eth_blockNumber');
    const block=parseInt(String(hex),16);
    if(!Number.isFinite(block))throw new Error('Bloco RPC inválido.');
    const timestamp=Date.now();
    const mac=computeHmac('sha256',toUtf8Bytes(secret),toUtf8Bytes(`${nodeId}:${timestamp}:${block}`)).slice(2);
    const j=await json(`${BASE}/validator/heartbeat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId,timestamp,block,mac})});
    setStatus(s=>({...s,healthy:Boolean(j.healthy),block,heartbeatCount:Number(j.heartbeatCount||0),pendingPoints:Number(j.pendingValidatorPointsEstimate||0),lastHeartbeat:timestamp,error:''}));
    return j;
  }

  async function start(){
    if(!status.paired)return pair();
    setBusy(true);
    try{
      runningRef.current=true;
      setStatus(s=>({...s,running:true,error:''}));
      await heartbeat();
      if(timer.current)clearInterval(timer.current);
      timer.current=setInterval(()=>heartbeat().catch(e=>setStatus(s=>({...s,healthy:false,error:String(e?.message||e)}))),INTERVAL_MS);
    }catch(e:any){runningRef.current=false;setStatus(s=>({...s,running:false,healthy:false,error:String(e?.message||e)}));Alert.alert('Mobile Node',String(e?.message||e));}
    finally{setBusy(false)}
  }
  function stop(){runningRef.current=false;if(timer.current){clearInterval(timer.current);timer.current=null}setStatus(s=>({...s,running:false}));}
  async function reset(){stop();await Promise.all([SecureStore.deleteItemAsync(NODE_ID_KEY),SecureStore.deleteItemAsync(NODE_SECRET_KEY),SecureStore.deleteItemAsync(NODE_OPERATOR_KEY)]);setStatus(empty)}

  const label=status.running?(status.healthy===false?'DEGRADADO':'ATIVO'):(status.paired?'PRONTO':'NÃO REGISTRADO');
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>ZORYQ MOBILE NODE</Text>
    <Text style={s.title}>Rode o agente da Testnet no celular.</Text>
    <Text style={s.copy}>O Mobile Node lê o RPC público e envia um heartbeat autenticado a cada 60 segundos. O Node Secret é separado da wallet e fica no SecureStore.</Text>

    <View style={s.hero}>
      <View style={[s.dot,status.running&&status.healthy!==false?s.dotOn:status.healthy===false?s.dotBad:null]}/>
      <View style={{flex:1}}><Text style={s.heroLabel}>{label}</Text><Text style={s.heroSub}>Chain ID 5919065 · heartbeat 60s</Text></View>
    </View>

    <View style={s.grid}>
      <Card k="NODE ID" v={status.nodeId?short(status.nodeId):'—'}/>
      <Card k="OPERADOR" v={status.operator?short(status.operator):'—'}/>
      <Card k="BLOCO" v={status.block===null?'—':String(status.block)}/>
      <Card k="HEARTBEATS" v={String(status.heartbeatCount)}/>
      <Card k="PONTOS PENDENTES" v={String(status.pendingPoints)}/>
      <Card k="ÚLTIMO SINAL" v={status.lastHeartbeat?new Date(status.lastHeartbeat).toLocaleTimeString('pt-BR'):'—'}/>
    </View>

    {!status.paired?<Pressable disabled={busy} onPress={pair} style={s.primary}><Text style={s.primaryText}>{busy?'REGISTRANDO…':'REGISTRAR MOBILE NODE'}</Text></Pressable>:status.running?<Pressable onPress={stop} style={s.stop}><Text style={s.stopText}>PARAR NODE</Text></Pressable>:<Pressable disabled={busy} onPress={start} style={s.primary}><Text style={s.primaryText}>{busy?'INICIANDO…':'INICIAR NODE'}</Text></Pressable>}
    {status.paired&&!status.running?<Pressable onPress={reset} style={s.secondary}><Text style={s.secondaryText}>Remover registro deste aparelho</Text></Pressable>:null}

    {status.error?<View style={s.error}><Text style={s.errorText}>{status.error}</Text></View>:null}
    <View style={s.info}><Text style={s.infoTitle}>Como funciona</Text><Text style={s.infoText}>1. A wallet local assina apenas o registro do node.\n2. O coordenador devolve Node ID + Node Secret.\n3. O app usa o Node Secret para HMAC dos heartbeats.\n4. A seed e a private key nunca são enviadas.\n5. Pontos ficam pendentes até revisão/finalização do epoch.</Text></View>
    <View style={s.warning}><Text style={s.warningTitle}>Importante</Text><Text style={s.warningText}>Este é o Validator Agent móvel da Testnet, não um nó de execução independente nem um validator descentralizado. No Android, heartbeats de 60s são confiáveis enquanto o ZORIQ está aberto/ativo; o sistema pode pausar timers em segundo plano.</Text></View>
  </ScrollView>
}

function Card({k,v}:{k:string;v:string}){return <View style={s.card}><Text style={s.cardK}>{k}</Text><Text numberOfLines={1} style={s.cardV}>{v}</Text></View>}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:'#07080d'},content:{padding:18,paddingBottom:120},eyebrow:{color:'#65e6c4',fontSize:11,fontWeight:'900',letterSpacing:1.8},title:{color:'#fff',fontSize:30,fontWeight:'900',lineHeight:34,marginTop:10},copy:{color:'#9aa8bd',fontSize:14,lineHeight:21,marginTop:10,marginBottom:18},hero:{borderWidth:1,borderColor:'#26344a',backgroundColor:'#0d121a',borderRadius:20,padding:18,flexDirection:'row',alignItems:'center',gap:12},dot:{width:14,height:14,borderRadius:7,backgroundColor:'#667085'},dotOn:{backgroundColor:'#49e58b'},dotBad:{backgroundColor:'#ff5c78'},heroLabel:{color:'#fff',fontSize:17,fontWeight:'900'},heroSub:{color:'#708098',fontSize:11,marginTop:3},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:14},card:{width:'48%',borderWidth:1,borderColor:'#1d2838',backgroundColor:'#0b1017',borderRadius:16,padding:14},cardK:{color:'#687892',fontSize:9,fontWeight:'900',letterSpacing:1},cardV:{color:'#fff',fontSize:15,fontWeight:'900',marginTop:5},primary:{backgroundColor:'#baff45',borderRadius:16,padding:17,alignItems:'center',marginTop:18},primaryText:{color:'#071009',fontWeight:'900',fontSize:13},stop:{backgroundColor:'#32141e',borderWidth:1,borderColor:'#8d3047',borderRadius:16,padding:17,alignItems:'center',marginTop:18},stopText:{color:'#ff8296',fontWeight:'900'},secondary:{borderWidth:1,borderColor:'#273246',borderRadius:15,padding:14,alignItems:'center',marginTop:10},secondaryText:{color:'#9eb0c9',fontWeight:'800'},error:{backgroundColor:'#2a1118',borderWidth:1,borderColor:'#6b2837',padding:14,borderRadius:14,marginTop:14},errorText:{color:'#ff91a1',fontSize:12,lineHeight:18},info:{backgroundColor:'#0d121a',borderWidth:1,borderColor:'#1f2c3d',padding:16,borderRadius:18,marginTop:18},infoTitle:{color:'#fff',fontSize:15,fontWeight:'900'},infoText:{color:'#9aa8bd',fontSize:12,lineHeight:21,marginTop:8},warning:{backgroundColor:'#17140b',borderWidth:1,borderColor:'#4f421b',padding:16,borderRadius:18,marginTop:12},warningTitle:{color:'#ffd36b',fontWeight:'900'},warningText:{color:'#c1ae7b',fontSize:11,lineHeight:18,marginTop:6}
});
