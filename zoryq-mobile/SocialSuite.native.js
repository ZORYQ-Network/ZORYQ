import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Image,Modal,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,useColorScheme,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import {JsonRpcProvider,Wallet,isAddress,parseEther} from 'ethers';
import {StatusBar} from 'expo-status-bar';
import SyncedFeed from './SyncedFeed';
import MiniGames from './MiniGames';
import {
  createPost,getBackendState,getMyProfile,getZoriqVerifiedStatus,listDiscoverableProfiles,
  signInWithLocalWallet,socialSupabase,toggleFollow,updateMyProfile
} from './socialBackend';

const THEME_KEY='zoriq.appearance.v1';
const WALLET_KEY='zoryq.wallet.privateKey';
const RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const CHAIN_ID=5919065;
const provider=new JsonRpcProvider(RPC,CHAIN_ID,{staticNetwork:true});

const dark={bg:'#07080d',panel:'#0e121a',panel2:'#111827',text:'#fff',muted:'#8994a6',line:'#252e3d',accent:'#baff45',cyan:'#34e8ff',soft:'#171e29'};
const light={bg:'#f6f7f9',panel:'#ffffff',panel2:'#eef2f6',text:'#101319',muted:'#657080',line:'#dce2ea',accent:'#76b900',cyan:'#007f99',soft:'#e9edf2'};

export default function SocialSuiteNative(){
 const system=useColorScheme();
 const [themeMode,setThemeMode]=useState('automatic');
 const isDark=themeMode==='night'||(themeMode==='automatic'&&system!=='light');
 const c=isDark?dark:light;
 const styles=useMemo(()=>makeStyles(c),[isDark]);
 const [tab,setTab]=useState('home');
 const [gameMode,setGameMode]=useState('gaming');
 const [backend,setBackend]=useState(null);
 const [people,setPeople]=useState([]);
 const [profile,setProfile]=useState(null);
 const [selected,setSelected]=useState(null);
 const [query,setQuery]=useState('');
 const [post,setPost]=useState('');
 const [busy,setBusy]=useState(false);
 const [showWallet,setShowWallet]=useState(false);
 const [verified,setVerified]=useState(false);
 const [pay,setPay]=useState({open:false,name:'',address:'',amount:''});

 useEffect(()=>{AsyncStorage.getItem(THEME_KEY).then(v=>{if(v)setThemeMode(v)});refresh()},[]);
 async function refresh(){
  try{
   const b=await getBackendState();setBackend(b);
   const cards=await listDiscoverableProfiles();setPeople(cards||[]);
   if(b.authenticated){
    const [me,w,v]=await Promise.all([
      getMyProfile(),
      socialSupabase.from('profiles').select('show_wallet').eq('id',b.session.user.id).maybeSingle(),
      getZoriqVerifiedStatus().catch(()=>({verified:false}))
    ]);
    setProfile(me);setShowWallet(Boolean(w.data?.show_wallet));setVerified(Boolean(v?.verified));
   }
  }catch{}
 }
 async function ensureLogin(){if(backend?.authenticated)return true;try{await signInWithLocalWallet();await refresh();return true}catch(e){Alert.alert('Entre com sua wallet',String(e?.message||e));return false}}
 async function chooseTheme(mode){setThemeMode(mode);await AsyncStorage.setItem(THEME_KEY,mode)}
 async function publish(){if(!(await ensureLogin()))return;const text=post.trim();if(!text)return;setBusy(true);try{await createPost(text,'public');setPost('');setTab('home');Alert.alert('Publicado','Seu post foi publicado na ZORIQ Social.')}catch(e){Alert.alert('Publicar',String(e?.message||e))}finally{setBusy(false)}}
 async function follow(id){if(!(await ensureLogin()))return;try{const r=await toggleFollow(id);Alert.alert('ZORIQ',r?.state==='requested'?'Solicitação de follow enviada.':'Follow atualizado.')}catch(e){Alert.alert('Seguir',String(e?.message||e))}}
 async function pickAvatar(){
  if(!(await ensureLogin()))return;
  const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!perm.granted)return Alert.alert('Fotos','Permita acesso às fotos para escolher sua imagem de perfil.');
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.82});
  if(result.canceled||!result.assets?.[0])return;const asset=result.assets[0];
  if(asset.fileSize&&asset.fileSize>5*1024*1024)return Alert.alert('Foto muito grande','Escolha uma imagem de até 5 MB.');
  setBusy(true);
  try{
   const b=await getBackendState();if(!b.session)throw new Error('auth_required');
   const ext=(asset.fileName?.split('.').pop()||'jpg').toLowerCase().replace('jpeg','jpg');const mime=asset.mimeType||`image/${ext==='jpg'?'jpeg':ext}`;
   const res=await fetch(asset.uri);const blob=await res.blob();const path=`${b.session.user.id}/avatar-${Date.now()}.${ext}`;
   const up=await socialSupabase.storage.from('profile-media').upload(path,blob,{contentType:mime,upsert:true});if(up.error)throw up.error;
   const pub=socialSupabase.storage.from('profile-media').getPublicUrl(path);const url=pub.data.publicUrl;
   await updateMyProfile({avatar_url:url});setProfile(p=>({...p,avatar_url:url}));Alert.alert('Foto atualizada','Sua nova foto já está sincronizada no perfil.');
  }catch(e){Alert.alert('Foto de perfil',String(e?.message||e))}finally{setBusy(false)}
 }
 async function toggleWalletVisibility(){if(!(await ensureLogin()))return;const next=!showWallet;try{await updateMyProfile({show_wallet:next});setShowWallet(next)}catch(e){Alert.alert('Wallet pública',String(e?.message||e))}}
 async function openPay(person){
  if(!(await ensureLogin()))return;
  try{const {data,error}=await socialSupabase.rpc('social_payment_destination',{p_profile_id:person.id});if(error)throw error;const dest=Array.isArray(data)?data[0]:data;if(!dest?.address)return Alert.alert('Envio indisponível','Este perfil não disponibilizou uma wallet EVM verificada para receber cripto.');setPay({open:true,name:person.display_name||person.username||'Perfil ZORIQ',address:String(dest.address),amount:''})}catch(e){Alert.alert('Enviar cripto',String(e?.message||e))}
 }
 async function sendCrypto(){if(!isAddress(pay.address)||!pay.amount||Number(pay.amount)<=0)return;setBusy(true);try{const pk=await SecureStore.getItemAsync(WALLET_KEY);if(!pk)throw new Error('Crie ou restaure sua wallet primeiro.');const signer=new Wallet(pk,provider);const tx=await signer.sendTransaction({to:pay.address,value:parseEther(pay.amount)});await tx.wait(1);Alert.alert('Transferência confirmada',`${pay.amount} ZQ enviado para ${pay.name}.\n\n${tx.hash}`);setPay({open:false,name:'',address:'',amount:''})}catch(e){Alert.alert('Transferência',String(e?.shortMessage||e?.message||e))}finally{setBusy(false)}}
 const filtered=people.filter(p=>!query.trim()||`${p.display_name||''} ${p.username||''} ${p.bio||''}`.toLowerCase().includes(query.trim().toLowerCase()));
 function Avatar({p,size=48}){return p?.avatar_url?<Image source={{uri:p.avatar_url}} style={{width:size,height:size,borderRadius:size/2,backgroundColor:c.soft}}/>:<View style={[styles.avatar,{width:size,height:size,borderRadius:size/2}]}><Text style={styles.avatarText}>{String(p?.display_name||p?.username||'Z').slice(0,2).toUpperCase()}</Text></View>}
 function Home(){return <ScrollView contentContainerStyle={styles.page}><View style={styles.hero}><Text style={styles.eyebrow}>ZORIQ SOCIAL</Text><Text style={styles.heroTitle}>Seu mundo social.</Text><Text style={styles.muted}>Feed sincronizado, pessoas, jogos e wallet em uma experiência mais simples.</Text></View><SyncedFeed/></ScrollView>}
 function Search(){if(selected)return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={()=>setSelected(null)}><Text style={styles.back}>← Voltar</Text></Pressable><View style={styles.profileCard}><Avatar p={selected} size={82}/><Text style={styles.profileName}>{selected.display_name||selected.username||'Usuário'} {selected.verified?'✓':''}</Text><Text style={styles.handle}>@{selected.username||'zoriq'}</Text><Text style={styles.bio}>{selected.bio||'Perfil ZORIQ'}</Text><View style={styles.actions}><Pressable style={styles.primary} onPress={()=>follow(selected.id)}><Text style={styles.primaryText}>Seguir</Text></Pressable><Pressable style={styles.secondary} onPress={()=>Alert.alert('Mensagem','Abra as mensagens da ZORIQ para conversar com este perfil.')}><Text style={styles.secondaryText}>✉ Mensagem</Text></Pressable><Pressable style={styles.money} onPress={()=>openPay(selected)}><Text style={styles.moneyText}>$ Enviar cripto</Text></Pressable></View><Text style={styles.note}>O botão $ usa somente uma wallet EVM que o próprio usuário tornou pública e que já foi verificada criptograficamente.</Text></View></ScrollView>;
  return <ScrollView contentContainerStyle={styles.page}><TextInput value={query} onChangeText={setQuery} placeholder="Buscar pessoas" placeholderTextColor={c.muted} style={styles.input}/>{filtered.map(p=><Pressable key={p.id} onPress={()=>setSelected(p)} style={styles.person}><Avatar p={p}/><View style={{flex:1}}><Text style={styles.personName}>{p.display_name||p.username||'Usuário'} {p.verified?'✓':''}</Text><Text style={styles.handle}>@{p.username||'zoriq'}</Text><Text numberOfLines={1} style={styles.bio}>{p.bio||'Perfil ZORIQ'}</Text></View><Text style={styles.chev}>›</Text></Pressable>)}</ScrollView>}
 function Create(){return <ScrollView contentContainerStyle={styles.page}><Text style={styles.sectionTitle}>Criar publicação</Text><TextInput multiline value={post} onChangeText={setPost} placeholder="O que você quer compartilhar?" placeholderTextColor={c.muted} style={[styles.input,styles.composer]}/><Pressable disabled={busy} onPress={publish} style={styles.primary}><Text style={styles.primaryText}>{busy?'Publicando…':'Publicar'}</Text></Pressable></ScrollView>}
 function Games(){return <ScrollView contentContainerStyle={styles.page}><View style={styles.modeRow}><Pressable onPress={()=>setGameMode('fun')} style={[styles.mode,gameMode==='fun'&&styles.modeActive]}><Text style={[styles.modeText,gameMode==='fun'&&styles.modeTextActive]}>😂 Divertir</Text></Pressable><Pressable onPress={()=>setGameMode('gaming')} style={[styles.mode,gameMode==='gaming'&&styles.modeActive]}><Text style={[styles.modeText,gameMode==='gaming'&&styles.modeTextActive]}>🎮 Games</Text></Pressable></View><MiniGames mode={gameMode}/></ScrollView>}
 function Profile(){return <ScrollView contentContainerStyle={styles.page}><View style={styles.profileCard}><Pressable onPress={pickAvatar}><Avatar p={profile} size={90}/><Text style={styles.photoAction}>{busy?'Aguarde…':'Alterar foto'}</Text></Pressable><Text style={styles.profileName}>{profile?.display_name||profile?.username||'Seu perfil'} {verified?'✓':''}</Text><Text style={styles.handle}>@{profile?.username||'zoriq'}</Text><Text style={styles.bio}>{profile?.bio||'Entre com sua wallet para sincronizar o perfil.'}</Text></View><Text style={styles.sectionTitle}>Aparência</Text><View style={styles.themeRow}>{[['day','☀ Dia'],['night','☾ Noite'],['automatic','◐ Automático']].map(([id,label])=><Pressable key={id} onPress={()=>chooseTheme(id)} style={[styles.themeChoice,themeMode===id&&styles.themeActive]}><Text style={[styles.themeText,themeMode===id&&styles.themeTextActive]}>{label}</Text></Pressable>)}</View><View style={styles.setting}><View style={{flex:1}}><Text style={styles.settingTitle}>Receber cripto pelo perfil</Text><Text style={styles.muted}>Mostra sua wallet EVM verificada para o botão $ de outros usuários.</Text></View><Pressable onPress={toggleWalletVisibility} style={[styles.toggle,showWallet&&styles.toggleOn]}><View style={[styles.knob,showWallet&&styles.knobOn]}/></Pressable></View><View style={styles.setting}><View><Text style={styles.settingTitle}>ZORIQ Verified</Text><Text style={styles.muted}>{verified?'Selo anual ativo ✓':'US$ 9,99 por ano · pago em ETH'}</Text></View></View><Text style={styles.note}>Sua seed phrase e chave privada nunca são exibidas no perfil. Apenas o endereço público verificado pode ser compartilhado.</Text></ScrollView>}
 const content=tab==='home'?<Home/>:tab==='search'?<Search/>:tab==='create'?<Create/>:tab==='games'?<Games/>:<Profile/>;
 return <SafeAreaView style={[styles.root,{backgroundColor:c.bg}]}><StatusBar style={isDark?'light':'dark'}/><View style={styles.top}><Text style={styles.brand}>ZORIQ</Text><Text style={styles.topHint}>{backend?.authenticated?'● sincronizado':'◐ local'}</Text></View><View style={{flex:1}}>{content}</View><View style={styles.bottom}>{[['home','⌂','Home'],['search','⌕','Buscar'],['create','＋','Criar'],['games','🎮','Games'],['profile','◎','Perfil']].map(([id,icon,label])=><Pressable key={id} onPress={()=>{setTab(id);if(id!=='search')setSelected(null)}} style={styles.navItem}><Text style={[styles.navIcon,tab===id&&styles.navActive]}>{icon}</Text><Text style={[styles.navLabel,tab===id&&styles.navActive]}>{label}</Text></Pressable>)}</View><Modal visible={pay.open} transparent animationType="slide" onRequestClose={()=>setPay(x=>({...x,open:false}))}><View style={styles.modalBg}><View style={styles.modal}><Text style={styles.sectionTitle}>$ Enviar cripto</Text><Text style={styles.personName}>{pay.name}</Text><Text style={styles.address}>{pay.address}</Text><Text style={styles.label}>ZQ · ZORYQ EVM Testnet</Text><TextInput keyboardType="decimal-pad" value={pay.amount} onChangeText={v=>setPay(x=>({...x,amount:v.replace(',','.')}))} placeholder="0.00 ZQ" placeholderTextColor={c.muted} style={styles.input}/><Pressable disabled={busy} onPress={sendCrypto} style={styles.money}><Text style={styles.moneyText}>{busy?'Confirmando…':'Continuar transferência'}</Text></Pressable><Pressable onPress={()=>setPay({open:false,name:'',address:'',amount:''})} style={styles.secondary}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Text style={styles.note}>A transferência usa sua wallet local. Se a confirmação biométrica estiver ativada, o app pedirá biometria antes de assinar.</Text></View></View></Modal></SafeAreaView>
}

function makeStyles(c){return StyleSheet.create({root:{flex:1},top:{height:48,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:c.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:c.bg},brand:{color:c.text,fontSize:20,fontWeight:'900',letterSpacing:4},topHint:{color:c.muted,fontSize:9,fontWeight:'800'},page:{padding:15,paddingBottom:95},hero:{backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:20,padding:17,marginBottom:12},eyebrow:{color:c.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.2},heroTitle:{color:c.text,fontSize:29,fontWeight:'900',marginVertical:7},muted:{color:c.muted,fontSize:11,lineHeight:17},bottom:{height:64,borderTopWidth:1,borderTopColor:c.line,backgroundColor:c.bg,flexDirection:'row',paddingHorizontal:5,paddingBottom:4},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIcon:{color:c.muted,fontSize:20,fontWeight:'900'},navLabel:{color:c.muted,fontSize:8,fontWeight:'800',marginTop:2},navActive:{color:c.text},input:{backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:13,color:c.text,padding:13,marginBottom:10},composer:{minHeight:160,textAlignVertical:'top',fontSize:16},sectionTitle:{color:c.text,fontSize:22,fontWeight:'900',marginBottom:12},person:{backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:15,padding:11,marginBottom:8,flexDirection:'row',alignItems:'center',gap:10},avatar:{backgroundColor:c.soft,alignItems:'center',justifyContent:'center'},avatarText:{color:c.text,fontWeight:'900'},personName:{color:c.text,fontSize:15,fontWeight:'900'},handle:{color:c.muted,fontSize:10,marginTop:2},bio:{color:c.muted,fontSize:11,lineHeight:17,marginTop:7},chev:{color:c.muted,fontSize:24},back:{color:c.cyan,fontWeight:'900',marginBottom:14},profileCard:{backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:20,padding:18,alignItems:'center',marginBottom:14},profileName:{color:c.text,fontSize:22,fontWeight:'900',marginTop:10},photoAction:{color:c.cyan,fontWeight:'900',fontSize:10,textAlign:'center',marginTop:7},actions:{width:'100%',gap:8,marginTop:15},primary:{backgroundColor:c.accent,borderRadius:12,padding:13,alignItems:'center'},primaryText:{color:'#071000',fontWeight:'900'},secondary:{borderWidth:1,borderColor:c.line,borderRadius:12,padding:12,alignItems:'center',marginTop:8},secondaryText:{color:c.text,fontWeight:'800'},money:{backgroundColor:'#137333',borderRadius:12,padding:13,alignItems:'center',marginTop:8},moneyText:{color:'#fff',fontWeight:'900'},note:{color:c.muted,fontSize:9,lineHeight:15,marginTop:13},modeRow:{flexDirection:'row',gap:7,marginBottom:10},mode:{flex:1,borderWidth:1,borderColor:c.line,borderRadius:12,padding:10,alignItems:'center',backgroundColor:c.panel},modeActive:{backgroundColor:c.text},modeText:{color:c.muted,fontWeight:'900'},modeTextActive:{color:c.bg},themeRow:{flexDirection:'row',gap:7,marginBottom:16},themeChoice:{flex:1,borderWidth:1,borderColor:c.line,borderRadius:12,paddingVertical:12,alignItems:'center',backgroundColor:c.panel},themeActive:{borderColor:c.cyan,backgroundColor:c.soft},themeText:{color:c.muted,fontSize:10,fontWeight:'900'},themeTextActive:{color:c.text},setting:{backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:15,padding:14,marginBottom:9,flexDirection:'row',alignItems:'center',gap:10},settingTitle:{color:c.text,fontWeight:'900',fontSize:13},toggle:{width:46,height:26,borderRadius:13,backgroundColor:c.soft,padding:3},toggleOn:{backgroundColor:c.accent},knob:{width:20,height:20,borderRadius:10,backgroundColor:'#fff'},knobOn:{marginLeft:20,backgroundColor:'#071000'},modalBg:{flex:1,backgroundColor:'rgba(0,0,0,.6)',justifyContent:'flex-end'},modal:{backgroundColor:c.panel,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:30},address:{color:c.muted,fontSize:9,marginTop:5,marginBottom:14},label:{color:c.cyan,fontSize:10,fontWeight:'900',marginBottom:8}})}
