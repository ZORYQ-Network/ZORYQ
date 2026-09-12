import fs from 'node:fs';

const path = new URL('./network_params.yaml', import.meta.url);
const text = fs.readFileSync(path, 'utf8');

const fail = (message) => {
  console.error(`[consensus-v2] FAIL: ${message}`);
  process.exitCode = 1;
};

const participantCount = (text.match(/^\s*-\s+el_type:\s*reth\s*$/gm) || []).length;
const lighthouseCount = (text.match(/^\s+cl_type:\s*lighthouse\s*$/gm) || []).length;
const validatorCounts = [...text.matchAll(/^\s+validator_count:\s*(\d+)\s*$/gm)].map(m => Number(m[1]));
const networkId = text.match(/^\s+network_id:\s*["']?(\d+)["']?\s*$/m)?.[1] || null;
const secondsPerSlot = Number(text.match(/^\s+seconds_per_slot:\s*(\d+)\s*$/m)?.[1] || 0);

if (participantCount < 4) fail(`expected at least 4 Reth execution participants, got ${participantCount}`);
if (lighthouseCount < 4) fail(`expected at least 4 Lighthouse consensus participants, got ${lighthouseCount}`);
if (validatorCounts.length < 4 || validatorCounts.some(v => v < 1)) fail('each participant must own at least one validator');
if (networkId !== '5919065') fail(`network_id must remain 5919065, got ${networkId}`);
if (secondsPerSlot < 2 || secondsPerSlot > 12) fail(`seconds_per_slot must be between 2 and 12, got ${secondsPerSlot}`);
if (/--dev(?:\s|$)/m.test(text)) fail('Reth --dev is forbidden in consensus-v2 topology');
if (/disable-auth-server/.test(text)) fail('Engine API cannot be disabled on validator EL nodes');

if (!process.exitCode) {
  console.log(JSON.stringify({
    ok: true,
    policy: 'zoryq-consensus-v2-topology-v2',
    executionClients: participantCount,
    consensusClients: lighthouseCount,
    validators: validatorCounts.reduce((a, b) => a + b, 0),
    networkId,
    secondsPerSlot,
    devModeForbidden: true,
    engineApiRequired: true,
    fourParticipantMinimum: true,
    claimBoundary: 'isolated CI/devnet topology; does not establish independent operators or production decentralization'
  }, null, 2));
}
