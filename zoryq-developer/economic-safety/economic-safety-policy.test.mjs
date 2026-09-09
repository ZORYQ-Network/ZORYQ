import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEconomicSafety } from './economic-safety-policy.mjs';

const now=1_800_000_000_000;
function good(){return {deadlineMs:now+5000,slippageBps:20,maxSlippageBps:50,priceImpactBps:30,maxPriceImpactBps:100,oracleTimestampMs:now-500,maxOracleAgeMs:2000,quoteTimestampMs:now-100,maxQuoteAgeMs:1000,expectedOut:'1000',minimumOut:'990',simulatedOut:'995',oracleDeviationBps:15,maxOracleDeviationBps:100,privateOrderflowRequired:true,privateOrderflowAvailable:true,sandwichProtectionRequired:true,sandwichProtectionVerified:true,simulationHash:'0xabc',executionSimulationHash:'0xabc'}}

test('safe order passes',()=>assert.equal(evaluateEconomicSafety(good(),{now}).ok,true));
for (const [name,mutate,code] of [
 ['expired deadline',x=>x.deadlineMs=now-1,'deadline_expired'],
 ['excess slippage',x=>x.slippageBps=51,'slippage_limit_exceeded'],
 ['excess price impact',x=>x.priceImpactBps=101,'price_impact_exceeded'],
 ['stale oracle',x=>x.oracleTimestampMs=now-5000,'stale_oracle'],
 ['stale quote',x=>x.quoteTimestampMs=now-5000,'stale_quote'],
 ['min out simulation failure',x=>x.simulatedOut='980','simulation_min_out_failed'],
 ['oracle deviation',x=>x.oracleDeviationBps=101,'oracle_deviation_exceeded'],
 ['missing private orderflow',x=>x.privateOrderflowAvailable=false,'private_orderflow_unavailable'],
 ['unverified sandwich protection',x=>x.sandwichProtectionVerified=false,'sandwich_protection_unverified'],
 ['simulation mutation',x=>x.executionSimulationHash='0xdef','simulation_binding_mismatch'],
]) test(name,()=>{const x=good();mutate(x);assert.equal(evaluateEconomicSafety(x,{now}).code,code)});
