import React,{useEffect,useRef,useState} from 'react';
import {AppState,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ZORYQ_UI} from './theme';

const CHAIN_ID=5919065;
const RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const STORAGE='zoryq.mobileWitness.v1';
const INTERVAL_MS=20000;

type Props={onBack:()=>void};
type State={enabled:boolean;checks:number;successfulChecks:number;lastBlock:number;lastHash:string;lastCheckedAt:string;startedAt:string};
const EMPTY:State={enabled:false,checks:0,successfulChecks:0,lastBlock:0,lastHash:'',lastCheckedAt:'',startedAt:''};

async function rpc(method:string,params:any[]=[]){
 const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params})});
 if(!r.ok)throw Error(`RPC HTTP ${r.status}`);
 const j=await r.json();
 if(j.error)throw Error(j.error.message||'RPC error');
 return j.result;
}
async function verify(previousBlock:number){
 const chainHex=await rpc('eth_chainId');
 const chainId=parseInt(chainHex,16);
 if(chainId!==CHAIN_ID)throw Error(`Chain ID inesperado: ${chainId}`);
 const b=await rpc('eth_getBlockByNumber',['latest',false]);
 if(!b?.hash||!b?.parentHash||!b?.number)throw Error('Cabeçalho incompleto');
 const block=parseInt(b.number,16);
 if(previousBlock>0&&block<previousBlock)throw Error('Altura da rede retrocedeu');
 return {block,hash:String(b.hash),parentHash:String(b.parentHash)};
}

export default function MobileNodeApp({onBack}:Props){
 const [node,setNode]=useState<State>(EMPTY);
 const [status,setStatus]=useState('Offline');
 const [warning,setWarning]=useState('');
 const busy=useRef(false);
 const timer=useRef<ReturnType<typeof setInterval>|null>(null);

 useEffect(()=>{void boot();return()=>stopTimer()},[]);
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active'&&node.enabled){void round();startTimer()}else stopTimer()});return()=>sub.remove()},[node.enabled,node.lastBlock]);
 async function boot(){try{const raw=await AsyncStorage.getItem(STORAGE);if(raw){const saved={...EMPTY,...JSON.parse(raw)};setNode(saved);if(saved.enabled){setStatus('Ativo • verificando');setTimeout(()=>void round(saved),250);startTimer()}}}catch{}}
 function stopTimer(){if(timer.current){clearInterval(timer.current);timer.current=null}}
 function startTimer(){stopTimer();timer.current=setInterval(()=>void round(),INTERVAL_MS)}
 async function persist(next:State){setNode(next);await AsyncStorage.setItem(STORAGE,JSON.stringify(next))}
 async function round(base?:State){if(busy.current)return;busy.current=true;setStatus('Verificando rede…');setWarning('');try{const current=base||node;const proof=await verify(current.lastBlock);const next={...current,enabled:true,checks:current.checks+1,successfulChecks:current.successfulChecks+1,lastBlock:proof.block,lastHash:proof.hash,lastCheckedAt:new Date().toISOString(),startedAt:current.startedAt||new Date().toISOString()};await persist(next);setStatus(`Online • bloco ${proof.block}`)}catch(e:any){const current=base||node;const next={...current,enabled:true,checks:current.checks+1,lastCheckedAt:new Date().toISOString(),startedAt:current.startedAt||new Date().toISOString()};await persist(next);setStatus('Atenção na verificação');setWarning(e?.message||'RPC indisponível')}finally{busy.current=false}}
 async function activate(){const next={...node,enabled:true,startedAt:node.startedAt||new Date().toISOString()};await persist(next);await round(next);startTimer()}
 async function deactivate(){stopTimer();const next={...node,enabled:false};await persist(next);setStatus('Offline')}
 const successRate=node.checks?Math.round((node.successfulChecks/node.checks)*100):0;
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content}>
  <View style={s.header}><Pressable onPress={onBack}><Text style={s.back}>← ZORYQ</Text></Pressable><View><Text style={s.kicker}>NETWORK PARTICIPATION</Text><Text style={s.title}>Mobile Node</Text></View></View>
  <View style={[s.hero,node.enabled&&s.heroOn]}><Text style={s.state}>{node.enabled?'● ACTIVE WITNESS':'○ OFFLINE'}</Text><Text style={s.heroTitle}>Seu celular pode verificar a ZORYQ.</Text><Text style={s.copy}>O Mobile Witness Node confere a identidade da rede e o avanço dos blocos enquanto o app está ativo. Não minera, não guarda chaves de validador e não é apresentado como participante do consenso.</Text><Pressable style={[s.button,node.enabled&&s.stop]} onPress={()=>void(node.enabled?deactivate():activate())}><Text style={s.buttonText}>{node.enabled?'Parar Mobile Node':'Ativar Mobile Node'}</Text></Pressable></View>
  <View style={s.grid}><Metric label="STATUS" value={status}/><Metric label="CHAIN ID" value="5919065"/><Metric label="ÚLTIMO BLOCO" value={node.lastBlock?String(node.lastBlock):'—'}/><Metric label="CHECKS OK" value={String(node.successfulChecks)}/><Metric label="TAXA DE SUCESSO" value={`${successRate}%`}/><Metric label="INTERVALO" value="20 s"/></View>
  {warning?<View style={s.warn}><Text style={s.warnTitle}>Verificação não confirmada</Text><Text style={s.warnText}>{warning}</Text></View>:null}
  <View style={s.card}><Text style={s.cardTitle}>O que esta versão faz</Text><Text style={s.line}>✓ Verifica o Chain ID da ZORYQ Testnet</Text><Text style={s.line}>✓ Lê cabeçalhos de blocos diretamente do RPC</Text><Text style={s.line}>✓ Rejeita retrocesso de altura observado</Text><Text style={s.line}>✓ Registra localmente verificações e uptime de sessão</Text><Text style={s.line}>✓ Interrompe o loop quando o app sai do primeiro plano para poupar bateria</Text></View>
  <View style={s.card}><Text style={s.cardTitle}>Próxima camada de descentralização</Text><Text style={s.copy}>Quando houver múltiplos endpoints operados de forma independente, o app passará a exigir acordo entre peers/checkpoints. Só então essas instalações deverão contar como observadores independentes no painel público.</Text></View>
  <View style={s.proof}><Text style={s.proofTitle}>Última prova local</Text><Text style={s.mono}>Block: {node.lastBlock||'—'}{`\n`}Hash: {node.lastHash||'—'}{`\n`}Checked: {node.lastCheckedAt||'—'}</Text></View>
 </ScrollView></SafeAreaView>
}
function Metric({label,value}:{label:string;value:string}){return <View style={s.metric}><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text></View>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:ZORYQ_UI.background},content:{padding:18,paddingBottom:44},header:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:18},back:{color:ZORYQ_UI.primary,fontWeight:'900'},kicker:{color:'#58E5CA',fontSize:10,fontWeight:'900',letterSpacing:1.4},title:{color:ZORYQ_UI.text,fontWeight:'900',fontSize:26},hero:{borderWidth:1,borderColor:ZORYQ_UI.border,borderRadius:22,padding:22,backgroundColor:ZORYQ_UI.panelSecondary},heroOn:{borderColor:'#35D49A'},state:{color:'#6FE6B1',fontSize:11,fontWeight:'900',letterSpacing:1.2},heroTitle:{color:ZORYQ_UI.text,fontSize:27,fontWeight:'900',marginTop:10},copy:{color:'#9FB0C4',fontSize:14,lineHeight:21,marginTop:8},button:{marginTop:20,paddingVertical:14,borderRadius:14,alignItems:'center',backgroundColor:'#35D49A'},stop:{backgroundColor:'#303B4B'},buttonText:{color:'#06100D',fontWeight:'900'},grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:14},metric:{width:'48%',borderWidth:1,borderColor:ZORYQ_UI.border,borderRadius:15,padding:14,backgroundColor:'#0D1420'},metricLabel:{color:'#72869F',fontSize:9,fontWeight:'900',letterSpacing:1},metricValue:{color:ZORYQ_UI.text,fontSize:17,fontWeight:'900',marginTop:5},warn:{marginTop:14,borderRadius:15,padding:14,backgroundColor:'#2A1A11',borderWidth:1,borderColor:'#684324'},warnTitle:{color:'#FFC977',fontWeight:'900'},warnText:{color:'#D4B98F',marginTop:5},card:{marginTop:14,borderRadius:18,padding:18,backgroundColor:'#0D1420',borderWidth:1,borderColor:ZORYQ_UI.border},cardTitle:{color:ZORYQ_UI.text,fontWeight:'900',fontSize:17,marginBottom:8},line:{color:'#A9B9CA',lineHeight:24},proof:{marginTop:14,borderRadius:18,padding:18,backgroundColor:'#070B11',borderWidth:1,borderColor:ZORYQ_UI.border},proofTitle:{color:'#67E7D1',fontWeight:'900',marginBottom:8},mono:{color:'#92A6BC',fontFamily:'monospace',fontSize:11,lineHeight:18}});