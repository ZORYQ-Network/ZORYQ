import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const files={
 games:'zoryq-mobile/PremiumArcade.tsx',
 wrapper:'zoryq-mobile/MiniGames.tsx',
 bridge:'zoryq-mobile/SocialSuite.native.js',
 native:'zoryq-mobile/ZoriqSocialNative.tsx',
 prefs:'zoryq-mobile/profilePreferences.ts',
 package:'zoryq-mobile/package.json',
 social:'zoryq-mobile/Social.tsx',
 app:'zoryq-mobile/app.json',
 profileWallet:'database/migrations/20260911_zoriq_social_profile_wallet_theme.sql',
 paymentDestination:'zoryq-mobile/socialPaymentDestination.ts',
 payments:'zoryq-mobile/socialPayments.ts',
 paymentSheet:'zoryq-mobile/SocialPaymentSheet.tsx'
};
for(const [name,file] of Object.entries(files)){if(!fs.existsSync(file))fail(`${name} missing: ${file}`);else pass(`${name}: ${file}`)}
if(process.exitCode)process.exit(process.exitCode);
const games=fs.readFileSync(files.games,'utf8');
const wrapper=fs.readFileSync(files.wrapper,'utf8');
const bridge=fs.readFileSync(files.bridge,'utf8');
const native=fs.readFileSync(files.native,'utf8');
const prefs=fs.readFileSync(files.prefs,'utf8');
const pkg=JSON.parse(fs.readFileSync(files.package,'utf8'));
const social=fs.readFileSync(files.social,'utf8');
const app=fs.readFileSync(files.app,'utf8');
const profileWallet=fs.readFileSync(files.profileWallet,'utf8');
const paymentDestination=fs.readFileSync(files.paymentDestination,'utf8');
const payments=fs.readFileSync(files.payments,'utf8');
const paymentSheet=fs.readFileSync(files.paymentSheet,'utf8');

if(!wrapper.includes("export {default} from './PremiumArcade'"))fail('MiniGames wrapper must route to PremiumArcade');else pass('MiniGames wrapper routes to PremiumArcade');
for(const marker of ['ZORYQ ARCADE','Neon 2048','Xadrez vs ZORI','Damas vs ZORI','Pulse Sequence','Reflex Rush','Memory Pro','Jogo da Velha Arena','Sem apostas','sem risco de saldo da wallet','new Chess','freshCheckers','winnerTTT','move2048','minimaxTTT','aiCheckersTurn']){if(!games.includes(marker))fail(`arcade marker missing: ${marker}`);else pass(`arcade marker: ${marker}`)}
for(const marker of ["mode?:'fun'|'gaming'",'Desafiar amigo','Share.share','AsyncStorage','onEarnXp?.(xp)']){if(!games.includes(marker))fail(`games integration marker missing: ${marker}`);else pass(`games integration: ${marker}`)}

if(!bridge.includes("export {default} from './ZoriqSocialNative'"))fail('native bridge must route to ZoriqSocialNative');else pass('native bridge routes to ZoriqSocialNative');
for(const marker of ['MiniGames',"['home','⌂','Home']","['search','⌕','Buscar']","['play','◈','Play']","['alerts','♡','Alertas']","['profile','◎','Perfil']",'😂 Divertir','🎮 Games','$ Enviar cripto','can_receive_crypto','receive_wallet_address','ensureLocalWalletLinked','Alterar foto de perfil','☀ Dia','☾ Noite','◐ Automático','uploadProfileAvatar','theme_preference','Mensagens']){if(!native.includes(marker))fail(`native experience marker missing: ${marker}`);else pass(`native experience: ${marker}`)}
if(native.includes("['network','Rede']")||native.includes("['network','Rede sincronizada']"))fail('obsolete Rede navigation tab is still present');else pass('Rede navigation tab removed; synchronized feed lives in Home');

for(const marker of ['profile-media','avatar_url','show_wallet','theme_preference','arrayBuffer','5*1024*1024']){if(!prefs.includes(marker))fail(`profile preference marker missing: ${marker}`);else pass(`profile preference: ${marker}`)}
for(const marker of ['theme_preference','show_wallet','verified_at',"chain_namespace='eip155'",'can_receive_crypto','receive_wallet_address','social_public_profiles']){if(!profileWallet.includes(marker))fail(`profile wallet migration marker missing: ${marker}`);else pass(`profile wallet migration: ${marker}`)}
if(!profileWallet.includes("theme_preference in ('system','light','dark')"))fail('theme preference constraint missing');else pass('theme preference constrained to system/light/dark');

if(pkg.dependencies?.['chess.js']!=='1.4.0')fail('chess.js must be pinned to 1.4.0');else pass('chess.js pinned to 1.4.0');
if(pkg.dependencies?.['expo-image-picker']!=='~17.0.11')fail('expo-image-picker must match Expo SDK 54 recommendation');else pass('expo-image-picker pinned for Expo SDK 54');
if(!app.includes('"userInterfaceStyle": "automatic"')||!app.includes('expo-image-picker'))fail('automatic theme / image picker app config missing');else pass('automatic theme and image picker app config present');
if(!social.includes("['fun','😂 Divertir']")||!social.includes("['gaming','🎮 Games']"))fail('Social feed modes Divertir/Games are missing');else pass('Social feed keeps Divertir/Games modes');

// Social/profile UI may initiate a transfer but must never display or persist signing secrets.
for(const forbidden of ['mnemonic','seed phrase','MNEMONIC_KEY','console.log(pk)','console.log(privateKey)','<Text>{pk}</Text>','<Text>{privateKey}</Text>','avatar_url:pk','privateKey:pk']){if(native.toLowerCase().includes(forbidden.toLowerCase()))fail(`profile/social shell exposes wallet secret marker: ${forbidden}`);else pass(`profile/social shell avoids secret exposure marker: ${forbidden}`)}

// Current Social Pay architecture: the payment module owns signing, loads only the local
// embedded wallet from SecureStore, and re-resolves the verified backend destination at
// the last responsible moment. The UI address is display-only; a mismatch aborts.
if(!payments.includes('SecureStore.getItemAsync(WALLET_KEY)'))fail('Social Pay signer must load the local APK wallet from SecureStore');else pass('Social Pay signer uses the local SecureStore wallet');
for(const marker of ['social_payment_destination','chain_namespace',"'eip155'",'payment_destination_changed']){if(!paymentDestination.includes(marker))fail(`locked payment destination marker missing: ${marker}`);else pass(`locked payment destination: ${marker}`)}
if(!payments.includes('assertSocialPaymentDestination(profileId,recipient)')||!payments.includes('const lockedRecipient=destination.address'))fail('Social Pay must re-resolve and lock the backend-verified recipient immediately before signing');else pass('Social Pay re-resolves and locks the verified recipient before signing');
if(!payments.includes('router.payNative(lockedRecipient,paymentRef')||!payments.includes('router.payToken(asset.tokenAddress,lockedRecipient,gross,paymentRef)'))fail('Social Pay router calls must use only the locked backend recipient');else pass('Social Pay router sends only to the locked backend recipient');
if(!native.includes('p.can_receive_crypto&&p.receive_wallet_address')||!native.includes('setTransferTarget(p)'))fail('profile $ action must only open for a backend-approved receiving profile');else pass('profile $ action only opens for an approved receiving profile');
if(!paymentSheet.includes('Destinatário verificado')||!paymentSheet.includes('target.address'))fail('payment sheet must display the locked recipient for review');else pass('payment sheet displays the verified locked recipient');
if(paymentSheet.includes('onChangeText={setRecipient}')||paymentSheet.includes('onChangeText={v=>setRecipient'))fail('payment sheet must not expose an editable recipient field');else pass('payment sheet has no editable recipient field');
if(!payments.includes("if(!network.routerAddress||!isAddress(network.routerAddress))throw new Error('payment_router_not_deployed')"))fail('Social Pay must block undeployed routers');else pass('Social Pay blocks undeployed routers');

for(const forbidden of ['betAmount','wager','casino','stakeGame','privateKey','MNEMONIC_KEY']){if(games.includes(forbidden))fail(`forbidden games capability found: ${forbidden}`);else pass(`no games wallet/wager marker: ${forbidden}`)}

if(process.exitCode)process.exit(process.exitCode);
console.log('ZORYQ Social + Premium Arcade readiness checks passed.');
