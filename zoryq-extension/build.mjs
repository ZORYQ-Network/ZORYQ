import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const common = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120', 'edge120'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
};

await Promise.all([
  build({ ...common, entryPoints: ['src/popup.ts'], outfile: 'dist/popup.js' }),
  build({ ...common, entryPoints: ['src/content.ts'], outfile: 'dist/content.js' }),
  build({ ...common, entryPoints: ['src/inpage.ts'], outfile: 'dist/inpage.js' }),
]);

await cp('popup.html', 'dist/popup.html');
await cp('manifest.json', 'dist/manifest.json');
console.log('ZORYQ Wallet extension built in dist/');
