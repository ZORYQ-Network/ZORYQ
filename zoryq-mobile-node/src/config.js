export const ZORYQ_MOBILE_NODE_CONFIG = {
  chainId: 5919065,
  networkName: 'ZORYQ Testnet',
  bootstrapRpc: 'https://zoryq-evm-node-live-production.up.railway.app/rpc',
  modes: {
    eco: 60000,
    balanced: 20000,
    active: 8000
  },
  contribution: {
    label: 'Witness Participation',
    validatorClaim: false,
    consensusClaim: false
  }
};
