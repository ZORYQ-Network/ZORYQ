import fs from 'node:fs';

const REQUIRED_CHECKS = Object.freeze([
  'ZORYQ Mainnet Readiness Gate',
  'ZORYQ Mainnet Launch Guard',
  'ZORYQ Mainnet Runtime Preflight',
  'ZORYQ Mainnet Supply Chain Evidence',
  'ZORYQ Mainnet Release Integrity',
  'ZORYQ Mainnet Multi-Operator Evidence',
  'ZORYQ Contract Tests'
]);

function fail(message, code = 64) {
  process.stdout.write(`${JSON.stringify({ pass: false, error: message }, null, 2)}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node release-governance-evidence.mjs --input <governance.json>');
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}
function isCommit(value) { return /^[0-9a-f]{40}$/i.test(String(value || '')); }
function isTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

const args = parseArgs(process.argv);
if (!args.input) fail('usage: node release-governance-evidence.mjs --input <governance.json>');
let evidence;
try { evidence = JSON.parse(fs.readFileSync(args.input, 'utf8')); } catch { fail('governance_evidence_invalid_json'); }

const blockers = [];
if (evidence.repository !== 'ZORYQ-Network/ZORYQ') blockers.push('repository_invalid');
if (evidence.productionEvidence !== true) blockers.push('production_evidence_required');
if (evidence.synthetic === true || evidence.fixtureOnly === true) blockers.push('synthetic_governance_evidence_forbidden');
if (!isCommit(evidence.releaseCommit)) blockers.push('release_commit_invalid');
if (evidence.releaseCommitVerified !== true) blockers.push('release_commit_signature_not_verified');
if (evidence.branchProtected !== true) blockers.push('branch_not_protected');
if (evidence.adminEnforcement !== true) blockers.push('branch_protection_not_enforced_for_admins');
if (evidence.requiresPullRequest !== true) blockers.push('pull_request_required');
if (!Number.isSafeInteger(evidence.requiredApprovingReviewCount) || evidence.requiredApprovingReviewCount < 2) blockers.push('approving_reviews_below_policy');
if (evidence.dismissStaleReviews !== true) blockers.push('stale_review_dismissal_required');
if (evidence.requireCodeOwnerReview !== true) blockers.push('code_owner_review_required');
if (evidence.requiredStatusChecksStrict !== true) blockers.push('strict_status_checks_required');
if (evidence.forcePushesAllowed !== false) blockers.push('force_push_must_be_disabled');
if (evidence.deletionsAllowed !== false) blockers.push('branch_deletion_must_be_disabled');
if (evidence.signedReleaseTag !== true) blockers.push('signed_release_tag_required');
if (evidence.immutableReleaseTag !== true) blockers.push('immutable_release_tag_required');
if (!isTimestamp(evidence.observedAt)) blockers.push('observed_at_invalid');

const observedAtMs = isTimestamp(evidence.observedAt) ? Date.parse(evidence.observedAt) : null;
if (observedAtMs !== null && observedAtMs > Date.now() + 60_000) blockers.push('observed_at_in_future');
if (observedAtMs !== null && Date.now() - observedAtMs > 24 * 60 * 60 * 1000) blockers.push('governance_evidence_stale');

const checks = Array.isArray(evidence.requiredChecks) ? evidence.requiredChecks.map(String) : [];
const uniqueChecks = new Set(checks);
if (uniqueChecks.size !== checks.length) blockers.push('duplicate_required_checks');
for (const required of REQUIRED_CHECKS) {
  if (!uniqueChecks.has(required)) blockers.push(`required_check_missing:${required}`);
}

const report = {
  pass: blockers.length === 0,
  status: blockers.length === 0 ? 'RELEASE_GOVERNANCE_EVIDENCE_ACCEPTED' : 'RELEASE_GOVERNANCE_EVIDENCE_REJECTED',
  repository: evidence.repository || null,
  releaseCommit: evidence.releaseCommit || null,
  observedAt: evidence.observedAt || null,
  requiredChecks: REQUIRED_CHECKS,
  observedRequiredChecks: [...uniqueChecks].sort(),
  blockers,
  rule: 'zoryq-mainnet-release-governance-evidence-v1'
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(83);
