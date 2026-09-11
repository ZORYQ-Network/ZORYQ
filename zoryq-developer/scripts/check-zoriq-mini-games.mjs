import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const files={games:'zoryq-mobile/MiniGames.tsx',bridge:'zoryq-mobile/SocialSuite.native.js',package:'zoryq-mobile/package.json',social:'zoryq-mobile/Social.tsx'};
for(const [name,file] of Object.entries(files)){if(!fs.existsSync(file))fail(`${name} missing: ${file}`);else pass(`${name}: ${file}`)}
if(process.exitCode)process.exit(process.exitCode);
const games=fs.readFileSync(files.games,'utf8');
const bridge=fs.readFileSync(files.bridge,'utf8');
const pkg=JSON.parse(fs.readFileSync(files.package,'utf8'));
const social=fs.readFileSync(files.social,'utf8');
for(const marker of ['ZORIQ MINI GAMES','Jogo da Velha','STOP','Xadrez','Damas','Pedra · Papel · Tesoura','Memória','Sem apostas','sem risco de saldo da wallet','new Chess','freshCheckers','winnerTTT','scoreStop']){if(!games.includes(marker))fail(`game marker missing: ${marker}`);else pass(`game marker: ${marker}`)}
for(const marker of ["mode?:'fun'|'gaming'",'Desafiar amigo','Share.share','AsyncStorage']){if(!games.includes(marker))fail(`games integration marker missing: ${marker}`);else pass(`games integration: ${marker}`)}
for(const marker of ['😂 Divertir','🎮 Games','MiniGames','SocialSuiteCore']){if(!bridge.includes(marker))fail(`native bridge marker missing: ${marker}`);else pass(`native bridge: ${marker}`)}
if(pkg.dependencies?.['chess.js']!=='1.4.0')fail('chess.js must be pinned to 1.4.0');else pass('chess.js pinned to 1.4.0');
if(!social.includes("['fun','😂 Divertir']")||!social.includes("['gaming','🎮 Games']"))fail('Social feed modes Divertir/Games are missing');else pass('Social feed keeps Divertir/Games modes');
for(const forbidden of ['betAmount','wager','casino','stakeGame','privateKey','MNEMONIC_KEY']){if(games.includes(forbidden))fail(`forbidden games capability found: ${forbidden}`);else pass(`no games wallet/wager marker: ${forbidden}`)}
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Mini Games readiness checks passed.');
