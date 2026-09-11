const {withAndroidManifest,createRunOncePlugin}=require('expo/config-plugins');
const walletPackages=['com.wallet.crypto.trustapp','io.metamask','me.rainbow','io.zerion.android','io.gnosis.safe','com.uniswap.mobile'];
function withWalletQueries(config){return withAndroidManifest(config,c=>{const manifest=c.modResults.manifest;const current=manifest.queries||[];const pkgEntries=walletPackages.map(name=>({package:[{$:{'android:name':name}}]}));manifest.queries=[...current,...pkgEntries];c.modResults.manifest=manifest;return c;});}
module.exports=createRunOncePlugin(withWalletQueries,'zoriq-wallet-queries','1.0.0');
