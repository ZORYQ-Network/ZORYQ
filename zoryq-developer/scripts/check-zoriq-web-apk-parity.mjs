import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const read=(p)=>{if(!fs.existsSync(p)){fail(`missing ${p}`);return''}return fs.readFileSync(p,'utf8')};

const html=read('zoryq-web/zoriq-social-v2.html');
const web=read('zoryq-web/zoriq-app-parity.js');
const webCss=read('zoryq-web/zoriq-app-parity.css');
const cfg=read('zoryq-web/config.js');
const mobileIndex=read('zoryq-mobile/index.js');
const mobileSuite=read('zoryq-mobile/SocialSuite.tsx');
const mobileBackend=read('zoryq-mobile/socialBackend.ts');
const mobilePay=read('zoryq-mobile/SocialPaymentSheet.tsx');
const mobilePayments=read('zoryq-mobile/socialPayments.ts');

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
for(const marker of ['socialPayRouters','5919065','8453','42161','43114']){if(!cfg.includes(marker))fail(`router registry missing: ${marker}`);else pass(`router registry: ${marker}`)}
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
const mobileSources=[mobileIndex,mobileSuite,mobileBackend,mobilePay,mobilePayments].join('\n');
for(const [cap,markers] of Object.entries(mobileCapabilities))for(const marker of markers){if(!mobileSources.includes(marker))fail(`APK ${cap} missing: ${marker}`);else pass(`APK ${cap}: ${marker}`)}

for(const forbidden of ['service_role','SUPABASE_SERVICE_ROLE_KEY','sb_secret_']){if(web.includes(forbidden))fail(`web parity contains forbidden secret marker: ${forbidden}`);else pass(`web parity has no ${forbidden}`)}
if(!web.includes("if(!router)return toast('Router ainda não configurado nesta rede.')"))fail('web Social Pay must block unconfigured routers');else pass('web Social Pay blocks unconfigured routers');
if(!mobilePayments.includes("if(!network.routerAddress||!isAddress(network.routerAddress))throw new Error('payment_router_not_deployed')"))fail('APK Social Pay must block undeployed routers');else pass('APK Social Pay blocks undeployed routers');
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Web DApp ↔ APK parity checks passed.');
