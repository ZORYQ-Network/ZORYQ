import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const read=(p)=>{if(!fs.existsSync(p)){fail(`missing ${p}`);return''}return fs.readFileSync(p,'utf8')};

const html=read('zoryq-web/zoriq-social-v2.html');
const web=read('zoryq-web/zoriq-app-parity.js');
const webMc=read('zoryq-web/zoriq-multichain-wallet.js');
const webCss=read('zoryq-web/zoriq-app-parity.css');
const cfg=read('zoryq-web/config.js');
const mobileIndex=read('zoryq-mobile/index.js');
const mobileSuite=read('zoryq-mobile/SocialSuite.tsx');
const mobileBackend=read('zoryq-mobile/socialBackend.ts');
const mobilePay=read('zoryq-mobile/SocialPaymentSheet.tsx');
const mobilePayments=read('zoryq-mobile/socialPayments.ts');
const mobileMc=read('zoryq-mobile/multichainWallet.ts');
const mobileMcUi=read('zoryq-mobile/MultiChainWallet.tsx');
const mobileHub=read('zoryq-mobile/WalletHub.tsx');
const appNative=read('zoryq-mobile/App.native.js');

const webCapabilities={
 social:['ZORIQ Social','Pulse','Worlds','ZORI','Reputação'],
 syncedSocial:['zoriq-social-backend.js','zoriq-social-sync.js'],
 wallet:['Wallet','connectWallet','Faucet','Enviar ZQ','Recovery'],
 security:['SEGURANÇA','personal_sign','SIWE'],
 verified:['ZORIQ VERIFIED','purchaseVerified'],
 socialPay:['ZORIQ SOCIAL PAY','social_payment_destination','payNative(address,bytes32)','payToken(address,address,uint256,bytes32)','DEFAULT_FEE_BPS','MAX_FEE_BPS'],
 theme:['data-parity-theme','zoriqTheme'],
 privacy:['wallet verificada','não armazena nem solicita seed phrase']
};
for(const [cap,markers] of Object.entries(webCapabilities))for(const marker of markers){const src=marker.includes('zoriq-social-')||['ZORIQ Social','Pulse','Worlds','ZORI','Reputação'].includes(marker)?html:web;if(!src.includes(marker))fail(`web ${cap} missing: ${marker}`);else pass(`web ${cap}: ${marker}`)}

for(const marker of ['zoriq-app-parity.css','zoriq-app-parity.js','zoriq-multichain-wallet.js']){if(!html.includes(marker))fail(`web shell missing parity asset: ${marker}`);else pass(`web shell loads ${marker}`)}
for(const marker of ['socialPayRouters','5919065','8453','42161','43114','56','534352','130']){if(!cfg.includes(marker))fail(`router registry missing: ${marker}`);else pass(`router registry: ${marker}`)}
if(!webCss.includes('@media(max-width:900px)'))fail('web parity responsive breakpoint missing');else pass('web parity responsive breakpoint present');

const mobileCapabilities={
 wallet:['Wallet / Recovery'],security:['ZORIQ SECURITY','BIOMETRIC_STRONG'],social:['SocialSuite'],socialSync:['getBackendState','subscribeSocial'],notifications:['Notificações sociais','listNotifications'],socialPay:['$ Enviar cripto','Taxa ZORIQ'],auth:['signInWithWeb3']
};
const mobileSources=[mobileIndex,mobileSuite,mobileBackend,mobilePay,mobilePayments,mobileMc,mobileMcUi,mobileHub,appNative].join('\n');
for(const [cap,markers] of Object.entries(mobileCapabilities))for(const marker of markers){if(!mobileSources.includes(marker))fail(`APK ${cap} missing: ${marker}`);else pass(`APK ${cap}: ${marker}`)}

const commonMc=['Ethereum','Base','Arbitrum One','Optimism','Polygon','BNB Smart Chain','Avalanche C-Chain','Gnosis','Sonic','Unichain'];
for(const marker of commonMc){
  if(!webMc.includes(marker))fail(`web Swap EVM missing network: ${marker}`);else pass(`web Swap EVM network: ${marker}`);
  if(!mobileMc.includes(marker))fail(`APK Swap EVM missing network: ${marker}`);else pass(`APK Swap EVM network: ${marker}`);
}

const webEngine=['eth_getCode','eth_call','https://api.paraswap.io','partnerFeeBps:String(FEE_BPS)','partnerAddress:TREASURY',"isDirectFeeTransfer:'true'","excludeContractMethodsWithoutFeeModel:'true'",'fee_route_unavailable','state.quote.created>55000'];
for(const marker of webEngine){if(!webMc.includes(marker))fail(`web Swap EVM engine missing: ${marker}`);else pass(`web Swap EVM engine: ${marker}`)}
const mobileEngine=['getCode(','new Contract(','https://api.paraswap.io','partnerFeeBps:String(ZORIQ_SWAP_FEE_BPS)','partnerAddress:ZORIQ_TREASURY',"isDirectFeeTransfer:'true'","excludeContractMethodsWithoutFeeModel:'true'",'fee_route_unavailable','quote.createdAt>55000'];
for(const marker of mobileEngine){if(!mobileMc.includes(marker))fail(`APK Swap EVM engine missing: ${marker}`);else pass(`APK Swap EVM engine: ${marker}`)}

for(const [name,src] of [['web',webMc],['APK',mobileMc]]){
  if(src.includes('li.quest'))fail(`${name} Swap EVM must not contain fee-less LI.FI fallback`);else pass(`${name} Swap EVM has no LI.FI fallback`);
}
if(!webMc.includes('[50,100,200]'))fail('web auto-slippage sequence must be 0.5% → 1% → 2%');else pass('web auto-slippage sequence: 0.5% → 1% → 2%');
if(!mobileMc.includes('[50,100,200]'))fail('APK auto-slippage sequence must be 0.5% → 1% → 2%');else pass('APK auto-slippage sequence: 0.5% → 1% → 2%');

const uiMarkers=['ZORIQ SWAP EVM','Cole contrato 0x','COTAR MELHOR ROTA','AUTO','MANUAL','TREASURY ZORIQ'];
for(const marker of uiMarkers){
  if(!webMc.includes(marker))fail(`web Swap EVM UI missing: ${marker}`);else pass(`web Swap EVM UI: ${marker}`);
  if(!mobileMcUi.includes(marker))fail(`APK Swap EVM UI missing: ${marker}`);else pass(`APK Swap EVM UI: ${marker}`);
}
if(!webMc.includes('setTimeout(()=>autoFind(side,v,true),450)'))fail('web contract paste must auto-detect after debounce');else pass('web contract paste auto-detection enabled');
if(!mobileMcUi.includes("setTimeout(()=>{lastAuto.current[side]=key;detect(side,clean,true)},450)"))fail('APK contract paste must auto-detect after debounce');else pass('APK contract paste auto-detection enabled');
if(!webMc.includes("const FEE_BPS=50")||!webMc.includes("const TREASURY='0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33'"))fail('web Swap EVM fee/Treasury mismatch');else pass('web Swap EVM fee 0.5% + Treasury configured');
if(!mobileMc.includes('ZORIQ_SWAP_FEE_BPS=50')||!mobileMc.includes("ZORIQ_TREASURY='0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33'"))fail('APK Swap EVM fee/Treasury mismatch');else pass('APK Swap EVM fee 0.5% + Treasury configured');

if(!appNative.includes("import WalletHub from './WalletHub'"))fail('APK native wallet entry must load WalletHub');else pass('APK native wallet loads WalletHub');
if(!mobileHub.includes('<MultiChainWallet/>')||!mobileHub.includes('SWAP EVM'))fail('WalletHub missing Swap EVM surface');else pass('WalletHub exposes Swap EVM surface');

for(const forbidden of ['service_role','SUPABASE_SERVICE_ROLE_KEY','sb_secret_','ZEROX_API_KEY','LIFI_API_KEY','LIFI_SECRET']){
  for(const [name,src] of [['web parity',web],['web Swap EVM',webMc],['web config',cfg],['APK Swap EVM',mobileMc]]){
    if(src.includes(forbidden))fail(`${name} contains forbidden secret marker: ${forbidden}`);else pass(`${name} has no ${forbidden}`);
  }
}
if(!web.includes("if(!router)return toast('Router ainda não configurado nesta rede.')"))fail('web Social Pay must block unconfigured routers');else pass('web Social Pay blocks unconfigured routers');
if(!mobilePayments.includes("if(!network.routerAddress||!isAddress(network.routerAddress))throw new Error('payment_router_not_deployed')"))fail('APK Social Pay must block undeployed routers');else pass('APK Social Pay blocks undeployed routers');
if(!mobileMc.includes("if(!isAddress(String(txp.to||'')))throw new Error('quote_destination_invalid')"))fail('APK Swap EVM must validate quote transaction destination');else pass('APK Swap EVM validates quote destination');
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Web DApp ↔ APK parity checks passed.');
