import fs from 'node:fs';
import path from 'node:path';

const PROC_ROOT='/proc';
const OUTPUT=process.env.ZORYQ_PROCESS_MEMORY_STATUS||'/data/zoryq-memory-processes.json';
const SAMPLE_MS=Math.max(5_000,Number(process.env.ZORYQ_MEMORY_SAMPLE_MS||30_000));
const HISTORY_SIZE=Math.max(4,Number(process.env.ZORYQ_MEMORY_HISTORY_SIZE||20));
const GROWTH_ALERT_MB_PER_MIN=Math.max(1,Number(process.env.ZORYQ_MEMORY_GROWTH_ALERT_MB_PER_MIN||8));

const DEFAULT_BUDGETS_MB=Object.freeze({
  reth:550,
  'traffic-gateway':100,
  'public-gateway':90,
  'product-gateway':80,
  'social-service':70,
  'explorer-service':70,
  'admin-control':50,
  'memory-watchdog':35,
  other:80
});

const history=new Map();

function readText(file){try{return fs.readFileSync(file,'utf8')}catch{return ''}}
function readNumber(file){const raw=readText(file).trim();if(!raw||raw==='max')return null;const n=Number(raw);return Number.isFinite(n)?n:null}
function mb(bytes){return Math.round((Number(bytes||0)/1048576)*100)/100}
function classify(cmd){
  const s=String(cmd||'').toLowerCase();
  if(/(^|\/)reth(?:\s|$)/.test(s)||s.includes('/reth '))return 'reth';
  for(const name of ['traffic-gateway','public-gateway','product-gateway','social-service','explorer-service','admin-control','memory-watchdog'])if(s.includes(name))return name;
  return 'other';
}
function budgetFor(kind){const envKey=`ZORYQ_RSS_BUDGET_${kind.toUpperCase().replace(/-/g,'_')}_MB`;const override=Number(process.env[envKey]);return Number.isFinite(override)&&override>0?override:DEFAULT_BUDGETS_MB[kind]??DEFAULT_BUDGETS_MB.other}
function procStat(pid){
  const status=readText(path.join(PROC_ROOT,pid,'status'));if(!status)return null;
  const cmdline=readText(path.join(PROC_ROOT,pid,'cmdline')).replace(/\0/g,' ').trim();
  const name=(status.match(/^Name:\s+(.+)$/m)||[])[1]?.trim()||'';
  const rssKb=Number((status.match(/^VmRSS:\s+(\d+)\s+kB$/m)||[])[1]||0);
  const kind=classify(`${name} ${cmdline}`);
  return {pid:Number(pid),name,kind,cmdline,rssBytes:rssKb*1024,rssMB:Math.round(rssKb/10.24)/100,budgetMB:budgetFor(kind)};
}
function sampleProcesses(now){
  const rows=[];
  for(const entry of fs.readdirSync(PROC_ROOT,{withFileTypes:true})){
    if(!entry.isDirectory()||!/^\d+$/.test(entry.name))continue;
    const row=procStat(entry.name);if(!row||row.rssBytes<=0)continue;
    const points=history.get(row.pid)||[];points.push({t:now,rss:row.rssBytes});while(points.length>HISTORY_SIZE)points.shift();history.set(row.pid,points);
    let growthMBPerMin=0;
    if(points.length>=2){const first=points[0],last=points.at(-1),minutes=(last.t-first.t)/60000;if(minutes>0)growthMBPerMin=mb(last.rss-first.rss)/minutes;}
    row.growthMBPerMin=Math.round(growthMBPerMin*100)/100;
    row.overBudget=row.rssMB>row.budgetMB;
    row.growingFast=row.growthMBPerMin>=GROWTH_ALERT_MB_PER_MIN;
    rows.push(row);
  }
  const live=new Set(rows.map(r=>r.pid));for(const pid of history.keys())if(!live.has(pid))history.delete(pid);
  return rows.sort((a,b)=>b.rssBytes-a.rssBytes);
}
function atomicWrite(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.tmp`;fs.writeFileSync(tmp,JSON.stringify(obj,null,2));fs.renameSync(tmp,file)}
function cgroup(){const current=readNumber('/sys/fs/cgroup/memory.current'),limit=readNumber('/sys/fs/cgroup/memory.max');return{currentBytes:current,limitBytes:limit,currentMB:mb(current),limitMB:mb(limit),percent:limit?Math.round(current/limit*10000)/100:null}}
function run(){
  const now=Date.now(),processes=sampleProcesses(now),cg=cgroup();
  const alerts=processes.filter(p=>p.overBudget||p.growingFast).map(p=>({pid:p.pid,kind:p.kind,rssMB:p.rssMB,budgetMB:p.budgetMB,growthMBPerMin:p.growthMBPerMin,reason:[p.overBudget?'over_budget':null,p.growingFast?'sustained_growth':null].filter(Boolean)}));
  const doc={ok:true,generatedAt:new Date(now).toISOString(),sampleMs:SAMPLE_MS,growthAlertMBPerMin:GROWTH_ALERT_MB_PER_MIN,cgroup:cg,totalObservedRSSMB:Math.round(processes.reduce((n,p)=>n+p.rssMB,0)*100)/100,alerts,processes};
  atomicWrite(OUTPUT,doc);
  if(alerts.length)console.warn('[zoryq-memory-watchdog] memory alert',{cgroupPercent:cg.percent,alerts});
  else console.log('[zoryq-memory-watchdog] sample',{cgroupPercent:cg.percent,top:processes.slice(0,5).map(p=>({pid:p.pid,kind:p.kind,rssMB:p.rssMB,growthMBPerMin:p.growthMBPerMin}))});
}

run();
setInterval(()=>{try{run()}catch(error){console.error('[zoryq-memory-watchdog] sample failed',error)}},SAMPLE_MS).unref?.();
