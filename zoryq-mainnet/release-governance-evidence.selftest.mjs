import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const GATE = path.join(ROOT, 'release-governance-evidence.mjs');
const REQUIRED_CHECKS = [
  'ZORYQ Mainnet Readiness Gate',
  'ZORYQ Mainnet Launch Guard',
  'ZORYQ Mainnet Runtime Preflight',
  'ZORYQ Mainnet Supply Chain Evidence',
  'ZORYQ Mainnet Release Integrity',
  'ZORYQ Mainnet Multi-Operator Evidence',
  'ZORYQ Contract Tests'
];

function run(input) {
  const r = spawnSync(process.execPath, [GATE, '--input', input], { encoding: 'utf8' });
  let body = {};
  try { body = JSON.parse(r.stdout || '{}'); } catch {}
  return { status: r.status, body };
}
function assert(ok, message) { if (!ok) throw new Error(message); }
function write(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-release-governance-selftest-'));
try {
  const input = path.join(dir, 'governance.json');
  const base = {
    repository: 'ZORYQ-Network/ZORYQ',
    productionEvidence: true,
    releaseCommit: 'a'.repeat(40),
    releaseCommitVerified: true,
    branchProtected: true,
    adminEnforcement: true,
    requiresPullRequest: true,
    requiredApprovingReviewCount: 2,
    dismissStaleReviews: true,
    requireCodeOwnerReview: true,
    requiredStatusChecksStrict: true,
    forcePushesAllowed: false,
    deletionsAllowed: false,
    signedReleaseTag: true,
    immutableReleaseTag: true,
    observedAt: new Date().toISOString(),
    requiredChecks: [...REQUIRED_CHECKS]
  };

  write(input, base);
  const good = run(input);
  assert(good.status === 0 && good.body.pass === true, `valid governance rejected: ${JSON.stringify(good.body)}`);

  const unsigned = { ...base, releaseCommitVerified: false };
  write(input, unsigned);
  const unsignedRun = run(input);
  assert(unsignedRun.status === 83 && unsignedRun.body.blockers?.includes('release_commit_signature_not_verified'), 'unsigned commit evidence was not rejected');

  const unprotected = { ...base, branchProtected: false };
  write(input, unprotected);
  const branchRun = run(input);
  assert(branchRun.status === 83 && branchRun.body.blockers?.includes('branch_not_protected'), 'unprotected branch was not rejected');

  const weakReviews = { ...base, requiredApprovingReviewCount: 1 };
  write(input, weakReviews);
  const reviewsRun = run(input);
  assert(reviewsRun.status === 83 && reviewsRun.body.blockers?.includes('approving_reviews_below_policy'), 'weak review policy was not rejected');

  const forcePush = { ...base, forcePushesAllowed: true };
  write(input, forcePush);
  const forceRun = run(input);
  assert(forceRun.status === 83 && forceRun.body.blockers?.includes('force_push_must_be_disabled'), 'force-push policy was not rejected');

  const missingCheck = { ...base, requiredChecks: REQUIRED_CHECKS.filter((v) => v !== 'ZORYQ Mainnet Supply Chain Evidence') };
  write(input, missingCheck);
  const checkRun = run(input);
  assert(checkRun.status === 83 && checkRun.body.blockers?.includes('required_check_missing:ZORYQ Mainnet Supply Chain Evidence'), 'missing required check was not rejected');

  const unsignedTag = { ...base, signedReleaseTag: false };
  write(input, unsignedTag);
  const tagRun = run(input);
  assert(tagRun.status === 83 && tagRun.body.blockers?.includes('signed_release_tag_required'), 'unsigned release tag was not rejected');

  process.stdout.write(JSON.stringify({
    ok: true,
    cases: ['valid-governance','unsigned-commit-rejection','unprotected-branch-rejection','review-threshold-rejection','force-push-rejection','missing-check-rejection','unsigned-tag-rejection']
  }, null, 2) + '\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
