import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Pressable,StyleSheet,Text,View} from 'react-native';
import {registerRootComponent} from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {HDNodeWallet,Wallet} from 'ethers';
import WalletApp from './App';
import SocialSuite from './SocialSuite';
import {getBackendState,listVisibleFeed} from './socialBackend';

const SECURITY_KEY='zoriq.security.biometric.v1';
let securityConfig={appLock:false,txConfirm:false};

async function biometricAvailable(){
  try{
    const [hardware,enrolled,level]=await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync()
    ]);
    return hardware&&enrolled&&level>=LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  }catch{return false}
}

async function authenticate(reason){
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

function patchSignerPrototype(proto){
  if(!proto||proto.__zoriqBiometricPatched)return;
  const original=proto.sendTransaction;
  if(typeof original!=='function')return;
  Object.defineProperty(proto,'__zoriqBiometricPatched',{value:true});
  proto.sendTransaction=async function(transaction){
    await authorizeTransaction();
    return original.call(this,transaction);
  };
}
patchSignerPrototype(Wallet.prototype);
patchSignerPrototype(HDNodeWallet.prototype);

function Root(){
  const [surface,setSurface]=useState('social');
  const [security,setSecurity]=useState(securityConfig);
  const [bio,setBio]=useState({ready:false,available:false,types:[]});
  const [cloud,setCloud]=useState({checked:false,online:false,authenticated:false});
  const [locked,setLocked]=useState(false);
  const backgroundAt=useRef(0);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const backend=await getBackendState();
        await listVisibleFeed(1);
        if(active)setCloud({checked:true,online:true,authenticated:backend.authenticated});
      }catch{
        if(active)setCloud({checked:true,online:false,authenticated:false});
      }
    })();
    return()=>{active=false};
  },[]);

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
      let cfg=raw?JSON.parse(raw):{appLock:available,txConfirm:available};
      if(!available)cfg={appLock:false,txConfirm:false};
      securityConfig=cfg;setSecurity(cfg);setBio({ready:true,available,types});
      if(cfg.appLock&&available){setLocked(true);const ok=await authenticate('Desbloquear ZORIQ');setLocked(!ok)}
    })();
  },[]);

  useEffect(()=>{
    const sub=AppState.addEventListener('change',async next=>{
      if(next==='background'||next==='inactive')backgroundAt.current=Date.now();
      if(next==='active'&&securityConfig.appLock&&Date.now()-backgroundAt.current>1200){
        setLocked(true);const ok=await authenticate('Desbloquear ZORIQ');setLocked(!ok);
      }
    });
    return()=>sub.remove();
  },[]);

  async function saveSecurity(next){securityConfig=next;setSecurity(next);await AsyncStorage.setItem(SECURITY_KEY,JSON.stringify(next))}
  async function toggleSecurity(key){
    if(!bio.available)return Alert.alert('Biometria segura indisponível','Cadastre uma digital ou reconhecimento facial seguro nas configurações do aparelho.');
    if(!security[key]){const ok=await authenticate(key==='txConfirm'?'Ativar confirmação de transações':'Ativar desbloqueio do app');if(!ok)return}
    const next={...security,[key]:!security[key]};await saveSecurity(next);
  }
  async function unlock(){const ok=await authenticate('Desbloquear ZORIQ');if(ok)setLocked(false)}
  const typeLabels=[];
  if(bio.types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))typeLabels.push('Digital');
  if(bio.types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))typeLabels.push('Facial');
  if(bio.types.includes(LocalAuthentication.AuthenticationType.IRIS))typeLabels.push('Íris');

  if(!bio.ready)return <View style={s.lock}><Text style={s.logo}>ZORIQ</Text><Text style={s.lockSub}>Preparando segurança…</Text></View>;
  if(locked)return <View style={s.lock}><View style={s.lockMark}><Text style={s.lockMarkText}>Z</Text></View><Text style={s.lockTitle}>ZORIQ bloqueado</Text><Text style={s.lockSub}>Use {typeLabels.join(' / ')||'a biometria'} para acessar o app e proteger sua wallet.</Text><Pressable style={s.unlock} onPress={unlock}><Text style={s.unlockText}>Desbloquear com biometria</Text></Pressable></View>;

  return <View style={s.root}>
    <View style={s.switcher}>
      <Pressable onPress={()=>setSurface('social')} style={[s.tab,surface==='social'&&s.active]}><Text style={[s.text,surface==='social'&&s.activeText]}>ZORIQ Social <Text style={cloud.online?s.cloudOnline:s.cloudOffline}>{cloud.checked?(cloud.online?(cloud.authenticated?'●':'◐'):'○'):'·'}</Text></Text></Pressable>
      <Pressable onPress={()=>setSurface('wallet')} style={[s.tab,surface==='wallet'&&s.active]}><Text style={[s.text,surface==='wallet'&&s.activeText]}>Wallet / Recovery</Text></Pressable>
      <Pressable onPress={()=>setSurface('security')} style={[s.securityTab,surface==='security'&&s.active]}><Text style={[s.text,surface==='security'&&s.activeText]}>🔐</Text></Pressable>
    </View>
    <View style={s.body}>{surface==='social'?<SocialSuite/>:surface==='wallet'?<WalletApp/>:<View style={s.securityPage}><Text style={s.securityEyebrow}>ZORIQ SECURITY</Text><Text style={s.securityTitle}>Biometria e proteção</Text><Text style={s.securityCopy}>Proteja o acesso ao aplicativo e exija confirmação biométrica antes de cada transação assinada pela wallet.</Text><View style={s.status}><Text style={s.statusLabel}>Social backend</Text><Text style={cloud.online?s.statusOk:s.statusOff}>{cloud.online?(cloud.authenticated?'ONLINE · sessão social autenticada':'ONLINE · modo público/offline-first'):'OFFLINE · dados sociais locais continuam disponíveis'}</Text></View><View style={s.status}><Text style={s.statusLabel}>Biometria segura</Text><Text style={bio.available?s.statusOk:s.statusOff}>{bio.available?`${typeLabels.join(' / ')||'Disponível'} · ativa no aparelho`:'Não disponível ou não cadastrada'}</Text></View><Pressable style={s.setting} onPress={()=>toggleSecurity('appLock')}><View><Text style={s.settingTitle}>Desbloquear aplicativo</Text><Text style={s.settingSub}>Solicita biometria ao abrir ou retornar ao ZORIQ.</Text></View><View style={[s.toggle,security.appLock&&s.toggleOn]}><View style={[s.knob,security.appLock&&s.knobOn]}/></View></Pressable><Pressable style={s.setting} onPress={()=>toggleSecurity('txConfirm')}><View style={{flex:1}}><Text style={s.settingTitle}>Confirmar transações</Text><Text style={s.settingSub}>Antes de enviar ZQ, stake, unstake, swap ou aprovação, exige biometria. Se cancelar, a wallet não assina.</Text></View><View style={[s.toggle,security.txConfirm&&s.toggleOn]}><View style={[s.knob,security.txConfirm&&s.knobOn]}/></View></Pressable><Pressable style={s.test} onPress={async()=>Alert.alert('Teste biométrico',(await authenticate('Testar biometria'))?'Autenticação confirmada.':'Autenticação não confirmada.')}><Text style={s.testText}>Testar biometria</Text></Pressable><Text style={s.warning}>A biometria nunca substitui sua seed phrase. Ela apenas autoriza o uso da chave privada armazenada localmente no aparelho. A seed não é enviada ao servidor.</Text></View>}</View>
  </View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#07080d'},switcher:{height:44,padding:5,backgroundColor:'#080b10',borderBottomWidth:1,borderBottomColor:'#202735',flexDirection:'row',gap:6},tab:{flex:1,borderRadius:10,alignItems:'center',justifyContent:'center'},securityTab:{width:48,borderRadius:10,alignItems:'center',justifyContent:'center'},active:{backgroundColor:'#171e29'},text:{color:'#788396',fontSize:11,fontWeight:'900'},activeText:{color:'#fff'},cloudOnline:{color:'#5cffad'},cloudOffline:{color:'#ffcf66'},body:{flex:1},lock:{flex:1,backgroundColor:'#07080d',alignItems:'center',justifyContent:'center',padding:30},logo:{color:'#fff',fontSize:24,fontWeight:'900',letterSpacing:5},lockMark:{width:82,height:82,borderRadius:25,backgroundColor:'#baff45',alignItems:'center',justifyContent:'center',marginBottom:22},lockMarkText:{fontSize:38,fontWeight:'900',color:'#071000'},lockTitle:{color:'#fff',fontSize:30,fontWeight:'900',marginBottom:8},lockSub:{color:'#8d96a9',textAlign:'center',lineHeight:20,maxWidth:330},unlock:{marginTop:24,backgroundColor:'#baff45',paddingHorizontal:22,paddingVertical:15,borderRadius:14},unlockText:{color:'#071000',fontWeight:'900'},securityPage:{flex:1,padding:22,backgroundColor:'#07080d'},securityEyebrow:{color:'#34e8ff',fontSize:11,fontWeight:'900',letterSpacing:1.6,marginTop:14},securityTitle:{color:'#fff',fontSize:32,fontWeight:'900',marginTop:8},securityCopy:{color:'#8d96a9',lineHeight:20,marginTop:8,marginBottom:20},status:{backgroundColor:'#0e121a',borderWidth:1,borderColor:'#242c3a',borderRadius:16,padding:15,marginBottom:10},statusLabel:{color:'#fff',fontWeight:'800'},statusOk:{color:'#5cffad',fontSize:12,marginTop:6},statusOff:{color:'#ffcf66',fontSize:12,marginTop:6},setting:{backgroundColor:'#0e121a',borderWidth:1,borderColor:'#242c3a',borderRadius:16,padding:15,marginTop:10,flexDirection:'row',alignItems:'center',gap:14},settingTitle:{color:'#fff',fontWeight:'900',fontSize:16},settingSub:{color:'#8d96a9',fontSize:11,lineHeight:17,marginTop:4,maxWidth:285},toggle:{width:48,height:28,borderRadius:14,backgroundColor:'#303746',padding:3},toggleOn:{backgroundColor:'#baff45'},knob:{width:22,height:22,borderRadius:11,backgroundColor:'#fff'},knobOn:{marginLeft:20,backgroundColor:'#071000'},test:{marginTop:18,borderWidth:1,borderColor:'#354053',padding:14,borderRadius:14,alignItems:'center'},testText:{color:'#fff',fontWeight:'900'},warning:{color:'#ffcf66',fontSize:11,lineHeight:18,marginTop:18}});
registerRootComponent(Root);