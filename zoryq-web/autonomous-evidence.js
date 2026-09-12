(() => {
  const ECONOMY_CONTRACT = '0xe9E075d1d44DEC0ee973e94F6e3eE8B7c2b27397';
  const V2_CONTRACT = '0xab9654c5867CB71E0Cedb6B7379d61aadb57af60';
  const EVIDENCE = {
    economyDeployment: '0x725b92447061bfa0e796fdc20e3c3fc1b10587ccd528f97911956dd701426c19',
    createOrganization: '0x082fb54c6e45b5b0c1b223be8b8ea366074cf1947365f1887d21b6b64582541d',
    campaignAssign: '0x09a86380d20030b7366d19de3e3c8dc9fdd9fae2c436de18dc539c6772f9c821',
    campaignSubmit: '0x6015284b3d5dacd023f49ea93f9a73d55673eb98fbe1fc5b92aacad95a007fee',
    campaignSettle: '0x8d8ad3189ead5fc37c0085c35044fbebd34da4d2225f48d95d2ba18d8101e633',
    marketingPayment: '0xcb9af5dd7559f02e98e9599f3c1fa45ca963862431ec3168a8c13a51f84d8473',
    developerPayment: '0x19fedce4d98eea1497deba768a1eb4f676598cba6d67752e9989b67cc3de6194',
    v2Deployment: '0x7090a1ea5902ecb0d7b10e7d037449fd848ef96d3ee05002c24e23a94e4cfb1c',
    v2Launch: '0x93b677a997e065100126418e6a73cfd5c82f5d8e5f87d6938c402ab8a1012041'
  };
  const cfg = window.ZORYQ_CONFIG || {};
  const rpcUrl = cfg.rpcUrl || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
  const explorerBase = cfg.rpcBase || 'https://zoryq-evm-node-live-production.up.railway.app';

  async function rpc(method, params) {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {'content-type':'application/json'},
      body: JSON.stringify({jsonrpc:'2.0', id: Date.now(), method, params})
    });
    if (!res.ok) throw new Error(`rpc_http_${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(body.error.message || 'rpc_error');
    return body.result;
  }

  function receiptOk(receipt) {
    return !!receipt && receipt.status === '0x1' && !!receipt.blockNumber;
  }

  function short(value) {
    return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : '—';
  }

  function txLink(hash, label) {
    return `<a href="${explorerBase}/tx/${hash}" target="_blank" rel="noreferrer">${label} · ${short(hash)}</a>`;
  }

  function mount() {
    const network = document.querySelector('.network');
    if (!network || document.getElementById('canonicalEvidence')) return null;
    const section = document.createElement('section');
    section.id = 'canonicalEvidence';
    section.className = 'box';
    section.style.marginBottom = '28px';
    section.innerHTML = `
      <div class="eyebrow">CANONICAL ONCHAIN EVIDENCE</div>
      <h2 style="margin-top:8px">What ZORYQ Autonomous has actually proven</h2>
      <p id="canonicalEvidenceSummary">Verifying public testnet contracts and receipts directly through RPC…</p>
      <div class="gates" id="canonicalEvidenceGates">
        <div><small>CONTRACTS</small><strong>checking</strong></div>
        <div><small>ORGANIZATION</small><strong>checking</strong></div>
        <div><small>WORK / HIRE</small><strong>checking</strong></div>
        <div><small>PAY / SETTLE</small><strong>checking</strong></div>
        <div><small>REAL REVENUE</small><strong>not claimed</strong></div>
      </div>
      <div id="canonicalEvidenceLinks" class="actions2" style="margin-top:16px"></div>
      <div class="warning" style="margin-top:16px">
        <b>Evidence boundary:</b> the v2 revenue cycle uses synthetic testnet dUSD mechanics. It proves an executable economic-control layer, not real commercial revenue, independent AI labor, audited security, or production autonomy.
      </div>`;
    network.insertAdjacentElement('afterend', section);
    return section;
  }

  async function verify() {
    if (!mount()) return;
    const summary = document.getElementById('canonicalEvidenceSummary');
    const gates = document.getElementById('canonicalEvidenceGates');
    const links = document.getElementById('canonicalEvidenceLinks');
    try {
      const [chainHex, economyCode, v2Code, orgReceipt, assignReceipt, submitReceipt, settleReceipt, marketingReceipt, developerReceipt, v2LaunchReceipt] = await Promise.all([
        rpc('eth_chainId', []),
        rpc('eth_getCode', [ECONOMY_CONTRACT, 'latest']),
        rpc('eth_getCode', [V2_CONTRACT, 'latest']),
        rpc('eth_getTransactionReceipt', [EVIDENCE.createOrganization]),
        rpc('eth_getTransactionReceipt', [EVIDENCE.campaignAssign]),
        rpc('eth_getTransactionReceipt', [EVIDENCE.campaignSubmit]),
        rpc('eth_getTransactionReceipt', [EVIDENCE.campaignSettle]),
        rpc('eth_getTransactionReceipt', [EVIDENCE.marketingPayment]),
        rpc('eth_getTransactionReceipt', [EVIDENCE.developerPayment]),
        rpc('eth_getTransactionReceipt', [EVIDENCE.v2Launch])
      ]);
      const chainOk = parseInt(chainHex, 16) === 5919065;
      const contractsOk = chainOk && economyCode && economyCode !== '0x' && v2Code && v2Code !== '0x';
      const organizationOk = receiptOk(orgReceipt) && receiptOk(v2LaunchReceipt);
      const workOk = receiptOk(assignReceipt) && receiptOk(submitReceipt);
      const paymentOk = receiptOk(settleReceipt) && receiptOk(marketingReceipt) && receiptOk(developerReceipt);
      const verifiedCount = [contractsOk, organizationOk, workOk, paymentOk].filter(Boolean).length;

      summary.innerHTML = verifiedCount === 4
        ? '<b>Live verification passed.</b> Contract bytecode and the canonical organization, work/hire and payment/settlement transactions are present with successful receipts on ZORYQ Testnet.'
        : `<b>Partial verification:</b> ${verifiedCount}/4 evidence groups passed in this browser session. Missing evidence stays unclaimed.`;
      gates.innerHTML = `
        <div><small>CONTRACTS</small><strong>${contractsOk ? '✓ bytecode live' : 'unverified'}</strong></div>
        <div><small>ORGANIZATION</small><strong>${organizationOk ? '✓ receipt 0x1' : 'unverified'}</strong></div>
        <div><small>WORK / HIRE</small><strong>${workOk ? '✓ receipts 0x1' : 'unverified'}</strong></div>
        <div><small>PAY / SETTLE</small><strong>${paymentOk ? '✓ receipts 0x1' : 'unverified'}</strong></div>
        <div><small>REAL REVENUE</small><strong>not claimed</strong></div>`;
      links.innerHTML = [
        txLink(EVIDENCE.createOrganization, 'Organization'),
        txLink(EVIDENCE.campaignAssign, 'Hire / assign'),
        txLink(EVIDENCE.campaignSubmit, 'Work evidence'),
        txLink(EVIDENCE.campaignSettle, 'Settlement'),
        txLink(EVIDENCE.v2Launch, '7-agent company v2')
      ].join('');
    } catch (err) {
      summary.textContent = `Live evidence verification unavailable: ${String(err?.message || err)}. No capability is promoted from an RPC failure.`;
      gates.querySelectorAll('strong').forEach((el, idx) => { if (idx < 4) el.textContent = 'unverified'; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verify, {once:true});
  else verify();
})();
