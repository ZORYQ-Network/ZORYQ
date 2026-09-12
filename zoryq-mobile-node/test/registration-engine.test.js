import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { RegistrationEngine, nodeIdFromPublicKeyBase64, registrationSigningPayload } from '../src/registration-engine.js';

const SECRET='zoryq-registration-test-secret-32-bytes-minimum';
function identity(){
  const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const publicKeyBase64=publicKey.export({type:'spki',format:'der'}).toString('base64');
  return {publicKeyBase64,privateKey,nodeId:nodeIdFromPublicKeyBase64(publicKeyBase64)};
}
function signChallenge(engine,challenge,id){
  const payload=engine.inspectChallenge(challenge);
  return sign('sha256',Buffer.from(registrationSigningPayload(payload)),id.privateKey).toString('base64');
}

test('registers a node only when Node ID matches the signing public key',()=>{
  const id=identity(); const engine=new RegistrationEngine({secret:SECRET,now:()=>1000});
  const challenge=engine.issueChallenge({nodeId:id.nodeId});
  const record=engine.register({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64:signChallenge(engine,challenge,id)});
  assert.equal(record.nodeId,id.nodeId); assert.equal(record.chainId,5919065); assert.equal(record.protocolVersion,1);
});

test('rejects replayed registration challenge',()=>{
  const id=identity(); const engine=new RegistrationEngine({secret:SECRET,now:()=>1000});
  const challenge=engine.issueChallenge({nodeId:id.nodeId}); const signatureBase64=signChallenge(engine,challenge,id);
  engine.register({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64});
  assert.throws(()=>engine.register({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64}),/replay/i);
});

test('rejects expired registration challenge',()=>{
  let now=1000; const id=identity(); const engine=new RegistrationEngine({secret:SECRET,ttlMs:50,now:()=>now});
  const challenge=engine.issueChallenge({nodeId:id.nodeId}); const signatureBase64=signChallenge(engine,challenge,id); now=1051;
  assert.throws(()=>engine.register({challenge,nodeId:id.nodeId,publicKeyBase64:id.publicKeyBase64,signatureBase64}),/Expired/);
});

test('rejects another public key claiming the same Node ID',()=>{
  const owner=identity(); const attacker=identity(); const engine=new RegistrationEngine({secret:SECRET,now:()=>1000});
  const challenge=engine.issueChallenge({nodeId:owner.nodeId});
  assert.throws(()=>engine.register({challenge,nodeId:owner.nodeId,publicKeyBase64:attacker.publicKeyBase64,signatureBase64:signChallenge(engine,challenge,attacker)}),/does not match nodeId/);
});

test('rejects bad signature without consuming challenge',()=>{
  const owner=identity(); const attacker=identity(); const engine=new RegistrationEngine({secret:SECRET,now:()=>1000});
  const challenge=engine.issueChallenge({nodeId:owner.nodeId});
  assert.throws(()=>engine.register({challenge,nodeId:owner.nodeId,publicKeyBase64:owner.publicKeyBase64,signatureBase64:signChallenge(engine,challenge,attacker)}),/Invalid node registration signature/);
  const good=engine.register({challenge,nodeId:owner.nodeId,publicKeyBase64:owner.publicKeyBase64,signatureBase64:signChallenge(engine,challenge,owner)});
  assert.equal(good.nodeId,owner.nodeId);
});

test('rejects tampered server challenge',()=>{
  const id=identity(); const engine=new RegistrationEngine({secret:SECRET,now:()=>1000});
  const challenge=engine.issueChallenge({nodeId:id.nodeId}); const [body,sig]=challenge.split('.');
  assert.throws(()=>engine.inspectChallenge(`${body.slice(0,-1)}A.${sig}`),/(Invalid registration challenge signature|Malformed)/);
});
