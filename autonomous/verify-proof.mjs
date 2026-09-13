#!/usr/bin/env node
import fs from 'node:fs';
import { verifyProofPack } from './lib/core.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node autonomous/verify-proof.mjs <proof-pack.json>');
  process.exit(2);
}

let pack;
try {
  pack = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`FAIL: invalid JSON: ${error.message}`);
  process.exit(1);
}

const result = verifyProofPack(pack);
if (!result.valid) {
  console.error('FAIL: Proof Pack verification failed');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`PASS: Proof Pack ${pack.companyId} is structurally consistent and evidenceRoot matches`);
if ((pack.receipts ?? []).length === 0) {
  console.log('NOTE: no chain receipts are present; this does not prove execution, payment, revenue, or outcome success.');
}
