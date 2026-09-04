export const commercialConfig = {
  routeFee: {
    defaultBps: 15,
    label: 'ZORIQ Route Fee',
    activation: 'partner-and-backend-gated',
  },
  pro: {
    productId: 'zoriq_pro_monthly',
    foundersUsdMonthly: 4.99,
    status: 'configuration',
    benefits: [
      'Advanced ZORIQ Guard',
      'Portfolio intelligence',
      'Advanced routing controls',
      'ZORIQ ONE automations',
      'Priority alerts and customization',
    ],
  },
  business: {
    products: ['Guard API', 'ONE API', 'Risk webhooks', 'Partner dashboard'],
    status: 'planned',
  },
  network: {
    strategy: 'multichain-first',
    futureExecutionLayer: 'ethereum-aligned-l2-or-appchain',
    status: 'research-gated-by-adoption',
  },
} as const;
