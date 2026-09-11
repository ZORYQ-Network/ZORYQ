import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const gate = path.resolve('zoryq-mainnet/key-custody-evidence.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-key-custody-'));
const sha = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  return {
    formatVersion: 1,
    network: 'ZORYQ Mainnet',
    productionEvidence: false,
    fixtureOnly: true,
    signer: {
      type: 'hsm',
      provider: 'ci-fixture-hsm',
      keyId: 'fixture-key-01',
      privateKeyExportable: false,
      localPrivateKeyMaterial: false,
      mfaRequired: true
    },
    separationOfDuties: {
      enabled: true,
      minimumApprovers: 2,
      roles: ['security', 'operations']
    },
    recoveryDrill: {
      status: 'pass',
      testedAt: new Date().toISOString(),
      evidenceSha256: sha('fixture-recovery-drill')
    },
    keyRotation: {
      documented: true,
      maximumAgeDays: 90
    }
  };
}
function run(name, evidence, shouldPass, blocker = null) {
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  const result = spawnSync(process.execPath, [gate, '--input', file, '--allow-fixture'], { encoding: 'utf8' });
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error(`${name}: invalid output: ${result.stdout}\n${result.stderr}`); }
  if (shouldPass && (result.status !== 0 || report.pass !== true)) throw new Error(`${name}: expected pass: ${result.stdout}`);
  if (!shouldPass && (result.status === 0 || report.pass !== false)) throw new Error(`${name}: expected rejection: ${result.stdout}`);
  if (blocker && !report.blockers.some((item) => item.includes(blocker))) throw new Error(`${name}: missing blocker ${blocker}: ${result.stdout}`);
  process.stdout.write(`${name}: ${shouldPass ? 'accepted' : 'rejected'} as expected\n`);
}

try {
  run('valid-external-custody', fixture(), true);

  const exportable = fixture();
  exportable.signer.privateKeyExportable = true;
  run('exportable-private-key', exportable, false, 'private_key_must_be_non_exportable');

  const localKey = fixture();
  localKey.signer.localPrivateKeyMaterial = true;
  run('local-private-key', localKey, false, 'local_private_key_material_forbidden');

  const noMfa = fixture();
  noMfa.signer.mfaRequired = false;
  run('mfa-disabled', noMfa, false, 'signer_mfa_required');

  const oneApprover = fixture();
  oneApprover.separationOfDuties.minimumApprovers = 1;
  run('single-approver', oneApprover, false, 'minimum_two_approvers_required');

  const recoveryFailed = fixture();
  recoveryFailed.recoveryDrill.status = 'fail';
  run('failed-recovery-drill', recoveryFailed, false, 'recovery_drill_must_pass');

  const leaked = fixture();
  leaked.signer.privateKey = 'do-not-accept';
  run('secret-field-leak', leaked, false, 'secret_material_field_present');

  const undocumentedRotation = fixture();
  undocumentedRotation.keyRotation.documented = false;
  run('missing-rotation-plan', undocumentedRotation, false, 'key_rotation_procedure_required');

  process.stdout.write('key custody evidence adversarial self-test: PASS\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
