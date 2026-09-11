import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isAddress,getAddress} from 'ethers';

const DATA_DIR=process.env.SOCIAL_MEDIA_DIR||'/data/social-media';
const SESSION_SECRET=String(process.env.SOCIAL_SESSION_SECRET||'');
const MAX_IMAGE_BYTES=5*1024*1024;
const MAX_JSON_BYTES=8*1024*1024;
const TYPES={'image/jpeg':{ext:'jpg',magic:b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff},'image/png':{ext:'png',magic:b=>b.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},'image/webp':{ext:'webp',magic:b=>b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP'}};

function safeJson(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function addr(v){if(!isAddress(String(v||'')))return null;return getAddress(v).toLowerCase()}
function verifyToken(token){if(!SESSION_SECRET||!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();let got;try{got=Buffer.from(sig,'base64url')}catch{return null}if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return null;const p=safeJson(Buffer.from(body,'base64url').toString('utf8'),null);if(!p||p.exp<Date.now())return null;return addr(p.address)}
function bearer(req){return String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')}
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(obj))}
async function readJson(req){let total=0;const chunks=[];for await(const c of req){total+=c.length;if(total>MAX_JSON_BYTES)throw Error('BODY_TOO_LARGE');chunks.push(c)}return safeJson(Buffer.concat(chunks).toString('utf8')||'{}',{}) }
function imageName(v){return /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(v)?v:null}

export async function handleSocialMedia(req,res,u){
 const p=u.pathname.replace(/^\/social/,'')||'/';
 if(req.method==='OPTIONS'){json(res,204,{});return true}
 if(req.method==='GET'&&p.startsWith('/media/')){
  const name=imageName(p.slice('/media/'.length));if(!name){json(res,404,{ok:false,error:'MEDIA_NOT_FOUND'});return true}
  const file=path.join(DATA_DIR,name);if(!fs.existsSync(file)){json(res,404,{ok:false,error:'MEDIA_NOT_FOUND'});return true}
  const ext=path.extname(name).slice(1);const mime=ext==='jpg'?'image/jpeg':ext==='png'?'image/png':'image/webp';res.writeHead(200,{'content-type':mime,'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'});fs.createReadStream(file).pipe(res);return true
 }
 if(req.method==='POST'&&p==='/v1/media/image'){
  const actor=verifyToken(bearer(req));if(!actor){json(res,401,{ok:false,error:'UNAUTHORIZED'});return true}
  try{
   const b=await readJson(req);const mime=String(b.mime||'').toLowerCase();const type=TYPES[mime];if(!type)throw Error('UNSUPPORTED_IMAGE_TYPE');const data=Buffer.from(String(b.dataBase64||''),'base64');if(data.length<32||data.length>MAX_IMAGE_BYTES)throw Error('INVALID_IMAGE_SIZE');if(!type.magic(data))throw Error('INVALID_IMAGE_BYTES');
   fs.mkdirSync(DATA_DIR,{recursive:true});const name=`${crypto.randomBytes(16).toString('hex')}.${type.ext}`;const file=path.join(DATA_DIR,name);fs.writeFileSync(file,data,{flag:'wx',mode:0o640});const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0];const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0];if(!host)throw Error('PUBLIC_HOST_UNAVAILABLE');const url=`${proto}://${host}/social/media/${name}`;json(res,201,{ok:true,actor,url,mime,size:data.length});return true
  }catch(e){const m=String(e?.message||'UPLOAD_FAILED');json(res,m==='BODY_TOO_LARGE'?413:400,{ok:false,error:m});return true}
 }
 return false
}
