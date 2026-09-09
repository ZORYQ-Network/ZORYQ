import fs from 'node:fs';

const fail=(message)=>{console.error(`FAIL: ${message}`);process.exitCode=1};
const pass=(message)=>console.log(`PASS: ${message}`);

const socialPath='zoryq-web/zoriq-social.html';
const configPath='zoryq-web/config.js';
const vercelPath='zoryq-web/vercel.json';
const roadmapPath='zoryq-developer/ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md';
const deployPath='zoryq-developer/ZORIQ_SOCIAL_DEPLOY.md';
for(const file of [socialPath,configPath,vercelPath,roadmapPath,deployPath]){
  if(!fs.existsSync(file)) fail(`missing ${file}`); else pass(`found ${file}`);
}
if(process.exitCode) process.exit(process.exitCode);

const social=fs.readFileSync(socialPath,'utf8');
const config=fs.readFileSync(configPath,'utf8');
const roadmap=fs.readFileSync(roadmapPath,'utf8');
const deploy=fs.readFileSync(deployPath,'utf8');
const vercel=JSON.parse(fs.readFileSync(vercelPath,'utf8'));

const requiredSocialMarkers=[
  'ZORIQ Social',
  'REAL-TIME AGENTIC SOCIAL & FINANCIAL CHAIN',
  'People',
  'Projects',
  'Agents',
  'Communities',
  'Proof Cards',
  'Connect wallet',
  'Project Registry',
  'Social persistence',
  'Demo/local',
  'Smart account + passkey',
  'Gas sponsorship',
  'Agent wallet',
  'Scoped, inspectable, revocable.',
  'not an active delegated permission',
  'MICROPAYMENT PREVIEW',
  'MEV protection',
  'Public reproducible benchmarks',
  '5919065'
];
for(const marker of requiredSocialMarkers){
  if(!social.includes(marker)) fail(`social marker missing: ${marker}`); else pass(`social marker: ${marker}`);
}

const roadmapMarkers=[
  'Real-Time Agentic Social & Financial Chain',
  'Public ZORYQ testnet',
  'Public Explorer + RPC + Faucet',
  'Parallel execution',
  'Sub-second finality',
  'Permissionless validators',
  'Native AA + passkeys',
  'Gas sponsorship / paymasters',
  'MEV protection',
  'AI Agent protocol',
  'Agent wallets',
  'Social graph',
  'Native DEX',
  'Native PerpDEX',
  'Stablecoin / payment layer',
  'Ethereum interoperability',
  'Simple SDKs: TS / Rust / Python',
  'Multi-client',
  'Independent audit',
  'Bug bounty',
  'Reproducible public benchmarks',
  'code → node → devnet → public testnet → external validators → reproducible benchmarks → audit → applications → users'
];
for(const marker of roadmapMarkers){
  if(!roadmap.includes(marker)) fail(`roadmap marker missing: ${marker}`); else pass(`roadmap marker: ${marker}`);
}

const forbiddenClaims=[
  /decentralized production network/i,
  /ZORYQ[^\n.]{0,80}1,?000,?000\+?\s*TPS/i,
  /passkeys?\s+(?:are\s+)?live/i,
  /gasless\s+(?:is\s+)?live/i,
  /permissionless validators?\s+(?:are\s+)?live/i,
  /MEV[- ]protected\s+(?:is\s+)?live/i,
  /production-ready social network/i
];
for(const pattern of forbiddenClaims){
  if(pattern.test(social)) fail(`unverified capability claim matched in social ${pattern}`); else pass(`no unverified social claim ${pattern}`);
}

for(const marker of ['chainId:5919065',"chainIdHex:'0x5a5159'", "projectRegistry:'0x180042c92A42f183A67005E8C0968a1F190aab33'"]){
  if(!config.includes(marker)) fail(`config mismatch: ${marker}`); else pass(`config marker: ${marker}`);
}

const rewriteMap=new Map((vercel.rewrites||[]).map(x=>[x.source,x.destination]));
for(const route of ['/zoriq','/social','/zoriq-social']){
  if(rewriteMap.get(route)!=='/zoriq-social.html') fail(`missing deploy rewrite for ${route}`); else pass(`deploy rewrite: ${route}`);
}

const headers=(vercel.headers||[]).flatMap(x=>x.headers||[]);
const headerMap=new Map(headers.map(x=>[x.key.toLowerCase(),x.value]));
for(const key of ['content-security-policy','x-content-type-options','referrer-policy','permissions-policy','x-frame-options']){
  if(!headerMap.has(key)) fail(`security header missing: ${key}`); else pass(`security header: ${key}`);
}

if(!social.includes('maxlength="500"')) fail('composer input limit missing'); else pass('composer input limit present');
if(!social.includes('@media(max-width:560px)')) fail('mobile breakpoint missing'); else pass('mobile breakpoint present');
if(!social.includes("e.key==='Escape'")) fail('keyboard modal escape handling missing'); else pass('keyboard modal escape handling present');
if(!social.includes('ZORIQ never asks for a seed phrase or private key')) fail('wallet safety language missing'); else pass('wallet safety language present');
if(!deploy.includes('ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md')) fail('deploy guide does not reference strategic roadmap'); else pass('deploy guide references strategic roadmap');

if(process.exitCode) process.exit(process.exitCode);
console.log('ZORIQ Social deployment-readiness static checks passed.');
