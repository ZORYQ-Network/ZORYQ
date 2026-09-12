import { randomBytes } from 'node:crypto';

const BASE=process.env.ZORYQ_FACTORY_BASE||'https://zoryq-evm-node-live-production.up.railway.app';
const idSuffix=(process.env.GITHUB_RUN_ID||Date.now())+'-'+randomBytes(3).toString('hex');
const email=`proof-${idSuffix}@example.test`;
const password='ZoryqProof-'+randomBytes(8).toString('hex');

async function request(path,{method='GET',body,token,allowed=[200]}={}){
 const headers={};if(body!==undefined)headers['content-type']='application/json';if(token)headers.authorization=`Bearer ${token}`;
 const res=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 let json={};try{json=await res.json()}catch{}
 if(!allowed.includes(res.status))throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(json).slice(0,400)}`);
 return {status:res.status,json};
}
async function waitForV03(){
 let last='';for(let i=0;i<30;i++){try{const r=await request('/factory/compiler/status');if(r.json?.version==='0.3')return r;}catch(e){last=e.message}await new Promise(r=>setTimeout(r,5000));}
 throw new Error(`v0.3_not_live ${last}`);
}
const compiler=await waitForV03();
const studio=await fetch(BASE+'/factory/studio-v3');if(studio.status!==200)throw new Error(`studio ${studio.status}`);const studioText=await studio.text();if(!studioText.includes('AI APP FACTORY · v0.3'))throw new Error('studio_marker_missing');
const prompt='Crie um sistema para clínica com pacientes, consultas, financeiro, documentos e notificações';
const compiled=await request('/factory/compile',{method:'POST',body:{prompt,cloud:true,chain:false}});
const spec=compiled.json.spec;
for(const id of ['patients','appointments','invoices','documents','notifications'])if(!spec.modules.some(m=>m.id===id))throw new Error(`compiled_missing_${id}`);
const created=await request('/factory/cloud/apps',{method:'POST',body:{spec,ownerEmail:email,ownerPassword:password,provenance:'github-v03-live-proof'},allowed:[201]});
const token=created.json.token;const appId=created.json.app.id;
const patient=await request(`/factory/cloud/apps/${appId}/records/patients`,{method:'POST',token,body:{revision:created.json.app.revision,record:{name:'Demo Patient',phone:'000'}} ,allowed:[201]});
const evolved=await request('/factory/evolve',{method:'POST',body:{prompt:'adicione cadastro de veículos e ative blockchain',baseSpec:spec}});
if(!evolved.json.spec.modules.some(m=>m.id==='vehicles'))throw new Error('evolution_missing_vehicles');
const cloudEvolve=await request(`/factory/cloud/apps/${appId}/evolve`,{method:'POST',token,body:{revision:patient.json.revision,spec:evolved.json.spec}});
if(Number(cloudEvolve.json.spec.version)<2)throw new Error('cloud_version_not_advanced');
const records=await request(`/factory/cloud/apps/${appId}/records/patients`,{token});if(records.json.records.length!==1)throw new Error('patient_not_preserved');
const audit=await request(`/factory/cloud/apps/${appId}/audit`,{token});if(!audit.json.audit.some(e=>e.type==='app.evolved'))throw new Error('audit_missing_evolution');
const exported=await request(`/factory/cloud/apps/${appId}/export`,{token});if(exported.json.export.records.patients.length!==1)throw new Error('export_missing_record');
const cloudStatus=await request('/factory/cloud/status');if(cloudStatus.json.schema!==2)throw new Error('cloud_schema_not_v2');

const evidence={schema:'zoryq-factory-v03-live-proof/1',generatedAt:new Date().toISOString(),base:BASE,checks:{compiler:{ok:true,version:compiler.json.version,catalogModules:compiler.json.catalogModules,presets:compiler.json.presets},studio:{ok:true,http:studio.status,bytes:studioText.length},compile:{ok:true,moduleIds:spec.modules.map(m=>m.id),fallbackCount:spec.capabilities?.genericFallbackModules??null},cloud:{ok:true,schema:cloudStatus.json.schema,persistence:cloudStatus.json.persistence,revision:cloudEvolve.json.revision},crud:{ok:true,patientRecords:records.json.records.length},evolution:{ok:true,version:cloudEvolve.json.spec.version,vehicles:true,preservedData:true},audit:{ok:true,events:audit.json.audit.length},export:{ok:true,moduleCount:Object.keys(exported.json.export.records).length}},syntheticAppId:appId,claimBoundary:'Project-controlled GitHub runner on external infrastructure. Proves public v0.3 reachability and reproducibility for supported schema-driven workflows; not independent human adoption, universal arbitrary software synthesis, audited production security, or mainnet readiness.'};
console.log(JSON.stringify(evidence,null,2));
