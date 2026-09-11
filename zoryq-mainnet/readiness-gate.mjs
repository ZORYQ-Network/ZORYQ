import fs from 'node:fs';

const TESTNET_CHAIN_ID = 5919065;
const EXIT_NOT_READY = 78;

function fail(message, code = 64) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('usage: node readiness-gate.mjs --input <readiness.json>');
    args[key.slice(2)] = value;
  }
  return args;
}

function bool(value) {
  return value === true;
}

function containsSecretKey(value, path = '') {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const current = path ? `${path}.${key}` : key;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['mnemonic', 'privatekey', 'secretkey', 'seedphrase', 'keystorepassword'].includes(normalized)) return current;
    const nested = containsSecretKey(child, current);
    if (nested) return nested;
  }
  return null;
}

const args = parseArgs(process.argv);
if (!args.input) fail('usage: node readiness-gate.mjs --input <readiness.json>');

let readiness;
try {
  readiness = JSON.parse(fs.readFileSync(args.input, 'utf8'));
} catch {
  fail('readiness_input_invalid_json');
}

const blockers = [];
const secretPath = containsSecretKey(readiness);
if (secretPath) blockers.push(`secret_material_field_present:${secretPath}`);

if (String(readiness?.network?.mode || '').toLowerCase() !== 'mainnet') blockers.push('network_mode_not_mainnet');
const chainId = Number(readiness?.network?.chainId);
if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('chain_id_invalid');
if (chainId === TESTNET_CHAIN_ID) blockers.push('chain_id_reuses_testnet');
if (!/^[0-9a-f]{64}$/i.test(String(readiness?.network?.genesisSha256 || ''))) blockers.push('genesis_sha256_not_pinned');
if (String(readiness?.execution?.client || '').toLowerCase() !== 'reth') blockers.push('execution_client_not_reth');
if (!bool(readiness?.execution?.nativePersistence)) blockers.push('native_persistence_not_attested');
if (!bool(readiness?.execution?.restoreTested)) blockers.push('restore_test_not_attested');

if (bool(readiness?.publicRpc?.debugEnabled)) blockers.push('public_debug_enabled');
if (bool(readiness?.publicRpc?.adminEnabled)) blockers.push('public_admin_enabled');
if (bool(readiness?.publicRpc?.nodeManagedSigning)) blockers.push('public_node_managed_signing_enabled');
if (!bool(readiness?.publicRpc?.rateLimitsEnabled)) blockers.push('public_rate_limits_not_attested');

if (bool(readiness?.testFeatures?.faucetEnabled)) blockers.push('mainnet_faucet_enabled');
if (bool(readiness?.testFeatures?.devSignerEnabled)) blockers.push('mainnet_dev_signer_enabled');
if (bool(readiness?.testFeatures?.demoAutomationEnabled)) blockers.push('mainnet_demo_automation_enabled');

if (!bool(readiness?.keyManagement?.externalSigner)) blockers.push('external_signer_not_attested');
if (readiness?.keyManagement?.rawPrivateKeysInRuntime !== false) blockers.push('raw_private_key_policy_not_safe');
if (!bool(readiness?.keyManagement?.rotationRunbookTested)) blockers.push('key_rotation_runbook_not_tested');

const threshold = Number(readiness?.governance?.emergencyMultisig?.threshold);
const signers = Number(readiness?.governance?.emergencyMultisig?.signers);
if (!Number.isInteger(signers) || signers < 2) blockers.push('emergency_multisig_signers_insufficient');
if (!Number.isInteger(threshold) || threshold < 2 || threshold > signers) blockers.push('emergency_multisig_threshold_invalid');

if (!bool(readiness?.operations?.metricsEnabled)) blockers.push('metrics_not_attested');
if (!bool(readiness?.operations?.alertingEnabled)) blockers.push('alerting_not_attested');
if (!bool(readiness?.operations?.incidentRunbookTested)) blockers.push('incident_runbook_not_tested');
if (!bool(readiness?.operations?.rollbackRunbookTested)) blockers.push('rollback_runbook_not_tested');
if (!bool(readiness?.operations?.backupRestoreDrillPassed)) blockers.push('backup_restore_drill_not_passed');

if (!bool(readiness?.security?.externalAuditCompleted)) blockers.push('external_security_audit_not_completed');
if (!bool(readiness?.security?.criticalFindingsClosed)) blockers.push('critical_security_findings_not_closed');
if (!bool(readiness?.security?.dependencyReviewPassed)) blockers.push('dependency_review_not_attested');

const report = {
  ok: blockers.length === 0,
  status: blockers.length === 0 ? 'READY_FOR_CONTROLLED_MAINNET_LAUNCH' : 'NOT_READY_FOR_MAINNET',
  chainId: Number.isSafeInteger(chainId) ? chainId : null,
  blockers,
  checks: {
    distinctChainId: chainId !== TESTNET_CHAIN_ID,
    pinnedGenesis: /^[0-9a-f]{64}$/i.test(String(readiness?.network?.genesisSha256 || '')),
    externalSigner: bool(readiness?.keyManagement?.externalSigner),
    publicDebugDisabled: readiness?.publicRpc?.debugEnabled === false,
    restoreTested: bool(readiness?.execution?.restoreTested),
    incidentAndRollbackTested: bool(readiness?.operations?.incidentRunbookTested) && bool(readiness?.operations?.rollbackRunbookTested),
    externalAuditCompleted: bool(readiness?.security?.externalAuditCompleted)
  }
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(EXIT_NOT_READY);
