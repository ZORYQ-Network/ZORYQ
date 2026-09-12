import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {getBackendState,signInWithLocalWallet,socialSupabase} from './socialBackend';

const OFFICIAL_HANDLE='@ZORIQNetwork';
const OFFICIAL_PROFILE='https://x.com/ZORIQNetwork';
const FOLLOW_URL='https://x.com/intent/follow?screen_name=ZORIQNetwork';
const POST_TEXT='Estou explorando a ZORIQ Testnet ⚡ @ZORIQNetwork #ZORIQ #testnet';
const POST_URL=`https://x.com/intent/post?text=${encodeURIComponent(POST_TEXT)}`;

type QuestKey='x_follow_zoriq'|'x_post_mention_zoriq';
type Submission={quest_key:QuestKey;x_username:string;proof_url:string|null;xp_reward:number;status:'pending_review'|'approved'|'rejected'|'awarded';review_note:string|null;submitted_at:string;reward_tx_hash:string|null};

const statusCopy=(s?:Submission|null)=>{
 if(!s)return'AINDA NÃO ENVIADA';
 if(s.status==='pending_review')return'PROVA PENDENTE';
 if(s.status==='approved')return'APROVADA · XP A FINALIZAR';
 if(s.status==='awarded')return'XP CONFIRMADO';
 return'REVISÃO NECESSÁRIA';
};

export default function XGrowthQuests(){
 const [username,setUsername]=useState('');
 const [postProof,setPostProof]=useState('');
 const [rows,setRows]=useState<Record<string,Submission>>({});
 const [busy,setBusy]=useState<QuestKey|null>(null);
 const [authenticated,setAuthenticated]=useState(false);

 const refresh=useCallback(async()=>{
  try{
   const state=await getBackendState();
   setAuthenticated(state.authenticated);
   if(!state.authenticated){setRows({});return}
   const {data,error}=await socialSupabase.from('x_quest_submissions').select('quest_key,x_username,proof_url,xp_reward,status,review_note,submitted_at,reward_tx_hash').in('quest_key',['x_follow_zoriq','x_post_mention_zoriq']);
   if(error)throw error;
   const next:Record<string,Submission>={};for(const row of data||[])next[String(row.quest_key)]=row as Submission;setRows(next);
   const first=(data||[])[0] as Submission|undefined;if(first?.x_username&&!username)setUsername(first.x_username);
  }catch(e:any){console.warn('X quests refresh',e?.message||e)}
 },[username]);

 useEffect(()=>{refresh()},[refresh]);

 async function ensureAuth(){
  const state=await getBackendState();
  if(state.authenticated){setAuthenticated(true);return}
  await signInWithLocalWallet();setAuthenticated(true);
 }

 async function submit(quest:QuestKey){
  const clean=username.trim().replace(/^@/,'');
  if(!/^[A-Za-z0-9_]{1,15}$/.test(clean))return Alert.alert('Usuário do X','Informe seu @ do X sem espaços.');
  if(quest==='x_post_mention_zoriq'&&!/^https:\/\/(www\.)?(x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/[0-9]+/i.test(postProof.trim()))return Alert.alert('Link do post','Cole o link do post publicado no X.');
  setBusy(quest);
  try{
   await ensureAuth();
   const {data,error}=await socialSupabase.rpc('submit_x_quest_proof',{p_quest_key:quest,p_x_username:clean,p_proof_url:quest==='x_post_mention_zoriq'?postProof.trim():null});
   if(error)throw error;
   const row=data as Submission;setRows(v=>({...v,[quest]:row}));
   Alert.alert('Prova enviada','A quest ficou PENDENTE. O XP só é liberado depois da validação do X/revisão; abrir ou clicar na missão não concede XP.');
  }catch(e:any){
   const msg=String(e?.message||e);Alert.alert('Quest do X',msg.includes('provider')?'A autenticação Web3/SIWE precisa estar habilitada para enviar a prova.':msg);
  }finally{setBusy(null)}
 }

 return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <Text style={s.eyebrow}>ZORIQ · GROWTH QUESTS</Text>
  <Text style={s.title}>Ganhe XP ajudando a ZORIQ a crescer.</Text>
  <Text style={s.copy}>As duas missões usam o perfil oficial {OFFICIAL_HANDLE}. O clique abre o X, mas não concede XP: a prova fica pendente até validação confiável.</Text>

  <View style={s.identity}>
   <View style={{flex:1}}><Text style={s.identityLabel}>PERFIL OFICIAL NO X</Text><Text style={s.identityValue}>{OFFICIAL_HANDLE}</Text></View>
   <Pressable onPress={()=>Linking.openURL(OFFICIAL_PROFILE)} style={s.ghost}><Text style={s.ghostText}>Abrir ↗</Text></Pressable>
  </View>

  <Text style={s.label}>SEU USUÁRIO DO X</Text>
  <TextInput autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} placeholder="ex.: meu_usuario" placeholderTextColor="#526174" style={s.input}/>

  <QuestCard
   number="01" title="Siga a ZORIQ no X" xp={100}
   description={`Siga ${OFFICIAL_HANDLE}. Depois envie seu usuário para a fila de verificação.`}
   status={statusCopy(rows.x_follow_zoriq)}
   onOpen={()=>Linking.openURL(FOLLOW_URL)} openLabel="Seguir no X ↗"
   onSubmit={()=>submit('x_follow_zoriq')} submitLabel={busy==='x_follow_zoriq'?'Enviando…':'Enviar para verificação'} disabled={Boolean(busy)}
  />

  <View style={s.card}>
   <View style={s.row}><View style={{flex:1}}><Text style={s.step}>02 · X QUEST</Text><Text style={s.cardTitle}>Publique marcando {OFFICIAL_HANDLE}</Text></View><Text style={s.xp}>+250 XP</Text></View>
   <Text style={s.cardCopy}>Faça um post público no X marcando o perfil oficial. O botão prepara um texto com a marcação; você pode editar antes de publicar.</Text>
   <Pressable onPress={()=>Linking.openURL(POST_URL)} style={s.open}><Text style={s.openText}>Criar post no X ↗</Text></Pressable>
   <Text style={s.label}>LINK DO POST PUBLICADO</Text>
   <TextInput autoCapitalize="none" autoCorrect={false} value={postProof} onChangeText={setPostProof} placeholder="https://x.com/seu_usuario/status/…" placeholderTextColor="#526174" style={s.input}/>
   <Pressable disabled={Boolean(busy)} onPress={()=>submit('x_post_mention_zoriq')} style={[s.submit,busy&&s.disabled]}><Text style={s.submitText}>{busy==='x_post_mention_zoriq'?'Enviando…':'Enviar prova para verificação'}</Text></Pressable>
   <Text style={s.status}>{statusCopy(rows.x_post_mention_zoriq)}</Text>
  </View>

  <View style={s.security}><Text style={s.securityTitle}>XP protegido contra farm falso</Text><Text style={s.securityText}>• A sessão é autenticada pela wallet via SIWE.\n• O app não pode aprovar a própria prova.\n• O valor é fixado pelo backend: 100 XP / 250 XP.\n• Provas entram como pending_review.\n• Aprovação/finalização depende de verificação do X ou revisão confiável.\n• Nunca informe seed phrase ou private key.</Text></View>
  <Text style={s.session}>{authenticated?'● sessão Web3 ativa':'○ a wallet será autenticada ao enviar a primeira prova'}</Text>
 </ScrollView>
}

function QuestCard({number,title,xp,description,status,onOpen,openLabel,onSubmit,submitLabel,disabled}:{number:string;title:string;xp:number;description:string;status:string;onOpen:()=>void;openLabel:string;onSubmit:()=>void;submitLabel:string;disabled:boolean}){
 return <View style={s.card}><View style={s.row}><View style={{flex:1}}><Text style={s.step}>{number} · X QUEST</Text><Text style={s.cardTitle}>{title}</Text></View><Text style={s.xp}>+{xp} XP</Text></View><Text style={s.cardCopy}>{description}</Text><View style={s.actions}><Pressable onPress={onOpen} style={s.open}><Text style={s.openText}>{openLabel}</Text></Pressable><Pressable disabled={disabled} onPress={onSubmit} style={[s.submit,disabled&&s.disabled]}><Text style={s.submitText}>{submitLabel}</Text></Pressable></View><Text style={s.status}>{status}</Text></View>
}

const s=StyleSheet.create({page:{flex:1,backgroundColor:'#07080d'},content:{padding:18,paddingBottom:120},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.8,color:'#66e6c4'},title:{color:'#fff',fontSize:29,fontWeight:'900',lineHeight:33,marginTop:9},copy:{color:'#91a0b5',fontSize:13,lineHeight:20,marginTop:9,marginBottom:15},identity:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#24364b',backgroundColor:'#0b121b',padding:14,borderRadius:16},identityLabel:{color:'#63758e',fontSize:9,fontWeight:'900',letterSpacing:1.1},identityValue:{color:'#fff',fontSize:17,fontWeight:'900',marginTop:4},ghost:{borderWidth:1,borderColor:'#2a3c54',borderRadius:10,paddingVertical:8,paddingHorizontal:11},ghostText:{color:'#9fc5f5',fontSize:10,fontWeight:'900'},label:{color:'#6f819b',fontSize:9,fontWeight:'900',letterSpacing:1.1,marginTop:13,marginBottom:6},input:{borderWidth:1,borderColor:'#243247',backgroundColor:'#090e15',borderRadius:12,paddingHorizontal:12,paddingVertical:11,color:'#fff',fontSize:12},card:{borderWidth:1,borderColor:'#1d2a3b',backgroundColor:'#0b1017',borderRadius:18,padding:15,marginTop:13},row:{flexDirection:'row',alignItems:'flex-start',gap:10},step:{color:'#65e6c4',fontSize:9,fontWeight:'900',letterSpacing:1.2},cardTitle:{color:'#fff',fontSize:18,fontWeight:'900',marginTop:4},xp:{color:'#baff45',fontSize:15,fontWeight:'900'},cardCopy:{color:'#8d9cb0',fontSize:12,lineHeight:18,marginTop:8},actions:{flexDirection:'row',gap:8,marginTop:12},open:{flex:1,borderWidth:1,borderColor:'#2f4764',backgroundColor:'#101a27',borderRadius:12,padding:11,alignItems:'center',marginTop:11},openText:{color:'#8fc8ff',fontSize:10,fontWeight:'900'},submit:{flex:1,backgroundColor:'#baff45',borderRadius:12,padding:11,alignItems:'center',marginTop:11},submitText:{color:'#071009',fontSize:10,fontWeight:'900'},disabled:{opacity:.45},status:{marginTop:10,color:'#f6c453',fontSize:9,fontWeight:'900',letterSpacing:.8},security:{marginTop:16,borderWidth:1,borderColor:'#1e382f',backgroundColor:'#0b1713',borderRadius:17,padding:15},securityTitle:{color:'#72edbb',fontSize:14,fontWeight:'900'},securityText:{color:'#91b3a7',fontSize:11,lineHeight:19,marginTop:7},session:{color:'#66778e',fontSize:9,textAlign:'center',marginTop:12}});
