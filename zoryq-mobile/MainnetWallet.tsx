import 'react-native-get-random-values';
import React,{useEffect,useMemo,useState} from 'react';
import {Alert,Linking,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View,RefreshControl} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Contract,HDNodeWallet,JsonRpcProvider,Wallet,formatEther,formatUnits,getAddress,isAddress,parseEther,parseUnits} from 'ethers';
import {BUILTIN_NETWORKS,NetworkConfig,mergeNetworks} from './networks';
import {WatchedToken,presetsFor,tokenKey} from './tokens';
import {SWAP_BACKEND,TREASURY_ADDRESS,WALLET_REVENUE_POLICY,revenueReadiness,revenueReady} from './revenue';

const BASE=process.env.EXPO_PUBLIC_ZORYQ_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const LEGACY_PK='zoryq.wallet.privateKey';
const LEGACY_MNEMONIC='zoryq.wallet.mnemonic';
const PK_KEY='zoryq.wallet.privateKey.v3';
const MNEMONIC_KEY='zoryq.wallet.mnemonic.v3';
const NETWORK_KEY='zoryq.wallet.network.v3';
const CUSTOM_NETWORKS_KEY='zoryq.wallet.customNetworks.v3';
const TOKENS_KEY='zoryq.wallet.tokens.v3';
const ACTIVITY_KEY='zoryq.wallet.activity.v3';
const ERC20_ABI=['function symbol() view returns(string)','function name() view returns(string)','function decimals() view returns(uint8)','function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)'];

type AppWallet=Wallet|HDNodeWallet;
type Tab='wallet'|'send'|'networks'|'tokens'|'swap'|'settings';
type Activity={hash:string;chainId:number;network:string;kind:string;status:'confirmed'|'failed'|'pending';createdAt:number;value?:string;to?:string};
type TokenBalance={token:WatchedToken;balance:string};

function short(a:string){return a?`${a.slice(0,6)}…${a.slice(-4)}`:'—'}
function errMsg(e:any){return e?.shortMessage||e?.reason||e?.message||'Falha inesperada'}
function jsonParse<T>(raw:string|null,fallback:T):T{try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
function explorerTx(network:NetworkConfig,hash:string){return `${network.explorerUrl.replace(/\/$/,'')}/tx/${hash}`}
function strongOptions(strong:boolean){return {requireAuthentication:strong,authenticationPrompt:'Desbloqueie a ZORYQ Wallet',keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY} as const}

export default function MainnetWallet(){
 const [customNetworks,setCustomNetworks]=useState<NetworkConfig[]>([]);
 const networks=useMemo(()=>mergeNetworks(customNetworks),[customNetworks]);
 const [networkId,setNetworkId]=useState('zoryq-testnet');
 const network=useMemo(()=>networks.find(n=>n.id===networkId)||networks[0],[networks,networkId]);
 const provider=useMemo(()=>new JsonRpcProvider(network.rpcUrl,network.chainId,{staticNetwork:true}),[network.chainId,network.rpcUrl]);
 const [wallet,setWallet]=useState<AppWallet|null>(null);
 const [strongVault,setStrongVault]=useState(false);
 const [vaultLoaded,setVaultLoaded]=useState(false);
 const [tab,setTab]=useState<Tab>('wallet');
 const [nativeBalance,setNativeBalance]=useState('0');
 const [block,setBlock]=useState<number|null>(null);
 const [online,setOnline]=useState(false);
 const [refreshing,setRefreshing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [phrase,setPhrase]=useState('');
 const [showPhrase,setShowPhrase]=useState(false);
 const [importing,setImporting]=useState(false);
 const [importPhrase,setImportPhrase]=useState('');
 const [watchlist,setWatchlist]=useState<WatchedToken[]>([]);
 const [tokenBalances,setTokenBalances]=useState<TokenBalance[]>([]);
 const [tokenAddress,setTokenAddress]=useState('');
 const [sendAsset,setSendAsset]=useState<'native'|string>('native');
 const [to,setTo]=useState('');
 const [amount,setAmount]=useState('');
 const [activities,setActivities]=useState<Activity[]>([]);
 const [customName,setCustomName]=useState('');
 const [customChainId,setCustomChainId]=useState('');
 const [customSymbol,setCustomSymbol]=useState('');
 const [customRpc,setCustomRpc]=useState('');
 const [customExplorer,setCustomExplorer]=useState('');

 useEffect(()=>{void bootstrap()},[]);
 useEffect(()=>{if(!wallet)return;setWallet(w=>w?(w.connect(provider) as AppWallet):null)},[provider]);
 useEffect(()=>{if(!wallet)return;void refreshAll(false);const id=setInterval(()=>void refreshAll(false),15000);return()=>clearInterval(id)},[wallet,network.chainId]);

 async function bootstrap(){
  try{
   const strong=SecureStore.canUseBiometricAuthentication();setStrongVault(strong);
   const [savedNetwork,customRaw,tokensRaw,activityRaw]=await Promise.all([
    AsyncStorage.getItem(NETWORK_KEY),AsyncStorage.getItem(CUSTOM_NETWORKS_KEY),AsyncStorage.getItem(TOKENS_KEY),AsyncStorage.getItem(ACTIVITY_KEY)
   ]);
   const custom=jsonParse<NetworkConfig[]>(customRaw,[]).filter(n=>Number.isInteger(n.chainId)&&n.chainId>0&&String(n.rpcUrl).startsWith('https://'));
   setCustomNetworks(custom);setWatchlist(jsonParse<WatchedToken[]>(tokensRaw,[]));setActivities(jsonParse<Activity[]>(activityRaw,[]));
   if(savedNetwork)setNetworkId(savedNetwork);
   const opts=strongOptions(strong);
   let pk=await SecureStore.getItemAsync(PK_KEY,opts).catch(()=>null);
   let mn=await SecureStore.getItemAsync(MNEMONIC_KEY,opts).catch(()=>null);
   if(!pk){
    const oldPk=await SecureStore.getItemAsync(LEGACY_PK).catch(()=>null);
    const oldMn=await SecureStore.getItemAsync(LEGACY_MNEMONIC).catch(()=>null);
    if(oldPk){
     await SecureStore.setItemAsync(PK_KEY,oldPk,opts);if(oldMn)await SecureStore.setItemAsync(MNEMONIC_KEY,oldMn,opts);
     await Promise.all([SecureStore.deleteItemAsync(LEGACY_PK),SecureStore.deleteItemAsync(LEGACY_MNEMONIC)]);pk=oldPk;mn=oldMn;
    }
   }
   if(pk)setWallet(new Wallet(pk,provider));if(mn)setPhrase(mn);
  }finally{setVaultLoaded(true)}
 }

 async function persistWatchlist(next:WatchedToken[]){setWatchlist(next);await AsyncStorage.setItem(TOKENS_KEY,JSON.stringify(next))}
 async function persistActivity(a:Activity){const next=[a,...activities.filter(x=>x.hash!==a.hash)].slice(0,100);setActivities(next);await AsyncStorage.setItem(ACTIVITY_KEY,JSON.stringify(next))}
 async function switchNetwork(next:NetworkConfig){
  try{setBusy(true);const p=new JsonRpcProvider(next.rpcUrl,next.chainId,{staticNetwork:true});const actual=await p.getNetwork();if(Number(actual.chainId)!==next.chainId)throw Error(`RPC respondeu Chain ID ${actual.chainId}, esperado ${next.chainId}`);setNetworkId(next.id);await AsyncStorage.setItem(NETWORK_KEY,next.id);setTab('wallet')}catch(e){Alert.alert('Rede rejeitada',errMsg(e))}finally{setBusy(false)}
 }
 async function refreshAll(show:boolean){
  if(!wallet)return;if(show)setRefreshing(true);
  try{
   const [net,bal,bn]=await Promise.all([provider.getNetwork(),provider.getBalance(wallet.address),provider.getBlockNumber()]);
   if(Number(net.chainId)!==network.chainId)throw Error('RPC retornou Chain ID diferente');
   setNativeBalance(formatEther(bal));setBlock(bn);setOnline(true);
   const tokens=watchlist.filter(t=>t.chainId===network.chainId);
   const rows:TokenBalance[]=[];
   for(const token of tokens){try{const c=new Contract(token.address,ERC20_ABI,provider);const b=await c.balanceOf(wallet.address);rows.push({token,balance:formatUnits(b,token.decimals)})}catch{rows.push({token,balance:'erro'})}}
   setTokenBalances(rows);
  }catch{setOnline(false)}finally{if(show)setRefreshing(false)}
 }
 async function storeWallet(w:AppWallet,mnemonic:string){
  const opts=strongOptions(strongVault);await SecureStore.setItemAsync(PK_KEY,w.privateKey,opts);if(mnemonic)await SecureStore.setItemAsync(MNEMONIC_KEY,mnemonic,opts);
 }
 async function createWallet(){setBusy(true);try{const w=Wallet.createRandom().connect(provider);const mn=w.mnemonic?.phrase||'';if(!mn)throw Error('Não foi possível gerar a frase');await storeWallet(w,mn);setWallet(w);setPhrase(mn);setShowPhrase(true)}catch(e){Alert.alert('Wallet',errMsg(e))}finally{setBusy(false)}}
 async function restoreWallet(){const p=importPhrase.trim().toLowerCase().replace(/\s+/g,' ');if(!p)return;setBusy(true);try{const w=Wallet.fromPhrase(p).connect(provider);await storeWallet(w,p);setWallet(w);setPhrase(p);setImportPhrase('');setImporting(false)}catch(e){Alert.alert('Frase inválida',errMsg(e))}finally{setBusy(false)}}
 async function addToken(addressInput=tokenAddress){
  if(!wallet)return;const raw=addressInput.trim();if(!isAddress(raw))return Alert.alert('Token','Contrato inválido.');
  setBusy(true);try{
   const address=getAddress(raw);const code=await provider.getCode(address);if(code==='0x')throw Error('Não existe contrato nesse endereço nesta rede.');
   const c=new Contract(address,ERC20_ABI,provider);const [symbol,name,decimals]=await Promise.all([c.symbol(),c.name(),c.decimals()]);
   const token:WatchedToken={chainId:network.chainId,address,symbol:String(symbol).slice(0,16),name:String(name).slice(0,64),decimals:Number(decimals),source:'custom'};
   if(token.decimals<0||token.decimals>36)throw Error('Decimals fora do limite aceito.');
   const next=[...watchlist.filter(t=>tokenKey(t)!==tokenKey(token)),token];await persistWatchlist(next);setTokenAddress('');await refreshAll(false);
  }catch(e){Alert.alert('Não foi possível adicionar',errMsg(e))}finally{setBusy(false)}
 }
 async function addPreset(token:WatchedToken){const next=[...watchlist.filter(t=>tokenKey(t)!==tokenKey(token)),token];await persistWatchlist(next);await refreshAll(false)}
 async function removeToken(token:WatchedToken){await persistWatchlist(watchlist.filter(t=>tokenKey(t)!==tokenKey(token)));setTokenBalances(x=>x.filter(r=>tokenKey(r.token)!==tokenKey(token)))}
 async function previewAndSend(){
  if(!wallet||!isAddress(to)||!amount||Number(amount)<=0)return Alert.alert('Dados inválidos','Confira endereço e valor.');
  setBusy(true);try{
   const target=getAddress(to);let txRequest:any;let label:string;
   if(sendAsset==='native'){txRequest={to:target,value:parseEther(amount)};label=`${amount} ${network.symbol}`}
   else{
    const token=watchlist.find(t=>tokenKey(t)===sendAsset&&t.chainId===network.chainId);if(!token)throw Error('Token não encontrado na watchlist');
    const c=new Contract(token.address,ERC20_ABI,wallet);const data=c.interface.encodeFunctionData('transfer',[target,parseUnits(amount,token.decimals)]);txRequest={to:token.address,data};label=`${amount} ${token.symbol}`;
   }
   await provider.call({...txRequest,from:wallet.address});
   const gas=await wallet.estimateGas(txRequest);const fee=await provider.getFeeData();const gasPrice=fee.maxFeePerGas||fee.gasPrice||0n;const maxFee=formatEther(gas*gasPrice);
   Alert.alert('Confirmar transação',`${network.name}\nEnviar: ${label}\nPara: ${target}\nGas máximo estimado: ${Number(maxFee).toPrecision(4)} ${network.symbol}\n\nA ZORYQ Wallet não cobra taxa de serviço em transferências.`,[
    {text:'Cancelar',style:'cancel'},
    {text:'Assinar e enviar',onPress:()=>void executeSend(txRequest,label,target)}
   ]);
  }catch(e){Alert.alert('Simulação falhou',errMsg(e))}finally{setBusy(false)}
 }
 async function executeSend(txRequest:any,label:string,target:string){if(!wallet)return;setBusy(true);try{
  const tx=await wallet.sendTransaction(txRequest);const base:Activity={hash:tx.hash,chainId:network.chainId,network:network.name,kind:'Transferência',status:'pending',createdAt:Date.now(),value:label,to:target};await persistActivity(base);
  const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('Transação falhou');await persistActivity({...base,status:'confirmed'});setTo('');setAmount('');await refreshAll(false);setTab('wallet');Alert.alert('Confirmada',`Transação confirmada em ${network.name}.`)
 }catch(e){Alert.alert('Transação',errMsg(e))}finally{setBusy(false)}}
 async function addCustomNetwork(){
  const chainId=Number(customChainId);if(!customName.trim()||!Number.isSafeInteger(chainId)||chainId<=0||!customSymbol.trim()||!customRpc.startsWith('https://')||!customExplorer.startsWith('https://'))return Alert.alert('Rede','Preencha nome, Chain ID e URLs HTTPS válidas.');
  setBusy(true);try{const p=new JsonRpcProvider(customRpc,chainId,{staticNetwork:true});const actual=await p.getNetwork();if(Number(actual.chainId)!==chainId)throw Error('O RPC não corresponde ao Chain ID informado.');const item:NetworkConfig={id:`custom-${chainId}`,name:customName.trim(),shortName:customName.trim().slice(0,10),chainId,symbol:customSymbol.trim().toUpperCase().slice(0,10),rpcUrl:customRpc.trim(),explorerUrl:customExplorer.trim(),mainnet:true,supports0x:false};const next=[...customNetworks.filter(n=>n.chainId!==chainId),item];setCustomNetworks(next);await AsyncStorage.setItem(CUSTOM_NETWORKS_KEY,JSON.stringify(next));setCustomName('');setCustomChainId('');setCustomSymbol('');setCustomRpc('');setCustomExplorer('');Alert.alert('Rede adicionada',`${item.name} foi validada pelo Chain ID do próprio RPC.`)}catch(e){Alert.alert('Rede rejeitada',errMsg(e))}finally{setBusy(false)}}
 async function wipe(){Alert.alert('Remover wallet deste aparelho','Tenha sua frase de recuperação antes de continuar.',[{text:'Cancelar',style:'cancel'},{text:'Remover',style:'destructive',onPress:async()=>{const opts=strongOptions(strongVault);await Promise.all([SecureStore.deleteItemAsync(PK_KEY,opts),SecureStore.deleteItemAsync(MNEMONIC_KEY,opts)]);setWallet(null);setPhrase('')}}])}

 if(!vaultLoaded)return <SafeAreaView style={s.root}><StatusBar style="light"/><View style={s.center}><Text style={s.hero}>ZORYQ Wallet</Text><Text style={s.muted}>Abrindo cofre seguro…</Text></View></SafeAreaView>;
 if(!wallet)return <SafeAreaView style={s.root}><StatusBar style="light"/><ScrollView contentContainerStyle={s.onboard}><View style={s.logo}><Text style={s.logoText}>Z</Text></View><Text style={s.hero}>ZORYQ Wallet</Text><Text style={s.sub}>Multichain EVM self-custody. A chave fica no aparelho.</Text><View style={s.card}><Text style={s.cardTitle}>Segurança do cofre</Text><Text style={s.muted}>{strongVault?'Biometria disponível: secrets protegidos por autenticação do dispositivo.':'SecureStore criptografado disponível; este dispositivo não oferece biometria forte para o cofre.'}</Text></View>{importing?<View style={s.card}><Text style={s.label}>Frase de recuperação</Text><TextInput style={[s.input,{minHeight:92}]} multiline secureTextEntry value={importPhrase} onChangeText={setImportPhrase} placeholder="12 palavras" placeholderTextColor="#697083"/><Pressable style={s.primary} onPress={restoreWallet} disabled={busy}><Text style={s.primaryText}>{busy?'Restaurando…':'Restaurar wallet'}</Text></Pressable><Pressable style={s.ghost} onPress={()=>setImporting(false)}><Text style={s.ghostText}>Cancelar</Text></Pressable></View>:<><Pressable style={s.primary} onPress={createWallet} disabled={busy}><Text style={s.primaryText}>{busy?'Criando…':'Criar nova wallet'}</Text></Pressable><Pressable style={s.secondary} onPress={()=>setImporting(true)}><Text style={s.secondaryText}>Importar wallet existente</Text></Pressable></>}</ScrollView></SafeAreaView>;

 const networkTokens=tokenBalances;
 return <SafeAreaView style={s.root}><StatusBar style="light"/><View style={s.header}><View><Text style={s.brand}>ZORYQ WALLET</Text><Text style={s.headerSub}>{network.name} · <Text style={{color:online?'#65e6a6':'#ffb86b'}}>{online?'ONLINE':'OFFLINE'}</Text></Text></View><Pressable onPress={()=>Clipboard.setStringAsync(wallet.address)}><Text style={s.address}>{short(wallet.address)}</Text></Pressable></View><View style={s.body}>
  {tab==='wallet'&&<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refreshAll(true)} tintColor="#8b6cff"/>} contentContainerStyle={s.scroll}><View style={s.balanceCard}><Text style={s.eyebrow}>{network.mainnet?'MAINNET':'TESTNET'} · CHAIN {network.chainId}</Text><Text style={s.balance}>{Number(nativeBalance).toFixed(6)} <Text style={s.unit}>{network.symbol}</Text></Text><Text style={s.muted}>{wallet.address}</Text><Text style={s.muted}>Bloco {block??'—'}</Text><View style={s.row}><Pressable style={[s.primary,s.flex]} onPress={()=>setTab('send')}><Text style={s.primaryText}>Enviar</Text></Pressable><Pressable style={[s.secondary,s.flex]} onPress={()=>setTab('networks')}><Text style={s.secondaryText}>Trocar rede</Text></Pressable></View></View>{networkTokens.map(r=><View key={tokenKey(r.token)} style={s.asset}><View><Text style={s.assetSymbol}>{r.token.symbol}</Text><Text style={s.muted}>{r.token.name}</Text></View><Text style={s.assetBalance}>{r.balance==='erro'?'Erro':Number(r.balance).toFixed(6)}</Text></View>)}{network.id==='zoryq-testnet'&&<View style={s.card}><Text style={s.cardTitle}>Ecossistema ZORYQ</Text><Text style={s.muted}>O DEX da testnet já separa 10 bps de cada swap para o protocol treasury. Ativos de testnet não têm valor monetário.</Text><View style={s.row}><Pressable style={[s.secondary,s.flex]} onPress={()=>Linking.openURL(`${BASE}/swap`)}><Text style={s.secondaryText}>Swap</Text></Pressable><Pressable style={[s.secondary,s.flex]} onPress={()=>Linking.openURL(`${BASE}/social`)}><Text style={s.secondaryText}>Social</Text></Pressable></View></View>}<Pressable style={s.ghost} onPress={()=>Linking.openURL(network.explorerUrl)}><Text style={s.link}>Abrir explorer da rede ↗</Text></Pressable></ScrollView>}
  {tab==='send'&&<ScrollView contentContainerStyle={s.scroll}><View style={s.card}><Text style={s.cardTitle}>Enviar ativo</Text><Text style={s.label}>Ativo</Text><View style={s.wrap}><Pressable style={[s.chip,sendAsset==='native'&&s.chipOn]} onPress={()=>setSendAsset('native')}><Text style={s.chipText}>{network.symbol}</Text></Pressable>{watchlist.filter(t=>t.chainId===network.chainId).map(t=><Pressable key={tokenKey(t)} style={[s.chip,sendAsset===tokenKey(t)&&s.chipOn]} onPress={()=>setSendAsset(tokenKey(t))}><Text style={s.chipText}>{t.symbol}</Text></Pressable>)}</View><Text style={s.label}>Destino</Text><TextInput style={s.input} autoCapitalize="none" value={to} onChangeText={setTo} placeholder="0x…" placeholderTextColor="#697083"/><Text style={s.label}>Quantidade</Text><TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor="#697083"/><Text style={s.note}>Antes de assinar, a Wallet simula a chamada, estima gas e mostra rede, valor, destino e taxa máxima estimada.</Text><Pressable style={s.primary} onPress={previewAndSend} disabled={busy}><Text style={s.primaryText}>{busy?'Simulando…':'Revisar transação'}</Text></Pressable></View></ScrollView>}
  {tab==='networks'&&<ScrollView contentContainerStyle={s.scroll}><Text style={s.section}>Redes EVM</Text><Text style={s.note}>Principais mainnets vêm pré-configuradas. Qualquer outra rede EVM pode ser adicionada abaixo; o RPC é validado contra o Chain ID antes de ser salvo.</Text>{networks.map(n=><Pressable key={n.id} style={[s.network,n.id===network.id&&s.networkOn]} onPress={()=>void switchNetwork(n)} disabled={busy}><View><Text style={s.assetSymbol}>{n.name}</Text><Text style={s.muted}>Chain {n.chainId} · {n.symbol}</Text></View><Text style={s.tag}>{n.mainnet?'MAINNET':'TESTNET'}</Text></Pressable>)}<View style={s.card}><Text style={s.cardTitle}>Adicionar rede EVM</Text><TextInput style={s.input} value={customName} onChangeText={setCustomName} placeholder="Nome da rede" placeholderTextColor="#697083"/><TextInput style={s.input} value={customChainId} onChangeText={setCustomChainId} keyboardType="number-pad" placeholder="Chain ID" placeholderTextColor="#697083"/><TextInput style={s.input} value={customSymbol} onChangeText={setCustomSymbol} autoCapitalize="characters" placeholder="Símbolo nativo" placeholderTextColor="#697083"/><TextInput style={s.input} value={customRpc} onChangeText={setCustomRpc} autoCapitalize="none" placeholder="https://RPC" placeholderTextColor="#697083"/><TextInput style={s.input} value={customExplorer} onChangeText={setCustomExplorer} autoCapitalize="none" placeholder="https://explorer" placeholderTextColor="#697083"/><Pressable style={s.primary} onPress={addCustomNetwork} disabled={busy}><Text style={s.primaryText}>Validar e adicionar</Text></Pressable></View></ScrollView>}
  {tab==='tokens'&&<ScrollView contentContainerStyle={s.scroll}><Text style={s.section}>Watchlist de tokens</Text><Text style={s.note}>Adicionar um contrato só faz a Wallet acompanhar saldo. Não cria approval nem concede permissão de gasto. Confirme sempre o endereço oficial do token.</Text>{watchlist.filter(t=>t.chainId===network.chainId).map(t=><View key={tokenKey(t)} style={s.asset}><View style={s.flex}><Text style={s.assetSymbol}>{t.symbol} · {t.name}</Text><Text style={s.muted}>{short(t.address)} · {t.decimals} decimais</Text></View><Pressable onPress={()=>void removeToken(t)}><Text style={s.danger}>Remover</Text></Pressable></View>)}<View style={s.card}><Text style={s.cardTitle}>Adicionar ERC-20 por contrato</Text><TextInput style={s.input} value={tokenAddress} onChangeText={setTokenAddress} autoCapitalize="none" placeholder="0x contrato" placeholderTextColor="#697083"/><Pressable style={s.primary} onPress={()=>void addToken()} disabled={busy}><Text style={s.primaryText}>{busy?'Validando contrato…':'Adicionar à watchlist'}</Text></Pressable></View>{presetsFor(network.chainId).length>0&&<View style={s.card}><Text style={s.cardTitle}>Tokens conhecidos desta rede</Text>{presetsFor(network.chainId).map(t=><Pressable key={tokenKey(t)} style={s.preset} onPress={()=>void addPreset(t)}><Text style={s.assetSymbol}>{t.symbol}</Text><Text style={s.link}>+ adicionar</Text></Pressable>)}</View>}</ScrollView>}
  {tab==='swap'&&<ScrollView contentContainerStyle={s.scroll}><View style={s.card}><Text style={s.cardTitle}>Treasury Revenue Engine</Text><Text style={s.eyebrow}>{revenueReady()?'PRONTO PARA QUOTES':'FAIL-CLOSED'}</Text><Text style={s.muted}>{WALLET_REVENUE_POLICY.description}</Text><Text style={s.metric}>Taxa de integração proposta: {WALLET_REVENUE_POLICY.swapFeeBps/100}% por swap</Text><Text style={s.note}>A taxa deve aparecer no quote antes da assinatura. Transferências normais continuam com taxa ZORYQ Wallet = 0.</Text>{revenueReady()?<><Text style={s.muted}>Treasury: {short(TREASURY_ADDRESS)}</Text><Text style={s.muted}>Backend seguro: configurado</Text></>:<Text style={s.warning}>Bloqueado para mainnet: {revenueReadiness().blockers.join(', ')}. A Wallet não presume um endereço de treasury nem embute API key sensível no APK.</Text>}{network.id==='zoryq-testnet'&&<Pressable style={s.primary} onPress={()=>Linking.openURL(`${BASE}/swap`)}><Text style={s.primaryText}>Abrir ZORYQ DEX</Text></Pressable>}{network.mainnet&&network.supports0x&&<Text style={s.note}>Esta rede está marcada como compatível com o motor de swap integrado. A execução fica habilitada somente quando o backend HTTPS e o treasury de produção forem configurados.</Text>}{SWAP_BACKEND?<Text style={s.muted}>Swap backend: {SWAP_BACKEND}</Text>:null}</View></ScrollView>}
  {tab==='settings'&&<ScrollView contentContainerStyle={s.scroll}><View style={s.card}><Text style={s.cardTitle}>Segurança</Text><Text style={s.metric}>{strongVault?'Cofre biométrico ativo':'SecureStore padrão'}</Text><Text style={s.note}>As chaves não são enviadas à ZORYQ, Railway, RPC ou Treasury. Assinaturas são locais.</Text><Pressable style={s.secondary} onPress={()=>setShowPhrase(true)}><Text style={s.secondaryText}>Exibir frase de recuperação</Text></Pressable></View><View style={s.card}><Text style={s.cardTitle}>Status de lançamento</Text><Text style={s.warning}>PRE-MAINNET WALLET: o código possui proteções de produção, porém auditoria independente, assinatura de release, revisão de dependências, testes em dispositivos reais e configuração final do Treasury continuam obrigatórios antes de declarar o APK pronto para custodiar valor real em escala.</Text></View><View style={s.card}><Text style={s.cardTitle}>Atividade</Text>{activities.slice(0,20).map(a=><Pressable key={`${a.chainId}:${a.hash}`} style={s.activity} onPress={()=>{const n=networks.find(x=>x.chainId===a.chainId);if(n)Linking.openURL(explorerTx(n,a.hash))}}><View style={s.flex}><Text style={s.assetSymbol}>{a.kind} · {a.value||''}</Text><Text style={s.muted}>{a.network} · {a.status} · {short(a.hash)}</Text></View><Text style={s.link}>↗</Text></Pressable>)}</View><Pressable style={s.dangerButton} onPress={wipe}><Text style={s.danger}>Remover wallet deste aparelho</Text></Pressable></ScrollView>}
 </View><View style={s.tabs}>{([['wallet','Wallet'],['send','Enviar'],['networks','Redes'],['tokens','Tokens'],['swap','Swap'],['settings','Ajustes']] as [Tab,string][]).map(([key,label])=><Pressable key={key} style={[s.tab,tab===key&&s.tabOn]} onPress={()=>setTab(key)}><Text style={[s.tabText,tab===key&&s.tabTextOn]}>{label}</Text></Pressable>)}</View>{showPhrase&&<View style={s.overlay}><View style={s.modal}><Text style={s.modalTitle}>Frase de recuperação</Text><Text style={s.warning}>Quem tiver estas palavras controla todos os ativos EVM desta carteira. Nunca envie para suporte, site, bot ou agente.</Text><Text style={s.phrase}>{phrase}</Text><Pressable style={s.secondary} onPress={()=>Clipboard.setStringAsync(phrase)}><Text style={s.secondaryText}>Copiar</Text></Pressable><Pressable style={s.primary} onPress={()=>setShowPhrase(false)}><Text style={s.primaryText}>Fechar</Text></Pressable></View></View>}</SafeAreaView>;
}

const s=StyleSheet.create({root:{flex:1,backgroundColor:'#050609'},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12},onboard:{flexGrow:1,padding:24,justifyContent:'center',gap:14},logo:{width:74,height:74,borderRadius:24,backgroundColor:'#6e4cff',alignItems:'center',justifyContent:'center',alignSelf:'center'},logoText:{color:'#fff',fontSize:42,fontWeight:'900'},hero:{color:'#fff',fontSize:36,fontWeight:'900',textAlign:'center'},sub:{color:'#a6adc0',fontSize:16,textAlign:'center',lineHeight:23,marginBottom:10},header:{paddingHorizontal:18,paddingVertical:12,borderBottomWidth:1,borderColor:'#1b1f2a',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{color:'#fff',fontWeight:'900',fontSize:18},headerSub:{color:'#8e97aa',fontSize:11,marginTop:3},address:{color:'#c9bfff',fontFamily:'monospace'},body:{flex:1},scroll:{padding:16,paddingBottom:34,gap:12},balanceCard:{padding:20,borderRadius:22,backgroundColor:'#0d1018',borderWidth:1,borderColor:'#282f42',gap:7},balance:{color:'#fff',fontSize:34,fontWeight:'900'},unit:{color:'#9c8aff',fontSize:20},eyebrow:{color:'#74efb0',fontSize:11,fontWeight:'800',letterSpacing:1.2},card:{padding:17,borderRadius:18,backgroundColor:'#0c0f16',borderWidth:1,borderColor:'#252c3c',gap:11},cardTitle:{color:'#fff',fontSize:18,fontWeight:'800'},section:{color:'#fff',fontSize:24,fontWeight:'900'},muted:{color:'#929bad',lineHeight:20},note:{color:'#8790a3',fontSize:12,lineHeight:18},warning:{color:'#ffd078',fontSize:12,lineHeight:19},label:{color:'#c4cad5',fontSize:12,fontWeight:'700'},input:{backgroundColor:'#070910',color:'#fff',borderWidth:1,borderColor:'#323a4e',borderRadius:13,paddingHorizontal:14,paddingVertical:13},primary:{backgroundColor:'#704cff',borderRadius:13,padding:14,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},secondary:{backgroundColor:'#141827',borderWidth:1,borderColor:'#343d55',borderRadius:13,padding:13,alignItems:'center'},secondaryText:{color:'#e2ddff',fontWeight:'800'},ghost:{padding:12,alignItems:'center'},ghostText:{color:'#aab2c3'},link:{color:'#8bdcff',fontWeight:'700'},danger:{color:'#ff7f98',fontWeight:'800'},dangerButton:{padding:16,borderWidth:1,borderColor:'#5b2733',borderRadius:14,alignItems:'center'},row:{flexDirection:'row',gap:10,marginTop:8},flex:{flex:1},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:'#343b4e',backgroundColor:'#10141e'},chipOn:{borderColor:'#876cff',backgroundColor:'#211a43'},chipText:{color:'#fff',fontWeight:'800'},asset:{padding:14,borderRadius:15,borderWidth:1,borderColor:'#252c3c',backgroundColor:'#090c12',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},assetSymbol:{color:'#fff',fontWeight:'800'},assetBalance:{color:'#fff',fontSize:18,fontWeight:'800'},network:{padding:14,borderRadius:15,borderWidth:1,borderColor:'#252c3c',backgroundColor:'#090c12',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},networkOn:{borderColor:'#795cff',backgroundColor:'#15112b'},tag:{color:'#7de8aa',fontSize:10,fontWeight:'900'},preset:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:1,borderColor:'#1c2230'},metric:{color:'#fff',fontSize:16,fontWeight:'800'},tabs:{flexDirection:'row',borderTopWidth:1,borderColor:'#1c2130',backgroundColor:'#080a0f',paddingBottom:4},tab:{flex:1,paddingVertical:11,alignItems:'center'},tabOn:{backgroundColor:'#121626'},tabText:{color:'#747d91',fontSize:10,fontWeight:'700'},tabTextOn:{color:'#b6a8ff'},activity:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:10,borderBottomWidth:1,borderColor:'#1c2230'},overlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.88)',alignItems:'center',justifyContent:'center',padding:20},modal:{width:'100%',maxWidth:520,backgroundColor:'#0d1119',borderRadius:20,borderWidth:1,borderColor:'#343b50',padding:20,gap:13},modalTitle:{color:'#fff',fontSize:23,fontWeight:'900'},phrase:{color:'#fff',fontFamily:'monospace',lineHeight:24,padding:14,borderRadius:12,backgroundColor:'#06080d'}});
