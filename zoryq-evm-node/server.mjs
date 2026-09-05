import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { JsonRpcProvider, Wallet, getAddress, parseEther } from 'ethers';

const PORT=Number(process.env.PORT||8080);
const RPC_PORT=8545;
const CHAIN_ID=5919065;
const CHAIN_HEX='0x5a5159';
const PRIVATE_KEY=(process.env.ZORYQ_TESTNET_PRIVATE_KEY||'').replace(/^0x/,'');
const STATE=process.env.ZORYQ_STATE_PATH||'/data/zoryq-state.json';
const GENESIS=process.env.ZORYQ_GENESIS_PATH||'/data/genesis.json';
const FAUCET_FILE=process.env.ZORYQ_FAUCET_STATE||'/data/faucet.json';
const FAUCET_AMOUNT=process.env.ZORYQ_FAUCET_AMOUNT||'100';
const BLOCKED_PREFIXES=['anvil_','hardhat_','evm_','debug_'];

if(!/^[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)){console.error('ZORYQ_TESTNET_PRIVATE_KEY is required. Refusing to start without a private faucet key.');process.exit(1)}
fs.mkdirSync('/data',{recursive:true});
const faucetOffline=new Wallet('0x'+PRIVATE_KEY);
if(!fs.existsSync(GENESIS)){
 const genesis={config:{chainId:CHAIN_ID,homesteadBlock:0,eip150Block:0,eip155Block:0,eip158Block:0,byzantiumBlock:0,constantinopleBlock:0,petersburgBlock:0,istanbulBlock:0,berlinBlock:0,londonBlock:0},nonce:'0x0',timestamp:'0x0',extraData:'0x',gasLimit:'0x1c9c380',difficulty:'0x0',mixHash:'0x'+'00'.repeat(32),coinbase:'0x'+'00'.repeat(20),alloc:{[faucetOffline.address]:{balance:'0x'+parseEther('1000000000').toString(16)}}};
 fs.writeFileSync(GENESIS,JSON.stringify(genesis,null,2));
}
const args=['--host','127.0.0.1','--port',String(RPC_PORT),'--chain-id',String(CHAIN_ID),'--block-time','2','--init',GENESIS,'--state',STATE,'--state-interval','5','--preserve-historical-states'];
const anvil=spawn('anvil',args,{stdio:['ignore','pipe','pipe']});
anvil.stdout.on('data',d=>process.stdout.write('[anvil] '+d));anvil.stderr.on('data',d=>process.stderr.write('[anvil] '+d));anvil.on('exit',c=>{console.error('Anvil exited',c);process.exit(c||1)});
process.on('SIGTERM',()=>anvil.kill('SIGTERM'));process.on('SIGINT',()=>anvil.kill('SIGINT'));

const localRpc='http://127.0.0.1:'+RPC_PORT;
let provider;let faucetWallet;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<120;i++){try{const r=await fetch(localRpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});const j=await r.json();if(j.result===CHAIN_HEX){provider=new JsonRpcProvider(localRpc,CHAIN_ID,{staticNetwork:true});faucetWallet=new Wallet('0x'+PRIVATE_KEY,provider);return}}catch{}await sleep(500)}throw Error('EVM node did not become ready')}
const nodeReady=ready();
function cors(res){res.setHeader('access-control-allow-origin','*');res.setHeader('access-control-allow-headers','content-type');res.setHeader('access-control-allow-methods','GET,POST,OPTIONS')}
function send(res,status,obj){cors(res);res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj))}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>2_000_000)throw Error('request too large')}return s?JSON.parse(s):{}}
function blocked(q){return !!q&&typeof q.method==='string'&&BLOCKED_PREFIXES.some(p=>q.method.startsWith(p))}
function loadFaucet(){try{return JSON.parse(fs.readFileSync(FAUCET_FILE,'utf8'))}catch{return {}}}
function saveFaucet(x){fs.writeFileSync(FAUCET_FILE,JSON.stringify(x,null,2))}

const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS'){cors(res);res.writeHead(204);return res.end()}await nodeReady;const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/health'){const block=await provider.getBlockNumber();return send(res,200,{ok:true,name:'ZORYQ EVM Testnet',chainId:CHAIN_ID,chainIdHex:CHAIN_HEX,symbol:'ZQ',block,evm:true,contracts:true,erc20:true,erc721:true,rpc:true,faucet:faucetOffline.address})}
 if(req.method==='GET'&&url.pathname==='/network'){return send(res,200,{chainName:'ZORYQ EVM Testnet',chainId:CHAIN_HEX,nativeCurrency:{name:'ZORYQ',symbol:'ZQ',decimals:18},rpcUrls:[process.env.PUBLIC_RPC_URL||'SET_PUBLIC_RPC_URL'],blockExplorerUrls:[process.env.PUBLIC_EXPLORER_URL||'https://zoryq-testnet.vercel.app/explorer.html']})}
 if(req.method==='POST'&&url.pathname==='/faucet'){const b=await body(req);let address;try{address=getAddress(String(b.address||''))}catch{return send(res,400,{ok:false,error:'invalid_address'})}const f=loadFaucet(),k=address.toLowerCase(),last=Number(f[k]||0),now=Date.now();if(now-last<86400000)return send(res,429,{ok:false,error:'cooldown',nextClaim:new Date(last+86400000).toISOString()});const tx=await faucetWallet.sendTransaction({to:address,value:parseEther(FAUCET_AMOUNT)});const receipt=await tx.wait();f[k]=now;saveFaucet(f);return send(res,200,{ok:true,address,amount:FAUCET_AMOUNT,symbol:'ZQ',txHash:tx.hash,blockNumber:receipt.blockNumber})}
 if(req.method==='POST'&&(url.pathname==='/'||url.pathname==='/rpc')){const raw=await body(req);const qs=Array.isArray(raw)?raw:[raw];if(qs.some(blocked)){const one={jsonrpc:'2.0',id:raw?.id??null,error:{code:-32601,message:'Administrative RPC method disabled on public ZORYQ endpoint'}};return send(res,200,Array.isArray(raw)?qs.map(q=>blocked(q)?{...one,id:q.id}:null).filter(Boolean):one)}const upstream=await fetch(localRpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(raw)});const txt=await upstream.text();cors(res);res.writeHead(upstream.status,{'content-type':'application/json; charset=utf-8'});return res.end(txt)}
 return send(res,404,{ok:false,error:'not_found'});
 }catch(e){console.error(e);return send(res,500,{ok:false,error:e?.message||'internal_error'})}});
server.listen(PORT,'0.0.0.0',()=>console.log(`ZORYQ EVM gateway listening on :${PORT}`));
