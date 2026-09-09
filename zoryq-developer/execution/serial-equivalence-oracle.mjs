import { createHash } from 'node:crypto';

function stable(v){
  if(Array.isArray(v)) return v.map(stable);
  if(v&&typeof v==='object') return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)]));
  return v;
}
export function digest(value){return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}

export function normalizeReceipt(r={}){
  return {status:r.status??null,gasUsed:r.gasUsed??null,contractAddress:r.contractAddress??null,logs:(r.logs||[]).map(l=>({address:l.address,topics:l.topics,data:l.data}))};
}

export function compareExecutions(reference,candidate){
  const ref={receipts:(reference.receipts||[]).map(normalizeReceipt),postState:reference.postState};
  const cand={receipts:(candidate.receipts||[]).map(normalizeReceipt),postState:candidate.postState};
  const receiptDigestReference=digest(ref.receipts),receiptDigestCandidate=digest(cand.receipts);
  const stateDigestReference=digest(ref.postState),stateDigestCandidate=digest(cand.postState);
  return {equal:receiptDigestReference===receiptDigestCandidate&&stateDigestReference===stateDigestCandidate,receiptDigestReference,receiptDigestCandidate,stateDigestReference,stateDigestCandidate};
}

export function assertEquivalent(reference,candidate){const r=compareExecutions(reference,candidate);if(!r.equal){const e=new Error('serial_equivalence_failed');e.evidence=r;throw e}return r}
