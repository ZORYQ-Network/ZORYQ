const RPC='https://zoryq-evm-node-live-production.up.railway.app/rpc';
const BASE='https://zoryq-evm-node-live-production.up.railway.app';
const tx=process.argv[2];
if(!/^0x[0-9a-fA-F]{64}$/.test(tx||'')){
  console.error('Usage: node examples/proof-pack.mjs <txHash>');
  process.exit(1);
}
async function rpc(method,params=[]){
  const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const j=await r.json(); if(j.error) throw Error(j.error.message); return j.result;
}
const [chainId,receipt,maturity]=await Promise.all([
  rpc('eth_chainId'),
  rpc('eth_getTransactionReceipt',[tx]),
  fetch(BASE+'/network-maturity.json').then(r=>r.json())
]);
if(chainId!=='0x5a5159') throw Error('Unexpected chain ID: '+chainId);
if(!receipt) throw Error('Transaction receipt not found');
const address=receipt.contractAddress||receipt.to;
let code=null;
if(address) code=await rpc('eth_getCode',[address,'latest']);
const pack={
  schema:'zoryq-proof-pack/0.1',
  generatedAt:new Date().toISOString(),
  network:{name:'ZORYQ EVM Testnet',chainId:5919065,caip2:'eip155:5919065',rpc:RPC},
  transaction:{hash:tx,status:receipt.status,blockNumber:parseInt(receipt.blockNumber,16),from:receipt.from,to:receipt.to,contractAddress:receipt.contractAddress||null},
  evidence:{receiptVerified:true,successful:receipt.status==='0x1',targetCodePresent:!!code&&code!=='0x',logCount:(receipt.logs||[]).length,explorer:BASE+'/tx/'+tx},
  maturity:{stage:maturity?.network?.stage||null,decentralized:maturity?.consensus?.decentralized===true,mainnet:maturity?.network?.mainnet===true},
  disclaimer:'Testnet evidence only. This pack does not imply audit, decentralization, mainnet readiness or monetary value.'
};
console.log(JSON.stringify(pack,null,2));
