import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mode = String(process.env.ZORYQ_NETWORK_MODE || 'testnet').trim().toLowerCase();
const serverPath = process.env.ZORYQ_SERVER_SOURCE || path.join(here, 'server.mjs');
const preparePath = process.env.ZORYQ_GENESIS_PREP_SOURCE || path.join(here, 'prepare-reth-genesis.mjs');

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function emit(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
function nonEmptyFile(file) {
  try { return fs.statSync(file).isFile() && fs.statSync(file).size > 0; } catch { return false; }
}

if (!['testnet', 'mainnet'].includes(mode)) {
  emit({ ok: false, mode, error: 'unsupported_network_mode', allowed: ['testnet', 'mainnet'] });
  process.exit(64);
}

if (mode === 'testnet') {
  emit({
    ok: true,
    mode,
    launchGuard: 'armed',
    mainnetActivated: false,
    message: 'ZORYQ testnet mode accepted; mainnet safety checks remain fail-closed.'
  });
  process.exit(0);
}

const server = read(serverPath);
const prepare = read(preparePath);
const blockers = [];
const evidence = {};

if (!server) blockers.push('server_source_unavailable');
if (!prepare) blockers.push('genesis_preparation_source_unavailable');
if (server.includes("'--dev'") || server.includes('"--dev"')) blockers.push('execution_client_dev_mode');
if (server.includes("'--dev.mnemonic'") || server.includes('"--dev.mnemonic"')) blockers.push('execution_client_dev_mnemonic');
if (server.includes('devFaucetWallets')) blockers.push('embedded_dev_faucet_wallets');
if (prepare.includes('Wallet.createRandom().mnemonic')) blockers.push('operator_mnemonic_autogeneration');

const genesisPath = String(process.env.ZORYQ_MAINNET_GENESIS_PATH || '').trim();
const expectedGenesisSha = String(process.env.ZORYQ_MAINNET_GENESIS_SHA256 || '').trim().toLowerCase();
if (!genesisPath) {
  blockers.push('mainnet_genesis_path_missing');
} else if (!fs.existsSync(genesisPath)) {
  blockers.push('mainnet_genesis_file_missing');
} else {
  try {
    const genesis = JSON.parse(fs.readFileSync(genesisPath, 'utf8'));
    const chainId = Number(genesis?.config?.chainId);
    if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('mainnet_chain_id_invalid');
    if (chainId === 5919065) blockers.push('mainnet_chain_id_reuses_testnet');
    if (!/^[0-9a-f]{64}$/.test(expectedGenesisSha)) {
      blockers.push('mainnet_genesis_sha256_missing');
    } else if (sha256(genesisPath) !== expectedGenesisSha) {
      blockers.push('mainnet_genesis_sha256_mismatch');
    }
  } catch {
    blockers.push('mainnet_genesis_invalid_json');
  }
}

const manifestPath = String(process.env.ZORYQ_MAINNET_LAUNCH_MANIFEST || '').trim();
let manifest = null;
if (!manifestPath) {
  blockers.push('launch_manifest_path_missing');
} else if (!nonEmptyFile(manifestPath)) {
  blockers.push('launch_manifest_missing_or_empty');
} else {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    blockers.push('launch_manifest_invalid_json');
  }
}

function requireBoundEvidence({ readyEnv, pathEnv, manifestField, prefix, legacyBlocker }) {
  if (String(process.env[readyEnv] || '').toLowerCase() !== 'true') {
    blockers.push(legacyBlocker);
  }

  const file = String(process.env[pathEnv] || '').trim();
  if (!file) {
    blockers.push(`${prefix}_evidence_path_missing`);
    return;
  }
  if (!nonEmptyFile(file)) {
    blockers.push(`${prefix}_evidence_missing_or_empty`);
    return;
  }

  const actualSha = sha256(file);
  evidence[prefix] = { path: file, sha256: actualSha, manifestField };
  if (!manifest) return;

  const declared = String(manifest?.[manifestField] || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(declared)) {
    blockers.push(`${prefix}_manifest_hash_missing_or_invalid`);
  } else if (declared !== actualSha) {
    blockers.push(`${prefix}_evidence_not_bound_to_launch_manifest`);
  }
}

requireBoundEvidence({
  readyEnv: 'ZORYQ_MAINNET_EXTERNAL_SIGNER_READY',
  pathEnv: 'ZORYQ_MAINNET_KEY_CUSTODY_EVIDENCE_PATH',
  manifestField: 'keyCustodyEvidenceSha256',
  prefix: 'external_signer',
  legacyBlocker: 'external_signer_not_attested'
});
requireBoundEvidence({
  readyEnv: 'ZORYQ_MAINNET_CONSENSUS_READY',
  pathEnv: 'ZORYQ_MAINNET_CONSENSUS_EVIDENCE_PATH',
  manifestField: 'consensusEvidenceSha256',
  prefix: 'production_consensus',
  legacyBlocker: 'production_consensus_not_attested'
});
requireBoundEvidence({
  readyEnv: 'ZORYQ_MAINNET_AUDIT_READY',
  pathEnv: 'ZORYQ_MAINNET_AUDIT_REPORT_PATH',
  manifestField: 'auditReportSha256',
  prefix: 'security_audit',
  legacyBlocker: 'security_audit_not_attested'
});
requireBoundEvidence({
  readyEnv: 'ZORYQ_MAINNET_INCIDENT_RUNBOOK_READY',
  pathEnv: 'ZORYQ_MAINNET_INCIDENT_RUNBOOK_PATH',
  manifestField: 'incidentRunbookSha256',
  prefix: 'incident_runbook',
  legacyBlocker: 'incident_runbook_not_attested'
});

const report = {
  ok: blockers.length === 0,
  mode,
  launchGuard: 'armed',
  mainnetActivated: blockers.length === 0,
  blockers,
  evidence,
  policy: {
    version: 'zoryq-mainnet-guard-v2-evidence-bound',
    distinctGenesis: true,
    distinctChainId: true,
    pinnedGenesisHash: true,
    noDevConsensus: true,
    noDevMnemonic: true,
    noEmbeddedDevFaucet: true,
    externalSignerRequired: true,
    productionConsensusRequired: true,
    securityAuditRequired: true,
    incidentRunbookRequired: true,
    evidenceFilesRequired: true,
    launchManifestBindingRequired: true
  }
};

emit(report);
if (blockers.length) process.exit(78);
