import 'react-native-get-random-values';
import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Pressable,RefreshControl,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {Wallet,getAddress} from 'ethers';

const SOCIAL_BASE=String(process.env.EXPO_PUBLIC_ZORYQ_SOCIAL||'https://zoryq-wallet-swap-production.up.railway.app/social').replace(/\/$/,'');
const PK_KEY='zoryq.wallet.privateKey.v3';
const SESSION_KEY='zoryq.social.session.v1';

type Profile={address:string;handle:string;displayName:string;bio:string;followers:number;following:number;posts:number;followedByViewer?:boolean;reputation?:{score:number;version:string}};
type Post={id:string;author:string;content:string;kind:string;createdAt:number;likeCount:number;liked:boolean;authorProfile:Profile};
type FeedScope='for-you'|'following';

function short(a:string){return a?`${a.slice(0,6)}…${a.slice(-4)}`:'—'}
function err(e:any){return e?.message||'Falha inesperada'}
function strongOptions(){return {requireAuthentication:SecureStore.canUseBiometricAuthentication(),authenticationPrompt:'Desbloqueie a ZORYQ para acessar seu perfil social',keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY} as const}
async function api(path:string,init:RequestInit={},token=''){
 const headers:any={'accept':'application/json',...(init.body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})};
 const r=await fetch(`${SOCIAL_BASE}${path}`,{...init,headers:{...headers,...(init.headers||{})}});const j=await r.json().catch(()=>({ok:false,error:'INVALID_RESPONSE'}));if(!r.ok||j?.ok===false)throw Error(j?.error||`HTTP_${r.status}`);return j;
}

export default function SocialApp(){
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [token,setToken]=useState('');
 const [profile,setProfile]=useState<Profile|null>(null);
 const [feed,setFeed]=useState<Post[]>([]);
 const [scope,setScope]=useState<FeedScope>('for-you');
 const [content,setContent]=useState('');
 const [busy,setBusy]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 const [screen,setScreen]=useState<'feed'|'profile'>('feed');
 const [edit,setEdit]=useState(false);
 const [handle,setHandle]=useState('');
 const [displayName,setDisplayName]=useState('');
 const [bio,setBio]=useState('');
 const signedIn=Boolean(wallet&&token&&profile);
 const own=useMemo(()=>wallet?.address.toLowerCase()||'',[wallet]);

 useEffect(()=>{void bootstrap()},[]);
 useEffect(()=>{if(signedIn)void loadFeed()},[scope,signedIn]);
 async function bootstrap(){
  const saved=await AsyncStorage.getItem(SESSION_KEY)||'';setToken(saved);
  if(saved){try{const pk=await SecureStore.getItemAsync(PK_KEY,strongOptions());if(pk){const w=new Wallet(pk);setWallet(w);const p=await api(`/v1/profile/${w.address}`,{},saved);setProfile(p.profile);syncEdit(p.profile)}}catch{await AsyncStorage.removeItem(SESSION_KEY);setToken('')}}
  await loadPublicFeed(saved);
 }
 function syncEdit(p:Profile){setHandle(p.handle||'');setDisplayName(p.displayName||'');setBio(p.bio||'')}
 async function signIn(){setBusy(true);try{
  const pk=await SecureStore.getItemAsync(PK_KEY,strongOptions());if(!pk)throw Error('Crie ou importe uma wallet primeiro na aba Wallet.');
  const w=new Wallet(pk);const c=await api(`/v1/auth/challenge?address=${encodeURIComponent(w.address)}`);const signature=await w.signMessage(c.message);const v=await api('/v1/auth/verify',{method:'POST',body:JSON.stringify({address:w.address,signature})});
  await AsyncStorage.setItem(SESSION_KEY,v.token);setWallet(w);setToken(v.token);setProfile(v.profile);syncEdit(v.profile);await loadFeedWith(v.token,scope);
 }catch(e){Alert.alert('ZORYQ Social',err(e))}finally{setBusy(false)}}
 async function logout(){await AsyncStorage.removeItem(SESSION_KEY);setToken('');setWallet(null);setProfile(null);setScreen('feed');await loadPublicFeed('')}
 async function loadPublicFeed(t=token){try{const j=await api(`/v1/feed?scope=for-you`,{},t);setFeed(j.items||[])}catch{}}
 async function loadFeedWith(t:string,s:FeedScope){const j=await api(`/v1/feed?scope=${s}`,{},t);setFeed(j.items||[])}
 async function loadFeed(){try{setRefreshing(true);await loadFeedWith(token,scope);if(wallet&&token){const p=await api(`/v1/profile/${wallet.address}`,{},token);setProfile(p.profile)}}catch(e){Alert.alert('Feed',err(e))}finally{setRefreshing(false)}}
 async function publish(){if(!signedIn||!content.trim())return;setBusy(true);try{await api('/v1/posts',{method:'POST',body:JSON.stringify({content:content.trim(),kind:'text'})},token);setContent('');await loadFeed()}catch(e){Alert.alert('Publicar',err(e))}finally{setBusy(false)}}
 async function toggleLike(post:Post){if(!signedIn)return Alert.alert('Entre com a Wallet','Assine a mensagem de login para curtir sem criar senha.');try{const j=await api(`/v1/posts/${post.id}/like`,{method:'POST'},token);setFeed(x=>x.map(p=>p.id===post.id?j.post:p));}catch(e){Alert.alert('Curtir',err(e))}}
 async function toggleFollow(p:Profile){if(!signedIn)return;try{await api(`/v1/follow/${p.address}`,{method:'POST'},token);await loadFeed()}catch(e){Alert.alert('Seguir',err(e))}}
 async function saveProfile(){if(!signedIn)return;setBusy(true);try{const j=await api('/v1/profile',{method:'PUT',body:JSON.stringify({handle,displayName,bio})},token);setProfile(j.profile);syncEdit(j.profile);setEdit(false);await loadFeed()}catch(e){Alert.alert('Perfil',err(e))}finally{setBusy(false)}}

 return <SafeAreaView style={s.root}><View style={s.top}><View><Text style={s.brand}>ZORYQ</Text><Text style={s.tag}>Social + Wallet + Web3</Text></View>{signedIn?<Pressable onPress={()=>setScreen(screen==='feed'?'profile':'feed')}><Text style={s.link}>{screen==='feed'?`@${profile?.handle}`:'Feed'}</Text></Pressable>:<Pressable onPress={()=>void signIn()} disabled={busy}><Text style={s.link}>{busy?'Assinando…':'Entrar com Wallet'}</Text></Pressable>}</View>
 {screen==='feed'?<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void loadFeed()} tintColor="#8f72ff"/>} contentContainerStyle={s.scroll}>
  <View style={s.hero}><Text style={s.heroTitle}>Seu Web3 acontece aqui.</Text><Text style={s.muted}>Perfis ligados à carteira, conteúdo e ações Web3 em uma experiência única.</Text></View>
  <View style={s.segment}><Pressable style={[s.seg,scope==='for-you'&&s.segOn]} onPress={()=>setScope('for-you')}><Text style={s.segText}>Para você</Text></Pressable><Pressable style={[s.seg,scope==='following'&&s.segOn]} onPress={()=>setScope('following')}><Text style={s.segText}>Seguindo</Text></Pressable></View>
  {signedIn?<View style={s.composer}><Text style={s.label}>Publicar como @{profile?.handle}</Text><TextInput style={s.input} multiline maxLength={500} value={content} onChangeText={setContent} placeholder="O que está acontecendo no Web3?" placeholderTextColor="#626a7e"/><View style={s.rowBetween}><Text style={s.counter}>{content.length}/500</Text><Pressable style={[s.primary,(!content.trim()||busy)&&s.disabled]} onPress={()=>void publish()} disabled={!content.trim()||busy}><Text style={s.primaryText}>Publicar</Text></Pressable></View></View>:<View style={s.card}><Text style={s.cardTitle}>Perfil controlado pela sua wallet</Text><Text style={s.muted}>Sem senha social. Você assina uma mensagem local que não movimenta fundos.</Text><Pressable style={s.primaryWide} onPress={()=>void signIn()}><Text style={s.primaryText}>Entrar com Wallet</Text></Pressable></View>}
  {feed.length===0?<View style={s.empty}><Text style={s.cardTitle}>O feed está começando.</Text><Text style={s.muted}>Seja uma das primeiras pessoas a publicar na ZORYQ.</Text></View>:feed.map(p=><View key={p.id} style={s.post}>
   <View style={s.rowBetween}><View><Text style={s.author}>{p.authorProfile?.displayName||'ZORYQ User'} <Text style={s.handle}>@{p.authorProfile?.handle}</Text></Text><Text style={s.meta}>{short(p.author)} · {new Date(p.createdAt).toLocaleString()}</Text></View>{signedIn&&p.author.toLowerCase()!==own?<Pressable onPress={()=>void toggleFollow(p.authorProfile)}><Text style={s.follow}>{p.authorProfile?.followedByViewer?'Seguindo':'Seguir'}</Text></Pressable>:null}</View>
   <Text style={s.content}>{p.content}</Text><View style={s.actions}><Pressable onPress={()=>void toggleLike(p)}><Text style={[s.action,p.liked&&s.liked]}>{p.liked?'♥':'♡'} {p.likeCount||0}</Text></Pressable><Text style={s.action}>↗ Compartilhar</Text><Text style={s.kind}>{p.kind==='text'?'POST':'WEB3'}</Text></View>
  </View>)}
 </ScrollView>:<ScrollView contentContainerStyle={s.scroll}>
  {profile?<><View style={s.profileHero}><View style={s.avatar}><Text style={s.avatarText}>{(profile.displayName||'Z').slice(0,1).toUpperCase()}</Text></View><Text style={s.profileName}>{profile.displayName}</Text><Text style={s.handleBig}>@{profile.handle}</Text><Text style={s.address}>{short(profile.address)}</Text><Text style={s.bio}>{profile.bio||'Construa sua identidade Web3 na ZORYQ.'}</Text><View style={s.stats}><Stat n={profile.followers} label="Seguidores"/><Stat n={profile.following} label="Seguindo"/><Stat n={profile.posts} label="Posts"/><Stat n={profile.reputation?.score||0} label="Reputação"/></View></View>
  {edit?<View style={s.card}><Text style={s.label}>Nome</Text><TextInput style={s.inputOne} value={displayName} onChangeText={setDisplayName} maxLength={48}/><Text style={s.label}>@handle</Text><TextInput style={s.inputOne} autoCapitalize="none" value={handle} onChangeText={setHandle} maxLength={24}/><Text style={s.label}>Bio</Text><TextInput style={s.input} multiline value={bio} onChangeText={setBio} maxLength={180}/><Pressable style={s.primaryWide} onPress={()=>void saveProfile()} disabled={busy}><Text style={s.primaryText}>Salvar perfil</Text></Pressable></View>:<Pressable style={s.primaryWide} onPress={()=>setEdit(true)}><Text style={s.primaryText}>Editar perfil</Text></Pressable>}
  <Pressable style={s.logout} onPress={()=>void logout()}><Text style={s.logoutText}>Sair do Social neste aparelho</Text></Pressable></>:null}
 </ScrollView>}
 </SafeAreaView>
}
function Stat({n,label}:{n:number;label:string}){return <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{label}</Text></View>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},top:{paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderColor:'#171c29',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{color:'#fff',fontSize:22,fontWeight:'900',letterSpacing:2},tag:{color:'#687188',fontSize:11},link:{color:'#9c84ff',fontWeight:'900'},scroll:{padding:14,paddingBottom:60,gap:12},hero:{paddingVertical:8},heroTitle:{color:'#fff',fontSize:28,fontWeight:'900'},muted:{color:'#8e97aa',lineHeight:20},segment:{flexDirection:'row',backgroundColor:'#0d111a',borderRadius:14,padding:4},seg:{flex:1,padding:10,alignItems:'center',borderRadius:11},segOn:{backgroundColor:'#272044'},segText:{color:'#c8ccda',fontWeight:'800'},composer:{backgroundColor:'#0c1018',borderWidth:1,borderColor:'#1d2534',borderRadius:18,padding:14,gap:9},label:{color:'#aeb6c8',fontWeight:'800',fontSize:12},input:{minHeight:90,color:'#fff',backgroundColor:'#111722',borderRadius:12,padding:12,textAlignVertical:'top'},inputOne:{color:'#fff',backgroundColor:'#111722',borderRadius:12,padding:12},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},counter:{color:'#5f687b'},primary:{backgroundColor:'#6c4df6',paddingHorizontal:18,paddingVertical:10,borderRadius:12},primaryWide:{backgroundColor:'#6c4df6',padding:14,borderRadius:14,alignItems:'center',marginTop:8},primaryText:{color:'#fff',fontWeight:'900'},disabled:{opacity:.4},card:{backgroundColor:'#0c1018',borderWidth:1,borderColor:'#1d2534',borderRadius:18,padding:14,gap:10},cardTitle:{color:'#fff',fontWeight:'900',fontSize:17},empty:{padding:24,alignItems:'center',gap:6},post:{backgroundColor:'#0a0e15',borderWidth:1,borderColor:'#171e2b',borderRadius:18,padding:14,gap:12},author:{color:'#f4f6fb',fontWeight:'900'},handle:{color:'#777f94',fontWeight:'600'},meta:{color:'#596276',fontSize:11,marginTop:3},follow:{color:'#9c84ff',fontWeight:'900'},content:{color:'#e7eaf2',fontSize:16,lineHeight:23},actions:{flexDirection:'row',alignItems:'center',gap:20},action:{color:'#8b94a8',fontWeight:'800'},liked:{color:'#ff5684'},kind:{marginLeft:'auto',color:'#6d7790',fontSize:10,fontWeight:'900'},profileHero:{alignItems:'center',paddingVertical:18,gap:5},avatar:{width:86,height:86,borderRadius:43,backgroundColor:'#6c4df6',alignItems:'center',justifyContent:'center',marginBottom:6},avatarText:{color:'#fff',fontSize:34,fontWeight:'900'},profileName:{color:'#fff',fontSize:25,fontWeight:'900'},handleBig:{color:'#9c84ff',fontWeight:'800'},address:{color:'#626b7d',fontFamily:'monospace'},bio:{color:'#c8ccda',textAlign:'center',marginTop:8,lineHeight:20},stats:{flexDirection:'row',marginTop:16,backgroundColor:'#0d111a',borderRadius:16,padding:10},stat:{flex:1,alignItems:'center'},statN:{color:'#fff',fontWeight:'900',fontSize:17},statL:{color:'#687188',fontSize:10,marginTop:3},logout:{padding:14,alignItems:'center'},logoutText:{color:'#ff708f',fontWeight:'800'}});
