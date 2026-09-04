import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { createRecoveryPhrase, deriveIdentity, isValidRecoveryPhrase, type ZoryqWalletIdentity } from './src/wallet';
import { loadRecoveryPhrase, removeWallet, saveRecoveryPhrase, walletExists } from './src/vault';

const API = 'https://juordakzclqefpuauzjq.supabase.co/functions/v1/zoryq-testnet';
const CHECK = [2, 6, 10] as const;
type Page = 'loading' | 'welcome' | 'backup' | 'verify' | 'import' | 'locked' | 'wallet' | 'reveal';
type Account = { points: number; test_zq_balance: number | string; faucet_claims: number; last_faucet_claim: string | null };

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'request_failed');
  return j;
}

function Btn({ title, onPress, secondary, danger, disabled }: { title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [s.btn, secondary && s.btn2, danger && s.btnDanger, (pressed || disabled) && { opacity: .55 }]}><Text style={[s.btnTxt, !secondary && !danger && { color: '#050508' }]}>{title}</Text></Pressable>;
}

function short(a: string) { return `${a.slice(0, 11)}…${a.slice(-8)}`; }

export default function App() {
  const [page, setPage] = useState<Page>('loading');
  const [identity, setIdentity] = useState<ZoryqWalletIdentity | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [pending, setPending] = useState('');
  const [importValue, setImportValue] = useState('');
  const [verify, setVerify] = useState(['', '', '']);
  const [revealed, setRevealed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const words = useMemo(() => pending.split(' ').filter(Boolean), [pending]);
  const nextClaim = account?.last_faucet_claim ? new Date(account.last_faucet_claim).getTime() + 86400000 : 0;
  const wait = Math.max(0, nextClaim - now);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const sensitive = page === 'backup' || page === 'verify' || page === 'reveal';
    (sensitive ? ScreenCapture.preventScreenCaptureAsync('zoryq-sensitive') : ScreenCapture.allowScreenCaptureAsync('zoryq-sensitive')).catch(() => {});
  }, [page]);
  useEffect(() => { boot(); }, []);

  async function boot() {
    if (!(await walletExists())) return setPage('welcome');
    await unlock();
  }
  async function unlock() {
    setBusy(true); setMessage('');
    try {
      const phrase = await loadRecoveryPhrase();
      const id = deriveIdentity(phrase);
      setIdentity(id); setPage('wallet'); await sync(id.address);
    } catch { setPage('locked'); setMessage('Authenticate with your device to unlock ZORYQ Wallet.'); }
    finally { setBusy(false); }
  }
  async function sync(address = identity?.address) {
    if (!address) return;
    try {
      await api('/api/register', { method: 'POST', body: JSON.stringify({ wallet: address }) });
      const state = await api(`/api/state?wallet=${encodeURIComponent(address)}`);
      setAccount(state.account);
    } catch (e: any) { setMessage(`Wallet is safe locally. Testnet sync: ${e?.message || 'offline'}`); }
  }
  function create() { setMessage(''); setVerify(['', '', '']); setPending(createRecoveryPhrase(12)); setPage('backup'); }
  async function confirmBackup() {
    const expected = CHECK.map(n => words[n - 1]);
    if (expected.some((w, i) => w !== verify[i].trim().toLowerCase())) return setMessage('Recovery check failed. Confirm the requested words.');
    setBusy(true);
    try {
      await saveRecoveryPhrase(pending);
      const id = deriveIdentity(pending); setIdentity(id); setPending(''); setPage('wallet');
      setMessage('Wallet created and recovery backup verified.'); await sync(id.address);
    } catch (e: any) { setMessage(e?.message || 'Could not secure wallet'); }
    finally { setBusy(false); }
  }
  async function restore() {
    const phrase = importValue.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!isValidRecoveryPhrase(phrase)) return setMessage('Invalid BIP-39 phrase. Enter all 12 or 24 words in order.');
    setBusy(true);
    try {
      await saveRecoveryPhrase(phrase); const id = deriveIdentity(phrase); setIdentity(id); setImportValue(''); setPage('wallet');
      setMessage('Wallet restored.'); await sync(id.address);
    } catch (e: any) { setMessage(e?.message || 'Restore failed'); }
    finally { setBusy(false); }
  }
  async function faucet() {
    if (!identity || wait > 0) return;
    setBusy(true);
    try {
      const j = await api('/api/faucet', { method: 'POST', body: JSON.stringify({ wallet: identity.address }) });
      setMessage(j.ok ? `Claim confirmed: +${j.amount} ZQ and +${j.points_awarded} points.` : 'Faucet cooldown active.');
      await sync();
    } catch (e: any) { setMessage(e?.message || 'Faucet failed'); }
    finally { setBusy(false); }
  }
  async function reveal() {
    setBusy(true);
    try { setRevealed(await loadRecoveryPhrase()); setPage('reveal'); }
    catch { setMessage('Authentication failed.'); }
    finally { setBusy(false); }
  }
  async function copy() { if (identity) { await Clipboard.setStringAsync(identity.address); setMessage('Address copied. Verify the first and last characters before use.'); } }
  function remove() {
    Alert.alert('Remove wallet?', 'Only continue if the recovery phrase is backed up.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeWallet(); setIdentity(null); setAccount(null); setPage('welcome'); } },
    ]);
  }
  function clock() {
    if (!wait) return 'AVAILABLE NOW';
    const h = Math.floor(wait / 3600000), m = Math.floor(wait % 3600000 / 60000), sec = Math.floor(wait % 60000 / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  if (page === 'loading') return <SafeAreaView style={s.root}><View style={s.center}><ActivityIndicator size="large" color="#00E5FF" /><Text style={s.muted}>Opening ZORYQ Wallet…</Text></View></SafeAreaView>;

  return <SafeAreaView style={s.root}><StatusBar barStyle="light-content" backgroundColor="#050508" /><ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
    <View style={s.brandRow}><View style={s.logo}><Text style={s.logoTxt}>Z</Text></View><View><Text style={s.brand}>ZORYQ</Text><Text style={s.brandSub}>WALLET • TESTNET</Text></View></View>

    {page === 'welcome' && <View><Text style={s.eye}>SELF-CUSTODY • ML-DSA-65</Text><Text style={s.title}>Your keys. Your ZORYQ.</Text><Text style={s.body}>Create a professional wallet with a BIP-39 recovery phrase. Your seed never leaves this device.</Text><Btn title="CREATE NEW WALLET" onPress={create}/><Btn title="IMPORT 12/24 WORDS" secondary onPress={() => { setMessage(''); setPage('import'); }}/><Text style={s.note}>Never send your recovery phrase to ZORYQ, support, a website, Supabase, Discord, X or anyone else.</Text></View>}

    {page === 'locked' && <View><Text style={s.eye}>WALLET LOCKED</Text><Text style={s.title}>Protected by your device.</Text><Text style={s.body}>{message}</Text><Btn title={busy ? 'UNLOCKING…' : 'UNLOCK WALLET'} disabled={busy} onPress={unlock}/></View>}

    {page === 'backup' && <View><Text style={s.eye}>STEP 1 OF 2 • RECOVERY BACKUP</Text><Text style={s.title}>Write down these 12 words.</Text><Text style={s.body}>Keep them offline, private and in the exact order shown.</Text><View style={s.seedGrid}>{words.map((w, i) => <View style={s.seed} key={`${w}-${i}`}><Text style={s.seedNo}>{i + 1}</Text><Text style={s.seedWord}>{w}</Text></View>)}</View><Text style={s.note}>Screenshots are blocked on this screen when supported.</Text><Btn title="I SAVED THE PHRASE" onPress={() => { setMessage(''); setPage('verify'); }}/><Btn title="DISCARD" secondary onPress={() => { setPending(''); setPage('welcome'); }}/></View>}

    {page === 'verify' && <View><Text style={s.eye}>STEP 2 OF 2 • VERIFY</Text><Text style={s.title}>Confirm your backup.</Text>{CHECK.map((n, i) => <View key={n} style={{ marginTop: 12 }}><Text style={s.label}>WORD #{n}</Text><TextInput style={s.input} secureTextEntry autoCapitalize="none" autoCorrect={false} value={verify[i]} onChangeText={v => setVerify(cur => cur.map((x, k) => k === i ? v : x))}/></View>)}{message ? <Text style={s.err}>{message}</Text> : null}<Btn title={busy ? 'SECURING…' : 'VERIFY & CREATE'} disabled={busy} onPress={confirmBackup}/><Btn title="BACK" secondary onPress={() => setPage('backup')}/></View>}

    {page === 'import' && <View><Text style={s.eye}>RESTORE WALLET</Text><Text style={s.title}>Import recovery phrase.</Text><Text style={s.body}>Enter 12 or 24 BIP-39 words. They are processed locally.</Text><TextInput multiline secureTextEntry autoCapitalize="none" autoCorrect={false} style={[s.input, { minHeight: 150, textAlignVertical: 'top', paddingTop: 15 }]} value={importValue} onChangeText={setImportValue} placeholder="word1 word2 word3 …" placeholderTextColor="#555D72"/>{message ? <Text style={s.err}>{message}</Text> : null}<Btn title={busy ? 'RESTORING…' : 'RESTORE WALLET'} disabled={busy} onPress={restore}/><Btn title="BACK" secondary onPress={() => setPage('welcome')}/></View>}

    {page === 'wallet' && identity && <View><Text style={s.eye}>ZORYQ TESTNET ALPHA</Text><Text style={s.title}>Wallet</Text><View style={s.card}><Text style={s.muted}>ACCOUNT 1 • ML-DSA-65</Text><Text style={s.addr}>{short(identity.address)}</Text><Text style={s.purple}>{identity.derivation}</Text><Btn title="COPY ADDRESS" secondary onPress={copy}/></View><View style={s.stats}><View style={s.stat}><Text style={s.muted}>BALANCE</Text><Text style={s.value}>{Number(account?.test_zq_balance || 0).toFixed(2)}</Text><Text style={s.cyan}>ZQ</Text></View><View style={s.stat}><Text style={s.muted}>POINTS</Text><Text style={s.value}>{account?.points || 0}</Text><Text style={s.cyan}>XP</Text></View><View style={s.stat}><Text style={s.muted}>CLAIMS</Text><Text style={s.value}>{account?.faucet_claims || 0}</Text><Text style={s.cyan}>24H</Text></View></View><View style={s.card}><Text style={s.eye}>FAUCET • 25 ZQ + 50 POINTS</Text><Text style={s.timer}>{clock()}</Text><Btn title={wait ? 'FAUCET LOCKED' : 'CLAIM TESTNET ZQ'} disabled={busy || wait > 0} onPress={faucet}/></View>{message ? <Text style={s.ok}>{message}</Text> : null}<Btn title="REFRESH TESTNET" secondary onPress={() => sync()}/><Btn title="VIEW RECOVERY PHRASE" secondary onPress={reveal}/><Btn title="REMOVE WALLET FROM DEVICE" danger onPress={remove}/></View>}

    {page === 'reveal' && <View><Text style={s.eye}>SENSITIVE • RECOVERY</Text><Text style={s.title}>Recovery phrase</Text><Text style={s.body}>Anyone with these words can control this wallet.</Text><View style={s.seedGrid}>{revealed.split(' ').map((w, i) => <View style={s.seed} key={`${w}-${i}`}><Text style={s.seedNo}>{i + 1}</Text><Text style={s.seedWord}>{w}</Text></View>)}</View><Btn title="HIDE RECOVERY PHRASE" onPress={() => { setRevealed(''); setPage('wallet'); }}/></View>}

    {busy ? <ActivityIndicator color="#00E5FF" style={{ marginTop: 18 }}/> : null}<Text style={s.footer}>ZORYQ Wallet v0.1 • Testnet only • Self-custody</Text>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  root:{flex:1,backgroundColor:'#050508'},wrap:{padding:22,paddingBottom:48,maxWidth:720,width:'100%',alignSelf:'center'},center:{flex:1,justifyContent:'center',alignItems:'center',gap:14},brandRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:38},logo:{width:48,height:48,borderRadius:15,borderWidth:1,borderColor:'#8B5CF6',backgroundColor:'#11131D',alignItems:'center',justifyContent:'center'},logoTxt:{fontSize:25,fontWeight:'900',fontStyle:'italic',color:'#B35CFF'},brand:{fontSize:22,fontWeight:'900',letterSpacing:5,color:'#FFF'},brandSub:{fontSize:9,letterSpacing:2.5,color:'#70788F',marginTop:4},eye:{fontSize:11,fontWeight:'900',letterSpacing:2,color:'#00E5FF',marginBottom:10},title:{fontSize:36,lineHeight:41,fontWeight:'900',letterSpacing:-1,color:'#FFF',marginBottom:14},body:{fontSize:15,lineHeight:23,color:'#9AA2B8',marginBottom:10},muted:{fontSize:10,letterSpacing:1.2,color:'#7C849A'},btn:{minHeight:52,borderRadius:15,backgroundColor:'#00E5FF',alignItems:'center',justifyContent:'center',paddingHorizontal:16,marginTop:12},btn2:{backgroundColor:'#11141E',borderWidth:1,borderColor:'#2B3144'},btnDanger:{backgroundColor:'#211016',borderWidth:1,borderColor:'#6E263D'},btnTxt:{fontSize:12,fontWeight:'900',letterSpacing:1.4,color:'#FFF'},note:{marginTop:18,padding:14,borderRadius:14,borderWidth:1,borderColor:'#273044',backgroundColor:'#0D1119',color:'#A3ABC0',fontSize:13,lineHeight:20},seedGrid:{flexDirection:'row',flexWrap:'wrap',gap:9,marginVertical:20},seed:{width:'48%',minHeight:50,borderRadius:13,borderWidth:1,borderColor:'#33254C',backgroundColor:'#0D0B13',flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:11},seedNo:{fontSize:10,color:'#6E7485',width:18},seedWord:{fontSize:15,fontWeight:'700',color:'#FFF'},label:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:'#9097AA',marginBottom:7},input:{minHeight:52,borderRadius:14,borderWidth:1,borderColor:'#2B3144',backgroundColor:'#0A0D14',color:'#FFF',paddingHorizontal:15,fontSize:15},err:{color:'#FF789D',marginTop:12,lineHeight:20},ok:{color:'#C6FF00',marginTop:12,lineHeight:20},card:{borderRadius:21,borderWidth:1,borderColor:'#292E42',backgroundColor:'#0A0D14',padding:19,marginTop:12},addr:{fontSize:22,fontWeight:'900',color:'#FFF',marginTop:10},purple:{fontSize:10,letterSpacing:1,color:'#A65CFF',marginTop:8},stats:{flexDirection:'row',gap:8,marginTop:12},stat:{flex:1,borderRadius:15,borderWidth:1,borderColor:'#20263A',backgroundColor:'#090C13',padding:12},value:{fontSize:21,fontWeight:'900',color:'#FFF',marginTop:6},cyan:{fontSize:9,fontWeight:'900',color:'#00E5FF',marginTop:3},timer:{fontSize:34,fontWeight:'900',letterSpacing:1.5,color:'#C6FF00',marginVertical:6},footer:{fontSize:10,letterSpacing:1.2,color:'#525A70',textAlign:'center',marginTop:34}
});
