import { computeBuilderReputation } from './project-intelligence.mjs';

const ADDRESS_RE=/^0x[0-9a-fA-F]{40}$/;
const HASH_RE=/^0x[0-9a-fA-F]{64}$/;
const DAY_MS=86_400_000;

const normAddress=v=>ADDRESS_RE.test(String(v||''))?String(v).toLowerCase():null;
const normHash=v=>HASH_RE.test(String(v||''))?String(v).toLowerCase():null;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(n))?Number(n):0));

function timestampMs(v){
  const n=Number(v);
  if(Number.isFinite(n)&&n>0) return n>10_000_000_000?n:n*1000;
  const t=Date.parse(String(v||''));
  return Number.isFinite(t)?t:null;
}

function dayBucket(ms){ return Math.floor(ms/DAY_MS); }

/**
 * Build anti-gaming-filtered project metrics from already-fetched chain evidence.
 * The caller is responsible for retrieving canonical blocks/transactions/receipts from ZORYQ RPC.
 * This function intentionally performs no network access, making the result deterministic and testable.
 */
export function indexProjectEvidence({manifest, transactions=[], receipts=[], blocks=[], approvedPrimitives={}}={}){
  if(!manifest||manifest.chainId!==5919065) throw new Error('invalid_manifest_chain');
  const builder=normAddress(manifest?.builder?.address);
  if(!builder) throw new Error('invalid_builder_address');

  const activeContracts=new Map();
  for(const c of Array.isArray(manifest.contracts)?manifest.contracts:[]){
    const address=normAddress(c?.address);
    if(!address||c?.active===false) continue;
    if(activeContracts.has(address)) throw new Error('duplicate_manifest_contract');
    activeContracts.set(address,{name:String(c?.name||''),kind:String(c?.kind||'other'),sharedIntegration:Boolean(c?.sharedIntegration)});
  }
  if(!activeContracts.size) throw new Error('no_active_project_contracts');

  const receiptByHash=new Map();
  for(const r of Array.isArray(receipts)?receipts:[]){
    const h=normHash(r?.transactionHash||r?.hash);
    if(h) receiptByHash.set(h,r);
  }
  const blockTime=new Map();
  for(const b of Array.isArray(blocks)?blocks:[]){
    const key=String(b?.number??'').toLowerCase();
    const ms=timestampMs(b?.timestamp);
    if(key&&ms) blockTime.set(key,ms);
  }

  const excludedWallets=new Set([builder]);
  for(const a of Array.isArray(manifest?.builder?.excludeAddresses)?manifest.builder.excludeAddresses:[]){
    const n=normAddress(a); if(n) excludedWallets.add(n);
  }

  const seenTx=new Set();
  const successful=[];
  let attemptedInteractions=0;
  let failedInteractions=0;

  for(const tx of Array.isArray(transactions)?transactions:[]){
    const hash=normHash(tx?.hash); const from=normAddress(tx?.from); const to=normAddress(tx?.to);
    if(!hash||!from||!to||seenTx.has(hash)||!activeContracts.has(to)) continue;
    seenTx.add(hash); attemptedInteractions++;
    const receipt=receiptByHash.get(hash);
    const success=receipt && (receipt.status==='0x1'||receipt.status===1||receipt.status===true);
    if(!success){ failedInteractions++; continue; }
    if(excludedWallets.has(from)) continue;
    const blockKey=String(tx?.blockNumber??receipt?.blockNumber??'').toLowerCase();
    const ms=timestampMs(tx?.timestamp)||timestampMs(receipt?.timestamp)||blockTime.get(blockKey)||null;
    successful.push({hash,from,to,timestampMs:ms,kind:activeContracts.get(to).kind});
  }

  const uniqueWalletSet=new Set(successful.map(x=>x.from));
  const daysByWallet=new Map();
  for(const e of successful){
    if(!e.timestampMs) continue;
    const set=daysByWallet.get(e.from)||new Set();
    set.add(dayBucket(e.timestampMs));
    daysByWallet.set(e.from,set);
  }
  const returningWallets=[...uniqueWalletSet].filter(w=>(daysByWallet.get(w)?.size||0)>=2).length;
  const timestamps=successful.map(x=>x.timestampMs).filter(Boolean).sort((a,b)=>a-b);
  const activeDays=timestamps.length?Math.max(1,Math.floor((timestamps.at(-1)-timestamps[0])/DAY_MS)+1):0;

  const primitiveMap=new Map(Object.entries(approvedPrimitives||{}).map(([k,v])=>[normAddress(v),String(k).toLowerCase()]).filter(([a])=>a));
  const integrations=new Set();
  for(const e of successful){
    const primitive=primitiveMap.get(e.to);
    if(primitive) integrations.add(primitive);
    if(['dex','stake','lending'].includes(e.kind)) integrations.add(e.kind);
  }

  const integrityFlags=[];
  const uniqueExternalWallets=uniqueWalletSet.size;
  if(attemptedInteractions>=10 && uniqueExternalWallets<=1) integrityFlags.push({code:'single_wallet_concentration',severity:'medium'});
  if(attemptedInteractions>0 && failedInteractions/attemptedInteractions>0.5) integrityFlags.push({code:'high_failure_rate',severity:'medium'});
  if(successful.length>=20 && uniqueExternalWallets>0 && successful.length/uniqueExternalWallets>50) integrityFlags.push({code:'extreme_interaction_concentration',severity:'high'});

  const metrics={
    uniqueExternalWallets,
    returningWallets,
    successfulInteractions:successful.length,
    attemptedInteractions,
    activeDays,
    verifiedPrimitiveIntegrations:[...integrations].sort(),
    integrityFlags
  };
  const reputation=computeBuilderReputation(metrics);

  return {
    version:'0.1.0',
    status:'derived-from-supplied-chain-evidence',
    project:{slug:String(manifest.slug||''),name:String(manifest.name||''),builder,contracts:[...activeContracts.keys()]},
    metrics:{...metrics,failedInteractions,successRatio:attemptedInteractions?Math.round((successful.length/attemptedInteractions)*10000)/10000:0},
    reputation,
    evidence:{
      uniqueTransactions:seenTx.size,
      countedTransactions:successful.map(x=>x.hash),
      excludedBuilderSelfActivity:true,
      receiptRequired:true,
      duplicateTransactionsIgnored:true,
      timestampedWalletCohorts:[...daysByWallet.entries()].map(([wallet,days])=>({wallet,activeDayBuckets:days.size}))
    },
    caveat:'This module validates supplied evidence deterministically but does not fetch canonical chain data itself. Live Project Intelligence requires a bounded RPC indexer and an active on-chain Project Registry.'
  };
}
