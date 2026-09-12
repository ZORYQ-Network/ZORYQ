import { Contract, JsonRpcProvider, Wallet, id, keccak256, toUtf8Bytes } from 'ethers';

const BASE=process.env.ZORYQ_FACTORY_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const RPC=BASE+'/rpc';
const CHAIN_ID=5919065;
const ABI=['function set(uint256 newValue)','function value() view returns(uint256)'];
const provider=new JsonRpcProvider(RPC,CHAIN_ID,{staticNetwork:true});
const wallet=Wallet.createRandom().connect(provider);
const snapshot={appId:'factory-live-proof',version:2,counts:{residents:1,packages:1,vehicles:0}};
const snapshotHash=keccak256(toUtf8Bytes(JSON.stringify(snapshot)));

function selectors(){return{set:id('set(uint256)').slice(2,10),value:id('value()').slice(2,10)}}
function creationBytecode(){const s=selectors(),runtime='60003560e01c8063'+s.set+'14601f578063'+s.value+'14602b5760006000fd5b60043560005560006000f35b60005460005260206000f3';return'0x6037600c60003960376000f3'+runtime}
async function fail(msg){throw new Error(msg)}

const chainId=Number((await provider.getNetwork()).chainId);
if(chainId!==CHAIN_ID)await fail(`chain id mismatch ${chainId}`);
const faucetRes=await fetch(BASE+'/faucet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:wallet.address})});
const faucet=await faucetRes.json();
if(!faucetRes.ok)await fail(`faucet ${faucetRes.status}: ${JSON.stringify(faucet).slice(0,240)}`);
let balance=await provider.getBalance(wallet.address);
for(let i=0;i<20&&balance===0n;i++){await new Promise(r=>setTimeout(r,750));balance=await provider.getBalance(wallet.address)}
if(balance===0n)await fail('wallet was not funded');

const deployTx=await wallet.sendTransaction({data:creationBytecode()});
const deployReceipt=await deployTx.wait();
if(!deployReceipt||deployReceipt.status!==1||!deployReceipt.contractAddress)await fail('proof contract deployment failed');
const contract=new Contract(deployReceipt.contractAddress,ABI,wallet);
const writeTx=await contract.set(BigInt(snapshotHash));
const writeReceipt=await writeTx.wait();
if(!writeReceipt||writeReceipt.status!==1)await fail('snapshot write failed');
const read=await contract.value();
const onchain='0x'+BigInt(read).toString(16).padStart(64,'0');
if(onchain.toLowerCase()!==snapshotHash.toLowerCase())await fail('snapshot readback mismatch');

const evidence={
  schema:'zoryq-factory-onchain-proof/0.2',
  generatedAt:new Date().toISOString(),
  network:{name:'ZORYQ Testnet',chainId},
  freshWallet:wallet.address,
  faucet:{ok:true,txHash:faucet.txHash||null,amount:faucet.amount||null,symbol:faucet.symbol||'ZQ'},
  proofContract:{address:deployReceipt.contractAddress,deploymentTx:deployTx.hash,deploymentBlock:deployReceipt.blockNumber},
  snapshot,
  snapshotHash,
  write:{txHash:writeTx.hash,blockNumber:writeReceipt.blockNumber,status:writeReceipt.status},
  readback:{value:onchain,matches:true},
  claimBoundary:'Project-controlled GitHub runner using a fresh ephemeral Testnet wallet. Proves the fixed optional Factory snapshot-proof path is publicly reproducible; not audited arbitrary generated-contract execution and not independent human adoption.'
};
console.log(JSON.stringify(evidence,null,2));
