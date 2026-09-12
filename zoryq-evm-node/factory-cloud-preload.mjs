import http from 'node:http';
import { handleFactoryCloud } from './factory-cloud.mjs';

const originalCreateServer=http.createServer.bind(http);

async function readJson(req,max=2_000_000){
  let raw='';
  for await(const chunk of req){
    raw+=chunk;
    if(raw.length>max)throw Error('request_too_large');
  }
  return raw?JSON.parse(raw):{};
}

function sendJson(res,status,obj){
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'content-type, authorization',
    'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}

http.createServer=function patchedCreateServer(...args){
  let listenerIndex=-1;
  for(let i=args.length-1;i>=0;i--){if(typeof args[i]==='function'){listenerIndex=i;break}}
  if(listenerIndex<0)return originalCreateServer(...args);
  const originalListener=args[listenerIndex];
  args[listenerIndex]=async function factoryAwareListener(req,res){
    try{
      const url=new URL(req.url||'/','http://127.0.0.1');
      if(url.pathname.startsWith('/factory/cloud/')){
        if(req.method==='OPTIONS')return sendJson(res,204,{});
        const handled=await handleFactoryCloud(req,res,{body:readJson,send:sendJson});
        if(handled)return;
      }
    }catch(e){
      return sendJson(res,500,{ok:false,error:String(e?.message||e).slice(0,300)});
    }
    return originalListener(req,res);
  };
  return originalCreateServer(...args);
};

console.log('[zoryq-factory] cloud route preload enabled');
