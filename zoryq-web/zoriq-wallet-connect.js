(()=>{
'use strict';
const cfg=()=>window.ZORYQ_CONFIG||{chainId:5919065,chainIdHex:'0x5a5159',networkName:'ZORYQ EVM Testnet',nativeSymbol:'ZQ',rpcUrl:'https://zoryq-evm-node-live-production.up.railway.app/rpc',explorerUrl:'https://zoryq-evm-node-live-production.up.railway.app/explorer'};
const providers=new Map();
let selected=null;
let chooser=null;
let resolveChooser=null;

function safeName(v){return String(v||'Wallet EVM').slice(0,80)}
function initial(name){return safeName(name).trim().slice(0,2).toUpperCase()||'W'}
function remember(detail){
 if(!detail?.provider)return;
 const id=String(detail.info?.uuid||detail.info?.rdns||detail.info?.name||`wallet-${providers.size+1}`);
 if(!providers.has(id))providers.set(id,{id,provider:detail.provider,info:{uuid:id,name:safeName(detail.info?.name),rdns:String(detail.info?.rdns||'')}});
 renderChooser();
}
window.addEventListener('eip6963:announceProvider',e=>remember(e.detail));
function requestProviders(){try{window.dispatchEvent(new Event('eip6963:requestProvider'))}catch{}if(window.ethereum&&!providers.size)remember({provider:window.ethereum,info:{uuid:'legacy-window-ethereum',name:window.ethereum?.isMetaMask?'MetaMask / EVM Wallet':'Wallet EVM',rdns:'legacy.window.ethereum'}})}

function chainParams(){const c=cfg();return{chainId:c.chainIdHex||`0x${Number(c.chainId||5919065).toString(16)}`,chainName:c.networkName||'ZORYQ EVM Testnet',nativeCurrency:{name:c.nativeSymbol||'ZQ',symbol:c.nativeSymbol||'ZQ',decimals:18},rpcUrls:[c.rpcUrl||`${c.rpcBase}/rpc`],blockExplorerUrls:c.explorerUrl?[c.explorerUrl]:[]}}
async function ensureZoriqChain(provider){
 const p=chainParams();
 try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:p.chainId}]})}
 catch(err){
  const code=Number(err?.code||err?.data?.originalError?.code||0);
  if(code!==4902&&code!==-32603)throw err;
  await provider.request({method:'wallet_addEthereumChain',params:[p]});
  await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:p.chainId}]});
 }
 const active=String(await provider.request({method:'eth_chainId'})).toLowerCase();
 if(active!==String(p.chainId).toLowerCase())throw new Error('A wallet não mudou para a rede ZORIQ.');
 return p;
}

function ensureChooser(){
 if(chooser)return chooser;
 const style=document.createElement('style');style.textContent=`
 .zqwc-backdrop{position:fixed;inset:0;background:rgba(2,4,10,.76);backdrop-filter:blur(14px);z-index:99999;display:none;align-items:center;justify-content:center;padding:18px}.zqwc-backdrop.open{display:flex}.zqwc-card{width:min(460px,100%);background:linear-gradient(155deg,#101726,#080b12);border:1px solid #27344a;border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.5);padding:20px;color:#fff}.zqwc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.zqwc-kicker{font:800 10px/1.2 system-ui;letter-spacing:1.4px;color:#5cffad}.zqwc-title{font:900 25px/1.1 system-ui;margin:5px 0}.zqwc-sub{color:#8c9ab1;font:500 13px/1.45 system-ui}.zqwc-close{width:34px;height:34px;border-radius:10px;border:1px solid #2c394f;background:#111824;color:#fff;font-size:20px;cursor:pointer}.zqwc-list{display:grid;gap:9px;margin-top:16px}.zqwc-wallet{display:flex;align-items:center;gap:12px;width:100%;padding:13px;border-radius:15px;border:1px solid #27344a;background:#0c121d;color:#fff;text-align:left;cursor:pointer}.zqwc-wallet:hover{border-color:#56e9ff;background:#101a27}.zqwc-avatar{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#4169ff,#27e6d2);display:grid;place-items:center;color:#061019;font-weight:1000}.zqwc-meta{flex:1}.zqwc-name{font:850 14px system-ui}.zqwc-rdns{font:600 10px system-ui;color:#77869d;margin-top:3px}.zqwc-chain{font:800 10px system-ui;color:#5cffad}.zqwc-empty{border:1px dashed #2a3444;border-radius:14px;padding:18px;text-align:center;color:#8794a8;font:600 12px/1.5 system-ui}.zqwc-note{margin-top:14px;padding:11px;border-radius:12px;background:#0a1a16;border:1px solid #20463b;color:#9bc7b8;font:600 11px/1.45 system-ui}`;
 document.head.appendChild(style);
 chooser=document.createElement('div');chooser.className='zqwc-backdrop';chooser.innerHTML=`<div class="zqwc-card"><div class="zqwc-head"><div><div class="zqwc-kicker">ZORIQ WALLET CONNECT</div><div class="zqwc-title">Escolha sua wallet</div><div class="zqwc-sub">Mostramos as wallets EVM instaladas no navegador. Depois da escolha, a ZORIQ adiciona/troca a rede para a ZORIQ EVM Testnet.</div></div><button class="zqwc-close" aria-label="Fechar">×</button></div><div class="zqwc-list"></div><div class="zqwc-note">Rede alvo: <b>ZORIQ EVM Testnet</b> · Chain ID <b>5919065</b> · moeda <b>ZQ</b>. A conexão nunca pede sua seed phrase.</div></div>`;
 document.body.appendChild(chooser);
 chooser.querySelector('.zqwc-close').onclick=()=>finishChooser(null);
 chooser.addEventListener('click',e=>{if(e.target===chooser)finishChooser(null)});
 return chooser;
}
function renderChooser(){if(!chooser)return;const list=chooser.querySelector('.zqwc-list');const rows=[...providers.values()];list.innerHTML=rows.length?rows.map(w=>`<button class="zqwc-wallet" data-zqwc="${w.id.replaceAll('"','')}"><span class="zqwc-avatar">${initial(w.info.name)}</span><span class="zqwc-meta"><span class="zqwc-name">${w.info.name}</span><span class="zqwc-rdns">${w.info.rdns||'EIP-1193 provider instalado'}</span></span><span class="zqwc-chain">Conectar → ZORIQ</span></button>`).join(''):`<div class="zqwc-empty">Nenhuma wallet EVM injetada foi encontrada. Instale MetaMask, Rabby, Coinbase Wallet, Rainbow ou outra wallet compatível e recarregue a página.</div>`;list.querySelectorAll('[data-zqwc]').forEach(b=>b.onclick=()=>finishChooser(providers.get(b.dataset.zqwc)||null))}
function finishChooser(value){if(chooser)chooser.classList.remove('open');const r=resolveChooser;resolveChooser=null;if(r)r(value)}
async function choose(){requestProviders();await new Promise(r=>setTimeout(r,120));ensureChooser();renderChooser();chooser.classList.add('open');return await new Promise(resolve=>{resolveChooser=resolve})}
async function connect(){const entry=await choose();if(!entry)throw new Error('Conexão cancelada.');const accounts=await entry.provider.request({method:'eth_requestAccounts'});const address=String(accounts?.[0]||'');if(!address)throw new Error('Wallet não conectada.');await ensureZoriqChain(entry.provider);selected=entry;return{provider:entry.provider,address,info:entry.info,chain:chainParams()}}
function getProvider(){return selected?.provider||null}
function getSelected(){return selected}
function clear(){selected=null}
requestProviders();
window.ZORYQ_WALLET_CONNECT={discover:async()=>{requestProviders();await new Promise(r=>setTimeout(r,120));return[...providers.values()].map(({id,info})=>({id,info}))},choose,connect,ensureZoriqChain,getProvider,getSelected,clear,chainParams};
})();