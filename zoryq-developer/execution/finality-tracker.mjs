export const FINALITY_STAGES = Object.freeze(['accepted','included','confirmed','final']);

export class FinalityTracker {
  constructor({confirmations=2, finalityDepth=6}={}) {
    if (confirmations < 1 || finalityDepth < confirmations) throw new Error('invalid_finality_policy');
    this.confirmations=confirmations; this.finalityDepth=finalityDepth;
  }
  classify({receipt,currentBlock}) {
    if (!receipt) return {stage:'accepted',confirmations:0};
    const included=Number(BigInt(receipt.blockNumber));
    const conf=Math.max(1,currentBlock-included+1);
    if (conf>=this.finalityDepth) return {stage:'final',confirmations:conf,includedBlock:included};
    if (conf>=this.confirmations) return {stage:'confirmed',confirmations:conf,includedBlock:included};
    return {stage:'included',confirmations:conf,includedBlock:included};
  }
  async waitFor(adapter,hash,{pollMs=250,timeoutMs=30000,onStage=()=>{}}={}) {
    const start=Date.now(); let last='accepted'; onStage({stage:last,at:start});
    while(Date.now()-start<timeoutMs){
      const [receipt,currentBlock]=await Promise.all([adapter.transactionReceipt(hash),adapter.blockNumber()]);
      const state=this.classify({receipt,currentBlock});
      if(state.stage!==last){last=state.stage;onStage({...state,at:Date.now()});}
      if(state.stage==='final') return {...state,elapsedMs:Date.now()-start,receipt};
      await new Promise(r=>setTimeout(r,pollMs));
    }
    throw new Error('finality_timeout');
  }
}
