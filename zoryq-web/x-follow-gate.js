// ZORYQ Testnet X follow gate
// Testnet UX gate only. A real follower check requires X OAuth/API verification.
(() => {
  const X_HANDLE = '@ZORIQNetwork';
  const X_URL = 'https://x.com/ZORIQNetwork';
  const STORAGE_KEY = 'zoryq-x-follow-confirmed-v1';

  function isConfirmed() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function setConfirmed(value = true) {
    if (value) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('zoryq:x-follow-change', { detail: { confirmed: !!value } }));
  }

  function render(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="border:1px solid #24364d;background:linear-gradient(145deg,#0d121b,#0a1018);border-radius:16px;padding:16px;margin:14px 0">
        <div style="font-size:10px;letter-spacing:.14em;color:#75d8ff;font-weight:800">FAUCET ACCESS</div>
        <div style="font-size:18px;font-weight:800;color:#f4f8ff;margin:6px 0">Follow ${X_HANDLE}</div>
        <div style="color:#92a4bb;font-size:13px;margin-bottom:12px">Follow the official ZORYQ account before claiming Testnet ZQ.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a href="${X_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;border:0;background:linear-gradient(135deg,#51a6ff,#4ff5db);color:#041018;padding:10px 13px;border-radius:11px;font-weight:800">Follow on X ↗</a>
          <button type="button" data-zoryq-x-confirm style="border:1px solid #2a3d58;background:#0f1724;color:#fff;padding:10px 13px;border-radius:11px;font-weight:800;cursor:pointer">${isConfirmed() ? 'Following confirmed ✓' : 'I followed @ZORIQNetwork'}</button>
        </div>
        <div style="margin-top:10px;color:#6f839c;font-size:11px">Current Testnet gate uses user confirmation. Production-grade enforcement will use X OAuth/API verification; do not treat this local confirmation as proof of follow.</div>
      </div>`;

    const btn = container.querySelector('[data-zoryq-x-confirm]');
    if (btn) btn.onclick = () => {
      setConfirmed(true);
      btn.textContent = 'Following confirmed ✓';
    };
  }

  window.ZORYQ_X = Object.freeze({
    handle: X_HANDLE,
    url: X_URL,
    isConfirmed,
    setConfirmed,
    render
  });
})();
