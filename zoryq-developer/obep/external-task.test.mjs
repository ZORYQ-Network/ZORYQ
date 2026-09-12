import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const input = path.join(here, 'external-task', 'records.json');
const compute = path.join(here, 'external-task', 'compute-task.mjs');
const verify = path.join(here, 'external-task', 'verify-task.mjs');

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('external task produces deterministic summary and verifies independently', () => {
  const first = run(compute, [input]);
  const second = run(compute, [input]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);

  const result = JSON.parse(first.stdout);
  assert.equal(result.recordCount, 6);
  assert.equal(result.activeRecordCount, 4);
  assert.equal(result.activeAmountTotal, 78);
  assert.deepEqual(result.categoryTotals, { compute: 17, storage: 42, verification: 19 });

  const tmp = path.join(os.tmpdir(), `zoryq-obep-task-${process.pid}.json`);
  fs.writeFileSync(tmp, first.stdout);
  try {
    const verification = run(verify, [input, tmp]);
    assert.equal(verification.status, 0, verification.stderr);
    const parsed = JSON.parse(verification.stdout);
    assert.equal(parsed.verified, true);
    assert.equal(parsed.outputHash, result.outputHash);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('external task verifier rejects substituted output', () => {
  const computed = run(compute, [input]);
  assert.equal(computed.status, 0, computed.stderr);
  const result = JSON.parse(computed.stdout);
  result.activeAmountTotal += 1;

  const tmp = path.join(os.tmpdir(), `zoryq-obep-task-bad-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(result));
  try {
    const verification = run(verify, [input, tmp]);
    assert.notEqual(verification.status, 0);
    assert.match(verification.stderr, /task result mismatch/);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});
