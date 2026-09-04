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
      window.postMessage({ source: 'zoryq-extension', type: 'response', id: msg.id, result, error }, location.origin);
    };

    try {
      if (!['zoryq_requestAccounts', 'zoryq_accounts', 'zoryq_chainId'].includes(msg.method)) {
        return reply(undefined, 'Unsupported ZORYQ Wallet method.');
      }
      if (msg.method === 'zoryq_chainId') return reply('zoryq-testnet-1');

      const stored = await chrome.storage.local.get(['vault', 'siteConnectionEnabled']);
      if (!stored.vault?.address) return reply(undefined, 'No ZORYQ Wallet exists in the extension yet.');
      if (!stored.siteConnectionEnabled) {
        return reply(undefined, 'Connection disabled. Open ZORYQ Wallet and enable Testnet connection.');
      }
      return reply([stored.vault.address]);
    } catch (error: any) {
      reply(undefined, error?.message || 'ZORYQ Wallet connection failed.');
    }
  });
}
