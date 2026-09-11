import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const EXPECTED_CHAIN_ID = 5919065;
const APP_DIR = String(process.env.ZORYQ_APP_DIR || '/app');
const DATA_DIR = String(process.env.ZORYQ_DATA_DIR || '/data');
const RETH_BIN = String(process.env.ZORYQ_RETH_BIN || '/usr/local/bin/reth');
const REQUIRED_FILES = [
  `${APP_DIR}/server.mjs`,
  `${APP_DIR}/mainnet-guard.mjs`,
  `${APP_DIR}/prepare-reth-genesis.mjs`,
  `${APP_DIR}/zoryq-reth-genesis.json`,
  `${APP_DIR}/entrypoint.sh`
];

function fail(blockers) {
  process.stdout.write(`${JSON.stringify({ ok: false, stage: 'railway-predeploy', blockers }, null, 2)}\n`);
  process.exit(79);
}

const blockers = [];
const mode = String(process.env.ZORYQ_NETWORK_MODE || 'testnet').trim().toLowerCase();

// This Dockerfile is the public testnet image. Mainnet must use the isolated,
// evidence-backed mainnet launcher and must never be promoted through this service.
if (mode !== 'testnet') blockers.push('public_testnet_image_refuses_non_testnet_mode');

for (const file of REQUIRED_FILES) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) blockers.push(`required_file_missing:${file}`);
}

try {
  const genesis = JSON.parse(fs.readFileSync(`${APP_DIR}/zoryq-reth-genesis.json`, 'utf8'));
  const chainId = Number(genesis?.config?.chainId);
  if (chainId !== EXPECTED_CHAIN_ID) blockers.push(`unexpected_testnet_chain_id:${chainId}`);
} catch {
  blockers.push('testnet_genesis_invalid_json');
}

const reth = spawnSync(RETH_BIN, ['--version'], { encoding: 'utf8', timeout: 10_000 });
if (reth.error || reth.status !== 0) blockers.push('reth_binary_unavailable');
else if (!/reth/i.test(`${reth.stdout || ''}${reth.stderr || ''}`)) blockers.push('reth_version_identity_invalid');

try {
  if (!fs.existsSync(DATA_DIR)) blockers.push('persistent_volume_missing');
  else {
    const probe = `${DATA_DIR}/.zoryq-predeploy-write-probe-${process.pid}`;
    fs.writeFileSync(probe, 'ok\n', { encoding: 'utf8', mode: 0o600 });
    const observed = fs.readFileSync(probe, 'utf8');
    fs.unlinkSync(probe);
    if (observed !== 'ok\n') blockers.push('persistent_volume_readback_failed');
  }
} catch {
  blockers.push('persistent_volume_not_writable');
}

if (blockers.length) fail(blockers);

process.stdout.write(`${JSON.stringify({
  ok: true,
  stage: 'railway-predeploy',
  mode,
  chainId: EXPECTED_CHAIN_ID,
  reth: 'available',
  persistentVolume: 'writable',
  policy: 'zoryq-public-testnet-predeploy-v2'
}, null, 2)}\n`);
