import fs from 'node:fs';
import path from 'node:path';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';

const RPC_URL=process.env.ZORYQ_RPC_URL||'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const MATURITY_URL=process.env.ZORYQ_MATURITY_URL||'https://zoryq-evm-node-live-production.up.railway.app/network-maturity.json';
const EXPECTED_CHAIN_ID=Number(process.env.ZORYQ_CHAIN_ID||5919065);
const EXPECTED_GENESIS_SHA=(process.env.ZORYQ_GENESIS_SHA256||'98cc8fd509be7822cd57c3999ee1c392d1f984580e145ee8b55db1092b80a5fd').toLowerCase();
const OPERATOR_ID=process.env.ZORYQ_WITNESS_OPERATOR_ID||'unclaimed-witness';
const REGION=process.env.ZORYQ_WITNESS_REGION||'unspecified';
const CONTROLLED_BY_CORE=String(process.env.ZORYQ_WITNESS_CORE_CONTROLLED||'true').toLowerCase()==='true';
const OUT=process.env.ZORYQ_WITNESS_EVIDENCE||'./zoryq-witness-evidence.json';
const KEY_FILE=process.env.ZORYQ_WITNESS_KEY_FILE||'./.zoryq-witness-ed25519.pem';

function canonicalJson(v){return JSON.stringify(v)}
function sha256(v){return createHash('sha256').update(v).digest('hex')}
function fail(message){throw new Error(message)}
async function getJson(url){const r=await fetch(url,{headers:{accept:'application/json'}});if(!r.ok)fail(`${url} -> HTTP ${r.status}`);return r.json()}
async function rpc(method,params=[]){const r=await fetch(RPC_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(!r.ok)fail(`rpc HTTP ${r.status}`);const j=await r.json();if(j.error)fail(`${method}: ${j.error.message||JSON.stringify(j.error)}`);return j.result}
function keyPair(){
  fs.mkdirSync(path.dirname(path.resolve(KEY_FILE)),{recursive:true});
  if(fs.existsSync(KEY_FILE)){
    const privateKey=createPrivateKey(fs.readFileSync(KEY_FILE));
    return {privateKey,publicKey:createPublicKey(privateKey)};
  }
  const kp=generateKeyPairSync('ed25519');
  fs.writeFileSync(KEY_FILE,kp.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
  return kp;
}

const maturity=await getJson(MATURITY_URL);
const published=maturity?.canonicalChainSpec;
if(!published?.public||!published.spec)fail('canonicalChainSpec missing from maturity endpoint');
if(Number(published.chainId)!==EXPECTED_CHAIN_ID)fail(`published chainId mismatch: ${published.chainId}`);
const computedGenesisSha=sha256(canonicalJson(published.spec));
if(computedGenesisSha!==String(published.sha256||'').toLowerCase())fail('published chain spec SHA-256 does not match its spec');
if(computedGenesisSha!==EXPECTED_GENESIS_SHA)fail(`unexpected canonical genesis SHA-256: ${computedGenesisSha}`);

const chainHex=await rpc('eth_chainId');
const chainId=Number(BigInt(chainHex));
if(chainId!==EXPECTED_CHAIN_ID)fail(`RPC chainId mismatch: ${chainId}`);
const headHex=await rpc('eth_blockNumber');
const headHeight=Number(BigInt(headHex));
const block=await rpc('eth_getBlockByNumber',[headHex,false]);
if(!block?.hash||Number(BigInt(block.number))!==headHeight)fail('head block verification failed');
const parentHeight=Math.max(0,headHeight-1);
const parent=await rpc('eth_getBlockByNumber',['0x'+parentHeight.toString(16),false]);
if(headHeight>0&&block.parentHash!==parent?.hash)fail('parent linkage verification failed');

const {privateKey,publicKey}=keyPair();
const publicKeyPem=publicKey.export({type:'spki',format:'pem'}).toString();
const observedAt=new Date().toISOString();
const evidence={
  schema:'zoryq-witness-evidence/1.0',
  evidenceClass:'LIVE_WITNESS_OBSERVATION',
  productionEvidence:false,
  operatorId:OPERATOR_ID,
  operatorControlledByCoreTeam:CONTROLLED_BY_CORE,
  independenceVerified:false,
  region:REGION,
  chainId,
  genesisSha256:computedGenesisSha,
  rpcUrl:RPC_URL,
  maturityUrl:MATURITY_URL,
  observedAt,
  headHeight,
  headHash:block.hash,
  parentHeight,
  parentHash:parent?.hash||null,
  witnessPublicKey:publicKeyPem,
  claimBoundary:CONTROLLED_BY_CORE
    ? 'Live witness evidence generated under core-team control; does not count as an independent operator.'
    : 'Operator declared external control. Independence still requires separate external verification before counting toward decentralization.'
};
const digest=sha256(canonicalJson(evidence));
const signature=sign(null,Buffer.from(digest,'utf8'),privateKey).toString('base64');
const bundle={...evidence,evidenceDigest:digest,signatureAlgorithm:'Ed25519',signature};
fs.writeFileSync(OUT,JSON.stringify(bundle,null,2)+'\n');
console.log(JSON.stringify({ok:true,out:OUT,chainId,genesisSha256:computedGenesisSha,headHeight,headHash:block.hash,operatorId:OPERATOR_ID,operatorControlledByCoreTeam:CONTROLLED_BY_CORE},null,2));
