import fs from 'node:fs';

function loadJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function saveJson(file,value){const tmp=`${file}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value));fs.renameSync(tmp,file)}
function hexNumber(v){return v==null?null:Number(BigInt(v))}
function safeLower(v){return typeof v==='string'?v.toLowerCase():null}
async function mapLimit(items,limit,fn){if(!items.length)return[];const out=new Array(items.length);let cursor=0;async function worker(){while(true){const i=cursor++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}const workers=Array.from({length:Math.min(Math.max(1,limit),items.length)},()=>worker());await Promise.all(workers);return out}

export function createExplorerIndexer({rpc,stateFile='/data/explorer-index.json',maxTransactions=10000,maxBlocksPerPass=100,pollMs=2000,receiptConcurrency=8}={}){
  if(typeof rpc!=='function')throw new Error('explorer indexer requires rpc function');
  maxTransactions=Math.max(1000,Number(maxTransactions)||10000);
  receiptConcurrency=Math.max(1,Math.min(32,Number(receiptConcurrency)||8));
  let state=loadJson(stateFile,{version:1,genesisHash:null,lastIndexedBlock:-1,totalSeen:0,transactions:[]});
  let running=false;
  let timer=null;

  function normalizeState(){
    state.version=1;
    state.genesisHash=state.genesisHash||null;
    state.lastIndexedBlock=Number.isFinite(Number(state.lastIndexedBlock))?Number(state.lastIndexedBlock):-1;
    state.totalSeen=Number.isFinite(Number(state.totalSeen))?Number(state.totalSeen):0;
    state.transactions=Array.isArray(state.transactions)?state.transactions:[];
    state.transactions.sort((a,b)=>(Number(b.blockNumber||0)-Number(a.blockNumber||0))||(Number(b.transactionIndex||0)-Number(a.transactionIndex||0)));
    if(state.transactions.length>maxTransactions)state.transactions.length=maxTransactions;
  }
  normalizeState();

  async function receiptFor(hash){
    try{return await rpc('eth_getTransactionReceipt',[hash])}catch{return null}
  }

  async function indexBlock(number){
    const hex='0x'+number.toString(16);
    const block=await rpc('eth_getBlockByNumber',[hex,true]);
    if(!block)return [];
    const timestamp=hexNumber(block.timestamp)||0;
    const txs=Array.isArray(block.transactions)?block.transactions:[];
    const receipts=await mapLimit(txs,receiptConcurrency,tx=>receiptFor(tx.hash));
    return txs.map((tx,i)=>{
      const receipt=receipts[i];
      return {
        hash:tx.hash,
        blockNumber:hexNumber(tx.blockNumber)??number,
        blockHash:tx.blockHash||block.hash||null,
        transactionIndex:hexNumber(tx.transactionIndex)??i,
        timestamp,
        from:tx.from||null,
        to:tx.to||null,
        value:tx.value||'0x0',
        nonce:hexNumber(tx.nonce),
        input:tx.input||'0x',
        gas:tx.gas||null,
        gasPrice:tx.gasPrice||null,
        maxFeePerGas:tx.maxFeePerGas||null,
        maxPriorityFeePerGas:tx.maxPriorityFeePerGas||null,
        type:tx.type||null,
        status:receipt?.status??null,
        gasUsed:receipt?.gasUsed||null,
        contractAddress:receipt?.contractAddress||null
      };
    });
  }

  function mergeTransactions(items){
    if(!items.length)return;
    const seen=new Set(state.transactions.map(t=>safeLower(t.hash)));
    let added=0;
    for(const tx of items){const k=safeLower(tx.hash);if(!k||seen.has(k))continue;state.transactions.push(tx);seen.add(k);added++}
    state.totalSeen+=added;
    state.transactions.sort((a,b)=>(b.blockNumber-a.blockNumber)||(b.transactionIndex-a.transactionIndex));
    if(state.transactions.length>maxTransactions)state.transactions.length=maxTransactions;
  }

  async function ensureGenesis(){
    const genesis=await rpc('eth_getBlockByNumber',['0x0',false]);
    const hash=genesis?.hash||null;
    if(state.genesisHash&&hash&&state.genesisHash!==hash){
      state={version:1,genesisHash:hash,lastIndexedBlock:-1,totalSeen:0,transactions:[]};
      saveJson(stateFile,state);
    }else if(!state.genesisHash&&hash){state.genesisHash=hash;saveJson(stateFile,state)}
  }

  async function syncOnce(){
    if(running)return;
    running=true;
    try{
      await ensureGenesis();
      const latest=hexNumber(await rpc('eth_blockNumber',[]))??0;
      let start=state.lastIndexedBlock+1;
      if(start<0)start=0;
      const end=Math.min(latest,start+maxBlocksPerPass-1);
      if(start<=end){
        const collected=[];
        for(let n=start;n<=end;n++)collected.push(...await indexBlock(n));
        mergeTransactions(collected);
        state.lastIndexedBlock=end;
        state.updatedAt=Date.now();
        saveJson(stateFile,state);
      }
    }catch(error){console.error('[zoryq-explorer] index pass failed',error?.message||error)}
    finally{running=false}
  }

  function list({page=1,limit=50,address='',order='desc'}={}){
    const safeLimit=Math.max(1,Math.min(100,Number(limit)||50));
    const safePage=Math.max(1,Number(page)||1);
    const target=safeLower(address);
    let rows=state.transactions;
    if(target)rows=rows.filter(tx=>safeLower(tx.from)===target||safeLower(tx.to)===target||safeLower(tx.contractAddress)===target);
    if(order==='asc')rows=[...rows].reverse();
    const start=(safePage-1)*safeLimit;
    return {ok:true,page:safePage,limit:safeLimit,order:order==='asc'?'asc':'desc',totalIndexed:rows.length,totalSeen:state.totalSeen,lastIndexedBlock:state.lastIndexedBlock,genesisHash:state.genesisHash,maxTransactions,transactions:rows.slice(start,start+safeLimit)};
  }

  function stats(){return {ok:true,lastIndexedBlock:state.lastIndexedBlock,totalIndexed:state.transactions.length,totalSeen:state.totalSeen,genesisHash:state.genesisHash,updatedAt:state.updatedAt||null,maxTransactions,receiptConcurrency}}
  function start(){if(timer)return;syncOnce();timer=setInterval(syncOnce,pollMs);timer.unref?.()}
  function stop(){if(timer)clearInterval(timer);timer=null}
  return {start,stop,syncOnce,list,stats};
}
