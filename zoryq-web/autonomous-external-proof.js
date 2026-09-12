(() => {
  const cfg = window.ZORYQ_CONFIG || {};
  const rpcUrl = cfg.rpcUrl || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
  const explorerBase = cfg.rpcBase || 'https://zoryq-evm-node-live-production.up.railway.app';
  const manifestUrl = './external-work-proof-live.json';

  async function rpc(method, params = []) {
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

  function short(value) {
    return value ? `${String(value).slice(0, 10)}…${String(value).slice(-8)}` : '—';
  }

  function txLink(hash, label) {
    if (!hash) return '';
    return `<a class="btn ghost" href="${explorerBase}/tx/${hash}" target="_blank" rel="noreferrer">${label} · ${short(hash)}</a>`;
  }

  function mount() {
    if (document.getElementById('externalWorkProofEvidence')) return document.getElementById('externalWorkProofEvidence');
    const anchor = document.getElementById('canonicalEvidence') || document.querySelector('.network');
    if (!anchor) return null;
    const section = document.createElement('section');
    section.id = 'externalWorkProofEvidence';
    section.className = 'box';
    section.style.marginBottom = '28px';
    section.innerHTML = `
      <div class="eyebrow">LIVE RECEIPT-BACKED WORK PROOF</div>
      <h2 style="margin-top:8px">Work → Delivery → Payment → Onchain evidence</h2>
      <p id="externalProofSummary">Loading the public Proof Pack and independently checking its contract and payment receipt through RPC…</p>
      <div class="gates" id="externalProofGates">
        <div><small>CONTRACT</small><strong>checking</strong></div>
        <div><small>WORK ORDER</small><strong>checking</strong></div>
        <div><small>DELIVERY</small><strong>checking</strong></div>
        <div><small>ZQ PAYMENT</small><strong>checking</strong></div>
        <div><small>TREASURY</small><strong>checking</strong></div>
      </div>
      <div class="work" style="margin-top:14px">
        <div class="node"><small>CONTRACT</small><b id="externalProofContract">—</b></div>
        <div class="node"><small>WORK ORDER</small><b id="externalProofWorkOrder">—</b></div>
        <div class="node"><small>PAYER</small><b id="externalProofPayer">—</b></div>
        <div class="node"><small>PAYMENT</small><b id="externalProofAmount">—</b></div>
        <div class="node"><small>PROOF DIGEST</small><b id="externalProofDigest">—</b></div>
        <div class="node"><small>CLAIM</small><b>Receipt-backed testnet work payment</b></div>
      </div>
      <div id="externalProofLinks" class="actions2" style="margin-top:16px"></div>
      <div class="warning" style="margin-top:16px">
        <b>Claim boundary:</b> this proves a separate-address native-ZQ testnet payment bound to declared work and delivery evidence. Both addresses are currently operator-controlled. This is <b>not</b> evidence of an independent customer, market demand, profitability, legal consideration, independent AI labor, audited security or production readiness.
      </div>`;
    anchor.insertAdjacentElement('afterend', section);
    return section;
  }

  function mark(gates, index, text, ok) {
    const nodes = gates.querySelectorAll('strong');
    if (!nodes[index]) return;
    nodes[index].textContent = text;
    nodes[index].style.color = ok ? 'var(--green)' : '#ffcb6b';
  }

  async function verify() {
    const section = mount();
    if (!section) return;
    const summary = document.getElementById('externalProofSummary');
    const gates = document.getElementById('externalProofGates');
    const links = document.getElementById('externalProofLinks');
    try {
      const manifestRes = await fetch(manifestUrl, {cache:'no-store'});
      if (!manifestRes.ok) throw new Error(`manifest_http_${manifestRes.status}`);
      const m = await manifestRes.json();
      if (Number(m?.network?.chainId) !== 5919065) throw new Error('manifest_wrong_chain');
      if (!m.contractAddress || !m.payment?.tx) throw new Error('manifest_incomplete');

      const [chainHex, code, receipt, tx] = await Promise.all([
        rpc('eth_chainId'),
        rpc('eth_getCode', [m.contractAddress, 'latest']),
        rpc('eth_getTransactionReceipt', [m.payment.tx]),
        rpc('eth_getTransactionByHash', [m.payment.tx])
      ]);

      const chainOk = parseInt(chainHex, 16) === 5919065;
      const contractOk = chainOk && code && code !== '0x';
      const workOk = Number(m.workOrderId) > 0 && !!m.spec?.hash && !!m.spec?.tx;
      const deliveryOk = !!m.delivery?.hash && !!m.delivery?.tx && m.contractState?.delivered === true;
      const receiptOk = !!receipt && receipt.status === '0x1' && String(receipt.transactionHash || receipt.hash || '').toLowerCase() === String(m.payment.tx).toLowerCase();
      const txOk = !!tx && String(tx.from).toLowerCase() === String(m.payerAddress).toLowerCase() && String(tx.to).toLowerCase() === String(m.contractAddress).toLowerCase() && BigInt(tx.value || '0x0').toString() === String(m.payment.valueWei);
      const paidOk = receiptOk && txOk && m.contractState?.paid === true && m.contractState?.cancelled === false && String(m.contractState?.revenueZqWei) === String(m.payment.valueWei);
      const treasuryOk = m.treasuryReconciliation?.exactDelta === true && String(m.treasuryReconciliation?.observedBlockDeltaWei) === String(m.payment.valueWei);

      mark(gates, 0, contractOk ? '✓ bytecode live' : 'unverified', contractOk);
      mark(gates, 1, workOk ? `✓ #${m.workOrderId}` : 'unverified', workOk);
      mark(gates, 2, deliveryOk ? '✓ hash bound' : 'unverified', deliveryOk);
      mark(gates, 3, paidOk ? `✓ ${m.payment.valueZq} ZQ` : 'unverified', paidOk);
      mark(gates, 4, treasuryOk ? '✓ exact delta' : 'unverified', treasuryOk);

      document.getElementById('externalProofContract').textContent = short(m.contractAddress);
      document.getElementById('externalProofWorkOrder').textContent = `#${m.workOrderId}`;
      document.getElementById('externalProofPayer').textContent = short(m.payerAddress);
      document.getElementById('externalProofAmount').textContent = `${m.payment.valueZq} ZQ · receipt ${m.payment.receiptStatus}`;
      document.getElementById('externalProofDigest').textContent = short(m.contractState?.proofDigest);

      const groups = [contractOk, workOk, deliveryOk, paidOk, treasuryOk];
      const passed = groups.filter(Boolean).length;
      summary.innerHTML = passed === groups.length
        ? '<b>Live verification passed.</b> The browser loaded the machine-readable Proof Pack and independently confirmed chain ID, deployed bytecode, payment transaction, successful receipt, payer/value binding and exact treasury delta through the public RPC.'
        : `<b>Partial verification:</b> ${passed}/${groups.length} evidence groups passed. Missing evidence remains unclaimed.`;
      links.innerHTML = [
        txLink(m.deploymentTx, 'Contract deployment'),
        txLink(m.spec?.tx, 'Work order'),
        txLink(m.delivery?.tx, 'Delivery'),
        txLink(m.payment?.tx, 'Payment receipt')
      ].join('');
    } catch (err) {
      summary.textContent = `Live external-work proof verification unavailable: ${String(err?.message || err)}. The interface does not promote the capability when evidence cannot be verified.`;
      gates.querySelectorAll('strong').forEach(el => { el.textContent = 'unverified'; el.style.color = '#ffcb6b'; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verify, {once:true});
  else verify();
})();
