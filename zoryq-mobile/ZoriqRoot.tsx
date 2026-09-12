import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {HDNodeWallet,Wallet} from 'ethers';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import WalletApp from './App';
import ZoriqSocialNative from './ZoriqSocialNative';
import {
  getBackendState,listNotifications,markAllNotificationsRead,markNotificationRead,
  signInWithLocalWallet,watchAuth
} from './socialBackend';

type Surface='social'|'wallet'|'security';
type SecurityConfig={appLock:boolean;txConfirm:boolean};
const SECURITY_KEY='zoriq.security.biometric.v1';
let securityConfig:SecurityConfig={appLock:false,txConfirm:false};

async function biometricAvailable(){
  try{
    const [hardware,enrolled,level]=await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync()
    ]);
    return Boolean(hardware&&enrolled&&level>=LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
  }catch{return false}
}

async function authenticate(reason:string){
  if(!(await biometricAvailable()))return false;
  try{
    const result=await LocalAuthentication.authenticateAsync({
      promptMessage:reason,
      promptSubtitle:'ZORIQ Security',
      promptDescription:'Confirme sua identidade para autorizar o uso local da wallet.',
      cancelLabel:'Cancelar',
      fallbackLabel:'Usar código do aparelho',
      disableDeviceFallback:false,
      requireConfirmation:true,
      biometricsSecurityLevel:'strong'
    });
    return Boolean(result.success);
  }catch{return false}
}

async function authorizeTransaction(){
  if(!securityConfig.txConfirm)return;
  const ok=await authenticate('Confirmar transação');
  if(!ok)throw new Error('Transação não autorizada. Confirme com biometria ou código do aparelho.');
}

function patchSignerPrototype(proto:any){
  if(!proto||proto.__zoriqBiometricPatched)return;
  const original=proto.sendTransaction;
  if(typeof original!=='function')return;
  Object.defineProperty(proto,'__zoriqBiometricPatched',{value:true});
  proto.sendTransaction=async function(transaction:any){
    await authorizeTransaction();
    return original.call(this,transaction);
  };
}
patchSignerPrototype(Wallet.prototype);
patchSignerPrototype(HDNodeWallet.prototype);

function Shell(){
  const [surface,setSurface]=useState<Surface>('social');
  const [drawer,setDrawer]=useState(false);
  const [noticeOpen,setNoticeOpen]=useState(false);
  const [security,setSecurity]=useState<SecurityConfig>(securityConfig);
  const [bio,setBio]=useState({ready:false,available:false,types:[] as number[]});
  const [cloud,setCloud]=useState({checked:false,online:false,authenticated:false});
  const [notifications,setNotifications]=useState<any[]>([]);
  const [locked,setLocked]=useState(false);
  const backgroundAt=useRef(0);
  const unread=notifications.filter(n=>!n.is_read).length;

  const refreshSocialState=useCallback(async()=>{
    try{
      const backend=await getBackendState();
      const notices=backend.authenticated?await listNotifications():[];
      setCloud({checked:true,online:true,authenticated:backend.authenticated});
      setNotifications(notices||[]);
      return backend;
    }catch{
      setCloud({checked:true,online:false,authenticated:false});
      setNotifications([]);
      return null;
    }
  },[]);

  useEffect(()=>{
    let alive=true;
    refreshSocialState();
    const stop=watchAuth(()=>{if(alive)refreshSocialState()});
    return()=>{alive=false;stop()};
  },[refreshSocialState]);

  useEffect(()=>{
    (async()=>{
      const [hardware,enrolled,level,types,raw]=await Promise.all([
        LocalAuthentication.hasHardwareAsync().catch(()=>false),
        LocalAuthentication.isEnrolledAsync().catch(()=>false),
        LocalAuthentication.getEnrolledLevelAsync().catch(()=>LocalAuthentication.SecurityLevel.NONE),
        LocalAuthentication.supportedAuthenticationTypesAsync().catch(()=>[]),
        AsyncStorage.getItem(SECURITY_KEY)
      ]);
      const available=Boolean(hardware&&enrolled&&level>=LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
      let cfg:SecurityConfig={appLock:available,txConfirm:available};
      try{if(raw)cfg=JSON.parse(raw)}catch{}
      if(!available)cfg={appLock:false,txConfirm:false};
      securityConfig=cfg;setSecurity(cfg);setBio({ready:true,available,types:types as number[]});
      if(cfg.appLock&&available){setLocked(true);const ok=await authenticate('Desbloquear ZORIQ');setLocked(!ok)}
    })();
  },[]);

  useEffect(()=>{
    const sub=AppState.addEventListener('change',async next=>{
      if(next==='background'||next==='inactive')backgroundAt.current=Date.now();
      if(next==='active'){
        refreshSocialState();
        if(securityConfig.appLock&&Date.now()-backgroundAt.current>1200){
          setLocked(true);const ok=await authenticate('Desbloquear ZORIQ');setLocked(!ok);
        }
      }
    });
    return()=>sub.remove();
  },[refreshSocialState]);

  async function saveSecurity(next:SecurityConfig){securityConfig=next;setSecurity(next);await AsyncStorage.setItem(SECURITY_KEY,JSON.stringify(next))}
  async function toggleSecurity(key:keyof SecurityConfig){
    if(!bio.available)return Alert.alert('Biometria segura indisponível','Cadastre digital ou reconhecimento facial nas configurações do aparelho.');
    if(!security[key]){const ok=await authenticate(key==='txConfirm'?'Ativar confirmação de transações':'Ativar desbloqueio do app');if(!ok)return}
    await saveSecurity({...security,[key]:!security[key]});
  }
  async function unlock(){const ok=await authenticate('Desbloquear ZORIQ');if(ok)setLocked(false)}
  function chooseSurface(next:Surface){setSurface(next);setDrawer(false)}
  async function activateSocial(){
    try{await signInWithLocalWallet();await refreshSocialState()}catch(e:any){Alert.alert('Entrar com wallet',String(e?.message||e||'Não foi possível conectar.'))}
  }
  async function markNotice(id:string){setNotifications(v=>v.map(n=>String(n.id)===id?{...n,is_read:true}:n));try{await markNotificationRead(id)}catch{}}
  async function markAll(){setNotifications(v=>v.map(n=>({...n,is_read:true})));try{await markAllNotificationsRead()}catch{}}
  const typeLabels:string[]=[];
  if(bio.types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))typeLabels.push('Digital');
  if(bio.types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))typeLabels.push('Facial');
  if(bio.types.includes(LocalAuthentication.AuthenticationType.IRIS))typeLabels.push('Íris');

  if(!bio.ready)return <View style={s.lock}><Text style={s.logo}>ZORIQ</Text><Text style={s.lockSub}>Preparando segurança…</Text></View>;
  if(locked)return <View style={s.lock}><View style={s.lockMark}><Text style={s.lockMarkText}>Z</Text></View><Text style={s.lockTitle}>ZORIQ bloqueado</Text><Text style={s.lockSub}>Use {typeLabels.join(' / ')||'a biometria'} para acessar o app e proteger sua wallet.</Text><Pressable style={s.unlock} onPress={unlock}><Text style={s.unlockText}>Desbloquear</Text></Pressable></View>;

  const title=surface==='social'?'ZORIQ Social':surface==='wallet'?'Wallet / Recovery':'Segurança';
  return <SafeAreaView style={s.safe} edges={['top','left','right','bottom']}>
    <StatusBar style="light" backgroundColor="#07080d" translucent={false}/>
    <View style={s.topbar}>
      <Pressable accessibilityLabel="Abrir aplicativos" onPress={()=>setDrawer(true)} style={s.topButton}><Text style={s.menuIcon}>☰</Text></Pressable>
      <View style={s.topCopy}><Text style={s.topTitle}>{title}</Text><Text style={s.topSub}>{cloud.checked?(cloud.online?(cloud.authenticated?'● conectado':'◐ online'):'○ offline'):'· verificando'}</Text></View>
      <Pressable accessibilityLabel="Notificações" onPress={()=>setNoticeOpen(true)} style={s.topButton}><Text style={s.bell}>♡</Text>{unread>0?<View style={s.badge}><Text style={s.badgeText}>{unread>9?'9+':unread}</Text></View>:null}</Pressable>
    </View>

    <View style={s.body}>{surface==='social'?<ZoriqSocialNative/>:surface==='wallet'?<WalletApp/>:<SecurityPage/>}</View>

    <Modal visible={drawer} transparent animationType="fade" onRequestClose={()=>setDrawer(false)}>
      <Pressable style={s.drawerBack} onPress={()=>setDrawer(false)}>
        <Pressable style={s.drawer} onPress={()=>{}}>
          <View style={s.drawerHead}><View><Text style={s.drawerBrand}>ZORIQ</Text><Text style={s.drawerSub}>APLICATIVOS</Text></View><Pressable onPress={()=>setDrawer(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <Text style={s.drawerHint}>Acesse tudo por uma coluna simples e retrátil.</Text>
          <AppItem icon="◎" title="Social" sub="Feed, pessoas, Play, perfil e $" active={surface==='social'} onPress={()=>chooseSurface('social')}/>
          <AppItem icon="$" title="Wallet / Recovery" sub="Saldo, envio, seed, stake e swap" active={surface==='wallet'} onPress={()=>chooseSurface('wallet')}/>
          <AppItem icon="▣" title="Segurança" sub="Biometria e confirmação de transações" active={surface==='security'} onPress={()=>chooseSurface('security')}/>
          <View style={s.drawerFoot}><Text style={s.drawerFootText}>Play / Mini Games fica dentro de Social → Play.</Text></View>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={noticeOpen} transparent animationType="slide" onRequestClose={()=>setNoticeOpen(false)}>
      <View style={s.noticeBack}><View style={s.noticeSheet}>
        <View style={s.noticeHead}><View><Text style={s.drawerSub}>ZORIQ SOCIAL</Text><Text style={s.noticeTitle}>Notificações</Text></View><Pressable onPress={()=>setNoticeOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
        {!cloud.authenticated?<View style={s.authBox}><Text style={s.settingTitle}>Conecte sua wallet</Text><Text style={s.settingSub}>Assine o login social para receber alertas pessoais no app inteiro.</Text><Pressable onPress={activateSocial} style={s.unlock}><Text style={s.unlockText}>Entrar com wallet</Text></Pressable></View>:<>
          <View style={s.noticeToolbar}><Text style={s.settingSub}>{unread} não lida{unread===1?'':'s'}</Text>{unread>0?<Pressable onPress={markAll}><Text style={s.markAll}>Marcar todas</Text></Pressable>:null}</View>
          <ScrollView contentContainerStyle={{paddingBottom:18}}>{notifications.length?notifications.map(n=><Pressable key={String(n.id)} onPress={()=>markNotice(String(n.id))} style={[s.noticeItem,!n.is_read&&s.noticeUnread]}><Text style={s.noticeIcon}>{n.icon||'◉'}</Text><View style={{flex:1}}><Text style={s.noticeItemTitle}>{n.title||n.type||'Notificação'}</Text><Text style={s.noticeBody}>{n.body||''}</Text><Text style={s.noticeTime}>{n.created_at?new Date(n.created_at).toLocaleString('pt-BR'):''}</Text></View></Pressable>):<View style={s.empty}><Text style={s.settingTitle}>Tudo em dia</Text><Text style={s.settingSub}>Nenhuma notificação nova.</Text></View>}</ScrollView>
        </>}
      </View></View>
    </Modal>
  </SafeAreaView>;

  function SecurityPage(){return <ScrollView style={s.securityPage} contentContainerStyle={{paddingBottom:28}}><Text style={s.securityEyebrow}>ZORIQ SECURITY</Text><Text style={s.securityTitle}>Biometria e proteção</Text><Text style={s.securityCopy}>Proteja o acesso ao aplicativo e confirme transações assinadas pela wallet.</Text><View style={s.status}><Text style={s.statusLabel}>Biometria</Text><Text style={bio.available?s.statusOk:s.statusOff}>{bio.available?`${typeLabels.join(' / ')||'Disponível'} · ativa no aparelho`:'Não disponível ou não cadastrada'}</Text></View><Pressable style={s.setting} onPress={()=>toggleSecurity('appLock')}><View style={{flex:1}}><Text style={s.settingTitle}>Desbloquear aplicativo</Text><Text style={s.settingSub}>Solicita biometria ao abrir ou retornar ao ZORIQ.</Text></View><Switch on={security.appLock}/></Pressable><Pressable style={s.setting} onPress={()=>toggleSecurity('txConfirm')}><View style={{flex:1}}><Text style={s.settingTitle}>Confirmar transações</Text><Text style={s.settingSub}>Exige biometria antes de enviar, fazer stake, swap ou Social Pay.</Text></View><Switch on={security.txConfirm}/></Pressable><Pressable style={s.test} onPress={async()=>Alert.alert('Teste biométrico',(await authenticate('Testar biometria'))?'Autenticação confirmada.':'Autenticação não confirmada.')}><Text style={s.testText}>Testar biometria</Text></Pressable><Text style={s.warning}>A biometria nunca substitui sua seed phrase. A seed e a chave privada permanecem locais no aparelho.</Text></ScrollView>}
}

function AppItem({icon,title,sub,active,onPress}:{icon:string;title:string;sub:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[s.appItem,active&&s.appItemActive]}><View style={s.appIcon}><Text style={s.appIconText}>{icon}</Text></View><View style={{flex:1}}><Text style={s.appTitle}>{title}</Text><Text style={s.appSub}>{sub}</Text></View><Text style={s.chev}>›</Text></Pressable>}
function Switch({on}:{on:boolean}){return <View style={[s.toggle,on&&s.toggleOn]}><View style={[s.knob,on&&s.knobOn]}/></View>}

export default function ZoriqRoot(){return <SafeAreaProvider><Shell/></SafeAreaProvider>}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#07080d'},body:{flex:1,backgroundColor:'#07080d'},
 topbar:{minHeight:54,paddingHorizontal:10,borderBottomWidth:1,borderBottomColor:'#1b2230',backgroundColor:'#080b10',flexDirection:'row',alignItems:'center'},topButton:{width:44,height:44,borderRadius:13,backgroundColor:'#10151e',alignItems:'center',justifyContent:'center',position:'relative'},menuIcon:{color:'#fff',fontSize:22,fontWeight:'800'},bell:{color:'#fff',fontSize:22},topCopy:{flex:1,paddingHorizontal:12},topTitle:{color:'#fff',fontSize:15,fontWeight:'900'},topSub:{color:'#5fd7a0',fontSize:9,fontWeight:'800',marginTop:2},badge:{position:'absolute',right:2,top:2,minWidth:18,height:18,borderRadius:9,backgroundColor:'#ff5577',alignItems:'center',justifyContent:'center',paddingHorizontal:4,borderWidth:2,borderColor:'#080b10'},badgeText:{color:'#fff',fontSize:8,fontWeight:'900'},
 lock:{flex:1,backgroundColor:'#07080d',alignItems:'center',justifyContent:'center',padding:30},logo:{color:'#fff',fontSize:28,fontWeight:'900',letterSpacing:5},lockMark:{width:82,height:82,borderRadius:24,backgroundColor:'#baff45',alignItems:'center',justifyContent:'center',marginBottom:22},lockMarkText:{color:'#071000',fontSize:38,fontWeight:'900'},lockTitle:{color:'#fff',fontSize:28,fontWeight:'900'},lockSub:{color:'#8d96a9',textAlign:'center',lineHeight:20,marginTop:8},unlock:{marginTop:14,backgroundColor:'#baff45',paddingHorizontal:18,paddingVertical:13,borderRadius:13,alignItems:'center'},unlockText:{color:'#071000',fontWeight:'900'},
 drawerBack:{flex:1,backgroundColor:'rgba(0,0,0,.62)',flexDirection:'row'},drawer:{width:'84%',maxWidth:330,backgroundColor:'#0a0e14',padding:18,borderRightWidth:1,borderRightColor:'#273142'},drawerHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},drawerBrand:{color:'#fff',fontSize:26,fontWeight:'900',letterSpacing:4},drawerSub:{color:'#34e8ff',fontSize:10,fontWeight:'900',letterSpacing:1.5,marginTop:4},drawerHint:{color:'#7f8b9e',fontSize:11,lineHeight:17,marginTop:12,marginBottom:8},close:{width:38,height:38,borderRadius:19,backgroundColor:'#171d28',alignItems:'center',justifyContent:'center'},closeText:{color:'#fff',fontSize:26,lineHeight:28},appItem:{minHeight:72,borderRadius:16,borderWidth:1,borderColor:'#202938',backgroundColor:'#0e131b',padding:12,marginTop:9,flexDirection:'row',alignItems:'center',gap:11},appItemActive:{borderColor:'#496477',backgroundColor:'#111a24'},appIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#171e29',alignItems:'center',justifyContent:'center'},appIconText:{color:'#baff45',fontSize:20,fontWeight:'900'},appTitle:{color:'#fff',fontSize:14,fontWeight:'900'},appSub:{color:'#7f8b9e',fontSize:9,lineHeight:14,marginTop:3},chev:{color:'#657185',fontSize:25},drawerFoot:{marginTop:16,padding:12,borderRadius:14,backgroundColor:'#0d1219'},drawerFootText:{color:'#7f8b9e',fontSize:10,lineHeight:15},
 noticeBack:{flex:1,backgroundColor:'rgba(0,0,0,.62)',justifyContent:'flex-end'},noticeSheet:{maxHeight:'78%',backgroundColor:'#0a0e14',borderTopLeftRadius:24,borderTopRightRadius:24,borderWidth:1,borderColor:'#273142',padding:18},noticeHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},noticeTitle:{color:'#fff',fontSize:26,fontWeight:'900',marginTop:4},authBox:{marginTop:16,backgroundColor:'#101720',borderWidth:1,borderColor:'#315569',borderRadius:16,padding:15},noticeToolbar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12,marginBottom:6},markAll:{color:'#baff45',fontSize:11,fontWeight:'900'},noticeItem:{flexDirection:'row',gap:11,padding:13,borderRadius:14,marginTop:7,backgroundColor:'#0d1219',borderWidth:1,borderColor:'#202938'},noticeUnread:{borderColor:'#36536b',backgroundColor:'#101924'},noticeIcon:{fontSize:18},noticeItemTitle:{color:'#fff',fontWeight:'900',fontSize:13},noticeBody:{color:'#98a3b5',fontSize:11,lineHeight:17,marginTop:3},noticeTime:{color:'#687386',fontSize:9,marginTop:5},empty:{alignItems:'center',paddingVertical:30},
 securityPage:{flex:1,backgroundColor:'#07080d',paddingHorizontal:18,paddingTop:18},securityEyebrow:{color:'#34e8ff',fontSize:10,fontWeight:'900',letterSpacing:1.5},securityTitle:{color:'#fff',fontSize:30,fontWeight:'900',marginTop:7},securityCopy:{color:'#8d96a9',lineHeight:19,marginTop:7,marginBottom:18},status:{backgroundColor:'#0e121a',borderWidth:1,borderColor:'#242c3a',borderRadius:16,padding:15,marginBottom:10},statusLabel:{color:'#fff',fontWeight:'800'},statusOk:{color:'#5cffad',fontSize:11,marginTop:5},statusOff:{color:'#ffcf66',fontSize:11,marginTop:5},setting:{backgroundColor:'#0e121a',borderWidth:1,borderColor:'#242c3a',borderRadius:16,padding:15,marginTop:10,flexDirection:'row',alignItems:'center',gap:14},settingTitle:{color:'#fff',fontWeight:'900',fontSize:15},settingSub:{color:'#8d96a9',fontSize:10,lineHeight:16,marginTop:4},toggle:{width:48,height:28,borderRadius:14,backgroundColor:'#303746',padding:3},toggleOn:{backgroundColor:'#baff45'},knob:{width:22,height:22,borderRadius:11,backgroundColor:'#fff'},knobOn:{marginLeft:20,backgroundColor:'#071000'},test:{marginTop:18,borderWidth:1,borderColor:'#354053',padding:14,borderRadius:14,alignItems:'center'},testText:{color:'#fff',fontWeight:'900'},warning:{color:'#ffcf66',fontSize:10,lineHeight:17,marginTop:16}
});
