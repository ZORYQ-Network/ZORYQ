import {canChargeLiveSwapFee, feePercentLabel, revenueConfig} from '@/config/revenue';

export type SwapQuote = {
  fromSymbol: string; toSymbol: string; fromAmount: string; toAmount: string;
  expectedUsd: string; networkFee: string; kyvoFee: string; kyvoFeePercent: string;
  feeMode: 'preview'|'live'; priceImpact: string; xp: number; route: string;
};

export async function getPreviewQuote(fromAmount: string): Promise<SwapQuote> {
  const parsed = Math.max(0, Number(fromAmount || 0));
  const output = parsed * 14.76536;
  const estimatedUsd = parsed * 2500;
  const feeUsd = estimatedUsd * (revenueConfig.swapFeeBps / 10000);
  const live = canChargeLiveSwapFee();
  return {
    fromSymbol:'ETH',toSymbol:'SOL',fromAmount:parsed.toFixed(4),toAmount:output.toFixed(4),
    expectedUsd:'$3,108.74',networkFee:'0.0042 ETH',
    kyvoFee:`${live?'':'Preview · '}${feePercentLabel()} (~$${feeUsd.toFixed(2)})`,
    kyvoFeePercent:feePercentLabel(),feeMode:live?'live':'preview',priceImpact:'0.53%',
    xp:Math.max(1,Math.round(parsed*10)),route:live?'KYVO Route · live integrator':'KYVO Route · preview'
  };
}
