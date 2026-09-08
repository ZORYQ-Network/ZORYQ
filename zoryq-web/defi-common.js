const ZORYQ={base:'https://zoryq-evm-node-live-production.up.railway.app',rpc:'https://zoryq-evm-node-live-production.up.railway.app/rpc',explorer:'https://zoryq-evm-node-live-production.up.railway.app',chainId:5919065,chainHex:'0x5a5159',native:{name:'ZORYQ',symbol:'ZQ',decimals:18},contracts:{swap:'0x8205F34B803eDd79DDCA414F00e12eCdDEdDacbE',stake:'0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1',zusd:'0xd2121E96C6af936c0496fDB499c1D0613d26c2B9',lending:null}};
let zSigner=null,zAccount=null;
const zProvider=new ethers.JsonRpcProvider(ZORYQ.rpc,ZORYQ.chainId,{staticNetwork:true});
async function zAddNetwork(){if(!window.ethereum)throw Error('Install MetaMask, Rabby or another EVM wallet');await ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:ZORYQ.chainHex,chainName:'ZORYQ EVM Testnet',nativeCurrency:ZORYQ.native,rpcUrls:[ZORYQ.rpc],blockExplorerUrls:[ZORYQ.explorer]}]})}
async function zEnsureNetwork(){if(!window.ethereum)throw Error('No EVM wallet detected');const id=await ethereum.request({method:'eth_chainId'});if(id!==ZORYQ.chainHex){try{await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:ZORYQ.chainHex}]})}catch(e){if(e.code===4902)await zAddNetwork();else throw e}}}
async function zConnect(){await zEnsureNetwork();const p=new ethers.BrowserProvider(ethereum);await p.send('eth_requestAccounts',[]);zSigner=await p.getSigner();zAccount=await zSigner.getAddress();return zAccount}
function zTxLink(hash){return `${ZORYQ.explorer}/tx/${hash}`}
function zAddrLink(addr){return `${ZORYQ.explorer}/address/${addr}`}
function zShort(v){return v?`${v.slice(0,7)}…${v.slice(-5)}`:'—'}
async function zWait(tx,onState){onState?.('pending',tx.hash);const receipt=await tx.wait();if(!receipt||receipt.status!==1)throw Error('Transaction failed');onState?.('confirmed',tx.hash);return receipt}
async function zGenesis(action,hash){if(!zAccount)return;try{await fetch(`${ZORYQ.base}/genesis/action`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:zAccount,action,txHash:hash})})}catch{}}
function zMoney(v,d=4){try{return Number(ethers.formatEther(v)).toLocaleString(undefined,{maximumFractionDigits:d})}catch{return '—'}}
