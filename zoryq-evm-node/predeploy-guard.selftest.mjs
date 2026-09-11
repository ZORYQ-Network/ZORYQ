import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const GUARD = path.join(ROOT, 'predeploy-guard.mjs');

function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function fixture(chainId = 5919065) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-predeploy-'));
  const app = path.join(root, 'app');
  const data = path.join(root, 'data');
  fs.mkdirSync(app, { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  for (const name of ['server.mjs','mainnet-guard.mjs','prepare-reth-genesis.mjs','entrypoint.sh']) write(path.join(app, name), '// fixture\n');
  write(path.join(app, 'zoryq-reth-genesis.json'), JSON.stringify({ config: { chainId } }));
  const reth = path.join(root, 'reth');
  write(reth, '#!/bin/sh\necho "reth Version: 2.5.2"\n');
  fs.chmodSync(reth, 0o755);
  return { root, app, data, reth };
}
function run(f, extraEnv = {}) {
  const r = spawnSync(process.execPath, [GUARD], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ZORYQ_APP_DIR: f.app,
      ZORYQ_DATA_DIR: f.data,
      ZORYQ_RETH_BIN: f.reth,
      ZORYQ_NETWORK_MODE: 'testnet',
      ...extraEnv
    }
  });
  let body = {};
  try { body = JSON.parse(r.stdout || '{}'); } catch {}
  return { status: r.status, body, stderr: r.stderr };
}

const cleanups = [];
try {
  const good = fixture(); cleanups.push(good.root);
  const accepted = run(good);
  assert(accepted.status === 0 && accepted.body.ok === true, `valid fixture rejected: ${JSON.stringify(accepted.body)}`);

  const wrongChain = fixture(1); cleanups.push(wrongChain.root);
  const wrongChainResult = run(wrongChain);
  assert(wrongChainResult.status === 79, `wrong chain exit=${wrongChainResult.status}`);
  assert(wrongChainResult.body.blockers?.includes('unexpected_testnet_chain_id:1'), 'wrong chain id was not rejected');

  const mainnet = fixture(); cleanups.push(mainnet.root);
  const mainnetResult = run(mainnet, { ZORYQ_NETWORK_MODE: 'mainnet' });
  assert(mainnetResult.status === 79, `mainnet mode exit=${mainnetResult.status}`);
  assert(mainnetResult.body.blockers?.includes('public_testnet_image_refuses_non_testnet_mode'), 'public image did not reject mainnet mode');

  const missingReth = fixture(); cleanups.push(missingReth.root);
  const missingRethResult = run(missingReth, { ZORYQ_RETH_BIN: path.join(missingReth.root, 'missing-reth') });
  assert(missingRethResult.status === 79, `missing reth exit=${missingRethResult.status}`);
  assert(missingRethResult.body.blockers?.includes('reth_binary_unavailable'), 'missing reth was not rejected');

  const missingVolume = fixture(); cleanups.push(missingVolume.root);
  fs.rmSync(missingVolume.data, { recursive: true, force: true });
  const missingVolumeResult = run(missingVolume);
  assert(missingVolumeResult.status === 79, `missing volume exit=${missingVolumeResult.status}`);
  assert(missingVolumeResult.body.blockers?.includes('persistent_volume_missing'), 'missing persistent volume was not rejected');

  process.stdout.write(`${JSON.stringify({ ok: true, cases: ['valid-fixture','wrong-chain-rejection','mainnet-mode-rejection','missing-reth-rejection','missing-volume-rejection'] }, null, 2)}\n`);
} finally {
  for (const root of cleanups) fs.rmSync(root, { recursive: true, force: true });
}
