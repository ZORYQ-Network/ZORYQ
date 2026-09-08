export const BUILDER_REPUTATION_VERSION = '0.1.0';

const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(n)) ? Number(n) : 0));
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function adoptionScore(uniqueExternalWallets) {
  const wallets = clamp(uniqueExternalWallets, 0, Number.MAX_SAFE_INTEGER);
  // Log scaling makes the first independent users meaningful while preventing raw scale from dominating.
  const normalized = Math.log1p(wallets) / Math.log1p(1000);
  return round2(30 * clamp(normalized, 0, 1));
}

function retentionScore(returningWallets, uniqueExternalWallets) {
  const unique = clamp(uniqueExternalWallets, 0, Number.MAX_SAFE_INTEGER);
  const returning = clamp(returningWallets, 0, unique);
  if (!unique) return 0;
  // 50%+ verified return rate receives the full retention component.
  return round2(25 * clamp((returning / unique) / 0.5, 0, 1));
}

function usageQualityScore(successfulInteractions, uniqueExternalWallets, successRatio) {
  const unique = clamp(uniqueExternalWallets, 0, Number.MAX_SAFE_INTEGER);
  const interactions = clamp(successfulInteractions, 0, Number.MAX_SAFE_INTEGER);
  const ratio = clamp(successRatio, 0, 1);
  if (!unique) return 0;
  // Interaction depth saturates at 5 successful interactions per independent wallet.
  const depth = clamp(interactions / (unique * 5), 0, 1);
  return round2(15 * depth + 5 * ratio);
}

function ecosystemIntegrationScore(verifiedPrimitiveIntegrations = []) {
  const approved = new Set(['dex', 'stake', 'lending']);
  const unique = new Set((verifiedPrimitiveIntegrations || []).map(v => String(v).toLowerCase()).filter(v => approved.has(v)));
  return round2(clamp(unique.size * 5, 0, 15));
}

function reliabilityScore(successRatio, activeDays, integrityFlags = []) {
  const ratio = clamp(successRatio, 0, 1);
  const longevity = clamp(clamp(activeDays, 0, Number.MAX_SAFE_INTEGER) / 30, 0, 1);
  const flags = Array.isArray(integrityFlags) ? integrityFlags : [];
  const penalty = Math.min(10, flags.reduce((n, flag) => {
    const severity = String(flag?.severity || flag || '').toLowerCase();
    return n + (severity === 'critical' ? 5 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1);
  }, 0));
  return round2(clamp(5 * ratio + 5 * longevity - penalty, 0, 10));
}

/**
 * Compute a deterministic, explainable ZORYQ Builder Reputation score.
 *
 * IMPORTANT: the caller is responsible for feeding only verified evidence and for excluding
 * project owner/builder self-activity, failed transactions, unverified manifest contracts and
 * activity clusters already classified as wash/circular manipulation.
 */
export function computeBuilderReputation(metrics = {}) {
  const uniqueExternalWallets = clamp(metrics.uniqueExternalWallets, 0, Number.MAX_SAFE_INTEGER);
  const returningWallets = clamp(metrics.returningWallets, 0, uniqueExternalWallets);
  const successfulInteractions = clamp(metrics.successfulInteractions, 0, Number.MAX_SAFE_INTEGER);
  const attemptedInteractions = clamp(metrics.attemptedInteractions ?? successfulInteractions, successfulInteractions, Number.MAX_SAFE_INTEGER);
  const successRatio = attemptedInteractions ? successfulInteractions / attemptedInteractions : 0;

  const components = {
    adoption: adoptionScore(uniqueExternalWallets),
    retention: retentionScore(returningWallets, uniqueExternalWallets),
    usageQuality: usageQualityScore(successfulInteractions, uniqueExternalWallets, successRatio),
    ecosystemIntegration: ecosystemIntegrationScore(metrics.verifiedPrimitiveIntegrations),
    reliability: reliabilityScore(successRatio, metrics.activeDays, metrics.integrityFlags)
  };

  const score = round2(Object.values(components).reduce((a, b) => a + b, 0));

  return {
    methodologyVersion: BUILDER_REPUTATION_VERSION,
    status: 'computed-from-supplied-verified-metrics',
    score: clamp(score, 0, 100),
    components,
    evidence: {
      uniqueExternalWallets,
      returningWallets,
      successfulInteractions,
      attemptedInteractions,
      successRatio: round2(successRatio),
      activeDays: clamp(metrics.activeDays, 0, Number.MAX_SAFE_INTEGER),
      verifiedPrimitiveIntegrations: [...new Set((metrics.verifiedPrimitiveIntegrations || []).map(v => String(v).toLowerCase()))],
      integrityFlags: Array.isArray(metrics.integrityFlags) ? metrics.integrityFlags : []
    },
    caveat: 'This engine does not verify chain evidence itself. A live score is valid only after the Project Intelligence indexer supplies verified, anti-gaming-filtered metrics.'
  };
}
