import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const fail=(message)=>{console.error(`FAIL: ${message}`);process.exitCode=1};
const pass=(message)=>console.log(`PASS: ${message}`);
const socialPath='zoryq-web/zoriq-social.html';
const servicePath='zoryq-evm-node/social-service.mjs';
const mobilePath='zoryq-mobile/SuperApp.tsx';
const configPath='zoryq-web/config.js';
for(const file of [socialPath,servicePath,mobilePath,configPath]){if(!fs.existsSync(file))fail(`missing ${file}`);else pass(`found ${file}`)}
if(process.exitCode)process.exit(process.exitCode);
const social=fs.readFileSync(socialPath,'utf8'),service=fs.readFileSync(servicePath,'utf8'),mobile=fs.readFileSync(mobilePath,'utf8'),config=fs.readFileSync(configPath,'utf8');
for(const marker of ['ZORIQ Social','Comunidades Web3','Ranking XP','Pagar perfil','avatarFile','XP é reputação de testnet','5919065']){if(!social.includes(marker))fail(`social marker missing: ${marker}`);else pass(`social marker: ${marker}`)}
for(const marker of ["url.pathname==='/ranking'","url.pathname==='/reputation'","url.pathname==='/communities'","community_create",'MAX_AVATAR_BYTES','provider.getTransactionCount','airdrop']){if(!service.includes(marker))fail(`service marker missing: ${marker}`);else pass(`service marker: ${marker}`)}
for(const marker of ['Create Wallet','Restore Wallet','pickAvatar','Pagar perfil','community_create',"type Tab='home'|'send'|'social'|'ranking'|'activity'|'settings'",'pendingXp','ERC-20 custom']){if(!mobile.includes(marker))fail(`mobile marker missing: ${marker}`);else pass(`mobile marker: ${marker}`)}
for(const marker of ['chainId:5919065',"chainIdHex:'0x5a5159'"]){if(!config.includes(marker))fail(`config mismatch: ${marker}`);else pass(`config marker: ${marker}`)}
const syntax=spawnSync(process.execPath,['--check',servicePath],{encoding:'utf8'});if(syntax.status!==0)fail(`social service syntax: ${syntax.stderr}`);else pass('social service syntax');
const forbidden=[/guaranteed airdrop/i,/airdrop guaranteed/i,/guaranteed token/i,/production-ready decentralized social network/i];for(const re of forbidden){if(re.test(social)||re.test(service)||re.test(mobile))fail(`forbidden claim ${re}`);else pass(`no forbidden claim ${re}`)}
if(!social.includes('maxlength="800"'))fail('composer limit missing');else pass('composer limit present');
if(!social.includes('@media(max-width:950px)'))fail('responsive breakpoint missing');else pass('responsive breakpoint present');
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ SocialFi superapp static readiness checks passed.');
