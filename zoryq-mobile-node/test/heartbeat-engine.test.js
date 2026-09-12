import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { HeartbeatEngine, heartbeatSigningPayload } from '../src/heartbeat-engine.js';
import { FileHeartbeatStore } from '../src/heartbeat-store.js';
import { nodeIdFromPublicKeyBase64 } from '../src/registration-engine.js';

const SECRET='zoryq-heartbeat-test-secret-32-bytes-minimum';
function identity(){const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const publicKeyBase64=publicKey.export({type:'spki',format:'der'}).toString('base64');return {publicKeyBase64,privateKey,nodeId:nodeIdFromPublicKeyBase64(publicKeyBase64)};}
function signed(engine,challenge,id,blockSeen,clientTime){const p=engine.inspect(challenge);return sign('sha256',Buffer.from(heartbeatSigningPayload(p,{blockSeen,clientTime})),id.privateKey).toString('base64');}

test('valid signed heartbeat is accepted and always awards zero XP',()=>{
  const id=identity(); const engine=new HeartbeatEngine({secret:SECRET,now:()=>1000}); const challenge=engine.issueChallenge(id.nodeId);
  const result=engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64:signed(engine,challenge,id,4242,1000),blockSeen:4242,clientTime:1000});
  assert.equal(result.accepted,true); assert.equal(result.xpAwarded,0);
});

test('heartbeat replay is rejected and cannot farm XP',()=>{
  const id=identity(); const engine=new HeartbeatEngine({secret:SECRET,now:()=>1000}); const challenge=engine.issueChallenge(id.nodeId); const signatureBase64=signed(engine,challenge,id,4242,1000);
  engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64,blockSeen:4242,clientTime:1000});
  assert.throws(()=>engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64,blockSeen:4242,clientTime:1000}),/replay/i);
});

test('heartbeat replay remains rejected after server restart',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zoryq-heartbeat-')); const file=path.join(dir,'heartbeats.jsonl');
  try {
    const id=identity(); const first=new HeartbeatEngine({secret:SECRET,now:()=>1000,store:new FileHeartbeatStore(file)}); const challenge=first.issueChallenge(id.nodeId); const signatureBase64=signed(first,challenge,id,4242,1000);
    first.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64,blockSeen:4242,clientTime:1000});
    const restarted=new HeartbeatEngine({secret:SECRET,now:()=>1000,store:new FileHeartbeatStore(file)});
    assert.throws(()=>restarted.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64,blockSeen:4242,clientTime:1000}),/replay/i);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('corrupt heartbeat store fails closed',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zoryq-heartbeat-corrupt-')); const file=path.join(dir,'heartbeats.jsonl');
  try { fs.writeFileSync(file,'not-json\n'); assert.throws(()=>new FileHeartbeatStore(file),/Corrupt heartbeat store/); }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('bad heartbeat signature earns nothing',()=>{
  const id=identity(), attacker=identity(); const engine=new HeartbeatEngine({secret:SECRET,now:()=>1000}); const challenge=engine.issueChallenge(id.nodeId);
  assert.throws(()=>engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64:signed(engine,challenge,attacker,4242,1000),blockSeen:4242,clientTime:1000}),/Invalid heartbeat signature/);
});

test('expired heartbeat challenge is rejected',()=>{
  let now=1000; const id=identity(); const engine=new HeartbeatEngine({secret:SECRET,ttlMs:50,now:()=>now}); const challenge=engine.issueChallenge(id.nodeId); const signatureBase64=signed(engine,challenge,id,4242,1000); now=1051;
  assert.throws(()=>engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64,blockSeen:4242,clientTime:1000}),/Expired/);
});

test('clock drift is rejected',()=>{
  const id=identity(); const engine=new HeartbeatEngine({secret:SECRET,now:()=>200000,maxClockSkewMs:1000}); const challenge=engine.issueChallenge(id.nodeId);
  assert.throws(()=>engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64:signed(engine,challenge,id,4242,1000),blockSeen:4242,clientTime:1000}),/clock drift/i);
});

test('heartbeat from another key claiming the Node ID is rejected',()=>{
  const id=identity(), attacker=identity(); const engine=new HeartbeatEngine({secret:SECRET,now:()=>1000}); const challenge=engine.issueChallenge(id.nodeId);
  assert.throws(()=>engine.verify({challenge,nodeId:id.nodeId,publicKeyBase64:attacker.publicKeyBase64,signatureBase64:signed(engine,challenge,attacker,4242,1000),blockSeen:4242,clientTime:1000}),/public key mismatch/i);
});
