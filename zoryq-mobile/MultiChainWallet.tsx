import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Wallet,formatUnits} from 'ethers';
import {
 EVM_NETWORKS,EvmNetwork,TokenRef,ContractHit,SwapQuote,ZORIQ_SWAP_FEE,ZORIQ_TREASURY,
 nativeToken,presetUsdc,findTokenAcrossNetworks,getAssetBalance,getSwapQuote,executeSwapQuote,getTransferStatus,swapFeeInfo
} from './multichainWallet';

const WALLET_KEY='zoryq.wallet.privateKey';
type Side='from'|'to';

export default function MultiChainWallet(){
 const defaultNet=EVM_NETWORKS.find(n=>n.chainId===8453)||EVM_NETWORKS[1];
 const [address,setAddress]=useState('');
 const [fromNetwork,setFromNetwork]=useState<EvmNetwork>(defaultNet);
 const [toNetwork,setToNetwork]=useState<EvmNetwork>(defaultNet);
 const [fromToken,setFromToken]=useState<TokenRef>(nativeToken(defaultNet));
 const [toToken,setToToken]=useState<TokenRef>(presetUsdc(defaultNet)||nativeToken(defaultNet));
 const [amount,setAmount]=useState('');
 const [balance,setBalance]=useState('0');
 const [fromContract,setFromContract]=useState('');
 const [toContract,setToContract]=useState('');
 const [matches,setMatches]=useState<{side:Side;hits:ContractHit[]}|null>(null);
 const [networkPicker,setNetworkPicker]=useState<Side|null>(null);
 const [slippageMode,setSlippageMode]=useState<'auto'|'manual'>('auto');
 const [manualSlippage,setManualSlippage]=useState('0.5');
 const [quote,setQuote]=useState<SwapQuote|null>(null);
 const [busy,setBusy]=useState(false);
 const [last,setLast]=useState<{hash:string;fromChain:number;toChain:number;tool:string;status:string}|null>(null);
 const fee=swapFeeInfo();

 useEffect(()=>{(async()=>{const pk=await SecureStore.getItemAsync(WALLET_KEY);if(pk)setAddress(new Wallet(pk).address)})()},[]);
 useEffect(()=>{setQuote(null);if(!address)return;getAssetBalance(fromNetwork,fromToken,address).then(setBalance).catch(()=>setBalance('0'))},[address,fromNetwork.chainId,fromToken.address]);
 const output=useMemo(()=>{
  if(!quote)return null;const raw=quote.raw;const d=Number(raw?.action?.toToken?.decimals??toToken.decimals);
  try{return {expected:formatUnits(BigInt(raw.estimate.toAmount),d),minimum:formatUnits(BigInt(raw.estimate.toAmountMin),d)}}catch{return null}
 },[quote,toToken.decimals]);

 function chooseNetwork(side:Side,n:EvmNetwork){
  if(side==='from'){setFromNetwork(n);setFromToken(nativeToken(n));setFromContract('')}
  else{setToNetwork(n);setToToken(presetUsdc(n)||nativeToken(n));setToContract('')}
  setNetworkPicker(null);setMatches(null);setQuote(null);
 }
 async function detect(side:Side){
  const value=(side==='from'?fromContract:toContract).trim();if(!value)return;
  setBusy(true);setQuote(null);
  try{
   const hits=await findTokenAcrossNetworks(value);const tokens=hits.filter(h=>h.token);
   if(!hits.length)throw new Error('Contrato não encontrado nas redes EVM suportadas.');
   if(!tokens.length)throw new Error('Contrato encontrado, mas não expõe metadados ERC-20 compatíveis para swap.');
   if(tokens.length===1){applyHit(side,tokens[0]);setMatches(null)}else setMatches({side,hits:tokens});
  }catch(e:any){Alert.alert('Buscar contrato',String(e?.message||e))}finally{setBusy(false)}
 }
 function applyHit(side:Side,hit:ContractHit){
  if(!hit.token)return;
  if(side==='from'){setFromNetwork(hit.network);setFromToken(hit.token);setFromContract(hit.token.address)}
  else{setToNetwork(hit.network);setToToken(hit.token);setToContract(hit.token.address)}
  setMatches(null);setQuote(null);
 }
 function setNative(side:Side){
  if(side==='from'){setFromToken(nativeToken(fromNetwork));setFromContract('')}
  else{setToToken(nativeToken(toNetwork));setToContract('')}
  setQuote(null);
 }
 async function makeQuote(){
  if(!address)return Alert.alert('Wallet','Crie ou restaure a Wallet ZORIQ primeiro.');
  if(!amount||Number(amount)<=0)return Alert.alert('Valor','Informe o valor para trocar.');
  if(!fromNetwork.lifi||!toNetwork.lifi)return Alert.alert('Rede ainda não agregada','A ZORYQ Testnet mantém seu swap próprio. Para o agregador multichain escolha uma mainnet EVM suportada.');
  setBusy(true);setQuote(null);
  try{
   const q=await getSwapQuote({fromNetwork,toNetwork,fromToken,toToken,amount:amount.replace(',','.'),fromAddress:address,slippageMode,manualSlippage:Number(manualSlippage.replace(',','.'))/100});
   setQuote(q);
  }catch(e:any){Alert.alert('Cotação multichain',friendly(String(e?.message||e)))}finally{setBusy(false)}
 }
 async function execute(){
  if(!quote)return;
  const action=async()=>{
   setBusy(true);try{
    const result=await executeSwapQuote(quote);setLast({hash:result.txHash,fromChain:result.fromChain,toChain:result.toChain,tool:result.tool,status:'SOURCE_CONFIRMED'});setQuote(null);setAmount('');
    Alert.alert('Transação enviada',result.fromChain===result.toChain?'Swap confirmado na rede de origem.':'Transação de origem confirmada. A etapa cross-chain continuará sendo acompanhada pelo agregador.');
   }catch(e:any){Alert.alert('Executar swap',friendly(String(e?.shortMessage||e?.message||e)))}finally{setBusy(false)}
  };
  Alert.alert('Confirmar swap',`${amount} ${fromToken.symbol} · ${fromNetwork.name}\n→ ${output?.expected||'—'} ${toToken.symbol} · ${toNetwork.name}\n\nSlippage: ${(quote.usedSlippage*100).toFixed(2)}%\n${quote.feeActive?`Taxa ZORIQ: ${(quote.feeRate*100).toFixed(2)}%`:'Sem taxa ZORIQ nesta rota'}`,[{text:'Cancelar',style:'cancel'},{text:'Confirmar',onPress:action}]);
 }
 async function refreshTransfer(){if(!last)return;try{const s=await getTransferStatus(last.hash,last.fromChain,last.toChain,last.tool);setLast({...last,status:String(s?.status||s?.substatus||'PENDING')})}catch(e:any){Alert.alert('Status',String(e?.message||e))}}

 return <ScrollView style={s.page} contentContainerStyle={s.content}>
  <View style={s.head}><View><Text style={s.eyebrow}>WALLET MULTICHAIN</Text><Text style={s.title}>Troque em várias EVMs.</Text></View><View style={s.live}><View style={s.dot}/><Text style={s.liveText}>{EVM_NETWORKS.length-1} mainnets</Text></View></View>
  <Text style={s.copy}>A rede fica discreta dentro de cada ativo. Cole um contrato e a ZORIQ procura automaticamente em todas as EVMs suportadas.</Text>

  <View style={s.swapCard}>
   <AssetBox side="from" label="VOCÊ ENVIA" network={fromNetwork} token={fromToken} contract={fromContract} setContract={setFromContract} amount={amount} setAmount={setAmount} balance={balance} onNetwork={()=>setNetworkPicker('from')} onDetect={()=>detect('from')} onNative={()=>setNative('from')} busy={busy}/>
   <View style={s.arrow}><Text style={s.arrowText}>↓</Text></View>
   <AssetBox side="to" label="VOCÊ RECEBE" network={toNetwork} token={toToken} contract={toContract} setContract={setToContract} onNetwork={()=>setNetworkPicker('to')} onDetect={()=>detect('to')} onNative={()=>setNative('to')} busy={busy}/>

   {matches?<View style={s.matches}><Text style={s.smallTitle}>CONTRATO ENCONTRADO EM MAIS DE UMA REDE</Text>{matches.hits.map(h=><Pressable key={`${h.network.chainId}-${h.token?.address}`} onPress={()=>applyHit(matches.side,h)} style={s.match}><Text style={s.matchToken}>{h.token?.symbol||'TOKEN'}</Text><Text style={s.matchNet}>{h.network.name}</Text></Pressable>)}</View>:null}

   <View style={s.slipRow}><View><Text style={s.smallTitle}>SLIPPAGE</Text><Text style={s.sub}>{slippageMode==='auto'?'Automático · 0,5% → 1% → 2% se necessário':'Manual · limite escolhido por você'}</Text></View><Pressable onPress={()=>{setSlippageMode(v=>v==='auto'?'manual':'auto');setQuote(null)}} style={s.mode}><Text style={s.modeText}>{slippageMode==='auto'?'AUTO':'MANUAL'}</Text></Pressable></View>
   {slippageMode==='manual'?<TextInput value={manualSlippage} onChangeText={v=>{setManualSlippage(v.replace(',','.'));setQuote(null)}} keyboardType="decimal-pad" placeholder="0.5" placeholderTextColor="#67738a" style={s.slipInput}/>:null}

   {quote&&output?<View style={s.quote}>
    <Row k="Estimado" v={`${output.expected} ${toToken.symbol}`}/><Row k="Mínimo protegido" v={`${output.minimum} ${toToken.symbol}`}/><Row k="Rota" v={String(quote.raw?.toolDetails?.name||quote.raw?.tool||'Agregador')}/><Row k="Slippage usado" v={`${(quote.usedSlippage*100).toFixed(2)}%`}/><Row k="Taxa ZORIQ" v={quote.feeActive?`${(quote.feeRate*100).toFixed(2)}% → Treasury`:'não ativa nesta rota'}/>
   </View>:null}

   {!quote?<Pressable disabled={busy} onPress={makeQuote} style={[s.primary,busy&&s.disabled]}><Text style={s.primaryText}>{busy?'BUSCANDO MELHOR ROTA…':'COTAR MELHOR ROTA'}</Text></Pressable>:<Pressable disabled={busy} onPress={execute} style={[s.primary,busy&&s.disabled]}><Text style={s.primaryText}>{busy?'CONFIRMANDO…':'TROCAR AGORA'}</Text></Pressable>}
  </View>

  <View style={s.feeBox}><View><Text style={s.smallTitle}>ZORIQ TREASURY</Text><Text style={s.treasury}>{ZORIQ_TREASURY.slice(0,10)}…{ZORIQ_TREASURY.slice(-6)}</Text></View><View style={[s.feePill,fee.configured?s.feeOn:s.feeOff]}><Text style={s.feePillText}>{fee.configured?`${(ZORIQ_SWAP_FEE*100).toFixed(1)}% ATIVA`:'FEE PENDENTE'}</Text></View></View>
  <Text style={s.note}>{fee.configured?'A comissão do integrador é deduzida da rota e encaminhada à fee wallet configurada para o integrador ZORIQ.':'Os swaps continuam utilizáveis, mas a comissão ZORIQ só será ativada depois que o integrador LI.FI estiver validado e apontando para a Treasury. O app não cobra uma taxa separada se isso falhar.'}</Text>

  {last?<Pressable onPress={refreshTransfer} style={s.last}><View><Text style={s.smallTitle}>ÚLTIMA ROTA</Text><Text style={s.lastHash}>{last.hash.slice(0,12)}…{last.hash.slice(-8)}</Text></View><Text style={s.lastStatus}>{last.status} · atualizar</Text></Pressable>:null}
  <Text style={s.warning}>Mainnet usa ativos com valor real. A ZORIQ nunca escolhe um contrato apenas pelo nome: contratos colados são conferidos por bytecode e metadados ERC‑20 na rede encontrada. Sempre confira o endereço antes de assinar.</Text>

  <Modal visible={Boolean(networkPicker)} transparent animationType="fade" onRequestClose={()=>setNetworkPicker(null)}>
   <Pressable style={s.modalBack} onPress={()=>setNetworkPicker(null)}><Pressable style={s.sheet} onPress={()=>{}}><Text style={s.sheetTitle}>Escolher rede</Text><ScrollView>{EVM_NETWORKS.map(n=><Pressable key={n.chainId} onPress={()=>chooseNetwork(networkPicker||'from',n)} style={s.netItem}><View><Text style={s.netName}>{n.name}</Text><Text style={s.netMeta}>Chain ID {n.chainId} · {n.nativeSymbol}</Text></View><Text style={s.netShort}>{n.short}</Text></Pressable>)}</ScrollView></Pressable></Pressable>
  </Modal>
 </ScrollView>
}

function AssetBox(p:any){return <View style={s.assetBox}>
 <View style={s.assetTop}><View><Text style={s.smallTitle}>{p.label}</Text><Text style={s.tokenName}>{p.token.symbol}</Text></View><Pressable onPress={p.onNetwork} style={s.netPill}><Text style={s.netPillText}>{p.network.short} ▾</Text></Pressable></View>
 {p.side==='from'?<TextInput value={p.amount} onChangeText={(v:string)=>p.setAmount(v.replace(',','.'))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#59667c" style={s.amount}/>:null}
 <View style={s.contractRow}><TextInput value={p.contract} onChangeText={p.setContract} autoCapitalize="none" placeholder="Cole o contrato ERC-20" placeholderTextColor="#59667c" style={s.contract}/><Pressable disabled={p.busy} onPress={p.onDetect} style={s.detect}><Text style={s.detectText}>BUSCAR</Text></Pressable></View>
 <View style={s.assetFoot}><Pressable onPress={p.onNative}><Text style={s.native}>Usar {p.network.nativeSymbol} nativo</Text></Pressable>{p.side==='from'?<Text style={s.balance}>saldo {trim(p.balance)} {p.token.symbol}</Text>:<Text style={s.balance}>{p.token.name}</Text>}</View>
</View>}
function Row({k,v}:{k:string;v:string}){return <View style={s.row}><Text style={s.rowK}>{k}</Text><Text style={s.rowV}>{v}</Text></View>}
function trim(v:string){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:6}):'0'}
function friendly(m:string){if(m.includes('wallet_missing'))return'Crie ou restaure sua wallet antes de trocar.';if(m.includes('quote_expired'))return'A cotação expirou. Gere uma nova rota.';if(m.includes('insufficient'))return'Saldo insuficiente para o valor, aprovação e gas.';if(m.includes('aggregator_chain_unsupported'))return'Essa rede ainda não está disponível no agregador multichain.';if(m.includes('No available quotes')||m.includes('quote'))return'Nenhuma rota segura foi encontrada para esse par/valor agora.';return m.slice(0,190)}

const s=StyleSheet.create({page:{flex:1,backgroundColor:'#07080d'},content:{padding:15,paddingBottom:120},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},eyebrow:{color:'#62e4c0',fontSize:10,fontWeight:'900',letterSpacing:1.5},title:{color:'#fff',fontSize:27,fontWeight:'900',marginTop:5},copy:{color:'#8492a8',fontSize:12,lineHeight:18,marginTop:7,marginBottom:14},live:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#0e151d',borderWidth:1,borderColor:'#253246',paddingHorizontal:10,paddingVertical:7,borderRadius:16},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#5ee2a0'},liveText:{color:'#8fa0b9',fontSize:9,fontWeight:'800'},swapCard:{backgroundColor:'#0b1017',borderWidth:1,borderColor:'#1c2736',borderRadius:22,padding:12},assetBox:{backgroundColor:'#0f151e',borderWidth:1,borderColor:'#202d3e',borderRadius:18,padding:14},assetTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},smallTitle:{color:'#71809a',fontSize:9,fontWeight:'900',letterSpacing:1.2},tokenName:{color:'#fff',fontSize:22,fontWeight:'900',marginTop:4},netPill:{backgroundColor:'#171f2b',paddingHorizontal:10,paddingVertical:7,borderRadius:12},netPillText:{color:'#a7b6cb',fontSize:9,fontWeight:'900'},amount:{color:'#fff',fontSize:31,fontWeight:'900',paddingVertical:9},contractRow:{flexDirection:'row',gap:7,marginTop:5},contract:{flex:1,backgroundColor:'#080c12',borderWidth:1,borderColor:'#1d2939',borderRadius:11,color:'#dce7f5',paddingHorizontal:10,paddingVertical:9,fontSize:10},detect:{backgroundColor:'#192435',borderRadius:11,justifyContent:'center',paddingHorizontal:11},detectText:{color:'#66e7c2',fontSize:8,fontWeight:'900'},assetFoot:{flexDirection:'row',justifyContent:'space-between',marginTop:8},native:{color:'#7ebaff',fontSize:9,fontWeight:'800'},balance:{color:'#67758b',fontSize:9,maxWidth:'55%'},arrow:{alignSelf:'center',width:34,height:34,borderRadius:17,backgroundColor:'#111a25',borderWidth:4,borderColor:'#0b1017',alignItems:'center',justifyContent:'center',marginVertical:-4,zIndex:2},arrowText:{color:'#fff',fontSize:18,fontWeight:'900'},matches:{marginTop:10,gap:6},match:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#111923',padding:10,borderRadius:11},matchToken:{color:'#fff',fontWeight:'900'},matchNet:{color:'#7f91aa',fontSize:10},slipRow:{marginTop:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sub:{color:'#697990',fontSize:9,marginTop:3},mode:{borderWidth:1,borderColor:'#2c4058',paddingHorizontal:10,paddingVertical:7,borderRadius:11},modeText:{color:'#64dfc0',fontSize:9,fontWeight:'900'},slipInput:{backgroundColor:'#0b1119',borderWidth:1,borderColor:'#27364a',borderRadius:11,color:'#fff',padding:10,marginTop:8},quote:{backgroundColor:'#080d13',borderRadius:14,padding:12,marginTop:12,gap:7},row:{flexDirection:'row',justifyContent:'space-between',gap:10},rowK:{color:'#718098',fontSize:10},rowV:{color:'#fff',fontSize:10,fontWeight:'800',maxWidth:'62%',textAlign:'right'},primary:{backgroundColor:'#baff45',borderRadius:14,padding:15,alignItems:'center',marginTop:13},disabled:{opacity:.5},primaryText:{color:'#071000',fontWeight:'900',fontSize:11},feeBox:{marginTop:12,backgroundColor:'#0d131b',borderWidth:1,borderColor:'#1c2a3a',borderRadius:17,padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},treasury:{color:'#fff',fontSize:11,fontWeight:'800',marginTop:4},feePill:{paddingHorizontal:9,paddingVertical:6,borderRadius:10},feeOn:{backgroundColor:'#18351f'},feeOff:{backgroundColor:'#302a16'},feePillText:{color:'#d9e5ef',fontSize:8,fontWeight:'900'},note:{color:'#68778e',fontSize:9,lineHeight:14,marginTop:7},last:{marginTop:12,borderWidth:1,borderColor:'#1e2c3f',backgroundColor:'#0c121a',borderRadius:14,padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},lastHash:{color:'#fff',fontSize:10,fontWeight:'800',marginTop:4},lastStatus:{color:'#66dcbc',fontSize:9,fontWeight:'800'},warning:{color:'#b6a36e',fontSize:9,lineHeight:15,marginTop:12},modalBack:{flex:1,backgroundColor:'rgba(0,0,0,.7)',justifyContent:'flex-end'},sheet:{maxHeight:'70%',backgroundColor:'#0b1017',borderTopLeftRadius:25,borderTopRightRadius:25,padding:16},sheetTitle:{color:'#fff',fontSize:20,fontWeight:'900',marginBottom:10},netItem:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#192231'},netName:{color:'#fff',fontSize:13,fontWeight:'800'},netMeta:{color:'#69788f',fontSize:9,marginTop:3},netShort:{color:'#66dfc0',fontSize:10,fontWeight:'900'}});
