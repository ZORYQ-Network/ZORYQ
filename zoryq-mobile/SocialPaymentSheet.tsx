import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {DEFAULT_SOCIAL_FEE_BPS,PaymentAsset,PaymentNetwork,SOCIAL_PAYMENT_NETWORKS,feePercentLabel,previewSocialPayment,sendSocialProfilePayment} from './socialPayments';

type Target={id:string;name:string;address:string};
type Props={visible:boolean;target:Target|null;onClose:()=>void;colors:any};

export default function SocialPaymentSheet({visible,target,onClose,colors:c}:Props){
 const first=SOCIAL_PAYMENT_NETWORKS.find(n=>n.routerAddress)||SOCIAL_PAYMENT_NETWORKS[0];
 const [network,setNetwork]=useState<PaymentNetwork>(first);
 const [asset,setAsset]=useState<PaymentAsset>(first.assets[0]);
 const [amount,setAmount]=useState('');
 const [busy,setBusy]=useState(false);
 const s=useMemo(()=>styles(c),[c]);
 useEffect(()=>{setAsset(network.assets[0]);setAmount('')},[network.chainId]);
 useEffect(()=>{if(!visible)setAmount('')},[visible]);
 let preview:any=null;try{if(amount&&Number(amount)>0)preview=previewSocialPayment(amount,asset,DEFAULT_SOCIAL_FEE_BPS)}catch{}
 const ready=Boolean(network.routerAddress&&target&&amount&&Number(amount)>0);
 async function send(){
  if(!target||!ready)return;
  try{
   setBusy(true);
   const result=await sendSocialProfilePayment({recipient:target.address,profileId:target.id,network,asset,amount});
   Alert.alert('Pagamento confirmado',`${result.recipientAmount} ${result.asset} enviados ao perfil.\nTaxa ZORIQ: ${result.protocolFee} ${result.asset} (${feePercentLabel(result.feeBps)}).\n\n${result.txHash}`);
   onClose();
  }catch(e:any){
   const m=String(e?.shortMessage||e?.message||e);
   Alert.alert('Enviar cripto',friendly(m));
  }finally{setBusy(false)}
 }
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <View style={s.back}><View style={s.sheet}>
   <View style={s.head}><View><Text style={s.title}>$ Enviar cripto</Text><Text style={s.sub}>{target?.name||'Perfil ZORIQ'}</Text></View><Pressable onPress={onClose}><Text style={s.close}>×</Text></Pressable></View>
   <Text style={s.label}>REDE</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{SOCIAL_PAYMENT_NETWORKS.map(n=><Pressable key={n.chainId} onPress={()=>setNetwork(n)} style={[s.chip,network.chainId===n.chainId&&s.chipOn,!n.routerAddress&&s.chipOff]}><Text style={[s.chipText,network.chainId===n.chainId&&s.chipTextOn]}>{n.name}</Text><Text style={s.chipMeta}>{n.routerAddress?'ativo':'router pendente'}</Text></Pressable>)}</ScrollView>
   <Text style={s.label}>ATIVO</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{network.assets.map(a=><Pressable key={`${network.chainId}-${a.symbol}`} onPress={()=>{setAsset(a);setAmount('')}} style={[s.asset,asset.symbol===a.symbol&&s.assetOn]}><Text style={[s.assetText,asset.symbol===a.symbol&&s.assetTextOn]}>{a.symbol}</Text><Text style={s.assetName}>{a.name}</Text></Pressable>)}</ScrollView>
   <TextInput value={amount} onChangeText={v=>setAmount(v.replace(',','.'))} keyboardType="decimal-pad" placeholder={`0.00 ${asset.symbol}`} placeholderTextColor={c.muted} style={s.amount}/>
   <View style={s.summary}>
    <View style={s.row}><Text style={s.key}>Destinatário verificado</Text><Text style={s.value}>{short(target?.address||'')}</Text></View>
    <View style={s.row}><Text style={s.key}>Recebe</Text><Text style={s.value}>{preview?`${preview.netText} ${asset.symbol}`:'—'}</Text></View>
    <View style={s.row}><Text style={s.key}>Taxa ZORIQ</Text><Text style={s.fee}>{preview?`${preview.feeText} ${asset.symbol} · ${feePercentLabel(DEFAULT_SOCIAL_FEE_BPS)}`:feePercentLabel(DEFAULT_SOCIAL_FEE_BPS)}</Text></View>
    <View style={s.row}><Text style={s.key}>Gas</Text><Text style={s.value}>cobrado pela rede</Text></View>
   </View>
   {!network.routerAddress?<Text style={s.warning}>O suporte para {network.name} já está preparado, mas o ZORIQ Social Pay Router ainda precisa ser implantado nessa rede. A transferência com taxa fica bloqueada até existir um router verificado.</Text>:null}
   {network.mainnet?<Text style={s.mainnet}>⚠ Esta é uma mainnet: {asset.symbol} possui valor real. Confira rede, ativo, valor e destinatário antes de confirmar.</Text>:<Text style={s.testnet}>Testnet: ativos de teste não representam valor monetário real.</Text>}
   <Pressable disabled={!ready||busy} onPress={send} style={[s.pay,(!ready||busy)&&s.disabled]}><Text style={s.payText}>{busy?'Confirmando…':`Enviar ${asset.symbol}`}</Text></Pressable>
   <Text style={s.note}>Antes de assinar, a ZORIQ reconfirma no backend a wallet EVM verificada deste perfil. O contrato divide a operação atomicamente: perfil + Treasury. Sua seed e chave privada nunca são enviadas ao servidor.</Text>
  </View></View>
 </Modal>
}
function short(v:string){return v&&v.length>18?`${v.slice(0,8)}…${v.slice(-6)}`:v}
function friendly(m:string){
 if(m.includes('payment_router_not_deployed'))return'Router de pagamento ainda não implantado nesta rede.';
 if(m.includes('payment_destination_changed'))return'A wallet verificada deste perfil mudou desde que você abriu o pagamento. Feche e abra novamente o botão $ para revisar o novo destino.';
 if(m.includes('payment_destination_unavailable'))return'Este perfil não está mais habilitado para receber cripto por uma wallet verificada.';
 if(m.includes('auth_required'))return'Entre com sua wallet na ZORIQ Social antes de enviar cripto.';
 if(m.includes('wallet_missing'))return'Crie ou restaure sua wallet primeiro.';
 if(m.includes('insufficient_token_balance'))return'Saldo do token insuficiente.';
 if(m.includes('insufficient_funds'))return'Saldo insuficiente para o valor e gas.';
 if(m.includes('rpc_unavailable'))return'A rede selecionada está indisponível no momento.';
 if(m.includes('approval_reset_failed'))return'Não foi possível redefinir a autorização anterior deste token.';
 if(m.includes('approval_failed'))return'A aprovação do token não foi confirmada.';
 return m.slice(0,180)
}
function styles(c:any){return StyleSheet.create({back:{flex:1,backgroundColor:'rgba(0,0,0,.62)',justifyContent:'flex-end'},sheet:{maxHeight:'92%',backgroundColor:c.panel,borderTopLeftRadius:25,borderTopRightRadius:25,padding:18,paddingBottom:28},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},title:{color:c.text,fontSize:23,fontWeight:'900'},sub:{color:c.muted,fontSize:11,marginTop:2},close:{color:c.text,fontSize:32},label:{color:c.muted,fontSize:9,fontWeight:'900',letterSpacing:1.2,marginTop:7,marginBottom:6},chips:{gap:7,paddingRight:14},chip:{borderWidth:1,borderColor:c.border,borderRadius:12,paddingHorizontal:12,paddingVertical:9,minWidth:102},chipOn:{borderColor:c.cyan,backgroundColor:c.panel2},chipOff:{opacity:.55},chipText:{color:c.muted,fontSize:10,fontWeight:'800'},chipTextOn:{color:c.text},chipMeta:{color:c.muted,fontSize:7,marginTop:3},asset:{borderWidth:1,borderColor:c.border,borderRadius:12,paddingHorizontal:13,paddingVertical:9,minWidth:90},assetOn:{borderColor:c.lime,backgroundColor:c.panel2},assetText:{color:c.text,fontSize:14,fontWeight:'900'},assetTextOn:{color:c.lime},assetName:{color:c.muted,fontSize:8,marginTop:2},amount:{backgroundColor:c.input,borderWidth:1,borderColor:c.border,borderRadius:15,color:c.text,padding:14,fontSize:24,fontWeight:'900',marginTop:13},summary:{backgroundColor:c.panel2,borderRadius:14,padding:12,marginTop:10,gap:8},row:{flexDirection:'row',justifyContent:'space-between',gap:12},key:{color:c.muted,fontSize:10},value:{color:c.text,fontSize:10,fontWeight:'800'},fee:{color:c.lime,fontSize:10,fontWeight:'900'},warning:{color:'#ffb36b',fontSize:10,lineHeight:15,marginTop:10},mainnet:{color:'#ffcf66',fontSize:10,lineHeight:15,marginTop:10},testnet:{color:c.cyan,fontSize:9,marginTop:10},pay:{backgroundColor:c.lime,borderRadius:13,paddingVertical:13,alignItems:'center',marginTop:12},disabled:{opacity:.42},payText:{color:'#071000',fontWeight:'900'},note:{color:c.muted,fontSize:8,lineHeight:13,textAlign:'center',marginTop:9}})}
