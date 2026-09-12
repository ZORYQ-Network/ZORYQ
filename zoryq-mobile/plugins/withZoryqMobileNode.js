const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const NODE_PACKAGE = 'network.zoryq.mobilenode';
const BRIDGE_PACKAGE = 'com.zoryq.wallet.mobilenodebridge';
const NODE_FILES = ['BootReceiver.kt', 'MobileNodeApi.kt', 'NodeIdentity.kt', 'NodeMode.kt', 'ResourceGovernor.kt', 'WitnessService.kt'];

function addUniquePermission(manifest, name) {
  manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
  if (!manifest.manifest['uses-permission'].some((p) => p.$?.['android:name'] === name)) {
    manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function addUniqueComponent(application, kind, component) {
  application[kind] = application[kind] || [];
  const name = component.$['android:name'];
  if (!application[kind].some((item) => item.$?.['android:name'] === name)) application[kind].push(component);
}

function withManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    [
      'android.permission.INTERNET',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
    ].forEach((permission) => addUniquePermission(manifest, permission));

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    addUniqueComponent(application, 'service', {
      $: {
        'android:name': `${NODE_PACKAGE}.WitnessService`,
        'android:exported': 'false',
        'android:foregroundServiceType': 'dataSync',
      },
    });
    addUniqueComponent(application, 'receiver', {
      $: {
        'android:name': `${NODE_PACKAGE}.BootReceiver`,
        'android:enabled': 'true',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
        },
      ],
    });
    return mod;
  });
}

function withNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const root = mod.modRequest.projectRoot;
      const androidRoot = mod.modRequest.platformProjectRoot;
      const appJava = path.join(androidRoot, 'app', 'src', 'main', 'java');
      const nodeSource = path.resolve(root, '..', 'zoryq-mobile-node', 'android', 'app', 'src', 'main', 'java', ...NODE_PACKAGE.split('.'));
      const bridgeSource = path.join(root, 'native', 'android');
      const nodeTarget = path.join(appJava, ...NODE_PACKAGE.split('.'));
      const bridgeTarget = path.join(appJava, ...BRIDGE_PACKAGE.split('.'));
      fs.mkdirSync(nodeTarget, { recursive: true });
      fs.mkdirSync(bridgeTarget, { recursive: true });
      for (const file of NODE_FILES) {
        const src = path.join(nodeSource, file);
        if (!fs.existsSync(src)) throw new Error(`Missing ZORYQ native node source: ${src}`);
        fs.copyFileSync(src, path.join(nodeTarget, file));
      }
      for (const file of ['ZoryqMobileNodeModule.kt', 'ZoryqMobileNodePackage.kt']) {
        const src = path.join(bridgeSource, file);
        if (!fs.existsSync(src)) throw new Error(`Missing ZORYQ wallet bridge source: ${src}`);
        fs.copyFileSync(src, path.join(bridgeTarget, file));
      }
      return mod;
    },
  ]);
}

function withDependencies(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('ZORYQ Mobile Node expects Expo Android Groovy app/build.gradle');
    let contents = mod.modResults.contents;
    const dependencies = [
      'implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0"',
      'implementation "com.squareup.okhttp3:okhttp:4.12.0"',
    ];
    for (const line of dependencies) {
      if (!contents.includes(line)) contents = contents.replace(/dependencies\s*\{/, `dependencies {\n    ${line}`);
    }
    mod.modResults.contents = contents;
    return mod;
  });
}

function withPackageRegistration(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    const importLine = `import ${BRIDGE_PACKAGE}.ZoryqMobileNodePackage`;
    if (!contents.includes(importLine)) {
      const packageMatch = contents.match(/^package\s+[^\n]+\n/m);
      if (!packageMatch) throw new Error('Unable to locate Kotlin package declaration in MainApplication');
      contents = contents.replace(packageMatch[0], `${packageMatch[0]}\n${importLine}\n`);
    }
    if (!contents.includes('add(ZoryqMobileNodePackage())')) {
      const marker = 'PackageList(this).packages.apply {';
      if (contents.includes(marker)) {
        contents = contents.replace(marker, `${marker}\n              add(ZoryqMobileNodePackage())`);
      } else {
        throw new Error('Unable to locate React Native package list in MainApplication');
      }
    }
    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = function withZoryqMobileNode(config) {
  config = withManifest(config);
  config = withNativeSources(config);
  config = withDependencies(config);
  config = withPackageRegistration(config);
  return config;
};
