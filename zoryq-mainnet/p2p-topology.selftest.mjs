import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('zoryq-mainnet/p2p-topology.mjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-p2p-topology-'));
const makeEnode = (i, host, port) => `enode://${String(i).padStart(2, '0').repeat(64)}@${host}:${port}`;

function fixture() {
  const validators = [
    ['operator-a','sa-east','validator-a.example.net',30304],
    ['operator-b','us-east','validator-b.example.net',30305],
    ['operator-c','eu-west','validator-c.example.net',30306],
    ['operator-d','sa-east','validator-d.example.net',30307]
  ].map(([operatorId, region, p2pHost, p2pPort], i) => ({
    operatorId, region, p2pHost, p2pPort,
    consensusPublicKey: `0x${String(i + 1).padStart(2, '0').repeat(48)}`,
    withdrawalAddress: `0x${String(i + 1).padStart(2, '0').repeat(20)}`,
    attestationPublicKeySpkiBase64: 'fixture',
    attestationKeyFingerprintSha256: String(i + 1).repeat(64).slice(0,64)
  }));
  return {
    registry: { formatVersion: 2, network: 'ZORYQ Mainnet', validators },
    identities: { nodes: validators.map((v, i) => ({ operatorId: v.operatorId, enode: makeEnode(i + 1, v.p2pHost, v.p2pPort) })) }
  };
}
function run(name, registry, identities, shouldPass, expected = '') {
  const dir = path.join(root, name); fs.mkdirSync(dir, { recursive: true });
  const registryFile = path.join(dir, 'registry.json');
  const identitiesFile = path.join(dir, 'identities.json');
  fs.writeFileSync(registryFile, JSON.stringify(registry));
  fs.writeFileSync(identitiesFile, JSON.stringify(identities));
  const result = spawnSync(process.execPath, [script, '--registry', registryFile, '--identities', identitiesFile, '--out', dir], { encoding: 'utf8' });
  let body = {}; try { body = JSON.parse(result.stdout); } catch {}
  if (shouldPass && (result.status !== 0 || body.ok !== true)) throw new Error(`${name}: expected pass: ${result.stdout} ${result.stderr}`);
  if (!shouldPass && (result.status === 0 || !String(body.error || '').includes(expected))) throw new Error(`${name}: expected ${expected}: ${result.stdout} ${result.stderr}`);
  if (shouldPass) {
    const topology = JSON.parse(fs.readFileSync(path.join(dir, 'p2p-topology.json'), 'utf8'));
    if (topology.validatorCount !== 4 || topology.regionCount !== 3 || topology.bootnodeRedundancyPerNode !== 3 || topology.containsPrivateKeyMaterial !== false) {
      throw new Error(`${name}: topology invariants failed`);
    }
  }
  process.stdout.write(`${name}: ${shouldPass ? 'accepted' : 'rejected'} as expected\n`);
}

try {
  let f = fixture(); run('valid-four-node-topology', f.registry, f.identities, true);
  f = fixture(); f.identities.nodes[3].enode = f.identities.nodes[0].enode; run('duplicate-enode', f.registry, f.identities, false, 'duplicate_enode');
  f = fixture(); f.identities.nodes[2].enode = makeEnode(3, 'wrong.example.net', 30306); run('host-mismatch', f.registry, f.identities, false, 'p2p_host_registry_mismatch');
  f = fixture(); f.identities.nodes[1].enode = makeEnode(2, f.registry.validators[1].p2pHost, 40404); run('port-mismatch', f.registry, f.identities, false, 'p2p_port_registry_mismatch');
  f = fixture(); f.identities.nodes.pop(); run('missing-identity', f.registry, f.identities, false, 'p2p_identity_count_must_match_validator_count');
  f = fixture(); f.registry.validators = f.registry.validators.slice(0,3); f.identities.nodes = f.identities.nodes.slice(0,3); run('three-validator-network', f.registry, f.identities, false, 'minimum_four_validators_required');
  process.stdout.write('P2P topology adversarial self-test: PASS\n');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
