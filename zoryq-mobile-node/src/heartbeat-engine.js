import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from 'node:crypto';
import { MOBILE_NODE_CHAIN_ID, MOBILE_NODE_PROTOCOL_VERSION, nodeIdFromPublicKeyBase64 } from './registration-engine.js';
import { MemoryHeartbeatStore, heartbeatRecord } from './heartbeat-store.js';

const DEFAULT_TTL_MS = 90_000;
function encode(value){return Buffer.from(JSON.stringify(value)).toString('base64url');}
function decode(value){return JSON.parse(Buffer.from(value,'base64url').toString('utf8'));}
function mac(secret,body){return createHmac('sha256',secret).update(body).digest('base64url');}
function equal(a,b){const l=Buffer.from(a);const r=Buffer.from(b);return l.length===r.length&&timingSafeEqual(l,r);}

export function heartbeatSigningPayload(payload,{blockSeen,clientTime}){
  return [
    'zoryq-node-heartbeat-v1',payload.v,payload.chainId,payload.nodeId,payload.nonce,
    payload.issuedAt,payload.expiresAt,Number.isInteger(blockSeen)?blockSeen:-1,clientTime
  ].join('|');
}

export class HeartbeatEngine {
  constructor({secret,ttlMs=DEFAULT_TTL_MS,now=()=>Date.now(),maxClockSkewMs=120_000,store=new MemoryHeartbeatStore()}={}){
    if(!secret||String(secret).length<32)throw new Error('HeartbeatEngine requires a server secret');
    if(!store||typeof store.hasNonce!=='function'||typeof store.append!=='function')throw new Error('HeartbeatEngine requires durable-capable heartbeat store');
    this.secret=String(secret);this.ttlMs=ttlMs;this.now=now;this.maxClockSkewMs=maxClockSkewMs;this.store=store;
  }
  issueChallenge(nodeId){
    if(!/^[0-9a-f]{64}$/.test(nodeId||''))throw new Error('Invalid nodeId');
    const issuedAt=this.now();const p={v:MOBILE_NODE_PROTOCOL_VERSION,chainId:MOBILE_NODE_CHAIN_ID,nodeId,nonce:randomBytes(24).toString('hex'),issuedAt,expiresAt:issuedAt+this.ttlMs};
    const body=encode(p);return `${body}.${mac(this.secret,body)}`;
  }
  inspect(token){
    const parts=String(token||'').split('.');if(parts.length!==2)throw new Error('Malformed heartbeat challenge');
    const [body,sig]=parts;if(!equal(sig,mac(this.secret,body)))throw new Error('Invalid heartbeat challenge signature');
    const p=decode(body);if(p.v!==MOBILE_NODE_PROTOCOL_VERSION)throw new Error('Unsupported protocol version');
    if(p.chainId!==MOBILE_NODE_CHAIN_ID)throw new Error('Wrong chain');
    if(!Number.isFinite(p.issuedAt)||!Number.isFinite(p.expiresAt)||p.expiresAt<=p.issuedAt)throw new Error('Invalid heartbeat time window');
    if(this.now()>p.expiresAt)throw new Error('Expired heartbeat challenge');
    return p;
  }
  verify({challenge,nodeId,publicKeyBase64,signatureBase64,blockSeen=-1,clientTime}){
    const p=this.inspect(challenge);if(p.nodeId!==nodeId)throw new Error('Heartbeat node mismatch');
    if(this.store.hasNonce(p.nonce))throw new Error('Heartbeat replay rejected');
    if(nodeIdFromPublicKeyBase64(publicKeyBase64)!==nodeId)throw new Error('Heartbeat public key mismatch');
    if(!Number.isFinite(clientTime)||Math.abs(this.now()-clientTime)>this.maxClockSkewMs)throw new Error('Heartbeat clock drift');
    if(!Number.isInteger(blockSeen)||blockSeen<0)throw new Error('Invalid heartbeat block');
    const key=createPublicKey({key:Buffer.from(publicKeyBase64,'base64'),format:'der',type:'spki'});
    const ok=verifySignature('sha256',Buffer.from(heartbeatSigningPayload(p,{blockSeen,clientTime})),key,Buffer.from(signatureBase64,'base64'));
    if(!ok)throw new Error('Invalid heartbeat signature');
    const acceptedAt=new Date(this.now()).toISOString();
    if(!this.store.append(heartbeatRecord({nonce:p.nonce,nodeId,blockSeen,acceptedAt})))throw new Error('Heartbeat replay rejected');
    return Object.freeze({accepted:true,nodeId,blockSeen,protocolVersion:MOBILE_NODE_PROTOCOL_VERSION,verifiedAt:acceptedAt,xpAwarded:0});
  }
}
