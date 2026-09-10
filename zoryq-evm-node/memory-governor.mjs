import fs from 'node:fs';

const CGROUP_CURRENT='/sys/fs/cgroup/memory.current';
const CGROUP_MAX='/sys/fs/cgroup/memory.max';

function readNumber(file){
  try{
    const raw=fs.readFileSync(file,'utf8').trim();
    if(!raw||raw==='max')return null;
    const value=Number(raw);
    return Number.isFinite(value)&&value>0?value:null;
  }catch{return null}
}

export function memorySnapshot(){
  const usage=process.memoryUsage();
  const current=readNumber(CGROUP_CURRENT)??usage.rss;
  const limit=readNumber(CGROUP_MAX);
  const percent=limit?current/limit*100:null;
  return {
    currentBytes:current,
    limitBytes:limit,
    percent:percent==null?null:Math.round(percent*100)/100,
    process:{rssBytes:usage.rss,heapUsedBytes:usage.heapUsed,heapTotalBytes:usage.heapTotal,externalBytes:usage.external,arrayBuffersBytes:usage.arrayBuffers},
    band:percent==null?'unknown':percent>=85?'critical':percent>=80?'protect':percent>=70?'caution':'normal'
  };
}

export function governorPolicy(baseConcurrency=64){
  const memory=memorySnapshot();
  const p=memory.percent??0;
  const factor=p>=85?0.25:p>=80?0.5:p>=70?0.75:1;
  return {
    memory,
    rpcConcurrency:Math.max(4,Math.floor(baseConcurrency*factor)),
    pauseNonEssential:p>=80,
    critical:p>=85
  };
}

export function createBandLogger(name='zoryq'){
  let previous='';
  return ()=>{
    const snap=memorySnapshot();
    if(snap.band!==previous){
      previous=snap.band;
      console.log(`[${name}] memory governor`,{band:snap.band,percent:snap.percent,currentMB:Math.round(snap.currentBytes/1048576),limitMB:snap.limitBytes?Math.round(snap.limitBytes/1048576):null});
    }
    return snap;
  };
}
