import fs from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';

const FILE=process.argv[2]||process.env.ZORYQ_WITNESS_EVIDENCE||'./zoryq-witness-evidence.json';
const EXPECTED_CHAIN_ID=Number(process.env.ZORYQ_CHAIN_ID||5919065);
const EXPECTED_GENESIS_SHA=(process.env.ZORYQ_GENESIS_SHA256||'98cc8fd509be7822cd57c3999ee1c392d1f984580e145ee8b55db1092b80a5fd').toLowerCase();
const MAX_AGE_MS=Number(process.env.ZORYQ_WITNESS_MAX_AGE_MS||15*60*1000);

function fail(message){console.error(JSON.stringify({ok:false,error:message},null,2));process.exit(1)}
function sha256(v){return createHash('sha256').update(v).digest('hex')}
if(!fs.existsSync(FILE))fail(`evidence file not found: ${FILE}`);
let b;try{b=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch{fail('invalid evidence JSON')}
if(b.schema!=='zoryq-witness-evidence/1.0')fail('unsupported schema');
if(Number(b.chainId)!==EXPECTED_CHAIN_ID)fail('chainId mismatch');
if(String(b.genesisSha256||'').toLowerCase()!==EXPECTED_GENESIS_SHA)fail('genesis SHA-256 mismatch');
if(!Number.isInteger(b.headHeight)||b.headHeight<0)fail('invalid headHeight');
if(!/^0x[0-9a-fA-F]{64}$/.test(String(b.headHash||'')))fail('invalid headHash');
if(!/^0x[0-9a-fA-F]{64}$/.test(String(b.parentHash||''))&&b.parentHeight>0)fail('invalid parentHash');
const observed=Date.parse(b.observedAt);if(!Number.isFinite(observed))fail('invalid observedAt');
if(Math.abs(Date.now()-observed)>MAX_AGE_MS)fail('stale witness evidence');
const {evidenceDigest,signature,signatureAlgorithm,...evidence}=b;
if(signatureAlgorithm!=='Ed25519')fail('unexpected signature algorithm');
const digest=sha256(JSON.stringify(evidence));
if(digest!==evidenceDigest)fail('evidence digest mismatch');
let key;try{key=createPublicKey(b.witnessPublicKey)}catch{fail('invalid witness public key')}
let sig;try{sig=Buffer.from(signature,'base64')}catch{fail('invalid signature encoding')}
if(!verify(null,Buffer.from(digest,'utf8'),key,sig))fail('signature verification failed');
const countsAsIndependent=b.operatorControlledByCoreTeam===false&&b.independenceVerified===true;
console.log(JSON.stringify({ok:true,verifiedSignature:true,chainId:b.chainId,genesisSha256:b.genesisSha256,headHeight:b.headHeight,headHash:b.headHash,operatorId:b.operatorId,countsAsIndependent,claim:countsAsIndependent?'INDEPENDENT_WITNESS_EVIDENCE':'WITNESS_EVIDENCE_ONLY'},null,2));
