import { identity, signMessage, signTransaction } from './core';

declare const chrome: any;

const ALLOWED = new Set([
  'https://zoryq-testnet.vercel.app',
  'https://juordakzclqefpuauzjq.supabase.co',
]);

let unlockedPhrase = '';
let unlockedAddress = '';

function senderOrigin(sender: any) {
  try { return new URL(sender?.url || sender?.tab?.url || '').origin; } catch { return ''; }
}
function assertOrigin(sender: any) {
  const origin = senderOrigin(sender);
  if (!ALLOWED.has(origin)) throw new Error('Origin is not authorized by ZORYQ Wallet.');
}
function assertUnlocked() {
  if (!unlockedPhrase) throw new Error('ZORYQ Wallet is locked. Open the extension and unlock it first.');
}

chrome.runtime.onMessage.addListener((msg: any, sender: any, sendResponse: (x: any) => void) => {
  (async () => {
    if (!msg?.type) return { ok:false, error:'invalid_message' };

    if (msg.type === 'wallet_unlock') {
      const phrase = String(msg.phrase || '');
      const id = identity(phrase);
      if (msg.address && id.address !== msg.address) throw new Error('Wallet integrity check failed.');
      unlockedPhrase = phrase;
      unlockedAddress = id.address;
      return { ok:true, address:id.address };
    }
    if (msg.type === 'wallet_lock') {
      unlockedPhrase = '';
      unlockedAddress = '';
      return { ok:true };
    }
    if (msg.type === 'wallet_status') return { ok:true, unlocked:!!unlockedPhrase, address:unlockedAddress || null };

    if (msg.type === 'wallet_sign_message') {
      assertOrigin(sender); assertUnlocked();
      const signed = signMessage(unlockedPhrase, String(msg.message || ''));
      if (signed.address !== unlockedAddress) throw new Error('Signer integrity check failed.');
      return { ok:true, ...signed };
    }

    if (msg.type === 'wallet_sign_transaction') {
      assertOrigin(sender); assertUnlocked();
      const signed = signTransaction(unlockedPhrase, msg.transaction || {});
      if (signed.from !== unlockedAddress) throw new Error('Transaction signer integrity check failed.');
      return { ok:true, transaction:signed };
    }

    return { ok:false, error:'unsupported_message' };
  })().then(sendResponse).catch((e:any) => sendResponse({ ok:false, error:e?.message || 'wallet_background_error' }));
  return true;
});
