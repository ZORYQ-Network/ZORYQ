import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

const gate = path.resolve('zoryq-mainnet/multi-operator-evidence.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-multi-operator-'));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const checkpointHash = `0x${'ab'.repeat(32)}`;
const genesis = hash('zoryq-mainnet-genesis');
const now = new Date().toISOString();

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const ordered = {};
  for (const key of Object.keys(value).sort()) ordered[key] = canonicalize(value[key]);
  return ordered;
}
function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }
function publicKeyDer(keyPair) { return keyPair.publicKey.export({ format: 'der', type: 'spki' }); }
function attestationStatement(evidence, node) {
  return canonicalJson({
    domain: 'zoryq-mainnet-multi-operator-node-attestation-v2-registry-bound',
    network: evidence.network,
    chainId: evidence.chainId,
    genesisSha256: evidence.genesisSha256,
    validatorRegistrySha256: evidence.validatorRegistrySha256,
    consensusEngine: evidence.consensusEngine,
    operatorId: node.operatorId,
    region: node.region,
    p2pNodeId: node.p2pNodeId,
    hostFingerprint: node.hostFingerprint,
    peerCount: node.peerCount,
    publicDebugEnabled: node.publicDebugEnabled,
    headHeight: node.headHeight,
    finalizedHeight: node.finalizedHeight,
    finalizedHash: node.finalizedHash,
    observedAt: node.observedAt,
    checkpointHashes: node.checkpointHashes || {}
  });
}
function signNode(evidence, node, keyPair) {
  node.operatorAttestation = {
    algorithm: 'ed25519',
    publicKeySpkiBase64: publicKeyDer(keyPair).toString('base64'),
    signatureBase64: sign(null, Buffer.from(attestationStatement(evidence, node)), keyPair.privateKey).toString('base64')
  };
}
function buildRegistry(nodes, keyPairs) {
  const validators = nodes.map((node, i) => ({
    operatorId: node.operatorId,
    consensusPublicKey: `0x${String(i + 1).padStart(2, '0').repeat(48)}`,
    withdrawalAddress: `0x${String(i + 1).padStart(2, '0').repeat(20)}`,
    region: node.region,
    p2pHost: `validator-${i + 1}.example.net`,
    p2pPort: 30304 + i,
    attestationPublicKeySpkiBase64: publicKeyDer(keyPairs[i]).toString('base64'),
    attestationKeyFingerprintSha256: hash(publicKeyDer(keyPairs[i]))
  }));
  return canonicalize({
    formatVersion: 2,
    network: 'ZORYQ Mainnet',
    minimumValidators: 4,
    minimumRegions: 3,
    validatorCount: validators.length,
    regionCount: new Set(validators.map((item) => item.region)).size,
    attestationKeyCount: validators.length,
    validators,
    containsPrivateKeyMaterial: false
  });
}
function registryText(registry) { return `${JSON.stringify(registry, null, 2)}\n`; }

function fixture() {
  const nodes = Array.from({ length: 4 }, (_, i) => ({
    operatorId: `operator-${i + 1}`,
    region: ['sa-east', 'us-east', 'eu-west', 'sa-east'][i],
    p2pNodeId: `enode-${i + 1}-${hash(`p2p-${i}`).slice(0, 24)}`,
    hostFingerprint: hash(`host-${i}`),
    chainId: 881122,
    genesisSha256: genesis,
    peerCount: 3,
    publicDebugEnabled: false,
    headHeight: 1002 + (i % 2),
    finalizedHeight: 1000 + (i % 2),
    finalizedHash: checkpointHash,
    observedAt: now,
    checkpointHashes: { '1000': checkpointHash }
  }));
  const keyPairs = nodes.map(() => generateKeyPairSync('ed25519'));
  const registry = buildRegistry(nodes, keyPairs);
  const evidence = {
    network: 'ZORYQ Mainnet',
    productionEvidence: true,
    synthetic: false,
    fixtureOnly: false,
    chainId: 881122,
    genesisSha256: genesis,
    validatorRegistrySha256: hash(registryText(registry)),
    consensusEngine: 'zoryq-bft-rehearsal',
    observedAt: now,
    commonFinalizedCheckpoint: { height: 1000, hash: checkpointHash },
    nodes,
    faultTests: [
      { name: 'producer-loss', status: 'pass', evidenceSha256: hash('producer-loss'), recoverySeconds: 41 },
      { name: 'network-partition-recovery', status: 'pass', evidenceSha256: hash('partition'), recoverySeconds: 96 },
      { name: 'node-restart-recovery', status: 'pass', evidenceSha256: hash('restart'), recoverySeconds: 53 }
    ]
  };
  nodes.forEach((node, i) => signNode(evidence, node, keyPairs[i]));
  return { evidence, keyPairs, registry };
}

function run(name, evidence, registry, shouldPass, expectedBlocker = null) {
  const evidenceFile = path.join(temp, `${name}.json`);
  const registryFile = path.join(temp, `${name}.registry.json`);
  fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  fs.writeFileSync(registryFile, registryText(registry));
  const result = spawnSync(process.execPath, [gate, '--input', evidenceFile, '--registry', registryFile], { encoding: 'utf8' });
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error(`${name}: invalid gate output: ${result.stdout}\n${result.stderr}`); }
  if (shouldPass && (result.status !== 0 || report.pass !== true)) throw new Error(`${name}: expected pass, got ${result.status}: ${result.stdout}`);
  if (!shouldPass && (result.status === 0 || report.pass !== false)) throw new Error(`${name}: expected rejection, got ${result.status}: ${result.stdout}`);
  if (expectedBlocker && !report.blockers.some((item) => item.includes(expectedBlocker))) throw new Error(`${name}: missing blocker ${expectedBlocker}: ${result.stdout}`);
  process.stdout.write(`${name}: ${shouldPass ? 'accepted' : 'rejected'} as expected\n`);
  return report;
}

try {
  const { evidence: baseline, registry: baselineRegistry } = fixture();
  const baselineReport = run('valid-registry-bound-signed-operators', baseline, baselineRegistry, true);
  if (baselineReport.operatorAttestationKeyCount !== 4 || baselineReport.authorizedRegistryOperatorCount !== 4) {
    throw new Error('expected four independent, registry-authorized operator attestation keys');
  }

  const { evidence: nestedMutation, registry: nestedRegistry } = fixture();
  nestedMutation.faultTests[0].evidenceSha256 = hash('producer-loss-mutated');
  const nestedMutationReport = run('nested-digest-mutation', nestedMutation, nestedRegistry, true);
  if (nestedMutationReport.evidenceSha256 === baselineReport.evidenceSha256) throw new Error('nested evidence mutation did not change evidenceSha256');
  process.stdout.write('nested evidence fields are bound into evidenceSha256\n');

  const reordered = {
    faultTests: baseline.faultTests,
    nodes: baseline.nodes,
    commonFinalizedCheckpoint: baseline.commonFinalizedCheckpoint,
    observedAt: baseline.observedAt,
    consensusEngine: baseline.consensusEngine,
    validatorRegistrySha256: baseline.validatorRegistrySha256,
    genesisSha256: baseline.genesisSha256,
    chainId: baseline.chainId,
    fixtureOnly: baseline.fixtureOnly,
    synthetic: baseline.synthetic,
    productionEvidence: baseline.productionEvidence,
    network: baseline.network
  };
  const reorderedReport = run('canonical-key-order', reordered, baselineRegistry, true);
  if (reorderedReport.evidenceSha256 !== baselineReport.evidenceSha256) throw new Error('canonical digest changed after top-level key reordering');
  process.stdout.write('evidenceSha256 is stable across object key ordering\n');

  const { evidence: unsigned, registry: unsignedRegistry } = fixture();
  delete unsigned.nodes[0].operatorAttestation;
  run('unsigned-operator', unsigned, unsignedRegistry, false, 'operator_attestation_missing_or_algorithm_invalid');

  const { evidence: tamperedSignedField, registry: tamperedRegistry } = fixture();
  tamperedSignedField.nodes[0].hostFingerprint = hash('tampered-host');
  run('tampered-signed-observation', tamperedSignedField, tamperedRegistry, false, 'operator_attestation_signature_invalid');

  const { evidence: duplicateKey, keyPairs: duplicateKeyPairs, registry: duplicateRegistry } = fixture();
  signNode(duplicateKey, duplicateKey.nodes[3], duplicateKeyPairs[0]);
  run('operator-key-reuse', duplicateKey, duplicateRegistry, false, 'duplicate_operator_attestation_key');

  const { evidence: unauthorizedKey, keyPairs: unauthorizedKeyPairs, registry: unauthorizedRegistry } = fixture();
  const rogueKey = generateKeyPairSync('ed25519');
  signNode(unauthorizedKey, unauthorizedKey.nodes[0], rogueKey);
  run('operator-key-not-in-registry', unauthorizedKey, unauthorizedRegistry, false, 'operator_attestation_key_not_authorized_by_validator_registry');

  const { evidence: registryMismatch, registry: mismatchedRegistry } = fixture();
  registryMismatch.validatorRegistrySha256 = hash('wrong-registry');
  run('registry-hash-mismatch', registryMismatch, mismatchedRegistry, false, 'validator_registry_sha256_mismatch');

  const { evidence: unknownOperator, keyPairs: unknownKeys, registry: unknownRegistry } = fixture();
  unknownOperator.nodes[0].operatorId = 'operator-rogue';
  signNode(unknownOperator, unknownOperator.nodes[0], unknownKeys[0]);
  run('operator-not-registered', unknownOperator, unknownRegistry, false, 'operator_not_authorized_by_validator_registry');

  const { evidence: regionMismatch, keyPairs: regionKeys, registry: regionRegistry } = fixture();
  regionMismatch.nodes[0].region = 'ap-south';
  signNode(regionMismatch, regionMismatch.nodes[0], regionKeys[0]);
  run('region-registry-mismatch', regionMismatch, regionRegistry, false, 'region_mismatch_with_validator_registry');

  const { evidence: reusedTestnet, keyPairs: reusedKeys, registry: reusedRegistry } = fixture();
  reusedTestnet.chainId = 5919065;
  reusedTestnet.nodes.forEach((node, i) => { node.chainId = 5919065; signNode(reusedTestnet, node, reusedKeys[i]); });
  run('testnet-chain-id', reusedTestnet, reusedRegistry, false, 'chain_id_reuses_testnet');

  const { evidence: duplicateOperator, registry: duplicateOperatorRegistry } = fixture();
  duplicateOperator.nodes[3].operatorId = duplicateOperator.nodes[0].operatorId;
  run('operator-concentration', duplicateOperator, duplicateOperatorRegistry, false, 'minimum_four_independent_operators_required');

  const { evidence: duplicateHost, registry: duplicateHostRegistry } = fixture();
  duplicateHost.nodes[3].hostFingerprint = duplicateHost.nodes[0].hostFingerprint;
  run('host-reuse', duplicateHost, duplicateHostRegistry, false, 'duplicate_host_fingerprint');

  const { evidence: debugExposed, registry: debugRegistry } = fixture();
  debugExposed.nodes[2].publicDebugEnabled = true;
  run('public-debug', debugExposed, debugRegistry, false, 'public_debug_must_be_false');

  const { evidence: divergentCheckpoint, registry: divergentRegistry } = fixture();
  divergentCheckpoint.nodes[1].checkpointHashes['1000'] = `0x${'cd'.repeat(32)}`;
  run('checkpoint-divergence', divergentCheckpoint, divergentRegistry, false, 'common_checkpoint_hash_mismatch');

  const { evidence: weakFaultEvidence, registry: weakFaultRegistry } = fixture();
  weakFaultEvidence.faultTests[1].status = 'fail';
  run('fault-test-failure', weakFaultEvidence, weakFaultRegistry, false, 'fault_test_not_passed:network-partition-recovery');

  process.stdout.write('multi-operator evidence adversarial self-test: PASS\n');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
