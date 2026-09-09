import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {Wallet} from 'ethers';

const SOCIAL_PORT=19086, RPC_PORT=19090, CHAIN_ID=5919065;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zoryq-social-e2e-'));
const store=path.join(tmp,'events.ndjson'), media=path.join(tmp,'media');
const txCounts=new Map();
function rpcResult(method,params){
  if(method==='eth_chainId')return '0x5a5159';
  if(method==='eth_blockNumber')return '0x2a';
  if(method==='eth_getTransactionCount'){const a=String(params?.[0]||'').toLowerCase();return '0x'+(txCounts.get(a)||5).toString(16)}
  if(method==='eth_getBalance')return '0x56bc75e2d63100000';
  if(method==='net_version')return String(CHAIN_ID);
  throw Error(`unsupported mock RPC ${method}`);
}
function rpcResponse(x){try{return {jsonrpc:'2.0',id:x.id,result:rpcResult(x.method,x.params||[])}}catch(e){return {jsonrpc:'2.0',id:x.id,error:{code:-32601,message:e.message}}}}
const mock=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;let body;try{body=JSON.parse(raw||'{}')}catch{res.writeHead(400);return res.end()}const out=Array.isArray(body)?body.map(rpcResponse):rpcResponse(body);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(out))});
await new Promise((resolve,reject)=>mock.listen(RPC_PORT,'127.0.0.1',resolve).once('error',reject));

const child=spawn(process.execPath,['social-service.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(SOCIAL_PORT),ZORYQ_CHAIN_BASE:`http://127.0.0.1:${RPC_PORT}`,ZORYQ_SOCIAL_STORE:store,ZORYQ_SOCIAL_MEDIA_DIR:media,ZORYQ_SOCIAL_ANCHOR:'false'},stdio:['ignore','pipe','pipe']});
let childLog='';child.stdout.on('data',c=>childLog+=c);child.stderr.on('data',c=>childLog+=c);
const BASE=`http://127.0.0.1:${SOCIAL_PORT}`;
async function api(route,opt={}){const r=await fetch(BASE+route,{...opt,headers:{'content-type':'application/json',...(opt.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${route} HTTP ${r.status} ${JSON.stringify(j)}`);return j}
async function waitReady(){for(let i=0;i<60;i++){try{const j=await api('/status');if(j.ok)return j}catch{}await new Promise(r=>setTimeout(r,100))}throw Error(`social did not become ready\n${childLog}`)}
async function commit(wallet,action,payload){const c=await api('/challenge',{method:'POST',body:JSON.stringify({address:wallet.address,action,payload})});const signature=await wallet.signMessage(c.message);return api('/commit',{method:'POST',body:JSON.stringify({challengeId:c.challengeId,signature})})}
function assert(ok,msg){if(!ok)throw Error(`ASSERT: ${msg}`)}
const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2SIAAAAASUVORK5CYII=';
let failure=null;
try{
  const status=await waitReady();assert(status.chainId===CHAIN_ID,'chain id');assert(status.features.includes('xp-ranking'),'xp feature');
  const alpha=Wallet.createRandom(),beta=Wallet.createRandom();txCounts.set(alpha.address.toLowerCase(),12);txCounts.set(beta.address.toLowerCase(),7);
  const pa=await commit(alpha,'profile',{username:'alpha_creator',displayName:'Alpha Creator',bio:'Creator on ZORYQ',avatarData:avatar,location:'Web3',website:'https://example.com',category:'creator',acceptsPayments:true});
  const pb=await commit(beta,'profile',{username:'beta_builder',displayName:'Beta Builder',bio:'Builder',category:'builder',acceptsPayments:true});
  assert(pa.profile.avatarUrl.startsWith('/api/social/media/avatar/'),'avatar URL');assert(pb.profile.username==='beta_builder','second profile');
  const av=await fetch(BASE+pa.profile.avatarUrl.replace('/api/social',''));assert(av.ok,'avatar served');assert((av.headers.get('content-type')||'').startsWith('image/png'),'avatar mime');
  const community=await commit(alpha,'community_create',{name:'ZORYQ Builders',slug:'zoryq-builders',description:'Build useful things',tokenAddress:''});
  assert(community.community.members===1,'creator auto joins community');
  const joined=await commit(beta,'community_join',{communityId:community.community.id});assert(joined.active===true&&joined.community.members===2,'community join');
  const post=await commit(alpha,'post',{text:'First creator post',mediaUrl:'',replyTo:null,communityId:community.community.id});
  assert(post.post.text==='First creator post','post created');
  await commit(beta,'like',{postId:post.post.id});await commit(beta,'repost',{postId:post.post.id});await commit(beta,'bookmark',{postId:post.post.id});await commit(beta,'follow',{target:alpha.address});
  const reply=await commit(beta,'post',{text:'Reply from builder',replyTo:post.post.id,communityId:community.community.id});assert(reply.post.replyTo===post.post.id,'reply created');
  const feed=await api(`/feed?viewer=${beta.address}&communityId=${community.community.id}`);const original=feed.posts.find(x=>x.id===post.post.id);assert(original?.likes===1,'like count');assert(original?.reposts===1,'repost count');assert(original?.replies===1,'reply count');assert(original?.liked&&original?.reposted&&original?.saved,'viewer reactions');
  const saved=await api(`/bookmarks?viewer=${beta.address}`);assert(saved.posts.some(x=>x.id===post.post.id),'bookmark query');
  const prof=await api(`/profile?address=${alpha.address}&viewer=${beta.address}`);assert(prof.profile.followers===1,'follower count');assert(prof.profile.viewerFollowing===true,'viewer follow');assert(prof.reputation.pendingXp>0,'reputation');assert(prof.reputation.airdrop.guaranteed===false,'no guaranteed airdrop');
  const rank=await api('/ranking?limit=10');assert(rank.rows.length===2,'ranking rows');assert(rank.rows[0].pendingXp>=rank.rows[1].pendingXp,'ranking order');assert(rank.kind==='pending-testnet-xp','pending rank kind');
  const communities=await api(`/communities?viewer=${beta.address}`);assert(communities.communities[0].viewerJoined===true,'community membership visible');
  const usernameLookup=await api(`/profile?username=alpha_creator&viewer=${beta.address}`);assert(usernameLookup.profile.address.toLowerCase()===alpha.address.toLowerCase(),'username lookup');
  console.log(JSON.stringify({ok:true,profiles:2,posts:2,communities:1,ranking:rank.rows.map(r=>({rank:r.rank,user:r.profile.username,xp:r.pendingXp})),alphaXp:prof.reputation.pendingXp},null,2));
}catch(e){failure=e;console.error(e.stack||e)}finally{child.kill('SIGTERM');mock.close();try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}}
if(failure)process.exit(1);
