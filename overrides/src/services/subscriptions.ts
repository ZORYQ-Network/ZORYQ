export type ProStatus = {configured:boolean; provider:'RevenueCat'; entitlement:'kyvo_pro'};

export function getProStatus(): ProStatus {
  return {
    configured: Boolean(process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY),
    provider: 'RevenueCat',
    entitlement: 'kyvo_pro',
  };
}
