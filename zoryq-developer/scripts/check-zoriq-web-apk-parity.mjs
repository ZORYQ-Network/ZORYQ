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
 multichain:['Ethereum','Base','Arbitrum One','Optimism','Polygon','Avalanche C-Chain','Linea','ZKsync Era'],
 theme:['data-parity-theme','zoriqTheme'],
 privacy:['wallet verificada','não armazena nem solicita seed phrase']
};
for(const [cap,markers] of Object.entries(webCapabilities))for(const marker of markers){const src=marker.includes('zoriq-social-')||['ZORIQ Social','Pulse','Worlds','ZORI','Reputação'].includes(marker)?html:web;if(!src.includes(marker))fail(`web ${cap} missing: ${marker}`);else pass(`web ${cap}: ${marker}`)}

for(const marker of ['zoriq-app-parity.css','zoriq-app-parity.js']){if(!html.includes(marker))fail(`web shell missing parity asset: ${marker}`);else pass(`web shell loads ${marker}`)}
for(const marker of ['socialPayRouters','5919065','8453','42161','43114','56','534352','130']){if(!cfg.includes(marker))fail(`router registry missing: ${marker}`);else pass(`router registry: ${marker}`)}
if(!webCss.includes('@media(max-width:900px)'))fail('web parity responsive breakpoint missing');else pass('web parity responsive breakpoint present');

const mobileCapabilities={
 wallet:['Wallet / Recovery'],
 security:['ZORIQ SECURITY','BIOMETRIC_STRONG'],
 social:['SocialSuite'],
 socialSync:['getBackendState','subscribeSocial'],
 notifications:['Notificações sociais','listNotifications'],
 socialPay:['$ Enviar cripto','Taxa ZORIQ'],
 multichain:['Ethereum','Base','Arbitrum One','Polygon','Avalanche C-Chain'],
 auth:['signInWithWeb3']
};
const mobileSources=[mobileIndex,mobileSuite,mobileBackend,mobilePay,mobilePayments,mobileMc,mobileMcUi,mobileHub,appNative].join('\n');
for(const [cap,markers] of Object.entries(mobileCapabilities))for(const marker of markers){if(!mobileSources.includes(marker))fail(`APK ${cap} missing: ${marker}`);else pass(`APK ${cap}: ${marker}`)}

const commonMc=['Ethereum','Base','Arbitrum One','Optimism','Polygon','Avalanche C-Chain','BNB Smart Chain','Linea','ZKsync Era','Scroll','Unichain'];
for(const marker of commonMc){
  if(!webMc.includes(marker))fail(`web multichain missing network: ${marker}`);else pass(`web multichain network: ${marker}`);
  if(!mobileMc.includes(marker))fail(`APK multichain missing network: ${marker}`);else pass(`APK multichain network: ${marker}`);
}
for(const marker of ['eth_getCode','eth_call','https://li.quest/v1/quote','approvalAddress','slippage']){
  if(!webMc.includes(marker))fail(`web multichain engine missing: ${marker}`);else pass(`web multichain engine: ${marker}`);
}
for(const marker of ['getCode(','new Contract(','https://li.quest/v1/quote','approvalAddress','slippage']){
  if(!mobileMc.includes(marker))fail(`APK multichain engine missing: ${marker}`);else pass(`APK multichain engine: ${marker}`);
}
if(!webMc.includes("[.005,.01,.02]"))fail('web auto-slippage sequence must be 0.5% → 1% → 2%');else pass('web auto-slippage sequence: 0.5% → 1% → 2%');
if(!mobileMc.includes('[0.005,0.01,0.02]'))fail('APK auto-slippage sequence must be 0.5% → 1% → 2%');else pass('APK auto-slippage sequence: 0.5% → 1% → 2%');
for(const marker of ['WALLET MULTICHAIN','Cole um contrato','SLIPPAGE','AUTO','MANUAL']){
  if(!webMc.includes(marker))fail(`web multichain UI missing: ${marker}`);else pass(`web multichain UI: ${marker}`);
  if(!mobileMcUi.includes(marker))fail(`APK multichain UI missing: ${marker}`);else pass(`APK multichain UI: ${marker}`);
}
if(!cfg.includes("lifiIntegrator:''")||!cfg.includes('lifiFee:0.005'))fail('web LI.FI fee must default to inactive integrator + explicit 0.5% rate');else pass('web LI.FI fee defaults safe/inactive until integrator config');
if(!mobileMc.includes("process.env.EXPO_PUBLIC_LIFI_INTEGRATOR||''"))fail('APK LI.FI fee must require explicit public integrator configuration');else pass('APK LI.FI fee requires explicit integrator configuration');
if(!appNative.includes("import WalletHub from './WalletHub'"))fail('APK native wallet entry must load WalletHub');else pass('APK native wallet loads WalletHub');
if(!mobileHub.includes('<MultiChainWallet/>'))fail('WalletHub missing multichain surface');else pass('WalletHub exposes multichain surface');
if(!cfg.includes("s.src='/zoriq-multichain-wallet.js'"))fail('web config must load multichain wallet layer');else pass('web config loads multichain wallet layer');

for(const forbidden of ['service_role','SUPABASE_SERVICE_ROLE_KEY','sb_secret_','LIFI_API_KEY','LIFI_SECRET']){
  for(const [name,src] of [['web parity',web],['web multichain',webMc],['web config',cfg],['APK multichain',mobileMc]]){
    if(src.includes(forbidden))fail(`${name} contains forbidden secret marker: ${forbidden}`);else pass(`${name} has no ${forbidden}`);
  }
}
if(!web.includes("if(!router)return toast('Router ainda não configurado nesta rede.')"))fail('web Social Pay must block unconfigured routers');else pass('web Social Pay blocks unconfigured routers');
if(!mobilePayments.includes("if(!network.routerAddress||!isAddress(network.routerAddress))throw new Error('payment_router_not_deployed')"))fail('APK Social Pay must block undeployed routers');else pass('APK Social Pay blocks undeployed routers');
if(!webMc.includes("state.quote.created>55000")||!mobileMc.includes('quote.createdAt>55000'))fail('multichain quotes must expire before execution');else pass('multichain quotes expire before execution');
if(!mobileMc.includes("if(!isAddress(String(tr.to||'')))throw new Error('quote_destination_invalid')"))fail('APK multichain must validate quote transaction destination');else pass('APK multichain validates quote destination');
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Web DApp ↔ APK parity checks passed.');
