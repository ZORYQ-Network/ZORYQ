(()=>{
'use strict';

const $=(q,r=document)=>r.querySelector(q);
const $$=(q,r=document)=>[...r.querySelectorAll(q)];
const CFG=()=>window.ZORYQ_CONFIG||{};
const B=()=>window.ZORYQ_SOCIAL_BACKEND||null;
const THEME_KEY='zoriq.theme.preference.v1.web';
const SUPABASE_URL='https://juordakzclqefpuauzjq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_XucQLaJTlznyM_mKee3WOg_hgE0Os6r';
const DEFAULT_FEE_BPS=50;
const MAX_FEE_BPS=250;

const CHAINS={
  '5919065':{id:5919065,name:'ZORYQ Testnet',native:'ZQ',rpc:'https://zoryq-evm-node-live-production.up.railway.app/rpc',explorer:'https://zoryq-testnet.vercel.app/explorer.html',mainnet:false,assets:[
    ['ZQ','ZORYQ Testnet',18,null],
    ['zUSD','ZORYQ Test USD',18,'0xd2121E96C6af936c0496fDB499c1D0613d26c2B9']
  ]},
  '1':{id:1,name:'Ethereum',native:'ETH',rpc:'https://ethereum-rpc.publicnode.com',explorer:'https://etherscan.io',mainnet:true,assets:[
    ['ETH','Ether',18,null],
    ['USDC','USD Coin',6,'0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
    ['USDT','Tether USD',6,'0xdAC17F958D2ee523a2206206994597C13D831ec7']
  ]},
  '8453':{id:8453,name:'Base',native:'ETH',rpc:'https://mainnet.base.org',explorer:'https://basescan.org',mainnet:true,assets:[
    ['ETH','Ether',18,null],
    ['USDC','USD Coin',6,'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913']
  ]},
  '42161':{id:42161,name:'Arbitrum One',native:'ETH',rpc:'https://arb1.arbitrum.io/rpc',explorer:'https://arbiscan.io',mainnet:true,assets:[
    ['ETH','Ether',18,null],
    ['USDC','USD Coin',6,'0xaf88d065e77c8cC2239327C5EDb3A432268e5831']
  ]},
  '10':{id:10,name:'Optimism',native:'ETH',rpc:'https://mainnet.optimism.io',explorer:'https://optimistic.etherscan.io',mainnet:true,assets:[
    ['ETH','Ether',18,null],
    ['USDC','USD Coin',6,'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85']
  ]},
  '137':{id:137,name:'Polygon',native:'POL',rpc:'https://polygon-rpc.com',explorer:'https://polygonscan.com',mainnet:true,assets:[
    ['POL','POL',18,null],
    ['USDC','USD Coin',6,'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359']
  ]},
  '43114':{id:43114,name:'Avalanche C-Chain',native:'AVAX',rpc:'https://api.avax.network/ext/bc/C/rpc',explorer:'https://snowtrace.io',mainnet:true,assets:[
    ['AVAX','Avalanche',18,null],
    ['USDC','USD Coin',6,'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'],
    ['USDT','Tether USD',6,'0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7']
  ]},
  '59144':{id:59144,name:'Linea',native:'ETH',rpc:'https://rpc.linea.build',explorer:'https://lineascan.build',mainnet:true,assets:[
    ['ETH','Ether',18,null],
    ['USDC','USD Coin',6,'0x176211869cA2b568f2A7D4EE941E073a821EE1ff']
  ]},
  '324':{id:324,name:'ZKsync Era',native:'ETH',rpc:'https://mainnet.era.zksync.io',explorer:'https://explorer.zksync.io',mainnet:true,assets:[
    ['ETH','Ether',18,null],
    ['USDC','USD Coin',6,'0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4']
  ]}
};

let wallet={provider:null,address:'',name:'',chainId:null,balance:null};
let pay={profileId:'',name:'',address:'',chainId:'5919065',assetIndex:0,busy:false,liveFeeBps:null,treasury:''};

function esc(v=''){
  return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function short(v=''){return v&&v.length>18?`${v.slice(0,8)}…${v.slice(-6)}`:v}
function toast(v){
  const t=$('#toast');
  if(!t)return;
  t.textContent=String(v);
  t.classList.add('show');
  clearTimeout(toast._);
  toast._=setTimeout(()=>t.classList.remove('show'),2300);
}
function addNav(label,id){
  const nav=$('.nav');
  if(!nav||$(`[data-view="${id}"]`,nav))return;
  const b=document.createElement('button');
  b.className='nav-btn';
  b.dataset.view=id;
  b.innerHTML=`<span class="nav-dot"></span><span class="label">${label}</span>`;
  b.onclick=()=>show(id);
  nav.appendChild(b);
}
function appendView(id,html){
  if($(`#view-${id}`))return;
  const v=document.createElement('section');
  v.className='view';
  v.id=`view-${id}`;
  v.innerHTML=html;
  $('.center')?.appendChild(v);
}
function show(id){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${id}`));
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  scrollTo({top:0,behavior:'smooth'});
  if(id==='wallet')refreshWallet();
  if(id==='verified')renderVerified();
  if(id==='security')renderSecurity();
}
function routerFor(chainId){
  const map=CFG().socialPayRouters||{};
  const v=map[String(chainId)]||map[chainId]||null;
  return /^0x[a-fA-F0-9]{40}$/.test(String(v||''))?v:null;
}
function toHexUtf8(text){
  return '0x'+[...new TextEncoder().encode(text)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function pad64(v){return String(v).replace(/^0x/,'').padStart(64,'0')}
function addrWord(a){
  if(!/^0x[a-fA-F0-9]{40}$/.test(a))throw new Error('Endereço inválido.');
  return pad64(a.toLowerCase());
}
function uintWord(n){return BigInt(n).toString(16).padStart(64,'0')}
function randomBytes32(){
  const b=new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function parseUnits(value,decimals){
  const s=String(value||'').trim().replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(s))throw new Error('Valor inválido.');
  const [a,b='']=s.split('.');
  if(b.length>decimals)throw new Error(`Máximo de ${decimals} casas decimais.`);
  return BigInt(a||'0')*10n**BigInt(decimals)+BigInt((b+'0'.repeat(decimals)).slice(0,decimals)||'0');
}
function formatUnits(n,decimals,max=8){
  n=BigInt(n);
  const base=10n**BigInt(decimals);
  const a=n/base;
  const b=(n%base).toString().padStart(decimals,'0').replace(/0+$/,'').slice(0,max);
  return b?`${a}.${b}`:`${a}`;
}
async function selector(p,sig){
  const hash=await p.request({method:'web3_sha3',params:[toHexUtf8(sig)]});
  return String(hash).slice(0,10);
}
async function ethCall(p,to,data){
  return p.request({method:'eth_call',params:[{to,data},'latest']});
}
async function waitReceipt(p,hash){
  for(let i=0;i<80;i++){
    const r=await p.request({method:'eth_getTransactionReceipt',params:[hash]}).catch(()=>null);
    if(r){
      if(String(r.status).toLowerCase()==='0x0')throw new Error('A transação falhou on-chain.');
      return r;
    }
    await new Promise(x=>setTimeout(x,1500));
  }
  throw new Error('A transação ainda não foi confirmada.');
}

async function connectWallet(){
  try{
    const wc=window.ZORYQ_WALLET_CONNECT;
    if(!wc)throw new Error('Conector de wallet indisponível.');
    const c=await wc.connect();
    wallet={provider:c.provider,address:c.address,name:c.info?.name||'Wallet EVM',chainId:CFG().chainId||5919065,balance:null};
    await refreshWallet();
    return wallet;
  }catch(e){
    toast(e?.message||e);
    throw e;
  }
}
async function ensureProvider(){
  if(wallet.provider&&wallet.address)return wallet;
  return connectWallet();
}
async function switchChain(p,chain){
  const hex='0x'+BigInt(chain.id).toString(16);
  try{
    await p.request({method:'wallet_switchEthereumChain',params:[{chainId:hex}]});
  }catch(e){
    const code=Number(e?.code||e?.data?.originalError?.code||0);
    if(code!==4902&&code!==-32603)throw e;
    await p.request({method:'wallet_addEthereumChain',params:[{
      chainId:hex,
      chainName:chain.name,
      nativeCurrency:{name:chain.native,symbol:chain.native,decimals:18},
      rpcUrls:[chain.rpc],
      blockExplorerUrls:[chain.explorer]
    }]});
    await p.request({method:'wallet_switchEthereumChain',params:[{chainId:hex}]});
  }
  wallet.chainId=chain.id;
}
async function refreshWallet(){
  const root=$('#parityWalletState');
  if(!root)return;
  try{
    if(!wallet.provider){
      const selected=window.ZORYQ_WALLET_CONNECT?.getSelected?.();
      if(selected?.provider){
        const accounts=await selected.provider.request({method:'eth_accounts'});
        if(accounts?.[0]){
          wallet={
            provider:selected.provider,
            address:accounts[0],
            name:selected.info?.name||'Wallet EVM',
            chainId:parseInt(await selected.provider.request({method:'eth_chainId'}),16),
            balance:null
          };
        }
      }
    }
    if(!wallet.provider||!wallet.address){
      root.innerHTML='<span class="parity-badge warn">○ wallet não conectada</span>';
      renderWalletDetails();
      return;
    }
    const [chainHex,bal]=await Promise.all([
      wallet.provider.request({method:'eth_chainId'}),
      wallet.provider.request({method:'eth_getBalance',params:[wallet.address,'latest']})
    ]);
    wallet.chainId=parseInt(chainHex,16);
    wallet.balance=formatUnits(BigInt(bal),18,6);
    root.innerHTML='<span class="parity-badge ok">● wallet conectada</span>';
    renderWalletDetails();
  }catch{
    root.innerHTML='<span class="parity-badge warn">○ conexão indisponível</span>';
    renderWalletDetails();
  }
}
function renderWalletDetails(){
  const x=$('#parityWalletDetails');
  if(!x)return;
  const connected=Boolean(wallet.address);
  const identity=connected
    ? `<h3>${esc(wallet.name)}</h3><div class="parity-address">${esc(wallet.address)}</div><div class="parity-kpi" style="margin-top:12px">${esc(wallet.balance||'0')} <span style="font-size:14px">${wallet.chainId===5919065?'ZQ':'native'}</span></div>`
    : '<h3>Conecte uma wallet EVM</h3><div class="parity-address">MetaMask, Rabby, Coinbase Wallet ou outra EIP-1193/EIP-6963</div>';
  const actions=connected
    ? '<button class="primary" id="parityConnectWallet">Trocar wallet</button><button class="secondary" id="paritySwitchZoriq">Abrir ZORIQ Testnet</button><button class="secondary" id="parityCopyAddress">Copiar endereço</button>'
    : '<button class="primary" id="parityConnectWallet">Conectar wallet</button>';
  x.innerHTML=
    `<div class="parity-card"><div class="eyebrow">WALLET WEB</div>${identity}<div class="parity-actions">${actions}</div></div>`+
    '<div class="parity-card"><div class="eyebrow">RECOVERY WEB</div><h3>Recuperação fica com a sua wallet</h3><p class="parity-note">No navegador, a ZORIQ não armazena nem solicita seed phrase. Criação, importação e recuperação acontecem dentro da wallet instalada. Isso é o equivalente seguro ao Wallet / Recovery do APK.</p><div class="parity-actions"><button class="secondary" id="parityRecoveryHelp">Como recuperar</button></div></div>';
  $('#parityConnectWallet').onclick=connectWallet;
  const sw=$('#paritySwitchZoriq');
  if(sw)sw.onclick=async()=>{await switchChain(wallet.provider,CHAINS['5919065']);await refreshWallet()};
  const cp=$('#parityCopyAddress');
  if(cp)cp.onclick=async()=>{await navigator.clipboard.writeText(wallet.address);toast('Endereço copiado')};
  $('#parityRecoveryHelp').onclick=()=>alert('Abra a wallet instalada e use o fluxo oficial de importar/restaurar conta. Nunca cole sua seed phrase em uma página web, inclusive na ZORIQ.');
}
async function faucetWeb(){
  try{
    await ensureProvider();
    await switchChain(wallet.provider,CHAINS['5919065']);
    const r=await fetch(`${CFG().rpcBase||'https://zoryq-evm-node-live-production.up.railway.app'}/faucet`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({address:wallet.address})
    });
    const j=await r.json();
    if(!r.ok)throw new Error(j.error||'Faucet indisponível');
    toast(j.txHash?'Faucet enviado. Aguarde confirmação.':'Claim enviado.');
    await refreshWallet();
  }catch(e){toast(e?.message||e)}
}
async function sendZq(){
  try{
    await ensureProvider();
    await switchChain(wallet.provider,CHAINS['5919065']);
    const to=$('#paritySendTo').value.trim();
    const amount=$('#paritySendAmount').value.trim();
    if(!/^0x[a-fA-F0-9]{40}$/.test(to))throw new Error('Endereço inválido.');
    const value=parseUnits(amount,18);
    const hash=await wallet.provider.request({method:'eth_sendTransaction',params:[{from:wallet.address,to,value:'0x'+value.toString(16)}]});
    toast(`Transação enviada: ${short(hash)}`);
    $('#paritySendAmount').value='';
    await waitReceipt(wallet.provider,hash);
    toast('Transferência confirmada');
    await refreshWallet();
  }catch(e){toast(e?.message||e)}
}
async function securitySign(){
  try{
    await ensureProvider();
    const message=`ZORIQ Security Check\nOrigin: ${location.origin}\nTime: ${new Date().toISOString()}\nNo transaction. No gas.`;
    await wallet.provider.request({method:'personal_sign',params:[toHexUtf8(message),wallet.address]});
    toast('Assinatura confirmada pela wallet');
  }catch(e){toast(e?.message||e)}
}
function renderSecurity(){
  const root=$('#paritySecurity');
  if(!root)return;
  const backend=B()?.state?.();
  const sessionTitle=backend?.authenticated?'Sessão SIWE ativa':'Sessão social não autenticada';
  const sessionCopy=backend?.authenticated
    ? 'Posts, mensagens, follows, notificações e preferências podem sincronizar com Supabase + RLS.'
    : 'Entre com a wallet usando SIWE para sincronizar dados pessoais. A assinatura não gasta gas.';
  root.innerHTML=
    '<div class="parity-grid">'+
      '<div class="parity-card"><div class="eyebrow">SEGURANÇA WEB</div><h3>Confirmação pela wallet</h3><p class="parity-note">No APK, a camada local pode usar biometria. No navegador, transações e assinaturas são confirmadas pela wallet instalada, que aplica PIN, biometria, hardware wallet ou política própria.</p><div class="parity-actions"><button class="primary" id="paritySecurityTest">Testar assinatura sem gas</button></div></div>'+
      `<div class="parity-card"><div class="eyebrow">SOCIAL SESSION</div><h3>${sessionTitle}</h3><p class="parity-note">${sessionCopy}</p><div class="parity-actions"><button class="secondary" id="paritySocialAuth">${backend?.authenticated?'Sair da sessão':'Entrar com wallet'}</button></div></div>`+
    '</div>';
  $('#paritySecurityTest').onclick=securitySign;
  $('#paritySocialAuth').onclick=async()=>{
    try{
      if(B().state().authenticated)await B().signOut();
      else await B().signInWithWallet();
      renderSecurity();
      renderVerified();
    }catch(e){toast(B()?.friendlyError?.(e)||e?.message||e)}
  };
}
async function renderVerified(){
  const root=$('#parityVerified');
  if(!root)return;
  const backend=B();
  if(!backend){
    root.innerHTML='<div class="parity-card">Backend indisponível.</div>';
    return;
  }
  const s=backend.state();
  let status=null,cfg=null;
  if(s.authenticated){
    try{[status,cfg]=await Promise.all([backend.verifiedStatus(),backend.verifiedConfig()])}catch{}
  }
  const active=Boolean(status?.verified);
  const checkout=s.authenticated
    ? `<div class="parity-field"><label>REDE</label><select id="parityVerifiedChain">${(cfg?.chains||[]).map(c=>`<option value="${esc(c.chain_id)}">${esc(c.name)} · ETH</option>`).join('')}</select></div><button class="primary parity-pay" id="parityVerifiedBuy">${active?'Renovar ZORIQ Verified':'Assinar ZORIQ Verified'}</button>`
    : '<button class="primary parity-pay" id="parityVerifiedLogin">Entrar com wallet</button>';
  root.innerHTML=
    `<div class="parity-card"><div class="row between"><div><div class="eyebrow">ZORIQ VERIFIED</div><h2 style="margin:6px 0">${active?'✓ Assinatura ativa':'Selo anual'}</h2></div><div style="font-size:36px;color:#58a6ff;font-weight:950">✓</div></div><div class="parity-kpi">US$ 9,99 <span style="font-size:13px;color:#8490a4">/ 365 dias</span></div><p class="parity-note">Pagamento em ETH em rede suportada. O backend valida remetente, destinatário, valor, recibo e reutilização de hash antes de liberar o selo.</p>${checkout}</div>`;
  const login=$('#parityVerifiedLogin');
  if(login)login.onclick=async()=>{
    try{await backend.signInWithWallet();renderVerified()}
    catch(e){toast(backend.friendlyError(e))}
  };
  const buy=$('#parityVerifiedBuy');
  if(buy)buy.onclick=async()=>{
    try{
      buy.disabled=true;
      buy.textContent='Confirmando…';
      const result=await backend.purchaseVerified($('#parityVerifiedChain').value);
      toast(`Verified ativo até ${new Date(result.current_period_end).toLocaleDateString('pt-BR')}`);
      renderVerified();
    }catch(e){toast(backend.friendlyError(e))}
    finally{buy.disabled=false}
  };
}

async function paymentDestination(profileId){
  const s=B()?.state?.();
  if(!s?.authenticated)throw new Error('Entre com sua wallet antes de enviar cripto.');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/social_payment_destination`,{
    method:'POST',
    headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${s.session.access_token}`,'content-type':'application/json'},
    body:JSON.stringify({p_profile_id:profileId})
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j?.message||'Não foi possível obter a wallet do perfil.');
  const row=Array.isArray(j)?j[0]:j;
  if(!row?.address)throw new Error('Este perfil não habilitou uma wallet verificada para receber cripto.');
  return row;
}
function buildPayModal(){
  if($('#parityPayModal'))return;
  const m=document.createElement('div');
  m.className='parity-modal';
  m.id='parityPayModal';
  m.innerHTML='<div class="parity-modal-card"><div class="parity-modal-head"><div><div class="eyebrow">ZORIQ SOCIAL PAY</div><h2 id="parityPayTitle" style="margin:5px 0">$ Enviar cripto</h2><div class="parity-address" id="parityPayAddress"></div></div><button class="parity-close" id="parityPayClose">×</button></div><div id="parityPayBody"></div></div>';
  document.body.appendChild(m);
  $('#parityPayClose').onclick=()=>m.classList.remove('open');
  m.onclick=e=>{if(e.target===m)m.classList.remove('open')};
}
async function openSocialPay(profileId,name){
  try{
    const dest=await paymentDestination(profileId);
    pay={profileId,name:name||'Perfil ZORIQ',address:dest.address,chainId:'5919065',assetIndex:0,busy:false,liveFeeBps:null,treasury:''};
    buildPayModal();
    $('#parityPayTitle').textContent=`$ Enviar para ${pay.name}`;
    $('#parityPayAddress').textContent=pay.address;
    renderPay();
    $('#parityPayModal').classList.add('open');
  }catch(e){toast(e?.message||e)}
}
function paySummary(amount,asset){
  let fee='—',net='—';
  try{
    if(amount&&Number(amount)>0){
      const gross=parseUnits(amount,asset[2]);
      const bps=BigInt(pay.liveFeeBps??DEFAULT_FEE_BPS);
      const f=gross*bps/10000n;
      fee=`${formatUnits(f,asset[2])} ${asset[0]}`;
      net=`${formatUnits(gross-f,asset[2])} ${asset[0]}`;
    }
  }catch{}
  return {fee,net};
}
function renderPay(){
  const root=$('#parityPayBody');
  if(!root)return;
  const chain=CHAINS[pay.chainId];
  const router=routerFor(chain.id);
  const asset=chain.assets[pay.assetIndex]||chain.assets[0];
  const amount=$('#parityPayAmount')?.value||'';
  const {fee,net}=paySummary(amount,asset);
  const networkButtons=Object.entries(CHAINS).map(([id,c])=>{
    const ready=Boolean(routerFor(c.id));
    return `<button class="parity-network ${id===pay.chainId?'active':''} ${ready?'':'disabled'}" data-pay-chain="${id}">${esc(c.name)}<small>${ready?'router configurado':'router pendente'}</small></button>`;
  }).join('');
  const assetOptions=chain.assets.map((a,i)=>`<option value="${i}" ${i===pay.assetIndex?'selected':''}>${a[0]} · ${a[1]}</option>`).join('');
  const feeLabel=fee==='—'?`${(DEFAULT_FEE_BPS/100).toFixed(2)}% estimada`:fee;
  const treasuryRow=pay.treasury?`<div><span>Treasury</span><b>${short(pay.treasury)}</b></div>`:'';
  const routerWarning=router?'':`<p class="parity-note parity-warn">O suporte de interface para ${esc(chain.name)} existe, mas o Social Pay Router ainda não foi configurado nessa rede. O envio com taxa fica bloqueado até existir um contrato implantado.</p>`;
  const networkWarning=chain.mainnet
    ? '<p class="parity-note parity-warn">⚠ Mainnet: o ativo possui valor real. Confira rede, ativo, valor e destinatário.</p>'
    : '<p class="parity-note parity-good">Testnet: ativos de teste não representam valor monetário real.</p>';
  root.innerHTML=
    `<div class="parity-field"><label>REDE</label><div class="parity-networks">${networkButtons}</div></div>`+
    `<div class="parity-field"><label>ATIVO</label><select id="parityPayAsset">${assetOptions}</select></div>`+
    `<div class="parity-field"><label>VALOR</label><input id="parityPayAmount" inputmode="decimal" placeholder="0.00 ${asset[0]}" value="${esc(amount)}"></div>`+
    `<div class="parity-summary"><div><span>Perfil recebe</span><b id="parityPayNet">${net}</b></div><div><span>Taxa ZORIQ</span><b class="parity-good" id="parityPayFee">${feeLabel}</b></div><div><span>Gas</span><b>cobrado pela rede</b></div>${treasuryRow}</div>`+
    routerWarning+networkWarning+
    `<button class="primary parity-pay" id="parityPaySend" ${router?'':'disabled'}>${pay.busy?'Confirmando…':`Enviar ${asset[0]}`}</button>`+
    '<p class="parity-note" style="text-align:center">Operação não custodial. O router divide atomicamente o valor entre perfil e Treasury; a ZORIQ não recebe sua seed ou chave privada.</p>';

  $$('[data-pay-chain]',root).forEach(b=>b.onclick=()=>{
    pay.chainId=b.dataset.payChain;
    pay.assetIndex=0;
    pay.liveFeeBps=null;
    pay.treasury='';
    renderPay();
  });
  $('#parityPayAsset').onchange=e=>{pay.assetIndex=Number(e.target.value);renderPay()};
  $('#parityPayAmount').oninput=e=>{
    const v=e.target.value;
    renderPay();
    const n=$('#parityPayAmount');
    if(n){n.value=v;n.focus();n.setSelectionRange(v.length,v.length)}
  };
  $('#parityPaySend').onclick=sendSocialPay;
}
async function liveRouterState(p,router){
  const [feeSel,treasurySel]=await Promise.all([selector(p,'feeBps()'),selector(p,'treasury()')]);
  const [feeHex,tHex]=await Promise.all([ethCall(p,router,feeSel),ethCall(p,router,treasurySel)]);
  const fee=Number(BigInt(feeHex));
  const treasury='0x'+String(tHex).replace(/^0x/,'').slice(-40);
  if(!Number.isFinite(fee)||fee<0||fee>MAX_FEE_BPS)throw new Error('Taxa do router fora do limite de segurança.');
  if(!/^0x[a-fA-F0-9]{40}$/.test(treasury))throw new Error('Treasury inválida no router.');
  return {fee,treasury};
}
async function sendSocialPay(){
  if(pay.busy)return;
  const chain=CHAINS[pay.chainId];
  const router=routerFor(chain.id);
  const asset=chain.assets[pay.assetIndex];
  if(!router)return toast('Router ainda não configurado nesta rede.');
  const amount=$('#parityPayAmount')?.value||'';
  try{
    pay.busy=true;
    renderPay();
    await ensureProvider();
    await switchChain(wallet.provider,chain);
    const accounts=await wallet.provider.request({method:'eth_requestAccounts'});
    const from=String(accounts?.[0]||'');
    if(!from)throw new Error('Wallet não conectada.');
    wallet.address=from;
    const gross=parseUnits(amount,asset[2]);
    if(gross<=0n)throw new Error('Informe um valor maior que zero.');
    const live=await liveRouterState(wallet.provider,router);
    pay.liveFeeBps=live.fee;
    pay.treasury=live.treasury;
    const ref=randomBytes32();
    let hash;

    if(!asset[3]){
      const sel=await selector(wallet.provider,'payNative(address,bytes32)');
      const data=sel+addrWord(pay.address)+ref;
      hash=await wallet.provider.request({method:'eth_sendTransaction',params:[{from,to:router,value:'0x'+gross.toString(16),data}]});
    }else{
      const token=asset[3];
      const allowanceSel=await selector(wallet.provider,'allowance(address,address)');
      const allowanceHex=await ethCall(wallet.provider,token,allowanceSel+addrWord(from)+addrWord(router));
      const allowance=BigInt(allowanceHex);
      if(allowance<gross){
        const approveSel=await selector(wallet.provider,'approve(address,uint256)');
        if(asset[0]==='USDT'&&allowance>0n){
          const zeroHash=await wallet.provider.request({method:'eth_sendTransaction',params:[{from,to:token,data:approveSel+addrWord(router)+uintWord(0)}]});
          await waitReceipt(wallet.provider,zeroHash);
        }
        const approveHash=await wallet.provider.request({method:'eth_sendTransaction',params:[{from,to:token,data:approveSel+addrWord(router)+uintWord(gross)}]});
        await waitReceipt(wallet.provider,approveHash);
      }
      const paySel=await selector(wallet.provider,'payToken(address,address,uint256,bytes32)');
      const data=paySel+addrWord(token)+addrWord(pay.address)+uintWord(gross)+ref;
      hash=await wallet.provider.request({method:'eth_sendTransaction',params:[{from,to:router,data}]});
    }

    await waitReceipt(wallet.provider,hash);
    const fee=gross*BigInt(live.fee)/10000n;
    const net=gross-fee;
    toast(`Confirmado: ${formatUnits(net,asset[2])} ${asset[0]} ao perfil · taxa ${formatUnits(fee,asset[2])} ${asset[0]}`);
    $('#parityPayModal').classList.remove('open');
  }catch(e){
    toast(e?.shortMessage||e?.message||e);
  }finally{
    pay.busy=false;
    renderPay();
  }
}

function injectPayButtons(){
  $$('[data-sync-message]').forEach(btn=>{
    const id=btn.dataset.syncMessage;
    const row=btn.closest('.suite-user');
    if(!row||row.querySelector(`[data-zq-social-pay="${id}"]`))return;
    const name=row.querySelector('.suite-user-name')?.textContent?.replace('✓','').trim()||'Perfil ZORIQ';
    const b=document.createElement('button');
    b.className='secondary';
    b.dataset.zqSocialPay=id;
    b.dataset.zqName=name;
    b.textContent='$ Enviar';
    btn.parentElement?.insertBefore(b,btn);
  });
}
function applyTheme(mode){
  document.documentElement.dataset.zoriqTheme=mode==='system'?'':mode;
  localStorage.setItem(THEME_KEY,mode);
  renderThemeButtons();
}
function renderThemeButtons(){
  const mode=localStorage.getItem(THEME_KEY)||'system';
  $$('[data-parity-theme]').forEach(b=>b.classList.toggle('active',b.dataset.parityTheme===mode));
}
function init(){
  addNav('Wallet','wallet');
  addNav('Verified','verified');
  addNav('Segurança','security');

  appendView('wallet',
    '<div class="hero"><div class="eyebrow">WEB DAPP PARITY</div><h1>Wallet, pagamentos e <span class="gradient">recovery seguro.</span></h1><p>O DApp web compartilha as funções essenciais do APK usando a wallet instalada no navegador. Seed phrase nunca é solicitada pela página.</p></div>'+
    '<div class="row between" style="margin:14px 0"><div id="parityWalletState"></div><div class="parity-theme"><button class="secondary" data-parity-theme="system">Sistema</button><button class="secondary" data-parity-theme="dark">Escuro</button><button class="secondary" data-parity-theme="light">Claro</button></div></div>'+
    '<div class="parity-grid" id="parityWalletDetails"></div>'+
    '<div class="parity-grid" style="margin-top:12px"><div class="parity-card"><div class="eyebrow">ZORYQ TESTNET</div><h3>Faucet e transferência</h3><div class="parity-actions"><button class="primary" id="parityFaucet">Pegar ZQ no Faucet</button><a class="secondary" href="/explorer" target="_blank" rel="noopener">Explorer</a><a class="secondary" href="/stake" target="_blank" rel="noopener">Stake</a><a class="secondary" href="/swap" target="_blank" rel="noopener">Swap</a></div><div class="parity-field"><label>ENVIAR ZQ PARA</label><input id="paritySendTo" placeholder="0x…"></div><div class="parity-field"><label>VALOR ZQ</label><input id="paritySendAmount" inputmode="decimal" placeholder="0.00"></div><button class="primary parity-pay" id="paritySendZq">Enviar ZQ</button></div>'+
    '<div class="parity-card"><div class="eyebrow">SOCIAL PAY</div><h3>Multichain pelo perfil</h3><p class="parity-note">O botão <b>$ Enviar</b> é adicionado aos perfis sincronizados que podem disponibilizar uma wallet verificada. O pagamento usa o router da rede e separa a taxa da Treasury atomicamente.</p><div class="parity-actions"><button class="secondary" data-view="discover">Abrir pessoas</button></div></div></div>'
  );
  appendView('verified','<div class="hero"><div class="eyebrow">WEB + APK</div><h1>ZORIQ <span class="gradient">Verified.</span></h1><p>A mesma assinatura anual e o mesmo estado de verificação são usados no DApp web e no APK.</p></div><div id="parityVerified" style="margin-top:14px"></div>');
  appendView('security','<div class="hero"><div class="eyebrow">SEGURANÇA</div><h1>Proteção equivalente em <span class="gradient">cada plataforma.</span></h1><p>APK usa biometria/local signer quando disponível. Web delega autorização à wallet instalada e usa SIWE para a sessão social.</p></div><div id="paritySecurity" style="margin-top:14px"></div>');

  $('#parityFaucet').onclick=faucetWeb;
  $('#paritySendZq').onclick=sendZq;
  $$('[data-parity-theme]').forEach(b=>b.onclick=()=>applyTheme(b.dataset.parityTheme));
  applyTheme(localStorage.getItem(THEME_KEY)||'system');
  refreshWallet();
  renderVerified();
  renderSecurity();
  buildPayModal();

  document.addEventListener('click',e=>{
    const payBtn=e.target.closest?.('[data-zq-social-pay]');
    if(payBtn){
      e.preventDefault();
      openSocialPay(payBtn.dataset.zqSocialPay,payBtn.dataset.zqName);
    }
    const v=e.target.closest?.('[data-view]');
    if(v&&['wallet','verified','security'].includes(v.dataset.view)){
      e.preventDefault();
      show(v.dataset.view);
    }
  });

  const observer=new MutationObserver(()=>injectPayButtons());
  observer.observe(document.body,{subtree:true,childList:true});
  injectPayButtons();
  setInterval(()=>{
    injectPayButtons();
    if($('#view-wallet')?.classList.contains('active'))refreshWallet();
  },10000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();

window.ZORIQ_DAPP_PARITY={openSocialPay,connectWallet,refreshWallet,sendSocialPay,CHAINS};
})();
