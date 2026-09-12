import fs from 'node:fs';
import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node compute-task.mjs <records.json>');
  process.exit(2);
}

const records = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('input must be an array');

for (const [index, record] of records.entries()) {
  if (!record || typeof record !== 'object') throw new Error(`record ${index} invalid`);
  if (typeof record.id !== 'string' || !record.id) throw new Error(`record ${index} id invalid`);
  if (typeof record.category !== 'string' || !record.category) throw new Error(`record ${index} category invalid`);
  if (!Number.isSafeInteger(record.amount)) throw new Error(`record ${index} amount invalid`);
  if (typeof record.active !== 'boolean') throw new Error(`record ${index} active invalid`);
}

const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
const active = sorted.filter((record) => record.active);
const categoryTotals = {};
for (const record of active) {
  categoryTotals[record.category] = (categoryTotals[record.category] ?? 0) + record.amount;
}

const output = {
  spec: 'ZORYQ_OBEP_EXTERNAL_TASK_V1',
  inputDigest: sha256(canonicalize(sorted)),
  recordCount: sorted.length,
  activeRecordCount: active.length,
  activeAmountTotal: active.reduce((sum, record) => sum + record.amount, 0),
  categoryTotals: Object.fromEntries(Object.entries(categoryTotals).sort(([a], [b]) => a.localeCompare(b))),
};

const outputHash = sha256(canonicalize(output));
process.stdout.write(JSON.stringify({ ...output, outputHash }, null, 2) + '\n');
