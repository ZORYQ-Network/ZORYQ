import fs from 'node:fs';

const fail=(m)=>{console.error(`FAIL: ${m}`);process.exitCode=1};
const pass=(m)=>console.log(`PASS: ${m}`);
const paths={
 migration:'database/migrations/20260911_zoriq_verified_annual_eth.sql',
 edge:'supabase/functions/zoriq-verified-payment/index.ts',
 mobileBackend:'zoryq-mobile/socialBackend.ts',
 mobileSuite:'zoryq-mobile/SocialSuite.tsx',
 webBackend:'zoryq-web/zoriq-social-backend.js',
 webSync:'zoryq-web/zoriq-social-sync.js'
};
for(const p of Object.values(paths)){if(!fs.existsSync(p))fail(`missing ${p}`);else pass(`found ${p}`)}
if(process.exitCode)process.exit(process.exitCode);
const read=(k)=>fs.readFileSync(paths[k],'utf8');
const migration=read('migration'),edge=read('edge'),mobileBackend=read('mobileBackend'),mobileSuite=read('mobileSuite'),webBackend=read('webBackend'),webSync=read('webSync');

for(const marker of ['zoriq_verified_subscriptions','zoriq_verified_payments','9.99','365','zoriq_guard_verified_profile_fields','service_role','row level security']){
  if(!migration.toLowerCase().includes(marker.toLowerCase()))fail(`migration marker missing: ${marker}`);else pass(`migration marker: ${marker}`)
}
for(const marker of ['PRICE_USD=9.99','PRICE_CENTS=999n','duration_days:365','payment_asset:"ETH"','zoriq_verified_annual','eth_getTransactionReceipt','eth_getTransactionByHash','sender_mismatch','recipient_mismatch','underpayment','transaction_already_used','wallet_not_linked_or_verified']){
  if(!edge.includes(marker))fail(`edge verifier marker missing: ${marker}`);else pass(`edge verifier marker: ${marker}`)
}
for(const marker of ['Ethereum','Base','Arbitrum One','Optimism','Linea','Scroll','zkSync Era','Blast','Unichain','Manta Pacific']){
  if(!edge.includes(marker))fail(`supported ETH network missing: ${marker}`);else pass(`supported network: ${marker}`)
}
for(const marker of ['getZoriqVerifiedConfig','getZoriqVerifiedStatus','quoteZoriqVerified','purchaseZoriqVerified','ensureLocalWalletLinked','parseEther','zoriq-verified-payment']){
  if(!mobileBackend.includes(marker))fail(`mobile verified integration missing: ${marker}`);else pass(`mobile verified integration: ${marker}`)
}
for(const marker of ["'verified'",'ZORIQ Verified','US$ 9,99','365 dias','purchaseZoriqVerified','✓']){
  if(!mobileSuite.includes(marker))fail(`mobile verified UI missing: ${marker}`);else pass(`mobile verified UI: ${marker}`)
}
for(const marker of ['verifiedConfig','verifiedStatus','purchaseVerified','zoriq-verified-payment','eth_sendTransaction']){
  if(!webBackend.includes(marker))fail(`web verified integration missing: ${marker}`);else pass(`web verified integration: ${marker}`)
}
for(const marker of ['ZORIQ Verified','US$ 9,99','purchaseVerified','verifiedStatus','✓']){
  if(!webSync.includes(marker))fail(`web verified UI missing: ${marker}`);else pass(`web verified UI: ${marker}`)
}

// Secrets may be referenced by env var name only inside the server-side edge function.
for(const [name,source] of [['mobile backend',mobileBackend],['mobile suite',mobileSuite],['web backend',webBackend],['web sync',webSync]]){
  for(const forbidden of ['SUPABASE_SERVICE_ROLE_KEY','sb_secret_']){
    if(source.includes(forbidden))fail(`${name}: server secret marker leaked to client: ${forbidden}`);else pass(`${name}: no ${forbidden}`)
  }
}
if(/sb_secret_[A-Za-z0-9_-]+/.test(edge))fail('edge function contains a literal Supabase secret');else pass('edge function uses environment secret only');
if(!edge.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'))fail('edge function must read service role from environment');else pass('edge function reads service role from environment');

if(process.exitCode)process.exit(process.exitCode);
console.log('ZORIQ Verified annual ETH checks passed.');
