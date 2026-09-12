import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Linking,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Wallet,formatUnits,isAddress} from 'ethers';
import {
 EVM_NETWORKS,EvmNetwork,TokenRef,ContractHit,SwapQuote,ZORIQ_SWAP_FEE,ZORIQ_TREASURY,
 nativeToken,presetUsdc,findTokenAcrossNetworks,getAssetBalance,getSwapQuote,executeSwapQuote,swapFeeInfo
} from './multichainWallet';

const WALLET_KEY='zoryq.wallet.privateKey';
type Side='from'|'to';
type LastSwap={hash:string;explorer:string;network:string};

export default function MultiChainWallet(){
 const defaultNet=EVM_NETWORKS.find(n=>n.chainId===8453)||EVM_NETWORKS[0];
 const [address,setAddress]=useState('');
 const [network,setNetwork]=useState<EvmNetwork>(defaultNet);
 const [fromToken,setFromToken]=useState<TokenRef>(nativeToken(defaultNet));
 const [toToken,setToToken]=useState<TokenRef>(presetUsdc(defaultNet)||nativeToken(defaultNet));
 const [amount,setAmount]=useState('');
 const [balance,setBalance]=useState('0');
 const [fromContract,setFromContract]=useState('');
 const [toContract,setToContract]=useState('');
 const [matches,setMatches]=useState<{side:Side;hits:ContractHit[]}|null>(null);
 const [networkPicker,setNetworkPicker]=useState(false);
 const [slippageMode,setSlippageMode]=useState<'auto'|'manual'>('auto');
 const [manualSlippage,setManualSlippage]=useState('0.5');
 const [quote,setQuote]=useState<SwapQuote|null>(null);
 const [busy,setBusy]=useState(false);
 const [detecting,setDetecting]=useState<Side|null>(null);
 const [last,setLast]=useState<LastSwap|null>(null);
 const lastAuto=useRef<Record<Side,string>>({from:'',to:''});
 const fee=swapFeeInfo();

 useEffect(()=>{(async()=>{const pk=await SecureStore.getItemAsync(WALLET_KEY);if(pk)setAddress(new Wallet(pk).address)})()},[]);
 useEffect(()=>{setQuote(null);if(!address)return;getAssetBalance(network,fromToken,address).then(setBalance).catch(()=>setBalance('0'))},[address,network.chainId,fromToken.address]);
 useEffect(()=>autoDetect('from',fromContract),[fromContract]);
 useEffect(()=>autoDetect('to',toContract),[toContract]);

 const output=useMemo(()=>{
  if(!quote)return null;
  try{return {expected:formatUnits(BigInt(String(quote.raw.priceRoute.destAmount)),toToken.decimals),minimum:formatUnits(BigInt(quote.minimumOut),toToken.decimals)}}catch{return null}
 },[quote,toToken.decimals]);

 function autoDetect(side:Side,value:string){
  const clean=value.trim();
  if(!isAddress(clean)){lastAuto.current[side]='';return()=>{}}
  const key=clean.toLowerCase();if(lastAuto.current[side]===key)return()=>{};
  const t=setTimeout(()=>{lastAuto.current[side]=key;detect(side,clean,true)},450);return()=>clearTimeout(t);
 }
 function chooseNetwork(n:EvmNetwork){
  setNetwork(n);setFromToken(nativeToken(n));setToToken(presetUsdc(n)||nativeToken(n));setFromContract('');setToContract('');setMatches(null);setNetworkPicker(false);setQuote(null);
 }
 async function detect(side:Side,value?:string,silent=false){
  const contract=(value||(side==='from'?fromContract:toContract)).trim();if(!contract||!isAddress(contract)){if(!silent)Alert.alert('Contrato','Cole um endereço ERC-20 válido.');return}
  setDetecting(side);setQuote(null);
  try{
   const hits=(await findTokenAcrossNetworks(contract)).filter(h=>h.token);
   if(!hits.length)throw new Error('Contrato ERC-20 não encontrado nas mainnets suportadas.');
   if(hits.length===1){applyHit(side,hits[0]);setMatches(null)}else setMatches({side,hits});
  }catch(e:any){if(!silent)Alert.alert('Buscar contrato',String(e?.message||e))}
  finally{setDetecting(null)}
 }
 function applyHit(side:Side,hit:ContractHit){
  if(!hit.token)return;
  const changed=network.chainId!==hit.network.chainId;
  setNetwork(hit.network);
  if(side==='from'){
   setFromToken(hit.token);setFromContract(hit.token.address);
   if(changed||toToken.chainId!==hit.network.chainId){setToToken(presetUsdc(hit.network)||nativeToken(hit.network));setToContract('')}
  }else{
   setToToken(hit.token);setToContract(hit.token.address);
   if(changed||fromToken.chainId!==hit.network.chainId){setFromToken(nativeToken(hit.network));setFromContract('')}
  }
  setMatches(null);setQuote(null);
 }
 function setNative(side:Side){
  if(side==='from'){setFromToken(nativeToken(network));setFromContract('')}
  else{setToToken(nativeToken(network));setToContract('')}
  setQuote(null);
 }
 function reverse(){
  const ft=fromToken,fc=fromContract;setFromToken(toToken);setFromContract(toContract);setToToken(ft);setToContract(fc);setQuote(null);setAmount('');
 }
 function selectManual(v:string){setSlippageMode('manual');setManualSlippage(v);setQuote(null)}
 async function makeQuote(){
  if(!address)return Alert.alert('Wallet','Crie ou restaure a Wallet ZORIQ primeiro.');
  if(!amount||Number(amount.replace(',','.'))<=0)return Alert.alert('Valor','Informe o valor para trocar.');
  if(fromToken.address.toLowerCase()===toToken.address.toLowerCase())return Alert.alert('Ativos iguais','Escolha dois ativos diferentes.');
  setBusy(true);setQuote(null);
  try{
   const q=await getSwapQuote({network,fromToken,toToken,amount:amount.replace(',','.'),fromAddress:address,slippageMode,manualSlippage:Number(manualSlippage.replace(',','.'))});setQuote(q);
  }catch(e:any){Alert.alert('Cotação EVM',friendly(String(e?.message||e)))}finally{setBusy(false)}
 }
 async function execute(){
  if(!quote)return;
  const action=async()=>{
   setBusy(true);try{
    const result=await executeSwapQuote(quote);setLast({hash:result.txHash,explorer:result.explorer,network:network.name});setQuote(null);setAmount('');
    Alert.alert('Swap confirmado',`A transação foi confirmada em ${network.name}. A rota foi criada com a partner fee ZORIQ de 0,5% apontada para a Treasury.`);
   }catch(e:any){Alert.alert('Executar swap',friendly(String(e?.shortMessage||e?.message||e)))}finally{setBusy(false)}
  };
  Alert.alert('Confirmar swap',`${amount} ${fromToken.symbol} → ${output?.expected||'—'} ${toToken.symbol}\n${network.name}\n\nSlippage: ${(quote.usedSlippage*100).toFixed(2)}%\nTaxa ZORIQ configurada: ${(quote.feeRate*100).toFixed(2)}%\nGas da rede: separado`,[{text:'Cancelar',style:'cancel'},{text:'Confirmar',onPress:action}]);
 }

 return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <View style={s.head}>
   <View><Text style={s.eyebrow}>ZORIQ SWAP EVM</Text><Text style={s.title}>Troque sem sair da wallet.</Text></View>
   <Pressable onPress={()=>setNetworkPicker(true)} style={s.networkChip}><Text style={s.networkChipText}>{network.short} ▾</Text></Pressable>
  </View>
  <Text style={s.copy}>Cole um contrato. A ZORIQ procura automaticamente em todas as mainnets suportadas e muda para a rede encontrada.</Text>

  <View style={s.swapCard}>
   <AssetBox side="from" label="VOCÊ ENVIA" token={fromToken} contract={fromContract} setContract={setFromContract} amount={amount} setAmount={setAmount} balance={balance} onDetect={()=>detect('from')} onNative={()=>setNative('from')} detecting={detecting==='from'}/>
   <Pressable onPress={reverse} style={s.reverse}><Text style={s.reverseText}>⇅</Text></Pressable>
   <AssetBox side="to" label="VOCÊ RECEBE" token={toToken} contract={toContract} setContract={setToContract} onDetect={()=>detect('to')} onNative={()=>setNative('to')} detecting={detecting==='to'}/>

   {matches?<View style={s.matches}><Text style={s.smallTitle}>MESMO CONTRATO ENCONTRADO EM MAIS DE UMA REDE</Text>{matches.hits.map(h=><Pressable key={`${h.network.chainId}-${h.token?.address}`} onPress={()=>applyHit(matches.side,h)} style={s.match}><View><Text style={s.matchToken}>{h.token?.symbol||'TOKEN'}</Text><Text style={s.matchName}>{h.token?.name||''}</Text></View><Text style={s.matchNet}>{h.network.name} ›</Text></Pressable>)}</View>:null}

   <View style={s.slipHead}><View><Text style={s.smallTitle}>SLIPPAGE</Text><Text style={s.sub}>{slippageMode==='auto'?'AUTO · tenta 0,5% → 1% → 2%':'MANUAL · máximo 5%'}</Text></View><Pressable onPress={()=>{setSlippageMode(v=>v==='auto'?'manual':'auto');setQuote(null)}} style={[s.mode,slippageMode==='auto'&&s.modeOn]}><Text style={s.modeText}>{slippageMode==='auto'?'AUTO':'MANUAL'}</Text></Pressable></View>
   {slippageMode==='manual'?<View style={s.slipChoices}>{['0.1','0.5','1','2'].map(v=><Pressable key={v} onPress={()=>selectManual(v)} style={[s.slipChoice,manualSlippage===v&&s.slipChoiceOn]}><Text style={s.slipChoiceText}>{v}%</Text></Pressable>)}<TextInput value={manualSlippage} onChangeText={v=>selectManual(v.replace(',','.'))} keyboardType="decimal-pad" placeholder="%" placeholderTextColor="#627086" style={s.slipCustom}/></View>:null}

   {quote&&output?<View style={s.quote}>
    <Row k="Você recebe ≈" v={`${trim(output.expected)} ${toToken.symbol}`}/>
    <Row k="Mínimo protegido" v={`${trim(output.minimum)} ${toToken.symbol}`}/>
    <Row k="Rede" v={network.name}/>
    <Row k="Slippage" v={`${(quote.usedSlippage*100).toFixed(2)}%`}/>
    <Row k="Taxa ZORIQ" v={`${(ZORIQ_SWAP_FEE*100).toFixed(2)}% → Treasury`}/>
   </View>:null}

   {!quote?<Pressable disabled={busy||Boolean(detecting)} onPress={makeQuote} style={[s.primary,(busy||Boolean(detecting))&&s.disabled]}><Text style={s.primaryText}>{busy?'COTANDO…':detecting?'IDENTIFICANDO CONTRATO…':'COTAR MELHOR ROTA'}</Text></Pressable>:<Pressable disabled={busy} onPress={execute} style={[s.primary,busy&&s.disabled]}><Text style={s.primaryText}>{busy?'CONFIRMANDO…':'TROCAR AGORA'}</Text></Pressable>}
  </View>

  <View style={s.feeBox}><View><Text style={s.smallTitle}>TREASURY ZORIQ</Text><Text style={s.treasury}>{ZORIQ_TREASURY.slice(0,10)}…{ZORIQ_TREASURY.slice(-6)}</Text></View><View style={s.feePill}><Text style={s.feePillText}>{(fee.fee*100).toFixed(1)}% CONFIGURADA</Text></View></View>
  <Text style={s.note}>A rota só é liberada quando a cotação inclui o modelo de partner fee configurado para a Treasury. Não existe fallback silencioso para uma rota sem taxa. A distribuição econômica final segue as regras do agregador.</Text>

  {last?<Pressable onPress={()=>Linking.openURL(last.explorer)} style={s.last}><View><Text style={s.smallTitle}>ÚLTIMO SWAP · {last.network}</Text><Text style={s.lastHash}>{last.hash.slice(0,13)}…{last.hash.slice(-8)}</Text></View><Text style={s.lastStatus}>EXPLORER ›</Text></Pressable>:null}
  <Text style={s.warning}>⚠ Mainnet usa dinheiro real. Contratos colados são verificados por bytecode e metadados ERC-20, mas isso não significa que o token seja seguro. Confira o contrato antes de assinar.</Text>

  <Modal visible={networkPicker} transparent animationType="fade" onRequestClose={()=>setNetworkPicker(false)}>
   <Pressable style={s.modalBack} onPress={()=>setNetworkPicker(false)}><Pressable style={s.sheet} onPress={()=>{}}><View style={s.sheetHead}><Text style={s.sheetTitle}>Rede do swap</Text><Text style={s.sheetSub}>Seleção discreta · mesma rede para entrada e saída</Text></View><ScrollView>{EVM_NETWORKS.map(n=><Pressable key={n.chainId} onPress={()=>chooseNetwork(n)} style={[s.netItem,n.chainId===network.chainId&&s.netItemOn]}><View><Text style={s.netName}>{n.name}</Text><Text style={s.netMeta}>Chain ID {n.chainId} · gas {n.nativeSymbol}</Text></View><Text style={s.netShort}>{n.short}</Text></Pressable>)}</ScrollView></Pressable></Pressable>
  </Modal>
 </ScrollView>
}

function AssetBox(p:any){return <View style={s.assetBox}>
 <View style={s.assetTop}><View><Text style={s.smallTitle}>{p.label}</Text><Text style={s.tokenName}>{p.token.symbol}</Text><Text numberOfLines={1} style={s.tokenSub}>{p.token.name}</Text></View>{p.side==='from'?<Text style={s.balance}>saldo {trim(p.balance)}</Text>:null}</View>
 {p.side==='from'?<TextInput value={p.amount} onChangeText={(v:string)=>{p.setAmount(v.replace(',','.'))}} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#59667c" style={s.amount}/>:null}
 <View style={s.contractRow}><TextInput value={p.contract} onChangeText={p.setContract} autoCapitalize="none" autoCorrect={false} placeholder="Cole contrato 0x…" placeholderTextColor="#59667c" style={s.contract}/><Pressable onPress={p.onDetect} style={s.detect}><Text style={s.detectText}>{p.detecting?'…':'⌕'}</Text></Pressable></View>
 <View style={s.assetFoot}><Pressable onPress={p.onNative}><Text style={s.native}>Usar moeda nativa</Text></Pressable><Text style={s.autoHint}>{p.detecting?'buscando em todas as redes…':'detecção automática'}</Text></View>
</View>}
function Row({k,v}:{k:string;v:string}){return <View style={s.row}><Text style={s.rowK}>{k}</Text><Text numberOfLines={1} style={s.rowV}>{v}</Text></View>}
function trim(v:string){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:8}):v}
function friendly(m:string){if(m.includes('wallet_missing'))return'Crie ou restaure a wallet antes de trocar.';if(m.includes('quote_expired'))return'A cotação expirou. Gere outra.';if(m.includes('same_asset'))return'Escolha dois ativos diferentes.';if(m.includes('insufficient'))return'Saldo insuficiente para o swap e gas.';if(m.includes('fee_route'))return'Não existe agora uma rota compatível com a taxa ZORIQ. Nenhum swap sem taxa será executado.';if(m.includes('rpc_'))return'Uma das redes não respondeu. Tente novamente.';return m.slice(0,190)}

const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#07080d'},content:{padding:15,paddingBottom:120},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},eyebrow:{color:'#62e4c0',fontSize:10,fontWeight:'900',letterSpacing:1.6},title:{color:'#fff',fontSize:27,fontWeight:'900',marginTop:5,maxWidth:270},copy:{color:'#8492a8',fontSize:12,lineHeight:18,marginTop:8,marginBottom:14},networkChip:{paddingHorizontal:12,paddingVertical:8,borderRadius:15,backgroundColor:'#101722',borderWidth:1,borderColor:'#27364a'},networkChipText:{color:'#d8e6f5',fontSize:9,fontWeight:'900'},swapCard:{backgroundColor:'#0b1017',borderWidth:1,borderColor:'#1c2736',borderRadius:22,padding:12},assetBox:{backgroundColor:'#0f151e',borderWidth:1,borderColor:'#202d3e',borderRadius:18,padding:14},assetTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},smallTitle:{color:'#708098',fontSize:9,fontWeight:'900',letterSpacing:1.15},tokenName:{color:'#fff',fontSize:24,fontWeight:'900',marginTop:5},tokenSub:{color:'#627086',fontSize:10,marginTop:1,maxWidth:230},balance:{color:'#8fa0b7',fontSize:10,fontWeight:'700'},amount:{color:'#fff',fontSize:31,fontWeight:'800',paddingVertical:8},contractRow:{flexDirection:'row',gap:7,marginTop:6},contract:{flex:1,color:'#cdd8e8',backgroundColor:'#090e15',borderWidth:1,borderColor:'#1f2a39',borderRadius:12,paddingHorizontal:11,paddingVertical:10,fontSize:10},detect:{width:42,borderRadius:12,backgroundColor:'#172231',alignItems:'center',justifyContent:'center'},detectText:{color:'#7ce9ca',fontSize:18,fontWeight:'900'},assetFoot:{flexDirection:'row',justifyContent:'space-between',marginTop:8},native:{color:'#65e6c4',fontSize:9,fontWeight:'800'},autoHint:{color:'#59687e',fontSize:8},reverse:{width:36,height:36,borderRadius:18,alignSelf:'center',alignItems:'center',justifyContent:'center',backgroundColor:'#172231',borderWidth:3,borderColor:'#0b1017',marginVertical:-3,zIndex:2},reverseText:{color:'#fff',fontSize:19,fontWeight:'900'},matches:{marginTop:12,borderWidth:1,borderColor:'#2d3c50',borderRadius:14,padding:10,gap:7},match:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:10,backgroundColor:'#101722',borderRadius:11},matchToken:{color:'#fff',fontWeight:'900'},matchName:{color:'#64738a',fontSize:9,marginTop:2},matchNet:{color:'#75e4c4',fontSize:10,fontWeight:'800'},slipHead:{marginTop:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sub:{color:'#697990',fontSize:9,marginTop:3},mode:{paddingHorizontal:11,paddingVertical:7,borderRadius:12,backgroundColor:'#151d28'},modeOn:{backgroundColor:'#173527'},modeText:{color:'#cbe7dd',fontSize:9,fontWeight:'900'},slipChoices:{flexDirection:'row',gap:6,marginTop:9},slipChoice:{paddingHorizontal:10,paddingVertical:8,borderRadius:10,backgroundColor:'#111923'},slipChoiceOn:{borderWidth:1,borderColor:'#65e6c4'},slipChoiceText:{color:'#c5d1e1',fontSize:9,fontWeight:'800'},slipCustom:{width:65,color:'#fff',backgroundColor:'#111923',borderRadius:10,paddingHorizontal:10,paddingVertical:6,fontSize:10},quote:{marginTop:14,padding:12,borderRadius:15,backgroundColor:'#080d13',borderWidth:1,borderColor:'#1d2938'},row:{flexDirection:'row',justifyContent:'space-between',gap:10,paddingVertical:5},rowK:{color:'#708098',fontSize:10},rowV:{color:'#dce8f5',fontSize:10,fontWeight:'800',maxWidth:'60%'},primary:{backgroundColor:'#b8ff49',padding:16,borderRadius:15,alignItems:'center',marginTop:16},primaryText:{color:'#071000',fontWeight:'900',fontSize:12},disabled:{opacity:.5},feeBox:{marginTop:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#0b1118',borderRadius:15,padding:12,borderWidth:1,borderColor:'#1a2735'},treasury:{color:'#a7b6c9',fontSize:10,marginTop:4},feePill:{backgroundColor:'#173527',paddingHorizontal:9,paddingVertical:7,borderRadius:11},feePillText:{color:'#7df0b2',fontSize:8,fontWeight:'900'},note:{color:'#65758c',fontSize:9,lineHeight:14,marginTop:7},last:{marginTop:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:13,borderRadius:15,backgroundColor:'#0d141d'},lastHash:{color:'#b9c8da',fontSize:10,marginTop:4},lastStatus:{color:'#65e6c4',fontSize:9,fontWeight:'900'},warning:{color:'#c6a85c',fontSize:9,lineHeight:15,marginTop:14},modalBack:{flex:1,backgroundColor:'rgba(0,0,0,.72)',justifyContent:'flex-end'},sheet:{maxHeight:'72%',backgroundColor:'#0b1017',borderTopLeftRadius:24,borderTopRightRadius:24,padding:15,borderTopWidth:1,borderColor:'#283648'},sheetHead:{paddingBottom:10},sheetTitle:{color:'#fff',fontSize:20,fontWeight:'900'},sheetSub:{color:'#6f7f95',fontSize:9,marginTop:3},netItem:{padding:14,marginBottom:6,borderRadius:14,backgroundColor:'#101722',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},netItemOn:{borderWidth:1,borderColor:'#65e6c4'},netName:{color:'#fff',fontWeight:'800'},netMeta:{color:'#67778d',fontSize:9,marginTop:3},netShort:{color:'#65e6c4',fontWeight:'900',fontSize:9}
});
