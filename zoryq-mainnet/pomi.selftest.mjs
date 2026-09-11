import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-pomi-'));
const evidence = path.join(root, 'runbook.txt'); fs.writeFileSync(evidence, 'incident-runbook-v1\n');
const manifest = path.join(root, 'manifest.json');
const input = { network:'ZORYQ Mainnet Ceremony Test', chainId:15919065, releaseCommit:'1111111111111111111111111111111111111111', releaseTag:'mainnet-rc1', policy:{launchCertificateThreshold:3,minimumIndependentOperators:3,auditRequired:true,incidentRunbookRequired:true,productionConsensusRequired:true}, evidence:{incidentRunbook:evidence} };
fs.writeFileSync(manifest, JSON.stringify(input));
function run(out, genesis) {
  const args=['zoryq-mainnet/pomi.mjs','--manifest',manifest,'--out',out]; if(genesis) args.push('--genesis',genesis);
  return spawnSync(process.execPath,args,{encoding:'utf8'});
}
const a=path.join(root,'a'), b=path.join(root,'b');
let r=run(a); if(r.status!==0) throw new Error(r.stderr||r.stdout);
r=run(b); if(r.status!==0) throw new Error(r.stderr||r.stdout);
const pa=JSON.parse(fs.readFileSync(path.join(a,'pomi.json'))), pb=JSON.parse(fs.readFileSync(path.join(b,'pomi.json')));
if(pa.commitment!==pb.commitment) throw new Error('non-deterministic commitment');
const genesis=path.join(root,'genesis.json'); fs.writeFileSync(genesis, JSON.stringify({extraData:pa.genesisAnchor.value}));
r=run(path.join(root,'verified'),genesis); if(r.status!==0) throw new Error(r.stderr||r.stdout);
fs.writeFileSync(evidence,'tampered\n');
r=run(path.join(root,'tampered')); if(r.status!==0) throw new Error(r.stderr||r.stdout);
const pt=JSON.parse(fs.readFileSync(path.join(root,'tampered','pomi.json'))); if(pt.commitment===pa.commitment) throw new Error('tamper not detected');
fs.writeFileSync(genesis, JSON.stringify({extraData:'0x'+'00'.repeat(32)}));
r=run(path.join(root,'bad'),genesis); if(r.status===0) throw new Error('wrong genesis anchor accepted');
console.log(JSON.stringify({ok:true,deterministic:true,tamperChangesCommitment:true,wrongGenesisRejected:true,commitment:pa.commitment,anchorBytes:pa.genesisAnchor.bytes}));
