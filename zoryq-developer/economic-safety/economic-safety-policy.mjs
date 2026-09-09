export function evaluateEconomicSafety(input,{now=Date.now()}={}){
  const fail=(code,detail=null)=>({ok:false,code,detail});
  if(!input) return fail('request_required');
  const deadline=Number(input.deadlineMs||0);
  if(!Number.isFinite(deadline)||deadline<=0||now>deadline) return fail('deadline_expired');
  const slippage=Number(input.slippageBps??0),maxSlippage=Number(input.maxSlippageBps??0);
  if(!Number.isInteger(slippage)||slippage<0||slippage>maxSlippage) return fail('slippage_limit_exceeded');
  const impact=Number(input.priceImpactBps??0),maxImpact=Number(input.maxPriceImpactBps??0);
  if(!Number.isInteger(impact)||impact<0||impact>maxImpact) return fail('price_impact_exceeded');
  const oracleAge=Math.max(0,now-Number(input.oracleTimestampMs||0));
  if(!Number.isFinite(oracleAge)||oracleAge>Number(input.maxOracleAgeMs??0)) return fail('stale_oracle');
  const quoteAge=Math.max(0,now-Number(input.quoteTimestampMs||0));
  if(!Number.isFinite(quoteAge)||quoteAge>Number(input.maxQuoteAgeMs??0)) return fail('stale_quote');
  const expected=BigInt(input.expectedOut??0),minimum=BigInt(input.minimumOut??0);
  if(expected<=0n||minimum<=0n||minimum>expected) return fail('invalid_output_bounds');
  const simulated=BigInt(input.simulatedOut??0);
  if(simulated<minimum) return fail('simulation_min_out_failed');
  const oracleDeviation=Number(input.oracleDeviationBps??0);
  if(!Number.isInteger(oracleDeviation)||oracleDeviation<0||oracleDeviation>Number(input.maxOracleDeviationBps??0)) return fail('oracle_deviation_exceeded');
  if(input.privateOrderflowRequired===true&&input.privateOrderflowAvailable!==true) return fail('private_orderflow_unavailable');
  if(input.sandwichProtectionRequired===true&&input.sandwichProtectionVerified!==true) return fail('sandwich_protection_unverified');
  if(String(input.simulationHash||'')!==String(input.executionSimulationHash||'')) return fail('simulation_binding_mismatch');
  return {ok:true,checkedAt:now,oracleAgeMs:oracleAge,quoteAgeMs:quoteAge,minimumOut:minimum.toString(),simulatedOut:simulated.toString()};
}
