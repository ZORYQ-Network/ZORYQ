import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/popup.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120', 'edge120'],
  outfile: 'dist/popup.js',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
});

await cp('popup.html', 'dist/popup.html');
await cp('manifest.json', 'dist/manifest.json');
console.log('ZORYQ Wallet extension built in dist/');
