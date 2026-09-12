import fs from 'node:fs';
import { verifyProofPack } from './obep.mjs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node verify-proof-pack.mjs <proof-pack.json>');
  process.exit(2);
}

try {
  const pack = JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = verifyProofPack(pack);
  console.log(JSON.stringify({ protocol: 'ZORYQ_OBEP', verified: true, ...result }));
} catch (error) {
  console.error(JSON.stringify({ protocol: 'ZORYQ_OBEP', verified: false, error: error.message }));
  process.exit(1);
}
