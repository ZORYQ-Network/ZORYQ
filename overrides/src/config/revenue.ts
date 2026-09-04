export type RevenueMode = 'preview' | 'live';

const rawFeeBps = Number(process.env.EXPO_PUBLIC_KYVO_SWAP_FEE_BPS ?? '15');

export const revenueConfig = {
  mode: (process.env.EXPO_PUBLIC_KYVO_REVENUE_MODE === 'live' ? 'live' : 'preview') as RevenueMode,
  swapFeeBps: Number.isFinite(rawFeeBps) ? Math.min(100, Math.max(0, rawFeeBps)) : 15,
  integrator: process.env.EXPO_PUBLIC_LIFI_INTEGRATOR ?? '',
  apiUrl: process.env.EXPO_PUBLIC_KYVO_API_URL ?? '',
  treasuryConfigured: Boolean(process.env.EXPO_PUBLIC_KYVO_TREASURY_PUBLIC_ID),
  proEnabled: process.env.EXPO_PUBLIC_KYVO_PRO_ENABLED === 'true',
};

export function feePercentLabel() {
  return `${(revenueConfig.swapFeeBps / 100).toFixed(2)}%`;
}

export function canChargeLiveSwapFee() {
  return revenueConfig.mode === 'live' && Boolean(revenueConfig.integrator) && revenueConfig.treasuryConfigured;
}
