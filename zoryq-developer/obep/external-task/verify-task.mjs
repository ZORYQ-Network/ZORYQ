import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
  console.error('usage: node verify-task.mjs <records.json> <result.json>');
  process.exit(2);
}

const expectedRun = spawnSync(process.execPath, [new URL('./compute-task.mjs', import.meta.url).pathname, inputPath], {
  encoding: 'utf8',
});
if (expectedRun.status !== 0) {
  console.error(expectedRun.stderr || 'failed to recompute task');
  process.exit(expectedRun.status || 1);
}

try {
  const expected = JSON.parse(expectedRun.stdout);
  const actual = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const expectedText = JSON.stringify(expected);
  const actualText = JSON.stringify(actual);
  if (expectedText !== actualText) {
    throw new Error(`task result mismatch: expected outputHash=${expected.outputHash}, got=${actual.outputHash ?? 'missing'}`);
  }
  console.log(JSON.stringify({
    protocol: 'ZORYQ_OBEP_EXTERNAL_TASK_V1',
    verified: true,
    inputDigest: expected.inputDigest,
    outputHash: expected.outputHash,
    recordCount: expected.recordCount,
    activeRecordCount: expected.activeRecordCount,
    activeAmountTotal: expected.activeAmountTotal,
  }));
} catch (error) {
  console.error(JSON.stringify({ protocol: 'ZORYQ_OBEP_EXTERNAL_TASK_V1', verified: false, error: error.message }));
  process.exit(1);
}
