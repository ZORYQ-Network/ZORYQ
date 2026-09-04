import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';

import {
  createRecoveryPhrase,
  deriveIdentity,
  isValidRecoveryPhrase,
  type ZoryqWalletIdentity,
} from './src/wallet';
import {
  loadRecoveryPhrase,
  removeWallet,
  saveRecoveryPhrase,
  walletExists,
} from './src/vault';

const API = 'https://juordakzclqefpuauzjq.supabase.co/functions/v1/zoryq-testnet';
const VERIFY_POSITIONS = [2, 6, 10] as const;

type Screen = 'loading' | 'welcome' | 'backup' | 'verify' | 'import' | 'locked' | 'wallet' | 'reveal';

type TestnetAccount = {
  points: number;
  test_zq_balance: number | string;
  faucet_claims: number;
  last_faucet_claim: string | null;
};

function shortAddress(value?: string) {
  if (!value) return '';
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || 'Network request failed');
  return json;
}

function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && { opacity: 0.62 },
      ]}
    >
      <Text style={[styles.buttonText, variant === 'primary' && { color: '#050508' }]}>{title}</Text>
    </Pressable>
  );
}

function Brand() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.logo}><Text style={styles.logoText}>Z</Text></View>
      <View>
        <Text style={styles.brand}>ZORYQ</Text>
        <Text style={styles.brandSub}>WALLET • TESTNET</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [pendingMnemonic, setPendingMnemonic] = useState('');
  const [importText, setImportText] = useState('');
  const [verifyWords, setVerifyWords] = useState(['', '', '']);
  const [identity, setIdentity] = useState<ZoryqWalletIdentity | null>(null);
  const [account, setAccount] = useState<TestnetAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recoveryReveal, setRecoveryReveal] = useState('');
  const [now, setNow] = useState(Date.now());

  const pendingWords = useMemo(() => pendingMnemonic.split(' ').filter(Boolean), [pendingMnemonic]);
  const nextClaimAt = account?.last_faucet_claim
    ? new Date(account.last_faucet_claim).getTime() + 24 * 60 * 60 * 1000
    : 0;
  const cooldownMs = Math.max(0, nextClaimAt - now);
  const faucetReady = !!identity && cooldownMs === 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const protect = ['backup', 'verify', 'reveal'].includes(screen);
    if (protect) {
      ScreenCapture.preventScreenCaptureAsync('zoryq-wallet-sensitive').catch(() => {});
    } else {
      ScreenCapture.allowScreenCaptureAsync('zoryq-wallet-sensitive').catch(() => {});
    }
    return () => {
      ScreenCapture.allowScreenCaptureAsync('zoryq-wallet-sensitive').catch(() => {});
    };
  }, [screen]);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      if (!(await walletExists())) {
        setScreen('welcome');
        return;
      }
      await unlock();
    } catch {
      setScreen('locked');
    }
  }

  async function unlock() {
    setBusy(true);
    setMessage('');
    try {
      const mnemonic = await loadRecoveryPhrase();
      const nextIdentity = deriveIdentity(mnemonic);
      setIdentity(nextIdentity);
      setScreen('wallet');
      await syncTestnet(nextIdentity.address);
    } catch (error: any) {
      setMessage(error?.message || 'Could not unlock wallet');
      setScreen('locked');
    } finally {
      setBusy(false);
    }
  }

  function createWallet() {
    const mnemonic = createRecoveryPhrase(12);
    setPendingMnemonic(mnemonic);
    setVerifyWords(['', '', '']);
    setScreen('backup');
  }

  async function finishCreate() {
    const expected = VERIFY_POSITIONS.map((position) => pendingWords[position - 1]);
    const supplied = verifyWords.map((word) => word.trim().toLowerCase());
    if (expected.some((word, index) => word !== supplied[index])) {
      setMessage('One or more recovery words are incorrect. Check your backup and try again.');
      return;
    }
    setBusy(true);
    try {
      await saveRecoveryPhrase(pendingMnemonic);
      const nextIdentity = deriveIdentity(pendingMnemonic);
      setIdentity(nextIdentity);
      setPendingMnemonic('');
      setVerifyWords(['', '', '']);
      setMessage('Wallet created. Recovery phrase verified and protected on this device.');
      setScreen('wallet');
      await syncTestnet(nextIdentity.address);
    } catch (error: any) {
      setMessage(error?.message || 'Could not save wallet securely');
    } finally {
      setBusy(false);
    }
  }

  async function importWallet() {
    const mnemonic = importText.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!isValidRecoveryPhrase(mnemonic)) {
      setMessage('Invalid BIP-39 recovery phrase. Enter all 12 or 24 words in the correct order.');
      return;
    }
    setBusy(true);
    try {
      const nextIdentity = deriveIdentity(mnemonic);
      await saveRecoveryPhrase(mnemonic);
      setIdentity(nextIdentity);
      setImportText('');
      setMessage('Wallet restored successfully.');
      setScreen('wallet');
      await syncTestnet(nextIdentity.address);
    } catch (error: any) {
      setMessage(error?.message || 'Could not restore wallet');
    } finally {
      setBusy(false);
    }
  }

  async function syncTestnet(address = identity?.address) {
    if (!address) return;
    try {
      await api('/api/register', { method: 'POST', body: JSON.stringify({ wallet: address }) });
      const state = await api(`/api/state?wallet=${encodeURIComponent(address)}`);
      setAccount(state.account);
    } catch (error: any) {
      setMessage(`Wallet is local and safe. Testnet sync failed: ${error?.message || 'offline'}`);
    }
  }

  async function claimFaucet() {
    if (!identity || !faucetReady) return;
    setBusy(true);
    try {
      const result = await api('/api/faucet', {
        method: 'POST',
        body: JSON.stringify({ wallet: identity.address }),
      });
      if (result.ok) {
        setMessage(`Claim confirmed: +${result.amount} ZQ and +${result.points_awarded} points.`);
      } else if (result.code === 'cooldown') {
        setMessage('This wallet is still inside the 24-hour faucet cooldown.');
      }
      await syncTestnet();
    } catch (error: any) {
      setMessage(error?.message || 'Faucet request failed');
    } finally {
      setBusy(false);
    }
  }

  async function revealRecovery() {
    setBusy(true);
    try {
      const mnemonic = await loadRecoveryPhrase();
      setRecoveryReveal(mnemonic);
      setScreen('reveal');
    } catch (error: any) {
      setMessage(error?.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!identity) return;
    await Clipboard.setStringAsync(identity.address);
    setMessage('Address copied. Always verify the first and last characters before sending funds.');
  }

  function confirmRemove() {
    Alert.alert(
      'Remove wallet from this device?',
      'Only continue if your recovery phrase is safely backed up. This cannot be undone without the phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeWallet();
            setIdentity(null);
            setAccount(null);
            setRecoveryReveal('');
            setScreen('welcome');
          },
        },
      ],
    );
  }

  function cooldownText() {
    if (cooldownMs <= 0) return 'AVAILABLE NOW';
    const hours = Math.floor(cooldownMs / 3600000);
    const minutes = Math.floor((cooldownMs % 3600000) / 60000);
    const seconds = Math.floor((cooldownMs % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (screen === 'loading') {
    return <SafeAreaView style={styles.root}><StatusBar barStyle="light-content" /><View style={styles.center}><ActivityIndicator color="#00E5FF" size="large" /><Text style={styles.muted}>Opening ZORYQ Wallet…</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050508" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Brand />

        {screen === 'welcome' && (
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>SELF-CUSTODY • POST-QUANTUM TESTNET</Text>
            <Text style={styles.title}>Your keys. Your ZORYQ.</Text>
            <Text style={styles.body}>Create a wallet with a standard BIP-39 recovery phrase. ZORYQ derives a deterministic ML-DSA-65 identity locally on your device.</Text>
            <View style={styles.gap} />
            <Button title="CREATE NEW WALLET" onPress={createWallet} />
            <Button title="IMPORT RECOVERY PHRASE" variant="secondary" onPress={() => { setMessage(''); setScreen('import'); }} />
            <View style={styles.notice}><Text style={styles.noticeText}>ZORYQ never asks you to send your seed phrase to a website, support agent, Discord, X, Supabase or API.</Text></View>
          </View>
        )}

        {screen === 'locked' && (
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>WALLET LOCKED</Text>
            <Text style={styles.title}>Protected on this device.</Text>
            <Text style={styles.body}>Authenticate with your device security to unlock your ZORYQ Wallet.</Text>
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Button title={busy ? 'UNLOCKING…' : 'UNLOCK WALLET'} onPress={unlock} disabled={busy} />
          </View>
        )}

        {screen === 'backup' && (
          <View>
            <Text style={styles.eyebrow}>STEP 1 OF 2 • BACKUP</Text>
            <Text style={styles.title}>Write down these 12 words.</Text>
            <Text style={styles.body}>They are the only recovery method for this wallet. Keep them offline and in order. Never photograph, upload or message them.</Text>
            <View style={styles.seedGrid}>
              {pendingWords.map((word, index) => (
                <View style={styles.seedWord} key={`${word}-${index}`}><Text style={styles.seedNumber}>{index + 1}</Text><Text style={styles.seedText}>{word}</Text></View>
              ))}
            </View>
            <View style={styles.notice}><Text style={styles.noticeText}>Screenshots are blocked on this screen when supported by the device.</Text></View>
            <Button title="I SAVED MY RECOVERY PHRASE" onPress={() => { setMessage(''); setScreen('verify'); }} />
            <Button title="CANCEL AND DISCARD" variant="secondary" onPress={() => { setPendingMnemonic(''); setScreen('welcome'); }} />
          </View>
        )}

        {screen === 'verify' && (
          <View>
            <Text style={styles.eyebrow}>STEP 2 OF 2 • VERIFY BACKUP</Text>
            <Text style={styles.title}>Confirm your recovery phrase.</Text>
            <Text style={styles.body}>Enter the requested words exactly as you wrote them down.</Text>
            {VERIFY_POSITIONS.map((position, index) => (
              <View key={position} style={styles.fieldWrap}>
                <Text style={styles.label}>WORD #{position}</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={styles.input}
                  value={verifyWords[index]}
                  onChangeText={(value) => setVerifyWords((current) => current.map((item, i) => i === index ? value : item))}
                />
              </View>
            ))}
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Button title={busy ? 'SECURING WALLET…' : 'VERIFY & CREATE WALLET'} onPress={finishCreate} disabled={busy} />
            <Button title="BACK" variant="secondary" onPress={() => setScreen('backup')} />
          </View>
        )}

        {screen === 'import' && (
          <View>
            <Text style={styles.eyebrow}>RESTORE WALLET</Text>
            <Text style={styles.title}>Import recovery phrase.</Text>
            <Text style={styles.body}>Enter your 12 or 24 BIP-39 words. Processing happens locally on this device.</Text>
            <TextInput
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textAlignVertical="top"
              placeholder="word1 word2 word3 …"
              placeholderTextColor="#596078"
              style={[styles.input, styles.seedInput]}
              value={importText}
              onChangeText={setImportText}
            />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Button title={busy ? 'RESTORING…' : 'RESTORE ZORYQ WALLET'} onPress={importWallet} disabled={busy} />
            <Button title="BACK" variant="secondary" onPress={() => { setMessage(''); setScreen('welcome'); }} />
          </View>
        )}

        {screen === 'wallet' && identity && (
          <View>
            <Text style={styles.eyebrow}>ZORYQ TESTNET ALPHA</Text>
            <Text style={styles.title}>Wallet</Text>
            <View style={styles.walletCard}>
              <Text style={styles.muted}>ACCOUNT 1</Text>
              <Text style={styles.address}>{shortAddress(identity.address)}</Text>
              <Text style={styles.derivation}>ML-DSA-65 • {identity.derivation}</Text>
              <Button title="COPY ADDRESS" variant="secondary" onPress={copyAddress} />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.muted}>BALANCE</Text><Text style={styles.statValue}>{Number(account?.test_zq_balance || 0).toFixed(2)}</Text><Text style={styles.statUnit}>ZQ</Text></View>
              <View style={styles.stat}><Text style={styles.muted}>POINTS</Text><Text style={styles.statValue}>{account?.points || 0}</Text><Text style={styles.statUnit}>XP</Text></View>
              <View style={styles.stat}><Text style={styles.muted}>CLAIMS</Text><Text style={styles.statValue}>{account?.faucet_claims || 0}</Text><Text style={styles.statUnit}>24H</Text></View>
            </View>

            <View style={styles.faucetCard}>
              <Text style={styles.eyebrow}>FAUCET • 25 ZQ + 50 POINTS</Text>
              <Text style={styles.faucetTimer}>{cooldownText()}</Text>
              <Text style={styles.body}>{faucetReady ? 'This wallet can claim testnet funds now.' : 'Same-wallet cooldown is active for 24 hours after each claim.'}</Text>
              <Button title={busy ? 'PROCESSING…' : faucetReady ? 'CLAIM TESTNET ZQ' : 'FAUCET LOCKED'} onPress={claimFaucet} disabled={busy || !faucetReady} />
            </View>

            {message ? <Text style={styles.success}>{message}</Text> : null}
            <Button title="REFRESH TESTNET" variant="secondary" onPress={() => syncTestnet()} />
            <Button title="VIEW RECOVERY PHRASE" variant="secondary" onPress={revealRecovery} />
            <Button title="REMOVE WALLET FROM DEVICE" variant="danger" onPress={confirmRemove} />
          </View>
        )}

        {screen === 'reveal' && (
          <View>
            <Text style={styles.eyebrow}>SENSITIVE • RECOVERY</Text>
            <Text style={styles.title}>Recovery phrase</Text>
            <Text style={styles.body}>Anyone with these words can control this wallet. Verify privacy around you before viewing.</Text>
            <View style={styles.seedGrid}>
              {recoveryReveal.split(' ').map((word, index) => (
                <View style={styles.seedWord} key={`${word}-${index}`}><Text style={styles.seedNumber}>{index + 1}</Text><Text style={styles.seedText}>{word}</Text></View>
              ))}
            </View>
            <Button title="HIDE RECOVERY PHRASE" onPress={() => { setRecoveryReveal(''); setScreen('wallet'); }} />
          </View>
        )}

        {busy && screen !== 'loading' ? <ActivityIndicator style={{ marginTop: 18 }} color="#00E5FF" /> : null}
        <Text style={styles.footer}>ZORYQ Wallet v0.1 • Testnet only • Self-custody</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },
  container: { padding: 22, paddingBottom: 44, maxWidth: 720, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
  logo: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#11131d', borderWidth: 1, borderColor: '#845EF7' },
  logoText: { color: '#B35CFF', fontWeight: '900', fontSize: 25, fontStyle: 'italic' },
  brand: { color: '#FFFFFF', fontSize: 22, letterSpacing: 5, fontWeight: '900' },
  brandSub: { color: '#717890', fontSize: 9, letterSpacing: 2.5, marginTop: 4 },
  hero: { paddingTop: 24 },
  eyebrow: { color: '#00E5FF', fontWeight: '800', letterSpacing: 2.4, fontSize: 11, marginBottom: 10 },
  title: { color: '#FFFFFF', fontSize: 36, lineHeight: 41, fontWeight: '900', letterSpacing: -1, marginBottom: 14 },
  body: { color: '#9AA1B8', fontSize: 15, lineHeight: 23 },
  muted: { color: '#7D859D', fontSize: 11, letterSpacing: 1.1 },
  gap: { height: 18 },
  button: { minHeight: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 18 },
  buttonPrimary: { backgroundColor: '#00E5FF' },
  buttonSecondary: { backgroundColor: '#11141E', borderWidth: 1, borderColor: '#2A3042' },
  buttonDanger: { backgroundColor: '#211016', borderWidth: 1, borderColor: '#6E263D' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 1.4, fontSize: 12 },
  notice: { backgroundColor: '#0D1119', borderWidth: 1, borderColor: '#273044', borderRadius: 14, padding: 14, marginTop: 18 },
  noticeText: { color: '#A3ABC0', lineHeight: 20, fontSize: 13 },
  seedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 22 },
  seedWord: { width: '48%', minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#31264B', backgroundColor: '#0D0B13', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  seedNumber: { color: '#6F7283', width: 20, fontSize: 11 },
  seedText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  fieldWrap: { marginTop: 14 },
  label: { color: '#8C93A8', fontSize: 10, letterSpacing: 1.7, fontWeight: '800', marginBottom: 7 },
  input: { color: '#FFFFFF', minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#2B3144', backgroundColor: '#0A0D14', paddingHorizontal: 15, fontSize: 15 },
  seedInput: { minHeight: 150, paddingTop: 16, marginVertical: 18 },
  error: { color: '#FF789D', lineHeight: 20, marginTop: 14 },
  success: { color: '#C6FF00', lineHeight: 20, marginTop: 14 },
  walletCard: { backgroundColor: '#0B0D14', borderWidth: 1, borderColor: '#2D2B44', borderRadius: 22, padding: 20, marginTop: 6 },
  address: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', marginTop: 10, letterSpacing: 0.3 },
  derivation: { color: '#A35CFF', fontSize: 11, marginTop: 8, marginBottom: 8, letterSpacing: 1.2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: '#0A0D13', borderWidth: 1, borderColor: '#20273A', borderRadius: 16, padding: 13 },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 7 },
  statUnit: { color: '#00E5FF', fontSize: 9, fontWeight: '800', marginTop: 3 },
  faucetCard: { backgroundColor: '#080C12', borderWidth: 1, borderColor: '#183F46', borderRadius: 22, padding: 20, marginTop: 14 },
  faucetTimer: { color: '#C6FF00', fontSize: 36, fontWeight: '900', letterSpacing: 2, marginBottom: 9 },
  footer: { color: '#535A70', textAlign: 'center', fontSize: 10, letterSpacing: 1.2, marginTop: 36 },
});
