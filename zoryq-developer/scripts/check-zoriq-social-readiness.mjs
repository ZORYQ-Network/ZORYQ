import fs from 'node:fs';

const fail=(message)=>{console.error(`FAIL: ${message}`);process.exitCode=1};
const pass=(message)=>console.log(`PASS: ${message}`);

const socialPath='zoryq-web/zoriq-social-v2.html';
const cssPath='zoryq-web/zoriq-social-v2.css';
const jsPath='zoryq-web/zoriq-social-v2.js';
const configPath='zoryq-web/config.js';
const vercelPath='zoryq-web/vercel.json';
const roadmapPath='zoryq-developer/ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md';
const deployPath='zoryq-developer/ZORIQ_SOCIAL_DEPLOY.md';
const productDoc='docs/ZORIQ_SOCIAL_EVOLUTION_V1.md';
for(const file of [socialPath,cssPath,jsPath,configPath,vercelPath,roadmapPath,deployPath,productDoc]){
  if(!fs.existsSync(file)) fail(`missing ${file}`); else pass(`found ${file}`);
}
if(process.exitCode) process.exit(process.exitCode);

const social=fs.readFileSync(socialPath,'utf8');
const css=fs.readFileSync(cssPath,'utf8');
const js=fs.readFileSync(jsPath,'utf8');
const config=fs.readFileSync(configPath,'utf8');
const roadmap=fs.readFileSync(roadmapPath,'utf8');
const deploy=fs.readFileSync(deployPath,'utf8');
const vercel=JSON.parse(fs.readFileSync(vercelPath,'utf8'));

const requiredSocialMarkers=[
  'ZORIQ Social',
  'YOUR SOCIAL WORLD EVOLVES WITH YOU',
  'ZORIQ PULSE',
  'ZORIQ WORLDS',
  'PERFIL EVOLUTIVO',
  'ZORIQ DNA',
  'ZORIQ POWERS',
  'REPUTATION GRAPH',
  'HUMAN FIRST',
  'ZORI · COMPANHEIRO SOCIAL',
  'maxlength="500"'
];
for(const marker of requiredSocialMarkers){
  if(!social.includes(marker)) fail(`social marker missing: ${marker}`); else pass(`social marker: ${marker}`);
}
for(const marker of ['localStorage','feedMode','unlockPowers','renderPulse','renderWorlds','renderDna','renderAssistant','duplicates','rapid']){
  if(!js.includes(marker)) fail(`social engine marker missing: ${marker}`); else pass(`social engine marker: ${marker}`);
}
if(!css.includes('@media(max-width:600px)')) fail('mobile breakpoint missing'); else pass('mobile breakpoint present');
if(!css.includes('power-electric')||!css.includes('dna-orb')) fail('profile visual system missing'); else pass('profile visual system present');

const forbiddenClaims=[
  /production-ready social network/i,
  /guaranteed bot[- ]free/i,
  /fully decentralized social network/i,
  /AI[^\n.]{0,50}live globally/i
];
for(const pattern of forbiddenClaims){
  if(pattern.test(social)||pattern.test(js)) fail(`unverified capability claim matched ${pattern}`); else pass(`no unverified claim ${pattern}`);
}

for(const marker of ['chainId:5919065',"chainIdHex:'0x5a5159'", "projectRegistry:'0x180042c92A42f183A67005E8C0968a1F190aab33'"]){
  if(!config.includes(marker)) fail(`config mismatch: ${marker}`); else pass(`config marker: ${marker}`);
}

const rewriteMap=new Map((vercel.rewrites||[]).map(x=>[x.source,x.destination]));
for(const route of ['/zoriq','/social','/zoriq-social']){
  if(rewriteMap.get(route)!=='/zoriq-social-v2.html') fail(`missing Social Evolution rewrite for ${route}`); else pass(`deploy rewrite: ${route}`);
}

const headers=(vercel.headers||[]).flatMap(x=>x.headers||[]);
const headerMap=new Map(headers.map(x=>[x.key.toLowerCase(),x.value]));
for(const key of ['content-security-policy','x-content-type-options','referrer-policy','permissions-policy','x-frame-options']){
  if(!headerMap.has(key)) fail(`security header missing: ${key}`); else pass(`security header: ${key}`);
}

for(const marker of ['Real-Time Agentic Social & Financial Chain','Public ZORYQ testnet','Independent audit']){
  if(!roadmap.includes(marker)) fail(`roadmap marker missing: ${marker}`); else pass(`roadmap marker: ${marker}`);
}
if(!deploy.includes('ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md')) fail('deploy guide does not reference strategic roadmap'); else pass('deploy guide references strategic roadmap');

if(process.exitCode) process.exit(process.exitCode);
console.log('ZORIQ Social Evolution deployment-readiness static checks passed.');
