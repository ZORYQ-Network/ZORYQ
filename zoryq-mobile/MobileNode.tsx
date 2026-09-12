import 'react-native-get-random-values';
import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Linking,NativeModules,PermissionsAndroid,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Contract,JsonRpcProvider,Wallet} from 'ethers';

const BASE=(process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app').replace(/\/$/,'');
const RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||`${BASE}/rpc`;
const EXPLORER=process.env.EXPO_PUBLIC_ZORYQ_EXPLORER||'https://zoryq-testnet.vercel.app/explorer.html';
const REWARD_REGISTRY=process.env.EXPO_PUBLIC_REWARD_REGISTRY||'0xAB1Dd21c529b182191ED84f00A4dF1917652CB10';
const WALLET_KEY='zoryq.wallet.privateKey';
const LEGACY_NODE_ID='zoryq.mobile.node.id';
const LEGACY_NODE_SECRET='zoryq.mobile.node.secret';
const LEGACY_NODE_OPERATOR='zoryq.mobile.node.operator';
const NativeNode:any=NativeModules.ZoryqNodeService;
const CHAIN_ID=5919065;
const EPOCH_ZERO=Date.UTC(2026,8,7,0,0,0);
const EPOCH_MS=7*24*60*60*1000;
const REWARD_ABI=['function scoreOf(address) view returns (uint256 total,uint256 mobile,uint256 contributor,uint256 validator,uint256 claimed,uint256 claimablePoints)'];
const provider=new JsonRpcProvider(RPC,CHAIN_ID,{staticNetwork:true});

type NodeStatus={paired:boolean;running:boolean;healthy:boolean;nodeId:string;operator:string;block:number;heartbeatCount:number;pendingPoints:number;lastHeartbeat:number;error:string};
type NetworkState={onlineMs:number;activeOperators:number;totalOperators:number;finalizedValidator:number;coordinatorSeen:boolean};
const empty:NodeStatus={paired:false,running:false,healthy:false,nodeId:'',operator:'',block:-1,heartbeatCount:0,pendingPoints:0,lastHeartbeat:0,error:''};
const emptyNetwork:NetworkState={onlineMs:0,activeOperators:0,totalOperators:0,finalizedValidator:0,coordinatorSeen:false};

async function json(url:string,init?:RequestInit){const r=await fetch(url,init);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(j?.error||`HTTP ${r.status}`));return j}
function short(v:string){return v?v.slice(0,8)+'…'+v.slice(-6):'—'}
function clamp01(v:number){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0))}
function duration(ms:number){const t=Math.max(0,Math.floor(ms/1000));const d=Math.floor(t/86400),h=Math.floor((t%86400)/3600),m=Math.floor((t%3600)/60),s=t%60;if(d)return `${d}d ${h}h`;if(h)return `${h}h ${m}m`;if(m)return `${m}m ${s}s`;return `${s}s`}
function epochInfo(now:number){
  const n=Math.max(1,Math.floor((now-EPOCH_ZERO)/EPOCH_MS)+1);
  const start=EPOCH_ZERO+(n-1)*EPOCH_MS;
  const end=start+EPOCH_MS;
  return {number:n,start,end,progress:clamp01((now-start)/EPOCH_MS),remaining:Math.max(0,end-now)};
}
function nextMilestone(onlineMs:number){
  const hour=3600000;
  if(onlineMs<hour)return {name:'Primeira hora saudável',reward:'120 pts base',target:hour,remaining:hour-onlineMs};
  if(onlineMs<24*hour)return {name:'Bônus 24h contínuas',reward:'+1.500 pts',target:24*hour,remaining:24*hour-onlineMs};
  if(onlineMs<168*hour)return {name:'Streak de 7 dias',reward:'+12.000 pts',target:168*hour,remaining:168*hour-onlineMs};
  return {name:'Operador 7d+',reward:'Marco principal concluído',target:168*hour,remaining:0};
}

export default function MobileNode(){
  const [status,setStatus]=useState<NodeStatus>(empty);
  const [network,setNetwork]=useState<NetworkState>(emptyNetwork);
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [nativeReady]=useState(Boolean(NativeNode?.status&&NativeNode?.configure&&NativeNode?.start));

  const load=useCallback(async()=>{
    if(!nativeReady)return;
    try{
      const raw=await NativeNode.status();
      const next:NodeStatus={paired:Boolean(raw?.paired),running:Boolean(raw?.running),healthy:Boolean(raw?.healthy),nodeId:String(raw?.nodeId||''),operator:String(raw?.operator||''),block:Number(raw?.block??-1),heartbeatCount:Number(raw?.heartbeatCount||0),pendingPoints:Number(raw?.pendingPoints||0),lastHeartbeat:Number(raw?.lastHeartbeat||0),error:String(raw?.error||'')};
      const net:NetworkState={...emptyNetwork};
      if(next.operator){
        try{
          const j=await json(`${BASE}/validators`);
          const validators=Array.isArray(j?.validators)?j.validators:[];
          net.totalOperators=validators.length;
          net.activeOperators=validators.filter((v:any)=>Boolean(v?.healthy)).length;
          const mine=validators.find((v:any)=>String(v?.nodeId||'')===next.nodeId||String(v?.operator||'').toLowerCase()===next.operator.toLowerCase());
          if(mine){
            net.coordinatorSeen=true;
            net.onlineMs=Math.max(0,Number(mine?.onlineMs||0));
            const estimate=Number(mine?.pendingValidatorPointsEstimate);
            if(Number.isFinite(estimate))next.pendingPoints=estimate;
          }
        }catch{}
        try{
          const x:any=await new Contract(REWARD_REGISTRY,REWARD_ABI,provider).scoreOf(next.operator);
          net.finalizedValidator=Number(x?.validator??x?.[3]??0);
        }catch{}
      }
      setStatus(next);setNetwork(net);
    }catch(e:any){setStatus(v=>({...v,error:String(e?.message||e)}))}
  },[nativeReady]);

  useEffect(()=>{
    let alive=true;let poll:any;let clock:any;
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
      poll=setInterval(()=>{if(alive)load()},10000);
      clock=setInterval(()=>{if(alive)setNow(Date.now())},1000);
    })();
    return()=>{alive=false;if(poll)clearInterval(poll);if(clock)clearInterval(clock)};
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

  async function requestNotification(){if(Platform.OS==='android'&&Number(Platform.Version)>=33){try{await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)}catch{}}}
  async function start(){
    if(!status.paired)return pair();
    setBusy(true);
    try{await requestNotification();await NativeNode.start();await new Promise(r=>setTimeout(r,650));await load();}
    catch(e:any){Alert.alert('Iniciar Mobile Node',String(e?.message||e));}
    finally{setBusy(false)}
  }
  async function stop(){setBusy(true);try{await NativeNode.stop();await load()}catch(e:any){Alert.alert('Parar Mobile Node',String(e?.message||e))}finally{setBusy(false)}}
  async function reset(){
    Alert.alert('Remover Mobile Node','Isso apaga o registro local deste aparelho. A wallet não será apagada.',[
      {text:'Cancelar',style:'cancel'},{text:'Remover',style:'destructive',onPress:async()=>{try{await NativeNode.clear();await load()}catch{}}}
    ]);
  }

  const epoch=epochInfo(now);
  const milestone=nextMilestone(network.onlineMs);
  const milestoneProgress=clamp01(network.onlineMs/milestone.target);
  const label=status.running?(status.healthy?'ATIVO':'INICIANDO / DEGRADADO'):(status.paired?'PRONTO':'NÃO REGISTRADO');
  const heartbeatFresh=status.lastHeartbeat>0&&now-status.lastHeartbeat<150000;

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <View style={s.topLine}><Text style={s.eyebrow}>ZORYQ MOBILE NODE</Text><View style={s.epochPill}><Text style={s.epochPillText}>ÉPOCA {epoch.number}</Text></View></View>
    <Text style={s.title}>Mantenha seu node saudável.</Text>
    <Text style={s.copy}>Participe da Testnet com uptime verificável. A tela mostra progresso real do node; pontos pendentes só viram recompensa finalizada após o fechamento da época e publicação on-chain.</Text>

    <View style={s.epochCard}>
      <View style={s.rowBetween}><View><Text style={s.kicker}>ÉPOCA {epoch.number} · 7 DIAS</Text><Text style={s.epochTitle}>Fecha em {duration(epoch.remaining)}</Text></View><Text style={s.epochPct}>{Math.floor(epoch.progress*100)}%</Text></View>
      <Progress value={epoch.progress}/>
      <View style={s.rowBetween}><Text style={s.mutedSmall}>{new Date(epoch.start).toLocaleDateString('pt-BR',{timeZone:'UTC'})} UTC</Text><Text style={s.mutedSmall}>{new Date(epoch.end).toLocaleDateString('pt-BR',{timeZone:'UTC'})} UTC</Text></View>
    </View>

    <View style={s.hero}><View style={[s.dot,status.running&&status.healthy?s.dotOn:status.running?s.dotWarn:null]}/><View style={{flex:1}}><Text style={s.heroLabel}>{label}</Text><Text style={s.heroSub}>Chain ID 5919065 · Foreground Service · heartbeat 60s</Text></View><View style={[s.freshPill,heartbeatFresh&&s.freshOn]}><Text style={s.freshText}>{heartbeatFresh?'SINAL OK':'AGUARDANDO'}</Text></View></View>

    <View style={s.milestoneCard}>
      <View style={s.rowBetween}><View style={{flex:1}}><Text style={s.kicker}>PRÓXIMO MARCO</Text><Text style={s.milestoneTitle}>{milestone.name}</Text><Text style={s.milestoneReward}>{milestone.reward}</Text></View><Text style={s.milestoneTime}>{milestone.remaining>0?duration(milestone.remaining):'✓'}</Text></View>
      <Progress value={milestoneProgress} accent/>
      <Text style={s.mutedSmall}>{network.coordinatorSeen?`Uptime observado: ${duration(network.onlineMs)}`:'Aguardando o coordenador reconhecer este node.'}</Text>
    </View>

    <View style={s.scoreStrip}>
      <View style={s.scoreItem}><Text style={s.scoreValue}>{Math.trunc(status.pendingPoints).toLocaleString('pt-BR')}</Text><Text style={s.scoreLabel}>PONTOS PENDENTES</Text></View>
      <View style={s.scoreDivider}/><View style={s.scoreItem}><Text style={s.scoreValue}>{Math.trunc(network.finalizedValidator).toLocaleString('pt-BR')}</Text><Text style={s.scoreLabel}>VALIDATOR FINALIZADO</Text></View>
      <View style={s.scoreDivider}/><View style={s.scoreItem}><Text style={s.scoreValue}>{network.activeOperators}/{network.totalOperators}</Text><Text style={s.scoreLabel}>NODES SAUDÁVEIS</Text></View>
    </View>

    <View style={s.grid}>
      <Card k="NODE ID" v={status.nodeId?short(status.nodeId):'—'}/><Card k="OPERADOR" v={status.operator?short(status.operator):'—'}/><Card k="BLOCO" v={status.block<0?'—':String(Math.trunc(status.block))}/><Card k="HEARTBEATS" v={String(Math.trunc(status.heartbeatCount))}/><Card k="UPTIME" v={network.coordinatorSeen?duration(network.onlineMs):'—'}/><Card k="ÚLTIMO SINAL" v={status.lastHeartbeat>0?new Date(status.lastHeartbeat).toLocaleTimeString('pt-BR'):'—'}/>
    </View>

    {!status.paired?<Pressable disabled={busy} onPress={pair} style={s.primary}><Text style={s.primaryText}>{busy?'REGISTRANDO…':'REGISTRAR MOBILE NODE'}</Text></Pressable>:status.running?<Pressable disabled={busy} onPress={stop} style={s.stop}><Text style={s.stopText}>{busy?'PARANDO…':'PARAR NODE'}</Text></Pressable>:<Pressable disabled={busy} onPress={start} style={s.primary}><Text style={s.primaryText}>{busy?'INICIANDO…':'INICIAR NODE PERSISTENTE'}</Text></Pressable>}

    {status.paired?<View style={s.actions}><Pressable onPress={()=>NativeNode.openBatterySettings?.()} style={s.secondary}><Text style={s.secondaryText}>Otimização de bateria</Text></Pressable><Pressable onPress={()=>NativeNode.openNotificationSettings?.()} style={s.secondary}><Text style={s.secondaryText}>Notificação do Node</Text></Pressable></View>:null}
    <View style={s.actions}><Pressable onPress={load} style={s.secondary}><Text style={s.secondaryText}>Atualizar agora</Text></Pressable><Pressable onPress={()=>Linking.openURL(EXPLORER)} style={s.secondary}><Text style={s.secondaryText}>Abrir Explorer</Text></Pressable></View>
    {status.paired&&!status.running?<Pressable onPress={reset} style={s.remove}><Text style={s.removeText}>Remover registro deste aparelho</Text></Pressable>:null}

    {!nativeReady?<View style={s.error}><Text style={s.errorText}>Serviço nativo indisponível nesta instalação.</Text></View>:null}
    {status.error?<View style={s.error}><Text style={s.errorText}>{status.error}</Text></View>:null}

    <View style={s.info}><Text style={s.infoTitle}>Como os marcos funcionam</Text><Text style={s.infoText}>• 1 hora saudável: base de 120 pts/h.\n• 24h contínuas: bônus sugerido de +1.500 pts.\n• 7 dias contínuos: bônus sugerido de +12.000 pts.\n• O coordenador verifica heartbeat, uptime e saúde.\n• Pontos exibidos como “pendentes” podem ser ajustados pela revisão anti-abuso da época.\n• Somente valores publicados/finalizados on-chain são definitivos.</Text></View>
    <View style={s.info}><Text style={s.infoTitle}>Proteção e persistência</Text><Text style={s.infoText}>• Node Secret criptografado com Android Keystore.\n• Seed/private key ficam fora do serviço.\n• Notificação permanente enquanto o node estiver ativo.\n• START_STICKY + retomada após boot/atualização.\n• O serviço continua mesmo com a tela do ZORIQ fechada, sujeito às regras de bateria do fabricante.</Text></View>
    <View style={s.warning}><Text style={s.warningTitle}>Importante</Text><Text style={s.warningText}>Este recurso é o Validator Agent móvel da Testnet. Ainda não é um execution node/validator independente da rede. Alguns Androids encerram serviços agressivamente; use “Otimização de bateria” para permitir execução sem restrição.</Text></View>
  </ScrollView>
}

function Progress({value,accent=false}:{value:number;accent?:boolean}){return <View style={s.track}><View style={[s.fill,{width:`${Math.max(2,Math.floor(clamp01(value)*100))}%`},accent&&s.fillAccent]}/></View>}
function Card({k,v}:{k:string;v:string}){return <View style={s.card}><Text style={s.cardK}>{k}</Text><Text numberOfLines={1} style={s.cardV}>{v}</Text></View>}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:'#07080d'},content:{padding:18,paddingBottom:120},topLine:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{color:'#65e6c4',fontSize:11,fontWeight:'900',letterSpacing:1.8},epochPill:{borderWidth:1,borderColor:'#315747',backgroundColor:'#10221b',borderRadius:999,paddingHorizontal:10,paddingVertical:6},epochPillText:{color:'#70efbc',fontSize:9,fontWeight:'900',letterSpacing:1},title:{color:'#fff',fontSize:30,fontWeight:'900',lineHeight:34,marginTop:10},copy:{color:'#9aa8bd',fontSize:13,lineHeight:20,marginTop:10,marginBottom:16},
  epochCard:{borderWidth:1,borderColor:'#293c55',backgroundColor:'#0b1119',borderRadius:20,padding:16,marginBottom:12},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},kicker:{color:'#71829b',fontSize:9,fontWeight:'900',letterSpacing:1.2},epochTitle:{color:'#fff',fontSize:20,fontWeight:'900',marginTop:4},epochPct:{color:'#65e6c4',fontSize:24,fontWeight:'900'},track:{height:8,borderRadius:999,backgroundColor:'#182334',overflow:'hidden',marginVertical:12},fill:{height:'100%',borderRadius:999,backgroundColor:'#65e6c4'},fillAccent:{backgroundColor:'#baff45'},mutedSmall:{color:'#65748a',fontSize:9,fontWeight:'700'},
  hero:{borderWidth:1,borderColor:'#26344a',backgroundColor:'#0d121a',borderRadius:20,padding:16,flexDirection:'row',alignItems:'center',gap:10},dot:{width:14,height:14,borderRadius:7,backgroundColor:'#667085'},dotOn:{backgroundColor:'#49e58b'},dotWarn:{backgroundColor:'#f6c453'},heroLabel:{color:'#fff',fontSize:17,fontWeight:'900'},heroSub:{color:'#708098',fontSize:10,marginTop:3},freshPill:{backgroundColor:'#171b22',borderRadius:999,paddingHorizontal:8,paddingVertical:5},freshOn:{backgroundColor:'#12301f'},freshText:{color:'#9fb0c6',fontSize:7,fontWeight:'900'},
  milestoneCard:{marginTop:12,borderWidth:1,borderColor:'#324124',backgroundColor:'#10160d',borderRadius:20,padding:16},milestoneTitle:{color:'#fff',fontSize:17,fontWeight:'900',marginTop:4},milestoneReward:{color:'#baff45',fontSize:11,fontWeight:'900',marginTop:4},milestoneTime:{color:'#fff',fontSize:19,fontWeight:'900'},scoreStrip:{marginTop:12,borderWidth:1,borderColor:'#1d2a3b',backgroundColor:'#0a1017',borderRadius:18,paddingVertical:14,flexDirection:'row',alignItems:'stretch'},scoreItem:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:6},scoreValue:{color:'#fff',fontSize:16,fontWeight:'900'},scoreLabel:{color:'#66768f',fontSize:7,fontWeight:'900',textAlign:'center',marginTop:4},scoreDivider:{width:1,backgroundColor:'#1e2a3a'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:12},card:{width:'48%',borderWidth:1,borderColor:'#1d2838',backgroundColor:'#0b1017',borderRadius:16,padding:14},cardK:{color:'#687892',fontSize:9,fontWeight:'900',letterSpacing:1},cardV:{color:'#fff',fontSize:15,fontWeight:'900',marginTop:5},primary:{backgroundColor:'#baff45',borderRadius:16,padding:17,alignItems:'center',marginTop:18},primaryText:{color:'#071009',fontWeight:'900',fontSize:13},stop:{backgroundColor:'#32141e',borderWidth:1,borderColor:'#8d3047',borderRadius:16,padding:17,alignItems:'center',marginTop:18},stopText:{color:'#ff8296',fontWeight:'900'},actions:{flexDirection:'row',gap:10,marginTop:10},secondary:{flex:1,borderWidth:1,borderColor:'#273246',borderRadius:15,padding:13,alignItems:'center'},secondaryText:{color:'#9eb0c9',fontWeight:'800',fontSize:11},remove:{borderWidth:1,borderColor:'#4b2430',borderRadius:15,padding:13,alignItems:'center',marginTop:10},removeText:{color:'#d98295',fontWeight:'800'},error:{backgroundColor:'#2a1118',borderWidth:1,borderColor:'#6b2837',padding:14,borderRadius:14,marginTop:14},errorText:{color:'#ff91a1',fontSize:12,lineHeight:18},info:{backgroundColor:'#0d121a',borderWidth:1,borderColor:'#1f2c3d',padding:16,borderRadius:18,marginTop:14},infoTitle:{color:'#fff',fontSize:15,fontWeight:'900'},infoText:{color:'#9aa8bd',fontSize:11,lineHeight:20,marginTop:8},warning:{backgroundColor:'#17140b',borderWidth:1,borderColor:'#4f421b',padding:16,borderRadius:18,marginTop:12},warningTitle:{color:'#ffd36b',fontWeight:'900'},warningText:{color:'#c1ae7b',fontSize:11,lineHeight:18,marginTop:6}
});
