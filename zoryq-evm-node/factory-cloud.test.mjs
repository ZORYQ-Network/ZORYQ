import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zoryq-factory-cloud-'));
process.env.ZORYQ_FACTORY_CLOUD_STATE=path.join(dir,'state.json');
process.env.ZORYQ_FACTORY_CLOUD_BACKUP=path.join(dir,'backup.json');
process.env.ZORYQ_FACTORY_CLOUD_JOURNAL=path.join(dir,'journal.ndjson');
process.env.ZORYQ_FACTORY_CLOUD_SECRET_FILE=path.join(dir,'secret');
const {handleFactoryCloud}=await import(`./factory-cloud.mjs?test=${Date.now()}`);

function req(method,url,body={},token=''){return {method,url,headers:{...(token?{authorization:`Bearer ${token}`}:{})},_body:body};}
async function call(method,url,body={},token=''){
 let result=null;
 const response={writeHead(){},end(){}};
 const send=(_res,status,obj)=>{result={status,obj};};
 const bodyReader=async r=>r._body||{};
 const handled=await handleFactoryCloud(req(method,url,body,token),response,{body:bodyReader,send});
 assert.equal(handled,true);return result;
}
const spec={v:3,version:1,id:'test-app',name:'Test App',modules:[{id:'records',label:'Registros',fields:[{id:'title',label:'Título',type:'text'}]}],cloud:true};

test('cloud v2 creates app, logs in and publishes hardened status',async()=>{
 const status=await call('GET','/factory/cloud/status');assert.equal(status.status,200);assert.equal(status.obj.schema,2);assert.match(status.obj.persistence,/backup/);
 const created=await call('POST','/factory/cloud/apps',{spec,ownerEmail:'owner@example.test',ownerPassword:'longpass123',provenance:'ci-test'});assert.equal(created.status,201);assert.equal(created.obj.app.revision,1);globalThis.ownerToken=created.obj.token;
 const login=await call('POST','/factory/cloud/login',{appId:'test-app',email:'owner@example.test',password:'longpass123'});assert.equal(login.status,200);assert.equal(login.obj.user.role,'owner');globalThis.ownerToken=login.obj.token;
});

test('optimistic revision prevents lost updates',async()=>{
 const first=await call('POST','/factory/cloud/apps/test-app/records/records',{revision:1,record:{title:'A'}},globalThis.ownerToken);assert.equal(first.status,201);assert.equal(first.obj.revision,2);
 const conflict=await call('POST','/factory/cloud/apps/test-app/records/records',{revision:1,record:{title:'stale'}},globalThis.ownerToken);assert.equal(conflict.status,409);assert.equal(conflict.obj.error,'revision_conflict');
 const second=await call('POST','/factory/cloud/apps/test-app/records/records',{revision:2,record:{title:'B'}},globalThis.ownerToken);assert.equal(second.status,201);assert.equal(second.obj.revision,3);
});

test('audit and export are available to owner and journal is written',async()=>{
 const audit=await call('GET','/factory/cloud/apps/test-app/audit',{},globalThis.ownerToken);assert.equal(audit.status,200);assert.ok(audit.obj.audit.some(e=>e.type==='record.created'));
 const exp=await call('GET','/factory/cloud/apps/test-app/export',{},globalThis.ownerToken);assert.equal(exp.status,200);assert.equal(exp.obj.export.records.records.length,2);
 assert.ok(fs.existsSync(process.env.ZORYQ_FACTORY_CLOUD_JOURNAL));
 assert.ok(fs.readFileSync(process.env.ZORYQ_FACTORY_CLOUD_JOURNAL,'utf8').includes('record.created'));
});
