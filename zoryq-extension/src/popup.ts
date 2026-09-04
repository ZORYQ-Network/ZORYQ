import { createPhrase, identity, validPhrase } from './core';

declare const chrome: any;

type Vault = { v:1; salt:string; iv:string; cipher:string; address:string };
const app = document.getElementById('app')!;
let currentPhrase = '';

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

async function passwordKey(password: string, salt: Uint8Array) {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:310000, hash:'SHA-256' }, raw, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function encryptPhrase(phrase: string, password: string, address: string): Promise<Vault> {
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(phrase)));
  return { v:1, salt:b64(salt), iv:b64(iv), cipher:b64(cipher), address };
}
async function decryptPhrase(vault: Vault, password: string) {
  const key = await passwordKey(password, unb64(vault.salt));
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(vault.iv) }, key, unb64(vault.cipher));
  return new TextDecoder().decode(plain);
}
async function getVault(): Promise<Vault|null> { const x = await chrome.storage.local.get('vault'); return x.vault || null; }
async function setVault(vault: Vault) { await chrome.storage.local.set({ vault }); }
async function connectionEnabled() { const x = await chrome.storage.local.get('siteConnectionEnabled'); return x.siteConnectionEnabled === true; }
async function setConnectionEnabled(value: boolean) { await chrome.storage.local.set({ siteConnectionEnabled:value }); }
async function unlockSigner(phrase: string, address: string) { const r=await chrome.runtime.sendMessage({ type:'wallet_unlock', phrase, address }); if(!r?.ok) throw new Error(r?.error || 'Signer unlock failed.'); }
async function lockSigner() { await chrome.runtime.sendMessage({ type:'wallet_lock' }).catch(()=>{}); }
function wordsHtml(phrase: string) { return `<div class="seed">${phrase.split(' ').map((w,i)=>`<span>${i+1}. ${w}</span>`).join('')}</div>`; }
function status(text: string, bad=false) { const el=document.getElementById('status'); if(el){el.className=bad?'err':'ok';el.textContent=text;} }

async function renderStart() {
  const vault = await getVault();
  if (vault) return renderLock(vault);
  app.innerHTML = `<div class="eye">SELF-CUSTODY • ML-DSA-65</div><div class="title">Own your ZORYQ.</div><div class="muted">Create a BIP-39 recovery phrase or restore an existing ZORYQ Wallet. Secrets never leave this extension.</div><div class="card"><input id="password" type="password" placeholder="Create wallet password (8+ chars)"><button id="create" class="primary">CREATE NEW WALLET</button><button id="import" class="secondary">IMPORT RECOVERY PHRASE</button><div id="status"></div></div>`;
  document.getElementById('create')!.onclick = async () => {
    try { const p=(document.getElementById('password') as HTMLInputElement).value; const phrase=createPhrase(); const id=identity(phrase); await setVault(await encryptPhrase(phrase,p,id.address)); await setConnectionEnabled(false); await unlockSigner(phrase,id.address); currentPhrase=phrase; renderBackup(id.address); } catch(e:any){status(e.message,true)}
  };
  document.getElementById('import')!.onclick = () => renderImport();
}
function renderBackup(address: string) {
  app.innerHTML = `<div class="eye">RECOVERY BACKUP</div><div class="title">Write these 12 words down.</div><div class="muted">Keep them offline and in order. Anyone with these words controls the wallet.</div>${wordsHtml(currentPhrase)}<div class="card"><div class="muted">Address</div><div class="addr">${address}</div></div><button id="done" class="primary">I SAVED MY RECOVERY PHRASE</button>`;
  document.getElementById('done')!.onclick = () => renderWallet(address);
}
function renderImport() {
  app.innerHTML = `<div class="eye">RESTORE</div><div class="title">Import wallet.</div><div class="muted">Enter your 12 or 24 BIP-39 words. They are processed locally.</div><textarea id="phrase" placeholder="word1 word2 word3 …"></textarea><input id="password" type="password" placeholder="New wallet password (8+ chars)"><button id="restore" class="primary">RESTORE WALLET</button><button id="back" class="secondary">BACK</button><div id="status"></div>`;
  document.getElementById('restore')!.onclick = async () => {
    try { const phrase=(document.getElementById('phrase') as HTMLTextAreaElement).value.trim().toLowerCase().replace(/\s+/g,' '); if(!validPhrase(phrase)) throw new Error('Invalid BIP-39 phrase.'); const p=(document.getElementById('password') as HTMLInputElement).value; const id=identity(phrase); await setVault(await encryptPhrase(phrase,p,id.address)); await setConnectionEnabled(false); await unlockSigner(phrase,id.address); currentPhrase=phrase; renderWallet(id.address); } catch(e:any){status(e.message,true)}
  };
  document.getElementById('back')!.onclick = renderStart;
}
function renderLock(vault: Vault) {
  app.innerHTML = `<div class="eye">WALLET LOCKED</div><div class="title">Welcome back.</div><div class="card"><div class="muted">${vault.address}</div><input id="password" type="password" placeholder="Wallet password"><button id="unlock" class="primary">UNLOCK</button><div id="status"></div></div>`;
  document.getElementById('unlock')!.onclick = async () => { try { currentPhrase=await decryptPhrase(vault,(document.getElementById('password') as HTMLInputElement).value); const id=identity(currentPhrase); if(id.address!==vault.address) throw new Error('Vault integrity check failed.'); await unlockSigner(currentPhrase,id.address); renderWallet(id.address); } catch { status('Incorrect password or damaged vault.',true); } };
}
async function renderWallet(address: string) {
  const enabled = await connectionEnabled();
  app.innerHTML = `<div class="eye">ZORYQ TESTNET • WALLET v0.3</div><div class="title">Wallet</div><div class="card"><div class="muted">ACCOUNT 1 • ML-DSA-65</div><div class="addr">${address}</div><button id="copy" class="secondary">COPY ADDRESS</button></div><div class="card"><div class="muted">OFFICIAL TESTNET CONNECTION</div><div style="margin-top:8px">${enabled ? 'Enabled. The official Testnet may request your address and signed challenges.' : 'Disabled. The website cannot access your wallet.'}</div><button id="site" class="${enabled ? 'danger' : 'primary'}">${enabled ? 'DISABLE TESTNET CONNECTION' : 'ALLOW TESTNET CONNECTION'}</button></div><button id="reveal" class="secondary">VIEW RECOVERY PHRASE</button><button id="lock" class="secondary">LOCK</button><button id="remove" class="danger">REMOVE WALLET</button><div id="status"></div>`;
  document.getElementById('copy')!.onclick = async () => { await navigator.clipboard.writeText(address); status('Address copied.'); };
  document.getElementById('site')!.onclick = async () => { await setConnectionEnabled(!enabled); await renderWallet(address); status(!enabled ? 'Official Testnet connection enabled.' : 'Official Testnet connection disabled.'); };
  document.getElementById('reveal')!.onclick = () => { if(currentPhrase) renderBackup(address); else status('Unlock the wallet first.',true); };
  document.getElementById('lock')!.onclick = async () => { currentPhrase=''; await lockSigner(); const v=await getVault(); if(v) renderLock(v); };
  document.getElementById('remove')!.onclick = async () => { if(confirm('Remove this wallet from the extension? Only continue if your recovery phrase is backed up.')) { currentPhrase=''; await lockSigner(); await chrome.storage.local.remove(['vault','siteConnectionEnabled']); renderStart(); } };
}

renderStart().catch(e => { app.innerHTML=`<div class="err">${e.message}</div>`; });
