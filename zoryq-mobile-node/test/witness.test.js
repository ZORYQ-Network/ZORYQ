import test from 'node:test';
import assert from 'node:assert/strict';
import { witnessRound } from '../src/witness.js';

test('witnessRound reports failure instead of inventing agreement', async () => {
  const result = await witnessRound(['http://127.0.0.1:1']);
  assert.equal(result.ok, false);
  assert.equal(result.independentAgreement, false);
  assert.equal(result.healthyCount, 0);
});
