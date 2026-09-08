import 'react-native-get-random-values';
import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Linking,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import {Contract,HDNodeWallet,JsonRpcProvider,Wallet,formatEther,formatUnits,isAddress,parseEther,parseUnits} from 'ethers';
import {StatusBar} from 'expo-status-bar';

const BASE=process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const RPC=process.env.EXPO_PUBLIC_ZORYQ_RPC||`${BASE}/rpc`;
const EXPLORER=process.env.EXPO_PUBLIC_ZORYQ_EXPLORER||'https://zoryq-testnet.vercel.app/explorer.html';
const REWARD_REGISTRY=process.env.EXPO_PUBLIC_REWARD_REGISTRY||'0xAB1Dd21c529b182191ED84f00A4dF1917652CB10';
const QUEST_REGISTRY=process.env.EXPO_PUBLIC_QUEST_REGISTRY||'0x85747F9BdCd758fcfB562c929236CCA6eEB025a9';
const STAKE_CONTRACT=process.env.EXPO_PUBLIC_STAKE_CONTRACT||'0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1';
const TEST_TOKEN=process.env.EXPO_PUBLIC_TEST_TOKEN||'0xd2121E96C6af936c0496fDB499c1D0613d26c2B9';
const SWAP_CONTRACT=process.env.EXPO_PUBLIC_SWAP_CONTRACT||'0x8205F34B803eDd79DDCA414F00e12eCdDEdDacbE';
const CHAIN_ID=5919065;
const KEY='zoryq.wallet.privateKey';
const LAST_TX_KEY='zoryq.wallet.lastTxHash';
const ZERO='0x0000000000000000000000000000000000000000';
const REWARD_ABI=['function scoreOf(address) view returns (uint256 total,uint256 mobile,uint256 contributor,uint256 validator,uint256 claimed,uint256 claimablePoints)'];
const QUEST_ABI=['function nextQuestId() view returns(uint256)','function quests(uint256) view returns(uint256 id,string title,string metadataURI,uint256 points,uint64 startAt,uint64 endAt,bool active)'];
const STAKE_ABI=['function staked(address) view returns(uint256)','function position(address) view returns(uint256 amount,uint64 since,uint256 ageSeconds)','function stake() payable','function unstake(uint256)'];
const TOKEN_ABI=['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function symbol() view returns(string)'];
const SWAP_ABI=['function tokensPerZQ() view returns(uint256)','function active() view returns(bool)','function swapZQForToken(uint256 minOut) payable returns(uint256)','function swapTokenForZQ(uint256 amountIn,uint256 minOut) returns(uint256)'];

type AppWallet=Wallet|HDNodeWallet;
type Tab='home'|'send'|'stake'|'swap'|'quests'|'rank'|'activity'|'settings';
type Quest={id:string;title:string;description:string;points:number;status:'active'|'upcoming'|'ended'|'paused';type:string};
type Score={total:number;mobile:number;contributor:number;validator:number;claimable:number};
type SwapDirection='zq-token'|'token-zq';
type LastTx={hash:string;kind:string;status:'pending'|'confirmed'|'failed'};
const fallbackQuests:Quest[]=[
 {id:'first-tx',title:'Primeira transação',description:'Envie uma transação na ZORYQ Testnet.',points:100,status:'active',type:'onchain_tx'},
 {id:'faucet',title:'Pegue ZQ no Faucet',description:'Faça um claim de ZQ Testnet.',points:50,status:'active',type:'faucet_claim'},
 {id:'swap',title:'Primeiro swap',description:'Faça um swap real de Testnet ZQ ↔ zUSD.',points:250,status:'active',type:'swap_verified'},
 {id:'stake',title:'Primeiro stake',description:'Coloque ZQ Testnet em stake.',points:300,status:'active',type:'stake_verified'}
];
function level(p:number){if(p>=100000)return'Genesis';if(p>=50000)return'Architect';if(p>=20000)return'Pioneer III';if(p>=10000)return'Pioneer II';if(p>=5000)return'Pioneer I';if(p>=1000)return'Explorer';return'Initiate'}
function questStatus(active:boolean,startAt:number,endAt:number):Quest['status']{const now=Math.floor(Date.now()/1000);if(!active)return'paused';if(startAt&&now<startAt)return'upcoming';if(endAt&&now>endAt)return'ended';return'active'}

export default function App(){
 const provider=useMemo(()=>new JsonRpcProvider(RPC,CHAIN_ID,{staticNetwork:true}),[]);
 const [wallet,setWallet]=useState<AppWallet|null>(null);
 const [balance,setBalance]=useState('0.0000');
 const [block,setBlock]=useState<number|null>(null);
 const [tab,setTab]=useState<Tab>('home');
 const [to,setTo]=useState('');
 const [amount,setAmount]=useState('');
 const [stakeAmount,setStakeAmount]=useState('');
 const [busy,setBusy]=useState(false);
 const [score,setScore]=useState<Score>({total:0,mobile:0,contributor:0,validator:0,claimable:0});
 const [quests,setQuests]=useState<Quest[]>(fallbackQuests);
 const [stakedZq,setStakedZq]=useState('0.0000');
 const [stakeAge,setStakeAge]=useState(0);
 const [testTokenBalance,setTestTokenBalance]=useState('0.0000');
 const [testTokenSymbol,setTestTokenSymbol]=useState('zUSD');
 const [swapQuote,setSwapQuote]=useState('0');
 const [swapActive,setSwapActive]=useState(false);
 const [swapDirection,setSwapDirection]=useState<SwapDirection>('zq-token');
 const [swapAmount,setSwapAmount]=useState('');
 const [lastTx,setLastTx]=useState<LastTx|null>(null);

 useEffect(()=>{(async()=>{const [pk,lastHash]=await Promise.all([SecureStore.getItemAsync(KEY),SecureStore.getItemAsync(LAST_TX_KEY)]);if(pk)setWallet(new Wallet(pk,provider));if(lastHash)setLastTx({hash:lastHash,kind:'Última transação',status:'confirmed'})})()},[]);
 useEffect(()=>{if(!wallet)return;refresh();const i=setInterval(refresh,10000);return()=>clearInterval(i)},[wallet]);

 function explorerTx(hash:string){return `${EXPLORER}?q=${encodeURIComponent(hash)}`}
 async function showConfirmed(hash:string,kind:string){
  setLastTx({hash,kind,status:'confirmed'});
  await SecureStore.setItemAsync(LAST_TX_KEY,hash);
  Alert.alert(`${kind} confirmada`,`A transação foi incluída na ZORYQ Testnet.\n\n${hash}`,[
   {text:'Copiar hash',onPress:()=>Clipboard.setStringAsync(hash)},
   {text:'Abrir Explorer',onPress:()=>Linking.openURL(explorerTx(hash))},
   {text:'OK',style:'cancel'}
  ]);
 }
 async function waitTx(hash:string,kind:string){
  setLastTx({hash,kind,status:'pending'});
  const receipt=await provider.waitForTransaction(hash,1,120000);
  if(!receipt||receipt.status!==1){setLastTx({hash,kind,status:'failed'});throw new Error('A transação não foi confirmada com sucesso.');}
  await showConfirmed(hash,kind);
 }

 async function refresh(){
  if(!wallet)return;
  try{
   const network=await provider.getNetwork();
   if(Number(network.chainId)!==CHAIN_ID)throw new Error('Chain ID incorreto');
   const [bal,bn]=await Promise.all([provider.getBalance(wallet.address),provider.getBlockNumber()]);
   setBalance(Number(formatEther(bal)).toFixed(4));setBlock(bn);
   if(REWARD_REGISTRY!==ZERO){const x=await new Contract(REWARD_REGISTRY,REWARD_ABI,provider).scoreOf(wallet.address);setScore({total:Number(x.total),mobile:Number(x.mobile),contributor:Number(x.contributor),validator:Number(x.validator),claimable:Number(x.claimablePoints)})}
   if(STAKE_CONTRACT!==ZERO){const p=await new Contract(STAKE_CONTRACT,STAKE_ABI,provider).position(wallet.address);setStakedZq(Number(formatEther(p.amount)).toFixed(4));setStakeAge(Number(p.ageSeconds))}
   if(TEST_TOKEN!==ZERO){const token=new Contract(TEST_TOKEN,TOKEN_ABI,provider);const [tb,sym]=await Promise.all([token.balanceOf(wallet.address),token.symbol()]);setTestTokenBalance(Number(formatUnits(tb,18)).toFixed(4));setTestTokenSymbol(String(sym))}
   if(SWAP_CONTRACT!==ZERO){const swap=new Contract(SWAP_CONTRACT,SWAP_ABI,provider);const [q,a]=await Promise.all([swap.tokensPerZQ(),swap.active()]);setSwapQuote(Number(formatUnits(q,18)).toLocaleString('pt-BR',{maximumFractionDigits:4}));setSwapActive(Boolean(a))}
   if(QUEST_REGISTRY!==ZERO)await loadQuests();
  }catch{setBlock(null)}
 }
 async function loadQuests(){try{const c=new Contract(QUEST_REGISTRY,QUEST_ABI,provider);const next=Number(await c.nextQuestId());const ids=Array.from({length:Math.max(0,Math.min(next-1,50))},(_,i)=>i+1);const rows=await Promise.all(ids.map(async id=>{const q=await c.quests(id);return {id:String(id),title:String(q.title),description:String(q.metadataURI||'Quest registrada on-chain'),points:Number(q.points),status:questStatus(Boolean(q.active),Number(q.startAt),Number(q.endAt)),type:'quest_registry'} as Quest}));setQuests(rows.length?rows:fallbackQuests)}catch{setQuests(fallbackQuests)}}
 async function createWallet(){const w=Wallet.createRandom().connect(provider);await SecureStore.setItemAsync(KEY,w.privateKey);setWallet(w);Alert.alert('Wallet criada','A chave foi armazenada no SecureStore deste aparelho. Use somente ZQ Testnet, sem valor monetário.');}
 async function importWallet(){Alert.alert('Importação segura','A importação de seed/private key permanece bloqueada nesta build. A ZORYQ nunca solicita nem envia chaves ao servidor.');}
 async function faucet(){if(!wallet)return;setBusy(true);try{const r=await fetch(`${BASE}/faucet`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:wallet.address})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Faucet indisponível');if(j.txHash){setLastTx({hash:String(j.txHash),kind:'Faucet',status:'pending'});try{await waitTx(String(j.txHash),'Faucet')}catch{Alert.alert('Faucet enviado',`Claim processado. Confira no Explorer: ${j.txHash}`)}}else Alert.alert('Faucet',`Claim enviado: ${j.amount||100} ZQ Testnet`);await refresh()}catch(e:any){Alert.alert('Faucet',e.message)}finally{setBusy(false)}}
 async function send(){if(!wallet||!isAddress(to)||!amount||Number(amount)<=0)return Alert.alert('Dados inválidos','Confira endereço e valor.');setBusy(true);try{const currentBalance=await provider.getBalance(wallet.address);const value=parseEther(amount);if(currentBalance<=value)return Alert.alert('Saldo insuficiente','Reserve uma pequena quantidade de ZQ Testnet para gas.');const tx=await wallet.sendTransaction({to,value});setTo('');setAmount('');await waitTx(tx.hash,'Transferência ZQ');await refresh();setTab('activity')}catch(e:any){Alert.alert('Falha',e.shortMessage||e.message)}finally{setBusy(false)}}
 async function stake(){if(!wallet||STAKE_CONTRACT===ZERO)return;if(!stakeAmount||Number(stakeAmount)<=0)return Alert.alert('Valor inválido','Informe a quantidade de ZQ Testnet.');setBusy(true);try{const c=new Contract(STAKE_CONTRACT,STAKE_ABI,wallet);const tx=await c.stake({value:parseEther(stakeAmount)});setStakeAmount('');await waitTx(tx.hash,'Stake');await refresh();setTab('activity')}catch(e:any){Alert.alert('Falha no stake',e.shortMessage||e.message)}finally{setBusy(false)}}
 async function unstakeAll(){if(!wallet||STAKE_CONTRACT===ZERO)return;if(Number(stakedZq)<=0)return Alert.alert('Sem stake','Não há ZQ em stake nesta wallet.');setBusy(true);try{const c=new Contract(STAKE_CONTRACT,STAKE_ABI,wallet);const raw=await c.staked(wallet.address);const tx=await c.unstake(raw);await waitTx(tx.hash,'Unstake');await refresh();setTab('activity')}catch(e:any){Alert.alert('Falha no unstake',e.shortMessage||e.message)}finally{setBusy(false)}}
 async function swap(){if(!wallet||SWAP_CONTRACT===ZERO||TEST_TOKEN===ZERO)return;if(!swapActive)return Alert.alert('Swap pausado','O Swap Lab está pausado.');if(!swapAmount||Number(swapAmount)<=0)return Alert.alert('Valor inválido','Informe uma quantidade maior que zero.');setBusy(true);try{const swap=new Contract(SWAP_CONTRACT,SWAP_ABI,wallet);if(swapDirection==='zq-token'){const tx=await swap.swapZQForToken(0,{value:parseEther(swapAmount)});await waitTx(tx.hash,`Swap ZQ → ${testTokenSymbol}`)}else{const raw=parseUnits(swapAmount,18);const token=new Contract(TEST_TOKEN,TOKEN_ABI,wallet);const allowance=await token.allowance(wallet.address,SWAP_CONTRACT);if(allowance<raw){const approval=await token.approve(SWAP_CONTRACT,raw);await waitTx(approval.hash,`Approve ${testTokenSymbol}`)}const tx=await swap.swapTokenForZQ(raw,0);await waitTx(tx.hash,`Swap ${testTokenSymbol} → ZQ`)}setSwapAmount('');await refresh();setTab('activity')}catch(e:any){Alert.alert('Falha no swap',e.shortMessage||e.message)}finally{setBusy(false)}}

 if(!wallet)return <SafeAreaView style={s.root}><StatusBar style="light"/><View style={s.onboard}><Text style={s.brand}>ZORYQ</Text><Text style={s.h1}>Sua entrada para a ZORYQ Testnet.</Text><Text style={s.muted}>Crie uma wallet local, receba ZQ Testnet e faça uma transação verificável no Explorer.</Text><Pressable style={s.primary} onPress={createWallet}><Text style={s.primaryText}>Criar nova wallet</Text></Pressable><Pressable style={s.secondary} onPress={importWallet}><Text style={s.secondaryText}>Importar wallet</Text></Pressable><Text style={s.note}>Chain ID {CHAIN_ID} • Self-custody • ZQ Testnet não possui valor financeiro nem garante futuro token/airdrop.</Text></View></SafeAreaView>;
 return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView contentContainerStyle={s.page}><View style={s.top}><Text style={s.brand}>ZORYQ</Text><Text style={block===null?s.netOff:s.net}>{block===null?'● RPC offline':'● Testnet online'}</Text></View>
 {tab==='home'&&<><Text style={s.label}>SALDO</Text><Text style={s.balance}>{balance} <Text style={s.zq}>ZQ</Text></Text><Pressable onPress={()=>Clipboard.setStringAsync(wallet.address)}><Text style={s.address}>{wallet.address}</Text></Pressable><View style={s.row}><Pressable style={s.primarySmall} onPress={()=>setTab('send')}><Text style={s.primaryText}>Enviar ZQ</Text></Pressable><Pressable style={s.secondarySmall} disabled={busy} onPress={faucet}><Text style={s.secondaryText}>{busy?'Processando...':'Faucet 100 ZQ'}</Text></Pressable></View><View style={[s.row,{marginTop:8}]}><Pressable style={s.secondarySmall} onPress={()=>setTab('stake')}><Text style={s.secondaryText}>Stake</Text></Pressable><Pressable style={s.secondarySmall} onPress={()=>setTab('swap')}><Text style={s.secondaryText}>Swap Lab</Text></Pressable></View><View style={s.cards}><Card title="ZORYQ Score" value={score.total.toLocaleString()} sub={`${level(score.total)} • finalizado on-chain`}/><Card title="ZQ em stake" value={`${stakedZq} ZQ`} sub={`${Math.floor(stakeAge/3600)}h na posição atual`}/><Card title={testTokenSymbol} value={testTokenBalance} sub={`1 ZQ ≈ ${swapQuote} ${testTokenSymbol}`}/><Card title="Último bloco" value={block?.toString()||'—'} sub={`Chain ID ${CHAIN_ID}`}/></View>{lastTx&&<Pressable style={s.txCard} onPress={()=>Linking.openURL(explorerTx(lastTx.hash))}><Text style={s.label}>ÚLTIMA TRANSAÇÃO</Text><Text style={s.txKind}>{lastTx.kind} • {lastTx.status.toUpperCase()}</Text><Text style={s.hash} numberOfLines={1}>{lastTx.hash}</Text><Text style={s.link}>Ver no Explorer →</Text></Pressable>}</>}
 {tab==='send'&&<><Back onPress={()=>setTab('home')}/><Text style={s.h2}>Enviar ZQ</Text><Text style={s.muted}>A transação será assinada localmente pela wallet deste aparelho e enviada ao RPC ZORYQ. Após confirmação, o hash poderá ser aberto diretamente no Explorer.</Text><TextInput style={s.input} autoCapitalize="none" placeholder="0x... destino" placeholderTextColor="#5d6473" value={to} onChangeText={setTo}/><TextInput style={s.input} placeholder="Quantidade ZQ" placeholderTextColor="#5d6473" keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/><Pressable style={s.primary} disabled={busy||block===null} onPress={send}><Text style={s.primaryText}>{busy?'Aguardando confirmação...':'Assinar e enviar'}</Text></Pressable></>}
 {tab==='stake'&&<><Back onPress={()=>setTab('home')}/><Text style={s.h2}>Stake de ZQ Testnet</Text><Text style={s.muted}>O vault bloqueia e devolve ZQ Testnet. Não cria rendimento financeiro.</Text><Card title="Posição atual" value={`${stakedZq} ZQ`} sub={`${Math.floor(stakeAge/3600)}h em stake`}/><TextInput style={s.input} placeholder="Quantidade ZQ" placeholderTextColor="#5d6473" keyboardType="decimal-pad" value={stakeAmount} onChangeText={setStakeAmount}/><Pressable style={s.primary} disabled={busy||block===null} onPress={stake}><Text style={s.primaryText}>Colocar em stake</Text></Pressable><Pressable style={s.secondary} disabled={busy||block===null} onPress={unstakeAll}><Text style={s.secondaryText}>Retirar todo stake</Text></Pressable></>}
 {tab==='swap'&&<><Back onPress={()=>setTab('home')}/><Text style={s.h2}>ZORYQ Swap Lab</Text><Text style={s.muted}>Swap real de Testnet entre ZQ e {testTokenSymbol}; transações confirmadas são verificáveis no Explorer.</Text><View style={s.segment}><Pressable style={[s.segmentBtn,swapDirection==='zq-token'&&s.segmentActive]} onPress={()=>setSwapDirection('zq-token')}><Text style={s.segmentText}>ZQ → {testTokenSymbol}</Text></Pressable><Pressable style={[s.segmentBtn,swapDirection==='token-zq'&&s.segmentActive]} onPress={()=>setSwapDirection('token-zq')}><Text style={s.segmentText}>{testTokenSymbol} → ZQ</Text></Pressable></View><Card title="Saldo ZQ" value={`${balance} ZQ`} sub={`Saldo ${testTokenSymbol}: ${testTokenBalance}`}/><Card title="Cotação Testnet" value={swapQuote==='0'?'—':`1 ZQ ≈ ${swapQuote} ${testTokenSymbol}`} sub={swapActive?'Swap Lab ativo':'Swap Lab pausado'}/><TextInput style={s.input} placeholder={swapDirection==='zq-token'?'Quantidade ZQ':`Quantidade ${testTokenSymbol}`} placeholderTextColor="#5d6473" keyboardType="decimal-pad" value={swapAmount} onChangeText={setSwapAmount}/><Pressable style={s.primary} disabled={busy||block===null||!swapActive} onPress={swap}><Text style={s.primaryText}>{busy?'Aguardando confirmação...':'Fazer swap on-chain'}</Text></Pressable></>}
 {tab==='quests'&&<><Text style={s.h2}>Quests & Score</Text><Text style={s.muted}>Pontos só são finalizados após validação elegível. Testnet Score não possui valor monetário e não garante futuro token/airdrop.</Text>{quests.map(q=><View key={q.id} style={s.quest}><View style={{flex:1}}><Text style={s.questTitle}>{q.title}</Text><Text style={s.muted}>{q.description}</Text><Text style={s.questType}>{q.type} • {q.status}</Text></View><Text style={s.points}>+{q.points}</Text></View>)}</>}
 {tab==='rank'&&<><Text style={s.h2}>Meu Score</Text><Card title="Nível" value={level(score.total)} sub={`${score.total.toLocaleString()} Score finalizado`}/><Card title="Validator" value={score.validator.toLocaleString()} sub="Node / infraestrutura validada"/><Card title="Builder" value={score.contributor.toLocaleString()} sub="Contribuições qualificadas"/><Card title="Mobile" value={score.mobile.toLocaleString()} sub="Atividade elegível validada"/><Pressable style={s.primary} onPress={()=>Linking.openURL('https://zoryq-testnet.vercel.app/leaderboard.html')}><Text style={s.primaryText}>Abrir ranking global</Text></Pressable></>}
 {tab==='activity'&&<><Text style={s.h2}>Chain & Explorer</Text><Text style={s.muted}>A fonte de verdade é a ZORYQ Chain. Use o hash abaixo para verificar status, bloco, from, to, valor e receipt.</Text>{lastTx?<View style={s.txCard}><Text style={s.label}>ÚLTIMA TRANSAÇÃO</Text><Text style={s.txKind}>{lastTx.kind}</Text><Text style={s.hash}>{lastTx.hash}</Text><Text style={lastTx.status==='confirmed'?s.confirmed:lastTx.status==='failed'?s.failed:s.pending}>{lastTx.status==='confirmed'?'CONFIRMADA ON-CHAIN':lastTx.status==='failed'?'FALHOU':'PENDENTE'}</Text><Pressable style={s.primary} onPress={()=>Linking.openURL(explorerTx(lastTx.hash))}><Text style={s.primaryText}>Abrir esta transação no Explorer</Text></Pressable><Pressable style={s.secondary} onPress={()=>Clipboard.setStringAsync(lastTx.hash)}><Text style={s.secondaryText}>Copiar txHash</Text></Pressable></View>:<Text style={s.note}>Nenhuma transação registrada nesta instalação ainda.</Text>}<Pressable style={s.secondary} onPress={()=>Linking.openURL(`${EXPLORER}?q=${wallet.address}`)}><Text style={s.secondaryText}>Abrir minha wallet no Explorer</Text></Pressable></>}
 {tab==='settings'&&<><Text style={s.h2}>Rede</Text><Card title="Network" value="ZORYQ EVM Testnet" sub="EVM compatible"/><Card title="Chain ID" value="5919065" sub="0x5a5159"/><Card title="RPC" value={block===null?'OFFLINE':'ONLINE'} sub={RPC}/><Card title="Stake Vault" value={STAKE_CONTRACT} sub="Stake nativo de ZQ Testnet"/><Card title="Swap Lab" value={SWAP_CONTRACT} sub={`Token: ${TEST_TOKEN}`}/><Text style={s.warning}>Nunca compartilhe seed ou private key. Esta build é exclusivamente Testnet.</Text></>}
 {tab!=='send'&&tab!=='stake'&&tab!=='swap'&&<View style={s.nav}>{(['home','quests','rank','activity','settings'] as Tab[]).map(x=><Pressable key={x} onPress={()=>setTab(x)} style={[s.navItem,tab===x&&s.navActive]}><Text style={s.navText}>{x==='home'?'Home':x==='quests'?'Quests':x==='rank'?'Score':x==='activity'?'Chain':'Rede'}</Text></Pressable>)}</View>}</ScrollView></SafeAreaView>
}
function Card({title,value,sub}:{title:string;value:string;sub:string}){return <View style={s.card}><Text style={s.label}>{title}</Text><Text style={s.cardValue} numberOfLines={1}>{value}</Text><Text style={s.muted} numberOfLines={2}>{sub}</Text></View>}
function Back({onPress}:{onPress:()=>void}){return <Pressable onPress={onPress}><Text style={s.back}>← Voltar</Text></Pressable>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},page:{padding:20,paddingBottom:110},onboard:{flex:1,justifyContent:'center',padding:28},brand:{fontSize:22,fontWeight:'900',letterSpacing:5,color:'#fff'},h1:{fontSize:42,lineHeight:46,fontWeight:'900',color:'#fff',marginTop:28,marginBottom:14},h2:{fontSize:30,fontWeight:'900',color:'#fff',marginVertical:18},muted:{color:'#8b93a7',lineHeight:20},note:{color:'#697184',marginTop:18,fontSize:12},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:36},net:{color:'#b8ff49',fontWeight:'700'},netOff:{color:'#ff7777',fontWeight:'700'},label:{color:'#737b90',fontSize:11,fontWeight:'800',letterSpacing:1.2},balance:{fontSize:45,fontWeight:'900',color:'#fff',marginVertical:8},zq:{color:'#b8ff49'},address:{color:'#00e5ff',fontSize:12,marginBottom:22},back:{color:'#00e5ff',fontWeight:'800',marginTop:2},row:{flexDirection:'row',gap:8},primary:{backgroundColor:'#b8ff49',padding:16,borderRadius:15,alignItems:'center',marginTop:20},primarySmall:{flex:1,backgroundColor:'#b8ff49',padding:15,borderRadius:14,alignItems:'center'},primaryText:{color:'#071000',fontWeight:'900'},secondary:{borderWidth:1,borderColor:'#2a3040',padding:16,borderRadius:15,alignItems:'center',marginTop:10},secondarySmall:{flex:1,borderWidth:1,borderColor:'#2a3040',padding:15,borderRadius:14,alignItems:'center'},secondaryText:{color:'#fff',fontWeight:'800'},cards:{gap:10,marginTop:22},card:{backgroundColor:'#0c0f15',borderWidth:1,borderColor:'#202633',padding:17,borderRadius:18,marginTop:10},cardValue:{color:'#fff',fontSize:21,fontWeight:'800',marginVertical:7},input:{backgroundColor:'#0c0f15',borderWidth:1,borderColor:'#242a38',color:'#fff',padding:16,borderRadius:14,marginBottom:10},quest:{flexDirection:'row',gap:14,backgroundColor:'#0c0f15',borderWidth:1,borderColor:'#202633',padding:17,borderRadius:18,marginTop:10},questTitle:{color:'#fff',fontWeight:'800',fontSize:17},questType:{color:'#00e5ff',fontSize:11,marginTop:7},points:{color:'#b8ff49',fontWeight:'900',fontSize:20},warning:{color:'#ffcf66',marginTop:20,lineHeight:20},segment:{flexDirection:'row',backgroundColor:'#0c0f15',borderRadius:14,padding:4,marginVertical:16},segmentBtn:{flex:1,padding:12,borderRadius:11,alignItems:'center'},segmentActive:{backgroundColor:'#202633'},segmentText:{color:'#fff',fontWeight:'800',fontSize:12},nav:{position:'absolute',left:10,right:10,bottom:18,backgroundColor:'#0a0d12',borderWidth:1,borderColor:'#222938',borderRadius:20,padding:6,flexDirection:'row'},navItem:{flex:1,paddingVertical:10,alignItems:'center',borderRadius:13},navActive:{backgroundColor:'#171d27'},navText:{color:'#dbe2ef',fontSize:10,fontWeight:'800'},txCard:{backgroundColor:'#0c0f15',borderWidth:1,borderColor:'#2a3040',padding:17,borderRadius:18,marginTop:18},txKind:{color:'#fff',fontSize:17,fontWeight:'800',marginTop:8},hash:{color:'#00e5ff',fontSize:11,marginTop:8},link:{color:'#b8ff49',fontWeight:'800',marginTop:10},confirmed:{color:'#b8ff49',fontWeight:'900',marginTop:12},pending:{color:'#ffcf66',fontWeight:'900',marginTop:12},failed:{color:'#ff7777',fontWeight:'900',marginTop:12}});
