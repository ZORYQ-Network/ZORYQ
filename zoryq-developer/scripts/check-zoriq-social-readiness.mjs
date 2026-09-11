import fs from 'node:fs';

const fail=(message)=>{console.error(`FAIL: ${message}`);process.exitCode=1};
const pass=(message)=>console.log(`PASS: ${message}`);

const files={
 social:'zoryq-web/zoriq-social-v2.html',
 css:'zoryq-web/zoriq-social-v2.css',
 js:'zoryq-web/zoriq-social-v2.js',
 suiteCss:'zoryq-web/zoriq-social-suite.css',
 suiteJs:'zoryq-web/zoriq-social-suite.js',
 mobile:'zoryq-mobile/Social.tsx',
 mobileSuite:'zoryq-mobile/SocialSuite.tsx',
 mobileBackend:'zoryq-mobile/socialBackend.ts',
 mobileIndex:'zoryq-mobile/index.js',
 mobilePackage:'zoryq-mobile/package.json',
 config:'zoryq-web/config.js',
 vercel:'zoryq-web/vercel.json',
 roadmap:'zoryq-developer/ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md',
 deploy:'zoryq-developer/ZORIQ_SOCIAL_DEPLOY.md',
 productDoc:'docs/ZORIQ_SOCIAL_EVOLUTION_V1.md',
 migrationPrivacy:'database/migrations/20260911_zoriq_social_suite_security_and_privacy.sql',
 migrationRpc:'database/migrations/20260911_zoriq_social_rpc_hardening.sql',
 migrationProfile:'database/migrations/20260911_zoriq_social_profile_preferences_constraints.sql'
};
for(const file of Object.values(files)){
 if(!fs.existsSync(file))fail(`missing ${file}`);else pass(`found ${file}`);
}
if(process.exitCode)process.exit(process.exitCode);

const read=(key)=>fs.readFileSync(files[key],'utf8');
const social=read('social'),css=read('css'),js=read('js'),suiteCss=read('suiteCss'),suiteJs=read('suiteJs');
const mobile=read('mobile'),mobileSuite=read('mobileSuite'),backend=read('mobileBackend'),mobileIndex=read('mobileIndex');
const config=read('config'),roadmap=read('roadmap'),deploy=read('deploy');
const migrationPrivacy=read('migrationPrivacy'),migrationRpc=read('migrationRpc'),migrationProfile=read('migrationProfile');
const vercel=JSON.parse(read('vercel'));

for(const marker of [
 'ZORIQ Social','YOUR SOCIAL WORLD EVOLVES WITH YOU','ZORIQ PULSE','ZORIQ WORLDS','PERFIL EVOLUTIVO','ZORIQ DNA','ZORIQ POWERS','REPUTATION GRAPH','HUMAN FIRST','ZORI · COMPANHEIRO SOCIAL','maxlength="500"','zoriq-social-suite.css','zoriq-social-suite.js'
]){
 if(!social.includes(marker))fail(`social marker missing: ${marker}`);else pass(`social marker: ${marker}`);
}
for(const marker of ['localStorage','feedMode','unlockPowers','renderPulse','renderWorlds','renderDna','renderAssistant','duplicates','rapid']){
 if(!js.includes(marker))fail(`core engine marker missing: ${marker}`);else pass(`core engine marker: ${marker}`);
}
for(const marker of ['DISCOVERY','ZORIQ MESSAGES','NOTIFICAÇÕES','PRIVACIDADE & CONTROLE','data-suite-save','user_blocks','suiteAchievements']){
 if(!suiteJs.includes(marker))fail(`social suite marker missing: ${marker}`);else pass(`social suite marker: ${marker}`);
}
if(!css.includes('@media(max-width:600px)'))fail('core mobile breakpoint missing');else pass('core mobile breakpoint present');
if(!suiteCss.includes('@media(max-width:880px)'))fail('suite mobile breakpoint missing');else pass('suite mobile breakpoint present');
if(!css.includes('power-electric')||!css.includes('dna-orb'))fail('profile visual system missing');else pass('profile visual system present');

for(const marker of ['ZORIQ PULSE','ZORIQ WORLDS','ZORIQ POWERS','ZORIQ DNA','HUMAN FIRST']){
 if(!mobile.includes(marker))fail(`mobile core marker missing: ${marker}`);else pass(`mobile core marker: ${marker}`);
}
for(const marker of ['SOCIAL SUITE','Descobrir','Mensagens','Alertas','Privacidade','Conta privada','Conquistas']){
 if(!mobileSuite.includes(marker))fail(`mobile suite marker missing: ${marker}`);else pass(`mobile suite marker: ${marker}`);
}
for(const marker of ['Wallet / Recovery','ZORIQ SECURITY','Confirmar transações','BIOMETRIC_STRONG','SocialSuite']){
 if(!mobileIndex.includes(marker))fail(`mobile shell/security marker missing: ${marker}`);else pass(`mobile shell/security marker: ${marker}`);
}

for(const marker of ['createClient','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','persistSession:true','listDiscoverableProfiles','listVisibleFeed','social_toggle_follow','social_add_comment','start_direct_conversation','subscribeSocial']){
 if(!backend.includes(marker))fail(`backend adapter marker missing: ${marker}`);else pass(`backend adapter marker: ${marker}`);
}
for(const forbidden of ['service_role','SUPABASE_SERVICE_ROLE_KEY','sb_secret_']){
 if(backend.includes(forbidden))fail(`secret-capability marker found in client backend: ${forbidden}`);else pass(`no client secret marker: ${forbidden}`);
}

for(const marker of ['follow_requests','user_mutes','posts_visible_read','supabase_realtime']){
 if(!migrationPrivacy.includes(marker))fail(`privacy migration marker missing: ${marker}`);else pass(`privacy migration marker: ${marker}`);
}
for(const marker of ['can_view_social_post','social_toggle_like','social_toggle_follow','social_accept_follow_request','start_direct_conversation','revoke all']){
 if(!migrationRpc.includes(marker))fail(`RPC migration marker missing: ${marker}`);else pass(`RPC migration marker: ${marker}`);
}
for(const marker of ['show_reputation','profiles_human_score_range','profiles_dm_mode_valid','profiles_power_key_valid']){
 if(!migrationProfile.includes(marker))fail(`profile migration marker missing: ${marker}`);else pass(`profile migration marker: ${marker}`);
}

const forbiddenClaims=[/production-ready social network/i,/guaranteed bot[- ]free/i,/fully decentralized social network/i,/AI[^\n.]{0,50}live globally/i];
for(const pattern of forbiddenClaims){
 if(pattern.test(social)||pattern.test(js)||pattern.test(suiteJs))fail(`unverified capability claim matched ${pattern}`);else pass(`no unverified claim ${pattern}`);
}

for(const marker of ['chainId:5919065',"chainIdHex:'0x5a5159'", "projectRegistry:'0x180042c92A42f183A67005E8C0968a1F190aab33'"]){
 if(!config.includes(marker))fail(`config mismatch: ${marker}`);else pass(`config marker: ${marker}`);
}

const rewriteMap=new Map((vercel.rewrites||[]).map(x=>[x.source,x.destination]));
for(const route of ['/zoriq','/social','/zoriq-social']){
 if(rewriteMap.get(route)!=='/zoriq-social-v2.html')fail(`missing Social Evolution rewrite for ${route}`);else pass(`deploy rewrite: ${route}`);
}
const headers=(vercel.headers||[]).flatMap(x=>x.headers||[]);
const headerMap=new Map(headers.map(x=>[x.key.toLowerCase(),x.value]));
for(const key of ['content-security-policy','x-content-type-options','referrer-policy','permissions-policy','x-frame-options']){
 if(!headerMap.has(key))fail(`security header missing: ${key}`);else pass(`security header: ${key}`);
}
for(const marker of ['Real-Time Agentic Social & Financial Chain','Public ZORYQ testnet','Independent audit']){
 if(!roadmap.includes(marker))fail(`roadmap marker missing: ${marker}`);else pass(`roadmap marker: ${marker}`);
}
if(!deploy.includes('ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md'))fail('deploy guide does not reference strategic roadmap');else pass('deploy guide references strategic roadmap');

if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Social Evolution deployment-readiness static checks passed.');
