import http from 'node:http';
import { handleFactoryCloud } from './factory-cloud.mjs';
import { compileFactoryPrompt, compilerStatus } from './factory-compiler.mjs';

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

async function handleCompiler(req,res,url){
  if(url.pathname==='/factory/compiler/status'&&req.method==='GET'){
    return sendJson(res,200,compilerStatus()),true;
  }
  if(url.pathname==='/factory/compile'&&req.method==='POST'){
    const b=await readJson(req,100_000);
    const spec=compileFactoryPrompt(b.prompt,{chain:b.chain!==false,cloud:b.cloud!==false});
    return sendJson(res,200,{ok:true,spec,compiler:compilerStatus()}),true;
  }
  if(url.pathname==='/factory/evolve'&&req.method==='POST'){
    const b=await readJson(req,250_000);
    if(!b.baseSpec||typeof b.baseSpec!=='object')return sendJson(res,400,{ok:false,error:'base_spec_required'}),true;
    const spec=compileFactoryPrompt(b.prompt,{baseSpec:b.baseSpec});
    return sendJson(res,200,{ok:true,spec,compiler:compilerStatus()}),true;
  }
  return false;
}

http.createServer=function patchedCreateServer(...args){
  let listenerIndex=-1;
  for(let i=args.length-1;i>=0;i--){if(typeof args[i]==='function'){listenerIndex=i;break}}
  if(listenerIndex<0)return originalCreateServer(...args);
  const originalListener=args[listenerIndex];
  args[listenerIndex]=async function factoryAwareListener(req,res){
    try{
      const url=new URL(req.url||'/','http://127.0.0.1');
      if(url.pathname.startsWith('/factory/')){
        if(req.method==='OPTIONS')return sendJson(res,204,{});
        const compilerHandled=await handleCompiler(req,res,url);
        if(compilerHandled)return;
      }
      if(url.pathname.startsWith('/factory/cloud/')){
        const handled=await handleFactoryCloud(req,res,{body:readJson,send:sendJson});
        if(handled)return;
      }
    }catch(e){
      const msg=String(e?.message||e).slice(0,300);
      const status=/prompt_too_|base_spec_required|request_too_large|invalid/i.test(msg)?400:500;
      return sendJson(res,status,{ok:false,error:msg});
    }
    return originalListener(req,res);
  };
  return originalCreateServer(...args);
};

console.log('[zoryq-factory] cloud + generalized compiler route preload enabled');
