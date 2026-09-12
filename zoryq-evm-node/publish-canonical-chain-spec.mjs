import fs from 'node:fs';
import { createHash } from 'node:crypto';

const CHAIN_SPEC=process.env.ZORYQ_RETH_CHAIN_SPEC||'/data/zoryq-reth-effective-genesis.json';
const MATURITY='/app/web/network-maturity.json';

function fail(message){console.error(`[zoryq-network] ${message}`);process.exit(1)}
if(!fs.existsSync(CHAIN_SPEC))fail(`canonical chain spec missing: ${CHAIN_SPEC}`);
if(!fs.existsSync(MATURITY))fail(`network maturity artifact missing: ${MATURITY}`);

const raw=fs.readFileSync(CHAIN_SPEC,'utf8');
let chainSpec;
try{chainSpec=JSON.parse(raw)}catch{fail('canonical chain spec is not valid JSON')}
if(Number(chainSpec?.config?.chainId)!==5919065)fail('canonical chain spec chainId mismatch');

let maturity;
try{maturity=JSON.parse(fs.readFileSync(MATURITY,'utf8'))}catch{fail('network maturity artifact is not valid JSON')}

const canonical=JSON.stringify(chainSpec);
const sha256=createHash('sha256').update(canonical).digest('hex');
const publishedAt=new Date().toISOString();

const next={
  ...maturity,
  canonicalChainSpec:{
    public:true,
    chainId:5919065,
    sha256,
    generatedFrom:'persisted-reth-effective-genesis',
    publishedAt,
    claimBoundary:'Public non-secret chain configuration for reproducible Node 2 setup. Contains no mnemonic, private key, discovery secret, provider credential or infrastructure credential.',
    spec:chainSpec
  }
};

const tmp=`${MATURITY}.tmp-${process.pid}`;
fs.writeFileSync(tmp,JSON.stringify(next,null,2)+'\n',{encoding:'utf8',mode:0o644});
fs.renameSync(tmp,MATURITY);
console.log(`[zoryq-network] canonical chain spec published sha256=${sha256}`);
