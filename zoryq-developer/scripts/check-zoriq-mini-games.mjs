import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const files={games:'zoryq-mobile/MiniGames.tsx',bridge:'zoryq-mobile/SocialSuite.native.js',native:'zoryq-mobile/ZoriqSocialNative.tsx',prefs:'zoryq-mobile/profilePreferences.ts',package:'zoryq-mobile/package.json',social:'zoryq-mobile/Social.tsx',app:'zoryq-mobile/app.json',payment:'database/migrations/20260911_zoriq_social_payment_destination.sql'};
for(const [name,file] of Object.entries(files)){if(!fs.existsSync(file))fail(`${name} missing: ${file}`);else pass(`${name}: ${file}`)}
if(process.exitCode)process.exit(process.exitCode);
const games=fs.readFileSync(files.games,'utf8');
const bridge=fs.readFileSync(files.bridge,'utf8');
const native=fs.readFileSync(files.native,'utf8');
const prefs=fs.readFileSync(files.prefs,'utf8');
const pkg=JSON.parse(fs.readFileSync(files.package,'utf8'));
const social=fs.readFileSync(files.social,'utf8');
const app=fs.readFileSync(files.app,'utf8');
const payment=fs.readFileSync(files.payment,'utf8');
for(const marker of ['ZORIQ MINI GAMES','Jogo da Velha','STOP','Xadrez','Damas','Pedra · Papel · Tesoura','Memória','Sem apostas','sem risco de saldo da wallet','new Chess','freshCheckers','winnerTTT','scoreStop']){if(!games.includes(marker))fail(`game marker missing: ${marker}`);else pass(`game marker: ${marker}`)}
for(const marker of ["mode?:'fun'|'gaming'",'Desafiar amigo','Share.share','AsyncStorage']){if(!games.includes(marker))fail(`games integration marker missing: ${marker}`);else pass(`games integration: ${marker}`)}
if(!bridge.includes("export {default} from './ZoriqSocialNative'"))fail('native bridge must route to ZoriqSocialNative');else pass('native bridge routes to ZoriqSocialNative');
for(const marker of ['MiniGames',"['home','⌂','Home']","['search','⌕','Buscar']",'$ Enviar cripto','Foto de perfil','themeMode','theme_preference','show_wallet','receive_wallet_address','ZORYQ Testnet · ZQ','Mensagens','Alertas']){if(!native.includes(marker))fail(`native experience marker missing: ${marker}`);else pass(`native experience: ${marker}`)}
if(native.includes("['network','Rede']"))fail('obsolete Rede navigation tab is still present');else pass('Rede navigation tab removed');
for(const marker of ['arrayBuffer()','profile-media','avatar_url','show_wallet','theme_preference']){if(!prefs.includes(marker))fail(`profile preference marker missing: ${marker}`);else pass(`profile preference: ${marker}`)}
if(pkg.dependencies?.['chess.js']!=='1.4.0')fail('chess.js must be pinned to 1.4.0');else pass('chess.js pinned to 1.4.0');
if(pkg.dependencies?.['expo-image-picker']!=='~17.0.11')fail('expo-image-picker must match Expo SDK 54 recommendation');else pass('expo-image-picker pinned for Expo SDK 54');
if(!app.includes('"userInterfaceStyle": "automatic"')||!app.includes('expo-image-picker'))fail('automatic theme / image picker app config missing');else pass('automatic theme and image picker app config present');
for(const marker of ['social_payment_destination','show_wallet','verified_at','eip155','grant execute']){if(!payment.toLowerCase().includes(marker.toLowerCase()))fail(`payment destination marker missing: ${marker}`);else pass(`payment destination: ${marker}`)}
if(!social.includes("['fun','😂 Divertir']")||!social.includes("['gaming','🎮 Games']"))fail('Social feed modes Divertir/Games are missing');else pass('Social feed keeps Divertir/Games modes');
for(const forbidden of ['betAmount','wager','casino','stakeGame','privateKey','MNEMONIC_KEY']){if(games.includes(forbidden))fail(`forbidden games capability found: ${forbidden}`);else pass(`no games wallet/wager marker: ${forbidden}`)}
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ simplified social + Mini Games readiness checks passed.');
