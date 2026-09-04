declare const chrome: any;

const ALLOWED = new Set([
  'https://zoryq-testnet.vercel.app',
  'https://juordakzclqefpuauzjq.supabase.co',
]);

if (ALLOWED.has(location.origin)) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inpage.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'zoryq-inpage' || msg.type !== 'request' || !msg.id) return;

    const reply = (result?: any, error?: string) => {
      window.postMessage({ source:'zoryq-extension', type:'response', id:msg.id, result, error }, location.origin);
    };

    try {
      const supported = ['zoryq_requestAccounts','zoryq_accounts','zoryq_chainId','zoryq_signMessage','zoryq_signTransaction'];
      if (!supported.includes(msg.method)) return reply(undefined, 'Unsupported ZORYQ Wallet method.');
      if (msg.method === 'zoryq_chainId') return reply('zoryq-testnet-1');

      const stored = await chrome.storage.local.get(['vault','siteConnectionEnabled']);
      if (!stored.vault?.address) return reply(undefined, 'No ZORYQ Wallet exists in the extension yet.');
      if (!stored.siteConnectionEnabled) return reply(undefined, 'Connection disabled. Open ZORYQ Wallet and enable Testnet connection.');

      if (msg.method === 'zoryq_signMessage') {
        const message = typeof msg.params === 'string' ? msg.params : msg.params?.message;
        if (!message) return reply(undefined, 'A message is required.');
        const signed = await chrome.runtime.sendMessage({ type:'wallet_sign_message', message });
        if (!signed?.ok) return reply(undefined, signed?.error || 'Signing failed.');
        return reply({ address:signed.address, publicKey:signed.publicKey, signature:signed.signature, algorithm:signed.algorithm, domain:signed.domain });
      }

      if (msg.method === 'zoryq_signTransaction') {
        const transaction = msg.params?.transaction || msg.params;
        if (!transaction || typeof transaction !== 'object') return reply(undefined, 'A transaction object is required.');
        if (transaction.from !== stored.vault.address) return reply(undefined, 'Transaction sender does not match connected wallet.');
        const signed = await chrome.runtime.sendMessage({ type:'wallet_sign_transaction', transaction });
        if (!signed?.ok) return reply(undefined, signed?.error || 'Transaction signing failed.');
        return reply(signed.transaction);
      }

      return reply([stored.vault.address]);
    } catch (error: any) {
      reply(undefined, error?.message || 'ZORYQ Wallet connection failed.');
    }
  });
}
