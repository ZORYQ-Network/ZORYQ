// ZORYQ Testnet X follow gate
// Faucet UX gate only. XP quests use authenticated external proof in /x-quests.html.
(() => {
  const X_HANDLE = '@ZORIQNetwork';
  const X_URL = 'https://x.com/ZORIQNetwork';
  const QUESTS_URL = '/x-quests.html';
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
        <div style="font-size:10px;letter-spacing:.14em;color:#75d8ff;font-weight:800">FAUCET ACCESS + XP QUEST</div>
        <div style="font-size:18px;font-weight:800;color:#f4f8ff;margin:6px 0">Follow ${X_HANDLE}</div>
        <div style="color:#92a4bb;font-size:13px;margin-bottom:12px">Follow the official ZORYQ account before claiming Testnet ZQ. The separate verified quest is worth +100 XP after trusted validation.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a href="${X_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;border:0;background:linear-gradient(135deg,#51a6ff,#4ff5db);color:#041018;padding:10px 13px;border-radius:11px;font-weight:800">Follow on X ↗</a>
          <button type="button" data-zoryq-x-confirm style="border:1px solid #2a3d58;background:#0f1724;color:#fff;padding:10px 13px;border-radius:11px;font-weight:800;cursor:pointer">${isConfirmed() ? 'Faucet step confirmed ✓' : 'I followed @ZORIQNetwork'}</button>
          <a href="${QUESTS_URL}" style="text-decoration:none;border:1px solid #344c33;background:#101b12;color:#baff45;padding:10px 13px;border-radius:11px;font-weight:800">Open XP Quests →</a>
        </div>
        <div style="margin-top:10px;color:#6f839c;font-size:11px">This local confirmation unlocks only the Testnet faucet UX. It never awards XP. Follow/post XP requires an authenticated proof submission and trusted X verification/review.</div>
      </div>`;

    const btn = container.querySelector('[data-zoryq-x-confirm]');
    if (btn) btn.onclick = () => {
      setConfirmed(true);
      btn.textContent = 'Faucet step confirmed ✓';
    };
  }

  window.ZORYQ_X = Object.freeze({
    handle: X_HANDLE,
    url: X_URL,
    questsUrl: QUESTS_URL,
    isConfirmed,
    setConfirmed,
    render
  });
})();
