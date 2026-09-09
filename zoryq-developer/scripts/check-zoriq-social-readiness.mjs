import fs from 'node:fs';

const fail=(message)=>{console.error(`FAIL: ${message}`);process.exitCode=1};
const pass=(message)=>console.log(`PASS: ${message}`);

const socialPath='zoryq-web/zoriq-social.html';
const configPath='zoryq-web/config.js';
const vercelPath='zoryq-web/vercel.json';
for(const file of [socialPath,configPath,vercelPath]){
  if(!fs.existsSync(file)) fail(`missing ${file}`); else pass(`found ${file}`);
}
if(process.exitCode) process.exit(process.exitCode);

const social=fs.readFileSync(socialPath,'utf8');
const config=fs.readFileSync(configPath,'utf8');
const vercel=JSON.parse(fs.readFileSync(vercelPath,'utf8'));

const requiredSocialMarkers=[
  'ZORIQ Social',
  'PEOPLE · PROJECTS · AGENTS',
  'Proof Cards',
  'Connect wallet',
  'Project Registry',
  'Social persistence',
  'Demo/local',
  'Scoped, inspectable, revocable.',
  'not an active delegated permission',
  '5919065'
];
for(const marker of requiredSocialMarkers){
  if(!social.includes(marker)) fail(`social marker missing: ${marker}`); else pass(`social marker: ${marker}`);
}

const forbiddenClaims=[
  /decentralized production network/i,
  /1,?000,?000\+?\s*TPS/i,
  /passkeys?\s+(?:are\s+)?live/i,
  /gasless\s+(?:is\s+)?live/i,
  /permissionless validators?\s+(?:are\s+)?live/i
];
for(const pattern of forbiddenClaims){
  if(pattern.test(social)) fail(`unverified capability claim matched ${pattern}`); else pass(`no unverified claim ${pattern}`);
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

if(process.exitCode) process.exit(process.exitCode);
console.log('ZORIQ Social deployment-readiness static checks passed.');
