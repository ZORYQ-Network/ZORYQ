import fs from 'node:fs';

const fail=(message)=>{console.error(`FAIL: ${message}`);process.exitCode=1};
const pass=(message)=>console.log(`PASS: ${message}`);
const files={
 social:'zoryq-web/zoriq-social-v2.html',css:'zoryq-web/zoriq-social-v2.css',js:'zoryq-web/zoriq-social-v2.js',suiteCss:'zoryq-web/zoriq-social-suite.css',suiteJs:'zoryq-web/zoriq-social-suite.js',webBackend:'zoryq-web/zoriq-social-backend.js',webSync:'zoryq-web/zoriq-social-sync.js',
 mobile:'zoryq-mobile/Social.tsx',mobileSuite:'zoryq-mobile/SocialSuite.tsx',mobileFeed:'zoryq-mobile/SyncedFeed.tsx',mobileBackend:'zoryq-mobile/socialBackend.ts',mobileIndex:'zoryq-mobile/index.js',mobilePackage:'zoryq-mobile/package.json',
 config:'zoryq-web/config.js',vercel:'zoryq-web/vercel.json',roadmap:'zoryq-developer/ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md',deploy:'zoryq-developer/ZORIQ_SOCIAL_DEPLOY.md',productDoc:'docs/ZORIQ_SOCIAL_EVOLUTION_V1.md',backendDoc:'docs/ZORIQ_SOCIAL_BACKEND.md',
 migrationPrivacy:'database/migrations/20260911_zoriq_social_suite_security_and_privacy.sql',migrationRpc:'database/migrations/20260911_zoriq_social_rpc_hardening.sql',migrationProfile:'database/migrations/20260911_zoriq_social_profile_preferences_constraints.sql',migrationReports:'database/migrations/20260911_zoriq_social_reporting_and_hides.sql',migrationUpsert:'database/migrations/20260911_zoriq_social_upsert_update_policies.sql'
};
for(const file of Object.values(files)){if(!fs.existsSync(file))fail(`missing ${file}`);else pass(`found ${file}`)}
if(process.exitCode)process.exit(process.exitCode);
const read=(key)=>fs.readFileSync(files[key],'utf8');
const social=read('social'),css=read('css'),js=read('js'),suiteCss=read('suiteCss'),suiteJs=read('suiteJs'),webBackend=read('webBackend'),webSync=read('webSync');
const mobile=read('mobile'),mobileSuite=read('mobileSuite'),mobileFeed=read('mobileFeed'),backend=read('mobileBackend'),mobileIndex=read('mobileIndex');
const config=read('config'),roadmap=read('roadmap'),deploy=read('deploy'),backendDoc=read('backendDoc');
const migrationPrivacy=read('migrationPrivacy'),migrationRpc=read('migrationRpc'),migrationProfile=read('migrationProfile'),migrationReports=read('migrationReports'),migrationUpsert=read('migrationUpsert');
const vercel=JSON.parse(read('vercel'));

for(const marker of ['ZORIQ Social','YOUR SOCIAL WORLD EVOLVES WITH YOU','ZORIQ PULSE','ZORIQ WORLDS','PERFIL EVOLUTIVO','ZORIQ DNA','ZORIQ POWERS','REPUTATION GRAPH','HUMAN FIRST','ZORI · COMPANHEIRO SOCIAL','maxlength="500"','zoriq-social-suite.css','zoriq-social-suite.js','zoriq-social-backend.js','zoriq-social-sync.js','Modo híbrido']){if(!social.includes(marker))fail(`social marker missing: ${marker}`);else pass(`social marker: ${marker}`)}
for(const marker of ['localStorage','feedMode','unlockPowers','renderPulse','renderWorlds','renderDna','renderAssistant','duplicates','rapid']){if(!js.includes(marker))fail(`core engine marker missing: ${marker}`);else pass(`core engine marker: ${marker}`)}
for(const marker of ['DISCOVERY','ZORIQ MESSAGES','NOTIFICAÇÕES','PRIVACIDADE & CONTROLE','data-suite-save','toggleBlock','suiteAchievements']){if(!suiteJs.includes(marker))fail(`social suite marker missing: ${marker}`);else pass(`social suite marker: ${marker}`)}
for(const marker of ['ZORYQ_SOCIAL_BACKEND','grant_type=web3','PUBLISHABLE_KEY','signInWithWallet','refresh_token','listProfiles','createPost','conversations','notifications','startPolling']){if(!webBackend.includes(marker))fail(`web backend marker missing: ${marker}`);else pass(`web backend marker: ${marker}`)}
for(const marker of ['SUPABASE + RLS','Web ↔ APK','Entrar com wallet','toggleFollow','createPost','sendMessage','markAllNotifications']){if(!webSync.includes(marker))fail(`web sync marker missing: ${marker}`);else pass(`web sync marker: ${marker}`)}
if(webSync.includes('MutationObserver'))fail('web sync must not use a global MutationObserver render loop');else pass('web sync avoids global MutationObserver render loop');
if(!css.includes('@media(max-width:600px)'))fail('core mobile breakpoint missing');else pass('core mobile breakpoint present');
if(!suiteCss.includes('@media(max-width:880px)'))fail('suite mobile breakpoint missing');else pass('suite mobile breakpoint present');
if(!css.includes('power-electric')||!css.includes('dna-orb'))fail('profile visual system missing');else pass('profile visual system present');

for(const marker of ['ZORIQ Pulse','ZORIQ Worlds','ZORIQ POWERS','ZORIQ DNA','HUMAN FIRST']){if(!mobile.includes(marker))fail(`mobile core marker missing: ${marker}`);else pass(`mobile core marker: ${marker}`)}
for(const marker of ['SOCIAL SUITE','Rede','Descobrir','Mensagens','Alertas','Privacidade','Conta privada','Conquistas','Entrar com wallet','Sincronizado com Supabase + RLS','Web3/SIWE','SyncedFeed']){if(!mobileSuite.includes(marker))fail(`mobile suite marker missing: ${marker}`);else pass(`mobile suite marker: ${marker}`)}
for(const marker of ['REDE SINCRONIZADA','Web ↔ APK','Publicar sincronizado','listVisibleFeed','createPost','toggleLike','toggleBookmark','hidePost','reportContent']){if(!mobileFeed.includes(marker))fail(`mobile synced feed marker missing: ${marker}`);else pass(`mobile synced feed marker: ${marker}`)}
for(const marker of ['Wallet / Recovery','ZORIQ SECURITY','Confirmar transações','BIOMETRIC_STRONG','SocialSuite','getBackendState','listVisibleFeed','Social backend']){if(!mobileIndex.includes(marker))fail(`mobile shell/security marker missing: ${marker}`);else pass(`mobile shell/security marker: ${marker}`)}
for(const marker of ['createClient','EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','persistSession:true','signInWithLocalWallet','signInWithWeb3','getMyProfile','listDiscoverableProfiles','listConversations','listMessages','markAllNotificationsRead','social_toggle_follow','social_add_comment','start_direct_conversation','subscribeSocial','reportContent','hidePost']){if(!backend.includes(marker))fail(`mobile backend marker missing: ${marker}`);else pass(`mobile backend marker: ${marker}`)}

for(const [name,source] of [['mobile backend',backend],['web backend',webBackend],['web sync',webSync],['mobile synced feed',mobileFeed]])for(const forbidden of ['service_role','SUPABASE_SERVICE_ROLE_KEY','sb_secret_']){if(source.includes(forbidden))fail(`${name}: secret-capability marker found: ${forbidden}`);else pass(`${name}: no client secret marker ${forbidden}`)}

for(const marker of ['follow_requests','user_mutes','posts_visible_read','supabase_realtime']){if(!migrationPrivacy.includes(marker))fail(`privacy migration marker missing: ${marker}`);else pass(`privacy migration marker: ${marker}`)}
for(const marker of ['can_view_social_post','social_toggle_like','social_toggle_follow','social_accept_follow_request','start_direct_conversation','revoke all']){if(!migrationRpc.includes(marker))fail(`RPC migration marker missing: ${marker}`);else pass(`RPC migration marker: ${marker}`)}
for(const marker of ['show_reputation','profiles_human_score_range','profiles_dm_mode_valid','profiles_power_key_valid']){if(!migrationProfile.includes(marker))fail(`profile migration marker missing: ${marker}`);else pass(`profile migration marker: ${marker}`)}
for(const marker of ['content_reports','post_hides','content_reports_own_insert','post_hides_own_insert']){if(!migrationReports.includes(marker))fail(`moderation migration marker missing: ${marker}`);else pass(`moderation migration marker: ${marker}`)}
for(const marker of ['content_reports_own_update','user_mutes_own_update','grant update']){if(!migrationUpsert.includes(marker))fail(`upsert migration marker missing: ${marker}`);else pass(`upsert migration marker: ${marker}`)}
for(const marker of ['offline-first','publishable key only','Row-Level Security','Hardened RPCs','content_reports','Sign-In With Ethereum']){if(!backendDoc.includes(marker))fail(`backend documentation marker missing: ${marker}`);else pass(`backend documentation marker: ${marker}`)}

const forbiddenClaims=[/production-ready social network/i,/guaranteed bot[- ]free/i,/fully decentralized social network/i,/AI[^\n.]{0,50}live globally/i,/end-to-end encrypted messages are live/i];
for(const pattern of forbiddenClaims){if(pattern.test(social)||pattern.test(js)||pattern.test(suiteJs)||pattern.test(webSync))fail(`unverified capability claim matched ${pattern}`);else pass(`no unverified claim ${pattern}`)}
for(const marker of ['chainId:5919065',"chainIdHex:'0x5a5159'", "projectRegistry:'0x180042c92A42f183A67005E8C0968a1F190aab33'"]){if(!config.includes(marker))fail(`config mismatch: ${marker}`);else pass(`config marker: ${marker}`)}
const rewriteMap=new Map((vercel.rewrites||[]).map(x=>[x.source,x.destination]));
for(const route of ['/zoriq','/social','/zoriq-social']){if(rewriteMap.get(route)!=='/zoriq-social-v2.html')fail(`missing Social Evolution rewrite for ${route}`);else pass(`deploy rewrite: ${route}`)}
const headers=(vercel.headers||[]).flatMap(x=>x.headers||[]),headerMap=new Map(headers.map(x=>[x.key.toLowerCase(),x.value]));
for(const key of ['content-security-policy','x-content-type-options','referrer-policy','permissions-policy','x-frame-options']){if(!headerMap.has(key))fail(`security header missing: ${key}`);else pass(`security header: ${key}`)}
const csp=headerMap.get('content-security-policy')||'';
for(const origin of ['https://juordakzclqefpuauzjq.supabase.co','https://zoryq-evm-node-live-production.up.railway.app']){if(!csp.includes(origin))fail(`CSP connect origin missing: ${origin}`);else pass(`CSP connect origin: ${origin}`)}
for(const marker of ['Real-Time Agentic Social & Financial Chain','Public ZORYQ testnet','Independent audit']){if(!roadmap.includes(marker))fail(`roadmap marker missing: ${marker}`);else pass(`roadmap marker: ${marker}`)}
if(!deploy.includes('ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md'))fail('deploy guide does not reference strategic roadmap');else pass('deploy guide references strategic roadmap');
if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Social Evolution deployment-readiness static checks passed.');
