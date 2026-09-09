export class ExecutionAdapter {
  async chainId() { throw new Error('not_implemented'); }
  async submitRawTransaction(_rawTx) { throw new Error('not_implemented'); }
  async transactionReceipt(_hash) { throw new Error('not_implemented'); }
  async blockNumber() { throw new Error('not_implemented'); }
  async blockByNumber(_tag='latest') { throw new Error('not_implemented'); }
  async stateDigest() { throw new Error('not_implemented'); }
}

export class JsonRpcExecutionAdapter extends ExecutionAdapter {
  constructor(rpcUrl, { fetchImpl = fetch } = {}) {
    super(); this.rpcUrl = rpcUrl; this.fetchImpl = fetchImpl; this.id = 1;
  }
  async rpc(method, params=[]) {
    const r = await this.fetchImpl(this.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:this.id++,method,params})});
    if (!r.ok) throw new Error(`rpc_http_${r.status}`);
    const j = await r.json(); if (j.error) throw new Error(j.error.message||`rpc_${j.error.code}`); return j.result;
  }
  async chainId(){ return this.rpc('eth_chainId'); }
  async submitRawTransaction(rawTx){ return this.rpc('eth_sendRawTransaction',[rawTx]); }
  async transactionReceipt(hash){ return this.rpc('eth_getTransactionReceipt',[hash]); }
  async blockNumber(){ return Number(BigInt(await this.rpc('eth_blockNumber'))); }
  async blockByNumber(tag='latest'){ return this.rpc('eth_getBlockByNumber',[typeof tag==='number'?`0x${tag.toString(16)}`:tag,false]); }
  async stateDigest(){
    const b=await this.blockByNumber('latest');
    return { blockNumber:Number(BigInt(b.number)), blockHash:b.hash, stateRoot:b.stateRoot||null, receiptsRoot:b.receiptsRoot||null, transactionsRoot:b.transactionsRoot||null };
  }
}
