import * as SecureStore from 'expo-secure-store';

const MNEMONIC_KEY = 'zoryq.wallet.mnemonic.v1';
const EXISTS_KEY = 'zoryq.wallet.exists.v1';

const authOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock ZORYQ Wallet',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function walletExists() {
  return (await SecureStore.getItemAsync(EXISTS_KEY)) === '1';
}

export async function saveRecoveryPhrase(mnemonic: string) {
  const value = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  await SecureStore.setItemAsync(MNEMONIC_KEY, value, authOptions);
  await SecureStore.setItemAsync(EXISTS_KEY, '1');
}

export async function loadRecoveryPhrase() {
  const mnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY, authOptions);
  if (!mnemonic) throw new Error('Wallet is locked or recovery material is missing');
  return mnemonic;
}

export async function removeWallet() {
  await SecureStore.deleteItemAsync(MNEMONIC_KEY, authOptions);
  await SecureStore.deleteItemAsync(EXISTS_KEY);
}
