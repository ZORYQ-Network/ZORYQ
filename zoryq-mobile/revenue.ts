import {isAddress} from 'ethers';

export const CANONICAL_WALLET_TREASURY='0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33';
export const CANONICAL_SWAP_BACKEND='https://zoryq-wallet-swap-production.up.railway.app';

export const WALLET_REVENUE_POLICY={
  version:'zoryq-wallet-revenue-v2',
  swapFeeBps:25, // 0.25% integrator fee; must be displayed before signing.
  transferFeeBps:0,
  hiddenFees:false,
  description:'Revenue is collected only from explicitly disclosed swap integration fees. Native/ERC-20 transfers have no ZORYQ Wallet service fee.'
} as const;

export const TREASURY_ADDRESS=String(process.env.EXPO_PUBLIC_ZORYQ_TREASURY||CANONICAL_WALLET_TREASURY).trim();
export const SWAP_BACKEND=String(process.env.EXPO_PUBLIC_ZORYQ_SWAP_BACKEND||CANONICAL_SWAP_BACKEND).trim().replace(/\/$/,'');

export function revenueReady(){
  return Boolean(TREASURY_ADDRESS&&isAddress(TREASURY_ADDRESS)&&SWAP_BACKEND.startsWith('https://'));
}

export function revenueReadiness(){
  const blockers:string[]=[];
  if(!TREASURY_ADDRESS||!isAddress(TREASURY_ADDRESS))blockers.push('production_treasury_not_configured');
  if(!SWAP_BACKEND.startsWith('https://'))blockers.push('secure_swap_backend_not_configured');
  return {ok:blockers.length===0,blockers,policy:WALLET_REVENUE_POLICY,treasury:TREASURY_ADDRESS,backend:SWAP_BACKEND};
}
