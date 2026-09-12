const {withAndroidManifest,createRunOncePlugin}=require('expo/config-plugins');

const walletPackages=[
  'com.wallet.crypto.trustapp',
  'io.metamask',
  'me.rainbow',
  'io.zerion.android',
  'io.gnosis.safe',
  'com.uniswap.mobile'
];

function withWalletQueries(config){
  return withAndroidManifest(config,c=>{
    const manifest=c.modResults.manifest;
    const current=Array.isArray(manifest.queries)?manifest.queries:[];
    const existingPackages=new Set(
      current.flatMap(q=>Array.isArray(q.package)?q.package:[])
        .map(p=>p?.$?.['android:name'])
        .filter(Boolean)
    );
    const packages=[...existingPackages,...walletPackages.filter(p=>!existingPackages.has(p))]
      .map(name=>({$:{'android:name':name}}));
    manifest.queries=[{package:packages}];
    c.modResults.manifest=manifest;
    return c;
  });
}

module.exports=createRunOncePlugin(withWalletQueries,'zoriq-wallet-queries','1.1.0');
