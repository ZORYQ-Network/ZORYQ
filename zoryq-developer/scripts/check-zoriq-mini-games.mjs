import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const files={
 games:'zoryq-mobile/MiniGames.tsx',
 bridge:'zoryq-mobile/SocialSuite.native.js',
 native:'zoryq-mobile/ZoriqSocialNative.tsx',
 prefs:'zoryq-mobile/profilePreferences.ts',
 package:'zoryq-mobile/package.json',
 social:'zoryq-mobile/Social.tsx',
 app:'zoryq-mobile/app.json',
 profileWallet:'database/migrations/20260911_zoriq_social_profile_wallet_theme.sql'
};
for(const [name,file] of Object.entries(files)){if(!fs.existsSync(file))fail(`${name} missing: ${file}`);else pass(`${name}: ${file}`)}
if(process.exitCode)process.exit(process.exitCode);
const games=fs.readFileSync(files.games,'utf8');
const bridge=fs.readFileSync(files.bridge,'utf8');
const native=fs.readFileSync(files.native,'utf8');
const prefs=fs.readFileSync(files.prefs,'utf8');
const pkg=JSON.parse(fs.readFileSync(files.package,'utf8'));
const social=fs.readFileSync(files.social,'utf8');
const app=fs.readFileSync(files.app,'utf8');
const profileWallet=fs.readFileSync(files.profileWallet,'utf8');

for(const marker of ['ZORIQ MINI GAMES','Jogo da Velha','STOP','Xadrez','Damas','Pedra · Papel · Tesoura','Memória','Sem apostas','sem risco de saldo da wallet','new Chess','freshCheckers','winnerTTT','scoreStop']){if(!games.includes(marker))fail(`game marker missing: ${marker}`);else pass(`game marker: ${marker}`)}
for(const marker of ["mode?:'fun'|'gaming'",'Desafiar amigo','Share.share','AsyncStorage']){if(!games.includes(marker))fail(`games integration marker missing: ${marker}`);else pass(`games integration: ${marker}`)}

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

// The social shell may read the private key from SecureStore only to construct the local signer for the explicit $ transfer.
// What must never happen is rendering, logging, persisting elsewhere, or uploading mnemonic/private-key material from the profile UI.
for(const forbidden of ['mnemonic','seed phrase','MNEMONIC_KEY','console.log(pk)','console.log(privateKey)','<Text>{pk}</Text>','<Text>{privateKey}</Text>','avatar_url:pk','privateKey:pk']){if(native.toLowerCase().includes(forbidden.toLowerCase()))fail(`profile/social shell exposes wallet secret marker: ${forbidden}`);else pass(`profile/social shell avoids secret exposure marker: ${forbidden}`)}
if(!native.includes("SecureStore.getItemAsync(WALLET_KEY)"))fail('profile payment signer must load the local wallet from SecureStore');else pass('profile payment signer uses SecureStore');
if(!native.includes('wallet.sendTransaction({to:addr,value})'))fail('profile $ action must send only to the locked backend-provided address');else pass('profile $ action signs locked-recipient transfer');
for(const forbidden of ['betAmount','wager','casino','stakeGame','privateKey','MNEMONIC_KEY']){if(games.includes(forbidden))fail(`forbidden games capability found: ${forbidden}`);else pass(`no games wallet/wager marker: ${forbidden}`)}

if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ simplified social + Mini Games readiness checks passed.');
