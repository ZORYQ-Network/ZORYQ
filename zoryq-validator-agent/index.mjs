import fs from 'node:fs';
import {createHmac} from 'node:crypto';

const DEFAULT_BASE=process.env.ZORYQ_BASE||'https://zoryq-evm-node-v4-production.up.railway.app';
const CONFIG_FILE=process.env.ZORYQ_NODE_CONFIG||'zoryq-node.json';
const INTERVAL_MS=Math.max(60000,Number(process.env.ZORYQ_HEARTBEAT_MS||60000));

function loadConfig(){
  let file={};try{file=JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8'))}catch{}
  const nodeId=process.env.ZORYQ_NODE_ID||file.nodeId;
  const secret=process.env.ZORYQ_NODE_SECRET||file.secret;
  const base=process.env.ZORYQ_BASE||file.base||DEFAULT_BASE;
  if(!nodeId||!secret){console.error('\nZORYQ Validator Agent is not paired.\n1. Open the ZORYQ Run a Node page.\n2. Connect your operator wallet and register a node.\n3. Save the generated nodeId and secret in zoryq-node.json.\n');process.exit(2)}
  return {nodeId,secret,base:String(base).replace(/\/$/,'')};
}
const cfg=loadConfig();
async function rpc(method,params=[]){const r=await fetch(cfg.base+'/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(!r.ok)throw Error('RPC HTTP '+r.status);const j=await r.json();if(j.error)throw Error(j.error.message||'RPC error');return j.result}
async function heartbeat(){const hex=await rpc('eth_blockNumber');const block=parseInt(hex,16);const timestamp=Date.now();const mac=createHmac('sha256',cfg.secret).update(`${cfg.nodeId}:${timestamp}:${block}`).digest('hex');const r=await fetch(cfg.base+'/validator/heartbeat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId:cfg.nodeId,timestamp,block,mac})});const j=await r.json();if(!r.ok)throw Error(j.error||'heartbeat_failed');console.log(`[${new Date().toISOString()}] healthy=${j.healthy} block=${block} heartbeats=${j.heartbeatCount} pending≈${j.pendingValidatorPointsEstimate} XP`)}
async function main(){console.log('ZORYQ Validator Agent');console.log('Node ID:',cfg.nodeId);console.log('Endpoint:',cfg.base);console.log('Wallet private key: NOT REQUIRED');for(;;){try{await heartbeat()}catch(e){console.error(`[${new Date().toISOString()}] ${e.message}`)}await new Promise(r=>setTimeout(r,INTERVAL_MS))}}
main();
