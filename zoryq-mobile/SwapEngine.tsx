import 'react-native-get-random-values';
import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Contract,JsonRpcProvider,Wallet,formatUnits,getAddress,isAddress,parseUnits} from 'ethers';
import {BUILTIN_NETWORKS,NetworkConfig} from './networks';
import {WatchedToken,presetsFor} from './tokens';
import {SWAP_BACKEND,TREASURY_ADDRESS,WALLET_REVENUE_POLICY} from './revenue';

const PK_KEY='zoryq.wallet.privateKey.v3';
const NETWORK_KEY='zoryq.wallet.network.v3';
const TOKENS_KEY='zoryq.wallet.tokens.v3';
const ACTIVITY_KEY='zoryq.wallet.activity.v3';
const NATIVE='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ERC20_APPROVAL_ABI=['function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)'];

type Asset={key:string;address:string;symbol:string;name:string;decimals:number;native:boolean};
type BackendHealth={ok:boolean;providerPreference?:string;feeBps?:number;treasury?:string|null;treasuryConfigured?:boolean;zeroXApiConfigured?:boolean;kyberPublicConfigured?:boolean;supportedChainIds?:number[]};
type QuoteState={envelope:any;sell:Asset;buy:Asset;sellAmount:string;sellBase:string;buyDisplay:string;feeDisplay:string;feeSymbol:string;createdAt:number};
type Activity={hash:string;chainId:number;network:string;kind:string;status:'confirmed'|'failed'|'pending';createdAt:number;value?:string;to?:string};

function strongOptions(){const strong=SecureStore.canUseBiometricAuthentication();return {requireAuthentication:strong,authenticationPrompt:'Desbloqueie a ZORYQ Wallet',keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY} as const}
function sameAddress(a:string,b:string){return String(a||'').toLowerCase()===String(b||'').toLowerCase()}
function short(a:string){return a?`${a.slice(0,8)}…${a.slice(-6)}`:'—'}
function errorText(e:any){return e?.shortMessage||e?.reason||e?.message||'Falha no swap'}
function parseJson<T>(raw:string|null,fallback:T):T{try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
function assetFromToken(t:WatchedToken):Asset{return {key:t.address.toLowerCase(),address:t.address,symbol:t.symbol,name:t.name,decimals:t.decimals,native:false}}

export default function SwapEngine(){
 const allSwapNetworks=useMemo(()=>BUILTIN_NETWORKS.filter(n=>n.mainnet&&n.supports0x),[]);
 const [health,setHealth]=useState<BackendHealth|null>(null);
 const swapNetworks=useMemo(()=>allSwapNetworks.filter(n=>!health?.supportedChainIds||health.supportedChainIds.includes(n.chainId)),[allSwapNetworks,health]);
 const [networkId,setNetworkId]=useState('ethereum');
 const network=useMemo(()=>swapNetworks.find(n=>n.id===networkId)||swapNetworks[0]||allSwapNetworks[0],[swapNetworks,allSwapNetworks,networkId]);
 const provider=useMemo(()=>new JsonRpcProvider(network.rpcUrl,network.chainId,{staticNetwork:true}),[network.chainId,network.rpcUrl]);
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [watchlist,setWatchlist]=useState<WatchedToken[]>([]);
 const [sellKey,setSellKey]=useState('native');
 const [buyKey,setBuyKey]=useState('');
 const [amount,setAmount]=useState('');
 const [quote,setQuote]=useState<QuoteState|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 const assets=useMemo(()=>{
  const native:Asset={key:'native',address:NATIVE,symbol:network.symbol,name:`${network.name} native`,decimals:18,native:true};
  const map=new Map<string,Asset>();
  for(const t of [...presetsFor(network.chainId),...watchlist.filter(t=>t.chainId===network.chainId)])map.set(t.address.toLowerCase(),assetFromToken(t));
  return [native,...map.values()];
 },[network,watchlist]);
 const sell=assets.find(a=>a.key===sellKey)||assets[0];
 const buy=assets.find(a=>a.key===buyKey)||assets.find(a=>a.key!==sell.key)||assets[0];

 useEffect(()=>{void bootstrap()},[]);
 useEffect(()=>{setQuote(null);setAmount('');setSellKey('native');const first=assets.find(a=>a.key!=='native');setBuyKey(first?.key||'');void checkBackend()},[network.chainId]);
 useEffect(()=>{if(wallet)setWallet(new Wallet(wallet.privateKey,provider))},[provider]);

 async function bootstrap(){
  try{
   const [savedNetwork,tokensRaw,pk]=await Promise.all([
    AsyncStorage.getItem(NETWORK_KEY),AsyncStorage.getItem(TOKENS_KEY),SecureStore.getItemAsync(PK_KEY,strongOptions()).catch(()=>null)
   ]);
   setWatchlist(parseJson<WatchedToken[]>(tokensRaw,[]));
   const saved=allSwapNetworks.find(n=>n.id===savedNetwork);if(saved)setNetworkId(saved.id);
   if(pk)setWallet(new Wallet(pk,provider));
  }catch(e){setMessage(errorText(e))}
  await checkBackend();
 }

 async function checkBackend(){
  try{const r=await fetch(`${SWAP_BACKEND}/health`,{headers:{accept:'application/json'}});const j=await r.json();setHealth(j)}catch{setHealth({ok:false})}
 }

 async function persistActivity(a:Activity){
  const current=parseJson<Activity[]>(await AsyncStorage.getItem(ACTIVITY_KEY),[]);
  const next=[a,...current.filter(x=>x.hash!==a.hash)].slice(0,100);
  await AsyncStorage.setItem(ACTIVITY_KEY,JSON.stringify(next));
 }

 async function chooseNetwork(n:NetworkConfig){
  setBusy(true);try{const p=new JsonRpcProvider(n.rpcUrl,n.chainId,{staticNetwork:true});const actual=await p.getNetwork();if(Number(actual.chainId)!==n.chainId)throw Error('RPC respondeu Chain ID incorreto');setNetworkId(n.id);await AsyncStorage.setItem(NETWORK_KEY,n.id);setMessage('')}catch(e){Alert.alert('Rede indisponível',errorText(e))}finally{setBusy(false)}
 }

 async function requestQuote():Promise<QuoteState>{
  if(!wallet)throw Error('Abra/crie a carteira primeiro na aba Carteira.');
  if(!health?.ok)throw Error('Backend de swaps não está pronto.');
  if(sell.key===buy.key)throw Error('Escolha ativos diferentes.');
  if(!amount||Number(amount)<=0)throw Error('Informe uma quantidade válida.');
  const sellBase=parseUnits(amount.replace(',','.'),sell.decimals).toString();
  const r=await fetch(`${SWAP_BACKEND}/quote`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({chainId:network.chainId,sellToken:sell.address,buyToken:buy.address,sellAmount:sellBase,taker:wallet.address})});
  const j=await r.json().catch(()=>({ok:false,error:'INVALID_BACKEND_RESPONSE'}));
  if(!r.ok||!j?.ok)throw Error(j?.error||`Quote recusado (${r.status})`);
  const p=j.feePolicy||{};
  if(Number(j.chainId)!==network.chainId)throw Error('Quote retornou Chain ID diferente.');
  if(Number(p.feeBps)!==WALLET_REVENUE_POLICY.swapFeeBps||p.hidden!==false||!sameAddress(p.feeRecipient,TREASURY_ADDRESS)||!sameAddress(p.feeToken,sell.address))throw Error('Quote rejeitado: política da Treasury não confere.');
  const q=j.quote||{};
  if(!q.transaction?.to||!isAddress(q.transaction.to)||typeof q.transaction.data!=='string'||!q.transaction.data.startsWith('0x'))throw Error('Quote não contém transação válida.');
  if(q.sellToken&&!sameAddress(q.sellToken,sell.address))throw Error('Sell token divergente no quote.');
  if(q.buyToken&&!sameAddress(q.buyToken,buy.address))throw Error('Buy token divergente no quote.');
  const buyAmount=String(q.buyAmount||'');if(!/^[1-9][0-9]*$/.test(buyAmount))throw Error('Quote sem valor de saída válido.');
  const fee=q.fees?.integratorFee||q.fees?.integratorFees?.[0];if(!fee||BigInt(String(fee.amount||'0'))<=0n||!sameAddress(fee.token,sell.address))throw Error('Quote sem taxa verificável para a Treasury.');
  const out:QuoteState={envelope:j,sell,buy,sellAmount:amount.replace(',','.'),sellBase,buyDisplay:formatUnits(buyAmount,buy.decimals),feeDisplay:formatUnits(String(fee.amount),sell.decimals),feeSymbol:sell.symbol,createdAt:Date.now()};
  setQuote(out);return out;
 }

 async function loadQuote(){setBusy(true);setMessage('');try{await checkBackend();const q=await requestQuote();setMessage(`Quote carregado por ${q.envelope.provider}. Revise a taxa antes de assinar.`)}catch(e){setQuote(null);Alert.alert('Não foi possível cotar',errorText(e))}finally{setBusy(false)}}

 async function approveExactIfNeeded(q:QuoteState){
  if(q.sell.native||!wallet)return false;
  const raw=q.envelope.quote||{};const spender=String(raw?.issues?.allowance?.spender||raw.allowanceTarget||'');
  if(!spender)return false;if(!isAddress(spender))throw Error('Approval target inválido.');
  if(raw.allowanceTarget&&!sameAddress(raw.allowanceTarget,spender))throw Error('Targets de allowance divergentes.');
  if(raw.transaction?.to&&sameAddress(raw.transaction.to,spender)&&String(q.envelope.provider||'').startsWith('0x'))throw Error('Quote inseguro: approval apontando ao contrato de execução.');
  const c=new Contract(q.sell.address,ERC20_APPROVAL_ABI,wallet);const needed=BigInt(q.sellBase);const current:bigint=await c.allowance(wallet.address,getAddress(spender));
  if(current>=needed)return false;
  setMessage(`Aprovando somente ${q.sellAmount} ${q.sell.symbol} para este swap…`);
  if(current>0n){const zero=await c.approve(getAddress(spender),0n);await zero.wait()}
  const tx=await c.approve(getAddress(spender),needed);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('Approval falhou.');
  return true;
 }

 function confirmSwap(){
  if(!quote)return;
  const age=Date.now()-quote.createdAt;if(age>10_000){Alert.alert('Quote expirado','As rotas mudam rapidamente. Gere um novo quote antes de trocar.');setQuote(null);return}
  Alert.alert('Confirmar swap',`${network.name}\n\nVocê vende: ${quote.sellAmount} ${quote.sell.symbol}\nRecebe estimado: ${quote.buyDisplay} ${quote.buy.symbol}\nTaxa ZORYQ Wallet: ${quote.feeDisplay} ${quote.feeSymbol} (${WALLET_REVENUE_POLICY.swapFeeBps/100}%)\nTreasury: ${TREASURY_ADDRESS}\n\nA taxa está embutida na rota e é enviada à Treasury pelo contrato do agregador.`,[
   {text:'Cancelar',style:'cancel'},
   {text:'Continuar',onPress:()=>void executeSwap(quote)}
  ]);
 }

 async function executeSwap(q:QuoteState){
  if(!wallet)return;setBusy(true);setMessage('');
  try{
   const approved=await approveExactIfNeeded(q);
   if(approved){const fresh=await requestQuote();setQuote(fresh);setMessage('Approval confirmado. O quote foi renovado; revise os novos valores e toque em Executar swap novamente.');Alert.alert('Approval confirmado','Por segurança, atualizamos o quote após o approval. Revise a taxa e o valor recebido antes de assinar o swap.');return}
   if(Date.now()-q.createdAt>10_000)throw Error('Quote expirou. Gere um novo quote.');
   const raw=q.envelope.quote;const txRaw=raw.transaction;const req:any={to:getAddress(txRaw.to),data:String(txRaw.data),value:BigInt(String(txRaw.value||'0'))};
   await provider.call({...req,from:wallet.address});
   let gas:bigint;try{gas=await wallet.estimateGas(req)}catch{const quoted=BigInt(String(txRaw.gas||'0'));if(quoted<=0n)throw Error('Não foi possível estimar gas.');gas=quoted}
   req.gasLimit=(gas*125n)/100n;
   setMessage('Assinando e enviando swap…');const tx=await wallet.sendTransaction(req);
   const base:Activity={hash:tx.hash,chainId:network.chainId,network:network.name,kind:'Swap',status:'pending',createdAt:Date.now(),value:`${q.sellAmount} ${q.sell.symbol} → ${q.buy.symbol}`,to:req.to};await persistActivity(base);
   const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('Swap revertido.');await persistActivity({...base,status:'confirmed'});
   setQuote(null);setAmount('');setMessage(`Swap confirmado: ${short(tx.hash)}. A taxa de ${WALLET_REVENUE_POLICY.swapFeeBps/100}% foi roteada para a Treasury pelo agregador.`);Alert.alert('Swap confirmado',`Transação: ${tx.hash}\n\nTreasury configurada: ${TREASURY_ADDRESS}`)
  }catch(e){Alert.alert('Swap não executado',errorText(e));setMessage(errorText(e))}finally{setBusy(false)}
 }

 if(!network)return <SafeAreaView style={s.root}><Text style={s.warning}>Nenhuma rede de swap disponível.</Text></SafeAreaView>;
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.scroll}>
  <Text style={s.title}>Swap com receita para Treasury</Text>
  <Text style={s.sub}>Taxa transparente de {WALLET_REVENUE_POLICY.swapFeeBps/100}% por swap. Transferências normais continuam sem taxa ZORYQ Wallet.</Text>
  <View style={s.card}><Text style={s.label}>Treasury oficial</Text><Text style={s.mono}>{TREASURY_ADDRESS}</Text><Text style={health?.ok?s.ok:s.warning}>{health?.ok?`Backend pronto · ${health.providerPreference||'aggregator'}`:'Backend indisponível'}</Text><Pressable style={s.smallButton} onPress={()=>void checkBackend()}><Text style={s.smallButtonText}>Verificar backend</Text></Pressable></View>
  <Text style={s.section}>Rede</Text><View style={s.wrap}>{swapNetworks.map(n=><Pressable key={n.id} style={[s.chip,n.id===network.id&&s.chipOn]} onPress={()=>void chooseNetwork(n)} disabled={busy}><Text style={s.chipText}>{n.shortName}</Text></Pressable>)}</View>
  <Text style={s.section}>Vender</Text><View style={s.wrap}>{assets.map(a=><Pressable key={`s-${a.key}`} style={[s.chip,a.key===sell.key&&s.chipOn]} onPress={()=>{setSellKey(a.key);setQuote(null)}}><Text style={s.chipText}>{a.symbol}</Text></Pressable>)}</View>
  <View style={s.amountBox}><Text style={s.amountLabel}>Quantidade</Text><TextInput style={s.amountInput} value={amount} onChangeText={v=>{setAmount(v);setQuote(null)}} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor="#596174"/><View style={s.wrap}>{['0.001','0.01','0.1','1','10','100'].map(v=><Pressable key={v} style={s.quick} onPress={()=>{setAmount(v);setQuote(null)}}><Text style={s.quickText}>{v}</Text></Pressable>)}</View></View>
  <Text style={s.section}>Receber</Text><View style={s.wrap}>{assets.filter(a=>a.key!==sell.key).map(a=><Pressable key={`b-${a.key}`} style={[s.chip,a.key===buy.key&&s.chipOn]} onPress={()=>{setBuyKey(a.key);setQuote(null)}}><Text style={s.chipText}>{a.symbol}</Text></Pressable>)}</View>
  <Pressable style={[s.primary,(!health?.ok||busy)&&s.disabled]} onPress={()=>void loadQuote()} disabled={!health?.ok||busy}><Text style={s.primaryText}>{busy?'Processando…':'Buscar melhor rota'}</Text></Pressable>
  {quote&&<View style={s.quote}><Text style={s.quoteTitle}>Quote verificável</Text><Text style={s.row}>Vender: {quote.sellAmount} {quote.sell.symbol}</Text><Text style={s.row}>Receber estimado: {quote.buyDisplay} {quote.buy.symbol}</Text><Text style={s.fee}>Taxa para Treasury: {quote.feeDisplay} {quote.feeSymbol} ({WALLET_REVENUE_POLICY.swapFeeBps/100}%)</Text><Text style={s.row}>Provedor: {quote.envelope.provider}</Text><Text style={s.note}>Rotas expiram rapidamente. O app recusa quotes com Treasury, fee ou Chain ID divergentes e simula a transação antes de enviar.</Text><Pressable style={s.execute} onPress={confirmSwap} disabled={busy}><Text style={s.primaryText}>Executar swap</Text></Pressable></View>}
  {message?<Text style={s.message}>{message}</Text>:null}
  <View style={s.card}><Text style={s.label}>Segurança</Text><Text style={s.note}>ERC‑20 recebe approval somente do valor necessário. Se houver approval, o quote é renovado antes da assinatura final. A chave privada continua no SecureStore do aparelho.</Text></View>
 </ScrollView></SafeAreaView>;
}

const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},scroll:{padding:18,paddingBottom:42,gap:13},title:{color:'#fff',fontSize:26,fontWeight:'900'},sub:{color:'#9ba4b8',lineHeight:20},section:{color:'#fff',fontWeight:'900',fontSize:16,marginTop:4},card:{padding:15,borderRadius:16,borderWidth:1,borderColor:'#283044',backgroundColor:'#0d1119',gap:8},label:{color:'#b6bed0',fontWeight:'800'},mono:{color:'#d8d1ff',fontFamily:'monospace',fontSize:12},ok:{color:'#69e6a7',fontWeight:'800'},warning:{color:'#ffc76b',fontWeight:'800'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:'#343d55',backgroundColor:'#10141e'},chipOn:{backgroundColor:'#251c4d',borderColor:'#8268ff'},chipText:{color:'#fff',fontWeight:'800'},amountBox:{padding:14,borderRadius:15,backgroundColor:'#0a0d14',borderWidth:1,borderColor:'#252c3c',gap:9},amountLabel:{color:'#8d96aa',fontSize:12},amountInput:{color:'#fff',fontSize:28,fontWeight:'900',borderBottomWidth:1,borderColor:'#2b3345',paddingVertical:8},quick:{paddingHorizontal:11,paddingVertical:7,borderRadius:10,backgroundColor:'#171c29'},quickText:{color:'#cdd3e0',fontWeight:'700'},primary:{padding:15,borderRadius:14,backgroundColor:'#704cff',alignItems:'center'},execute:{padding:15,borderRadius:14,backgroundColor:'#12a56f',alignItems:'center'},disabled:{opacity:.45},primaryText:{color:'#fff',fontWeight:'900'},quote:{padding:16,borderRadius:18,borderWidth:1,borderColor:'#436b5d',backgroundColor:'#0b1714',gap:8},quoteTitle:{color:'#7ff0bb',fontSize:18,fontWeight:'900'},row:{color:'#d6dbe6'},fee:{color:'#8ff2c3',fontWeight:'900'},note:{color:'#9099ac',fontSize:12,lineHeight:18},message:{color:'#b7c1d6',lineHeight:19},smallButton:{alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:7,borderRadius:9,backgroundColor:'#171c29'},smallButtonText:{color:'#cfd6e5',fontWeight:'800',fontSize:12}});
