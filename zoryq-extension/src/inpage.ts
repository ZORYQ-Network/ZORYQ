type Pending = { resolve: (value: any) => void; reject: (reason?: any) => void; timer: number };

declare global {
  interface Window { zoryq?: any }
}

const pending = new Map<string, Pending>();
let seq = 0;

function request(method: string, params?: any) {
  const id = `zoryq-${Date.now()}-${++seq}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('ZORYQ Wallet did not respond. Open the extension and enable Testnet connection.'));
    }, 12000);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ source: 'zoryq-inpage', type: 'request', id, method, params }, window.location.origin);
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== 'zoryq-extension' || msg.type !== 'response' || !msg.id) return;
  const item = pending.get(msg.id);
  if (!item) return;
  window.clearTimeout(item.timer);
  pending.delete(msg.id);
  if (msg.error) item.reject(new Error(msg.error));
  else item.resolve(msg.result);
});

const provider = Object.freeze({
  isZoryq: true,
  chainId: 'zoryq-testnet-1',
  version: '0.2.0',
  request: ({ method, params }: { method: string; params?: any }) => request(method, params),
});

if (!window.zoryq) {
  Object.defineProperty(window, 'zoryq', { value: provider, configurable: false, enumerable: false, writable: false });
}
window.dispatchEvent(new Event('zoryq#initialized'));
