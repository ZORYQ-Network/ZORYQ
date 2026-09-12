import React,{useEffect,useState} from 'react';
import {PermissionsAndroid,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {ZORYQ_UI} from './theme';
import {
 configureNativeMobileNode,
 getNativeMobileNodeStatus,
 nativeMobileNodeAvailable,
 NativeNodeMode,
 NativeNodeStatus,
 pauseNativeMobileNode,
 setNativeMobileNodeMode,
 startNativeMobileNode,
 stopNativeMobileNode,
} from './nativeMobileNode';

const CHAIN_ID=5919065;
const EMPTY:NativeNodeStatus={running:false,paused:false,resumeRequired:false,nodeId:'',state:'Offline',mode:'BALANCED',lastBlock:0,lastBlockHash:'',lastCheck:'',proofStatus:'No verified proof yet',lastXpAwarded:0,totalXp:0,lastXpEventId:'',lastVerifiedProofHash:'',heartbeatStatus:'Not sent yet',lastHeartbeatAt:'',lastHeartbeatXp:0};
type Props={onBack:()=>void};

export default function MobileNodeApp({onBack}:Props){
 const [node,setNode]=useState<NativeNodeStatus>(EMPTY);
 const [busy,setBusy]=useState(false);
 const [warning,setWarning]=useState('');
 const available=nativeMobileNodeAvailable();

 useEffect(()=>{
  let mounted=true;
  async function refresh(){
   if(!available)return;
   try{const next=await getNativeMobileNodeStatus();if(mounted)setNode(next)}catch(e:any){if(mounted)setWarning(e?.message||'Native node status unavailable')}
  }
  void refresh();const id=setInterval(()=>void refresh(),5000);
  return()=>{mounted=false;clearInterval(id)};
 },[available]);

 async function refresh(){if(!available)return;setNode(await getNativeMobileNodeStatus())}
 async function notificationPermission(){
  if(Platform.OS==='android'&&Number(Platform.Version)>=33){
   await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
 }
 async function activate(){
  if(!available){setWarning('Este build não contém o serviço Android nativo do ZORYQ Mobile Node.');return}
  setBusy(true);setWarning('');
  try{
   await notificationPermission();
   await configureNativeMobileNode({wifiOnly:false,chargingOnly:false,allowMobileData:true,batteryMinimum:20});
   await setNativeMobileNodeMode('BALANCED');
   await startNativeMobileNode();
   await refresh();
  }catch(e:any){setWarning(e?.message||'Não foi possível iniciar o Mobile Node')}finally{setBusy(false)}
 }
 async function pause(){setBusy(true);setWarning('');try{await pauseNativeMobileNode();await refresh()}catch(e:any){setWarning(e?.message||'Não foi possível pausar')}finally{setBusy(false)}}
 async function stop(){setBusy(true);setWarning('');try{await stopNativeMobileNode();await refresh()}catch(e:any){setWarning(e?.message||'Não foi possível parar')}finally{setBusy(false)}}
 async function mode(next:NativeNodeMode){setBusy(true);setWarning('');try{await setNativeMobileNodeMode(next);if(next==='PAUSED')await pauseNativeMobileNode();else if(!node.running)await startNativeMobileNode();await refresh()}catch(e:any){setWarning(e?.message||'Não foi possível alterar o modo')}finally{setBusy(false)}}

 const state=node.running?'● BACKGROUND NODE ACTIVE':node.resumeRequired?'◐ RESUME REQUIRED':node.paused?'Ⅱ PAUSED':'○ OFFLINE';
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content}>
  <View style={s.header}><Pressable onPress={onBack}><Text style={s.back}>← ZORYQ</Text></Pressable><View><Text style={s.kicker}>NETWORK PARTICIPATION</Text><Text style={s.title}>Mobile Node</Text></View></View>
  <View style={[s.hero,node.running&&s.heroOn]}><Text style={s.state}>{state}</Text><Text style={s.heroTitle}>Seu celular verifica a ZORYQ em segundo plano.</Text><Text style={s.copy}>O serviço Android nativo valida a Chain ID, recebe desafios, verifica blocos e só registra XP depois que a prova assinada é aceita pelo backend. Heartbeat e tempo ocioso não geram XP. O Mobile Node não é apresentado como participante do consenso e não é validator.</Text>
   <View style={s.actions}>{!node.running?<Pressable style={s.button} disabled={busy} onPress={()=>void activate()}><Text style={s.buttonText}>{busy?'Iniciando…':'Run Mobile Node'}</Text></Pressable>:<><Pressable style={s.secondary} disabled={busy} onPress={()=>void pause()}><Text style={s.secondaryText}>Pause</Text></Pressable><Pressable style={s.secondary} disabled={busy} onPress={()=>void stop()}><Text style={s.secondaryText}>Stop</Text></Pressable></>}</View>
  </View>
  <View style={s.grid}><Metric label="STATUS" value={node.state||'Offline'}/><Metric label="CHAIN ID" value={String(CHAIN_ID)}/><Metric label="MODE" value={node.mode||'BALANCED'}/><Metric label="ÚLTIMO BLOCO" value={node.lastBlock?String(Math.trunc(node.lastBlock)):'—'}/><Metric label="TOTAL XP" value={String(Math.trunc(node.totalXp||0))}/><Metric label="ÚLTIMO XP" value={node.lastXpAwarded?`+${Math.trunc(node.lastXpAwarded)}`:'0'}/></View>
  <View style={s.card}><Text style={s.cardTitle}>Contribution mode</Text><View style={s.modeRow}>{(['ECO','BALANCED','MAX_CONTRIBUTION'] as NativeNodeMode[]).map(m=><Pressable key={m} disabled={busy} style={[s.mode,node.mode===m&&s.modeOn]} onPress={()=>void mode(m)}><Text style={s.modeText}>{m.replace('_',' ')}</Text></Pressable>)}</View><Text style={s.copy}>O Resource Governor pode interromper tarefas por bateria, temperatura, conectividade ou armazenamento. Nenhuma pausa de segurança gera XP.</Text></View>
  {warning?<View style={s.warn}><Text style={s.warnTitle}>Atenção</Text><Text style={s.warnText}>{warning}</Text></View>:null}
  {!available?<View style={s.warn}><Text style={s.warnTitle}>Native bridge ausente</Text><Text style={s.warnText}>Use o APK oficial gerado pelo workflow da ZORYQ. Expo Go não executa o Foreground Service nativo.</Text></View>:null}
  <View style={s.card}><Text style={s.cardTitle}>Prova e XP</Text><Text style={s.line}>Proof: {node.proofStatus||'No verified proof yet'}</Text><Text style={s.line}>XP Event: {node.lastXpEventId||'—'}</Text><Text style={s.line}>Proof hash: {node.lastVerifiedProofHash||'—'}</Text><Text style={s.line}>Heartbeat: {node.heartbeatStatus||'Not sent yet'}</Text><Text style={s.line}>Heartbeat XP: {Math.trunc(node.lastHeartbeatXp||0)} (deve ser 0)</Text></View>
  <View style={s.proof}><Text style={s.proofTitle}>Node identity / latest verification</Text><Text style={s.mono}>Node ID: {node.nodeId||'—'}{`\n`}Block: {node.lastBlock||'—'}{`\n`}Hash: {node.lastBlockHash||'—'}{`\n`}Checked: {node.lastCheck||'—'}{`\n`}Heartbeat: {node.lastHeartbeatAt||'—'}</Text></View>
  <View style={s.card}><Text style={s.cardTitle}>Regras de verdade</Text><Text style={s.line}>✓ Wallet key e Node key permanecem separadas</Text><Text style={s.line}>✓ Node key é mantida no Android Keystore</Text><Text style={s.line}>✓ Core nativo verifica eth_chainId + eth_getBlockByNumber</Text><Text style={s.line}>✓ Challenge/proof inválido ou repetido = 0 XP</Text><Text style={s.line}>✓ Heartbeat = 0 XP</Text><Text style={s.line}>✓ Background usa Foreground Service visível</Text><Text style={s.line}>✓ Reinício exige retomada controlada pelo usuário quando o Android exigir</Text></View>
 </ScrollView></SafeAreaView>
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text></View>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:ZORYQ_UI.background},content:{padding:18,paddingBottom:44},header:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:18},back:{color:ZORYQ_UI.primary,fontWeight:'900'},kicker:{color:'#58E5CA',fontSize:10,fontWeight:'900',letterSpacing:1.4},title:{color:ZORYQ_UI.text,fontWeight:'900',fontSize:26},hero:{borderWidth:1,borderColor:ZORYQ_UI.border,borderRadius:22,padding:22,backgroundColor:ZORYQ_UI.panelSecondary},heroOn:{borderColor:'#35D49A'},state:{color:'#6FE6B1',fontSize:11,fontWeight:'900',letterSpacing:1.2},heroTitle:{color:ZORYQ_UI.text,fontSize:27,fontWeight:'900',marginTop:10},copy:{color:'#9FB0C4',fontSize:14,lineHeight:21,marginTop:8},actions:{flexDirection:'row',gap:10,marginTop:20},button:{flex:1,paddingVertical:14,borderRadius:14,alignItems:'center',backgroundColor:'#35D49A'},buttonText:{color:'#06100D',fontWeight:'900'},secondary:{flex:1,paddingVertical:14,borderRadius:14,alignItems:'center',backgroundColor:'#303B4B'},secondaryText:{color:'#F0F5FA',fontWeight:'900'},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:14},metric:{width:'48%',borderWidth:1,borderColor:ZORYQ_UI.border,borderRadius:15,padding:14,backgroundColor:'#0D1420'},metricLabel:{color:'#72869F',fontSize:9,fontWeight:'900',letterSpacing:1},metricValue:{color:ZORYQ_UI.text,fontSize:15,fontWeight:'900',marginTop:5},warn:{marginTop:14,borderRadius:15,padding:14,backgroundColor:'#2A1A11',borderWidth:1,borderColor:'#684324'},warnTitle:{color:'#FFC977',fontWeight:'900'},warnText:{color:'#D4B98F',marginTop:5},card:{marginTop:14,borderRadius:18,padding:18,backgroundColor:'#0D1420',borderWidth:1,borderColor:ZORYQ_UI.border},cardTitle:{color:ZORYQ_UI.text,fontWeight:'900',fontSize:17,marginBottom:8},line:{color:'#A9B9CA',lineHeight:24},modeRow:{flexDirection:'row',flexWrap:'wrap',gap:8},mode:{paddingVertical:10,paddingHorizontal:12,borderRadius:12,backgroundColor:'#192231',borderWidth:1,borderColor:'#293A50'},modeOn:{borderColor:'#35D49A',backgroundColor:'#12352D'},modeText:{color:'#DCE6F2',fontWeight:'800',fontSize:11},proof:{marginTop:14,borderRadius:18,padding:18,backgroundColor:'#070B11',borderWidth:1,borderColor:ZORYQ_UI.border},proofTitle:{color:'#67E7D1',fontWeight:'900',marginBottom:8},mono:{color:'#92A6BC',fontFamily:'monospace',fontSize:11,lineHeight:18}});
