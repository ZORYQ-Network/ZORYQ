import http from 'node:http';
import { createExplorerIndexer } from './explorer-indexer.mjs';

const PORT=Number(process.env.PORT||8085);
const RPC_URL=process.env.ZORYQ_EXPLORER_RPC_URL||'http://127.0.0.1:8082/rpc';
const MAX_TRANSACTIONS=Math.max(1000,Number(process.env.ZORYQ_EXPLORER_MAX_TRANSACTIONS||10000));
const RECEIPT_CONCURRENCY=Math.max(1,Math.min(32,Number(process.env.ZORYQ_EXPLORER_RECEIPT_CONCURRENCY||8)));
const MAX_BLOCKS_PER_PASS=Math.max(1,Math.min(500,Number(process.env.ZORYQ_EXPLORER_MAX_BLOCKS_PER_PASS||50)));
const POLL_MS=Math.max(1000,Number(process.env.ZORYQ_EXPLORER_POLL_MS||2500));

async function rpc(method,params=[]){
  const r=await fetch(RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params})});
  if(!r.ok)throw new Error(`rpc_http_${r.status}`);
  const j=await r.json();
  if(j.error)throw new Error(j.error.message||'rpc_error');
  return j.result;
}

const indexer=createExplorerIndexer({
  rpc,
  stateFile:process.env.ZORYQ_EXPLORER_INDEX_STATE||'/data/explorer-index.json',
  maxTransactions:MAX_TRANSACTIONS,
  receiptConcurrency:RECEIPT_CONCURRENCY,
  maxBlocksPerPass:MAX_BLOCKS_PER_PASS,
  pollMs:POLL_MS
});
indexer.start();

function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'});res.end(JSON.stringify(value))}

const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url||'/','http://localhost');
    if(req.method!=='GET')return send(res,405,{ok:false,error:'method_not_allowed'});
    if(url.pathname==='/explorer/transactions')return send(res,200,indexer.list({page:url.searchParams.get('page')||1,limit:url.searchParams.get('limit')||50,address:url.searchParams.get('address')||'',order:url.searchParams.get('order')||'desc'}));
    if(url.pathname==='/explorer/stats')return send(res,200,indexer.stats());
    return send(res,404,{ok:false,error:'not_found'});
  }catch(error){return send(res,500,{ok:false,error:error?.message||'internal_error'})}
});

server.listen(PORT,'127.0.0.1',()=>console.log(`ZORYQ explorer index service listening on 127.0.0.1:${PORT}; maxTx=${MAX_TRANSACTIONS}; receiptConcurrency=${RECEIPT_CONCURRENCY}; blocksPerPass=${MAX_BLOCKS_PER_PASS}`));
process.on('SIGTERM',()=>{indexer.stop();server.close(()=>process.exit(0))});
process.on('SIGINT',()=>{indexer.stop();server.close(()=>process.exit(0))});
