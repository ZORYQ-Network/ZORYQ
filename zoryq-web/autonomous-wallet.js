(() => {
  const SELECTOR = '0x622b6fba'; // keccak256("launchCompany(uint256,bytes32)")[0:4]
  const CHAIN_ID = 5919065;
  const CHAIN_HEX = '0x5a5159';
  const cfg = window.ZORYQ_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  async function publicRpc(method, params = []) {
    const res = await fetch(cfg.rpcUrl, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0', id:Date.now(), method, params})});
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(body.error.message || 'RPC error');
    return body.result;
  }
  function utf8Hex(text) {
    return '0x' + [...new TextEncoder().encode(text)].map((b) => b.toString(16).padStart(2,'0')).join('');
  }
  function word(value) { return BigInt(value).toString(16).padStart(64,'0'); }
  async function promptHash(payload) {
    const hash = await publicRpc('web3_sha3', [utf8Hex(payload)]);
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash || '')) throw new Error('ZORYQ RPC did not return a valid keccak-256 prompt hash.');
    return hash;
  }
  async function waitReceipt(hash) {
    for (let i=0;i<60;i++) {
      const receipt = await publicRpc('eth_getTransactionReceipt', [hash]);
      if (receipt) return receipt;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Receipt timeout — verify the transaction in Explorer.');
  }
  async function ensureChain() {
    let chain = await ethereum.request({method:'eth_chainId'});
    if (parseInt(chain,16) === CHAIN_ID) return;
    try {
      await ethereum.request({method:'wallet_switchEthereumChain', params:[{chainId:CHAIN_HEX}]});
    } catch (error) {
      if (error?.code !== 4902) throw error;
      await ethereum.request({method:'wallet_addEthereumChain', params:[{
        chainId:CHAIN_HEX,
        chainName:'ZORYQ EVM Testnet',
        nativeCurrency:{name:'ZORYQ',symbol:'ZQ',decimals:18},
        rpcUrls:[cfg.rpcUrl],
        blockExplorerUrls:[`${cfg.rpcBase}/explorer`]
      }]});
    }
    chain = await ethereum.request({method:'eth_chainId'});
    if (parseInt(chain,16) !== CHAIN_ID) throw new Error('Wallet is not on ZORYQ Testnet.');
  }
  function updateProof(txHash, receipt, wallet, hash) {
    const status = $('launchStatus');
    if (window.launchEvidence) {
      window.launchEvidence.txHash = txHash;
      window.launchEvidence.receipt = receipt;
      window.launchEvidence.wallet = wallet;
      window.launchEvidence.promptHash = hash;
    }
    $('companyState').textContent='ONCHAIN — RECEIPT VERIFIED';
    $('companyState').className='tag2 ok';
    $('companyTitle').textContent='Autonomous Company — verified launch';
    $('receiptState').textContent='status 0x1';
    $('cycleState').textContent='executed';
    ['gCreate','gHire','gPay','gEarn'].forEach((id)=>{ if ($(id)) $(id).textContent='✓ receipt-backed'; });
    status.innerHTML=`Launch verified on ZORYQ Testnet: <a href="${cfg.rpcBase}/tx/${txHash}" target="_blank" rel="noreferrer">open transaction</a>`;
    if (typeof window.render === 'function') window.render();
  }
  function install() {
    const button = $('launch');
    if (!button || button.dataset.canonicalWalletHandler === '1') return;
    button.dataset.canonicalWalletHandler='1';
    button.onclick = async () => {
      const status = $('launchStatus');
      try {
        const goal = $('goal').value.trim();
        const budget = Number($('budget').value || 0);
        if (!goal) { $('goal').focus(); throw new Error('Enter a goal first.'); }
        if (!Number.isFinite(budget) || budget < 25 || budget > 10000) throw new Error('Budget must be between 25 and 10,000 synthetic dUSD.');
        if (!cfg.onePromptCompany) throw new Error('Canonical One-Prompt Company address is unavailable.');
        if (!window.ethereum) throw new Error('No injected EVM wallet found. Open this page in a wallet-enabled browser.');
        button.disabled=true;
        status.textContent='Connecting wallet…';
        const accounts=await ethereum.request({method:'eth_requestAccounts'});
        const wallet=accounts?.[0];
        if (!wallet) throw new Error('Wallet connection was not approved.');
        await ensureChain();
        const payload=JSON.stringify({goal,successCriteria:$('success').value.trim(),duration:$('duration').value,autonomy:$('autonomy').value});
        const hash=await promptHash(payload);
        const budgetUsd6=BigInt(Math.round(budget*1e6));
        const data=SELECTOR + word(budgetUsd6) + hash.slice(2);
        status.textContent='Review the transaction in your wallet. No native ZQ value is transferred.';
        const txHash=await ethereum.request({method:'eth_sendTransaction',params:[{from:wallet,to:cfg.onePromptCompany,data,value:'0x0'}]});
        status.textContent='Transaction submitted. Waiting for public receipt…';
        const receipt=await waitReceipt(txHash);
        if (receipt.status !== '0x1') throw new Error('Transaction was mined but failed.');
        updateProof(txHash,receipt,wallet,hash);
      } catch (error) {
        status.textContent=String(error?.message || error);
      } finally { button.disabled=false; }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
