const RPC=process.env.ZORYQ_RPC||'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const TEST_TX=process.env.ZORYQ_TEST_TX||'0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const TEST_ADDRESS=process.env.ZORYQ_TEST_ADDRESS||'0x509fcfd87c0a3dee40f36b65842aa4ace1fc9ee6';
let id=0;
async function rpc(method,params=[]){
  const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});
  const j=await r.json();
  if(j.error)throw new Error(`${method}: ${j.error.code} ${j.error.message}`);
  return j.result;
}
async function check(name,fn){try{const result=await fn();console.log(`PASS ${name}`,typeof result==='object'?JSON.stringify(result):result);return true}catch(e){console.error(`FAIL ${name}`,e.message);return false}}
const checks=[];
checks.push(await check('eth_chainId',async()=>{const x=await rpc('eth_chainId');if(x!=='0x5a5159')throw Error(`expected 0x5a5159, got ${x}`);return x}));
checks.push(await check('net_version',async()=>{const x=await rpc('net_version');if(x!=='5919065')throw Error(`expected 5919065, got ${x}`);return x}));
checks.push(await check('eth_blockNumber',()=>rpc('eth_blockNumber')));
checks.push(await check('eth_getBalance',()=>rpc('eth_getBalance',[TEST_ADDRESS,'latest'])));
checks.push(await check('eth_getTransactionReceipt',async()=>{const x=await rpc('eth_getTransactionReceipt',[TEST_TX]);if(x===null)return 'null-for-unknown-transaction';if(typeof x!=='object'||typeof x.transactionHash!=='string'||typeof x.status!=='string')throw Error('invalid receipt shape');return {blockNumber:x.blockNumber,status:x.status,from:x.from,to:x.to,gasUsed:x.gasUsed}}));
checks.push(await check('eth_call',()=>rpc('eth_call',[{to:TEST_ADDRESS,data:'0x'},'latest'])));
checks.push(await check('eth_estimateGas',()=>rpc('eth_estimateGas',[{from:TEST_ADDRESS,to:TEST_ADDRESS,value:'0x0'}])));
checks.push(await check('eth_getLogs',()=>rpc('eth_getLogs',[{fromBlock:'latest',toBlock:'latest'}])));
checks.push(await check('eth_sendRawTransaction capability',async()=>{try{await rpc('eth_sendRawTransaction',['0x']);throw Error('malformed transaction unexpectedly accepted')}catch(e){if(/Empty transaction data|Failed to decode transaction|-32602/i.test(e.message))return 'validation active';throw e}}));
if(checks.some(x=>!x))process.exit(1);
console.log('ZORYQ EVM compliance audit: PASS');
