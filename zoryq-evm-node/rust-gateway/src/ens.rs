use reqwest::Client;
use serde_json::{json, Value};
use sha3::{Digest, Keccak256};
use std::env;

const ENS_REGISTRY:&str="0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const RESOLVER_SELECTOR:&str="0178b8bf";
const NAME_SELECTOR:&str="691f3431";
const ADDR_SELECTOR:&str="3b3b57de";

fn keccak(data:&[u8])->[u8;32]{let mut h=Keccak256::new();h.update(data);let out=h.finalize();let mut r=[0u8;32];r.copy_from_slice(&out);r}
fn namehash(name:&str)->[u8;32]{let mut node=[0u8;32];for label in name.split('.').rev(){let lh=keccak(label.as_bytes());let mut buf=[0u8;64];buf[..32].copy_from_slice(&node);buf[32..].copy_from_slice(&lh);node=keccak(&buf);}node}
fn hex32(v:&[u8;32])->String{v.iter().map(|b|format!("{b:02x}")).collect()}
fn decode_hex(s:&str)->Result<Vec<u8>,String>{let s=s.strip_prefix("0x").unwrap_or(s);if s.len()%2!=0{return Err("invalid_hex".into())}let mut out=Vec::with_capacity(s.len()/2);for i in (0..s.len()).step_by(2){out.push(u8::from_str_radix(&s[i..i+2],16).map_err(|_|"invalid_hex")?);}Ok(out)}
fn decode_address(result:&str)->Option<String>{let b=decode_hex(result).ok()?;if b.len()<32{return None}let a=&b[b.len()-20..];if a.iter().all(|x|*x==0){return None}Some(format!("0x{}",a.iter().map(|x|format!("{x:02x}")).collect::<String>()))}
fn decode_string(result:&str)->Option<String>{let b=decode_hex(result).ok()?;if b.len()<64{return None}let off=u64::from_be_bytes(b.get(24..32)?.try_into().ok()?) as usize;if b.len()<off+32{return None}let len=u64::from_be_bytes(b.get(off+24..off+32)?.try_into().ok()?) as usize;if b.len()<off+32+len{return None}String::from_utf8(b[off+32..off+32+len].to_vec()).ok().filter(|s|!s.is_empty())}
async fn eth_call(client:&Client,rpc:&str,to:&str,data:String)->Result<String,String>{let r=client.post(rpc).json(&json!({"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":to,"data":data},"latest"]})).send().await.map_err(|e|e.to_string())?;let j:Value=r.json().await.map_err(|e|e.to_string())?;if let Some(e)=j.get("error"){return Err(e.get("message").and_then(Value::as_str).unwrap_or("rpc_error").to_string())}j.get("result").and_then(Value::as_str).map(str::to_string).ok_or_else(||"missing_result".into())}
async fn registry_resolver(client:&Client,rpc:&str,node:&[u8;32])->Result<Option<String>,String>{let data=format!("0x{RESOLVER_SELECTOR}{}",hex32(node));let out=eth_call(client,rpc,ENS_REGISTRY,data).await?;Ok(decode_address(&out))}

pub async fn resolve_identity(client:&Client,address:&str)->Value{
    let rpc=env::var("ENS_SEPOLIA_RPC").unwrap_or_else(|_|"https://ethereum-sepolia-rpc.publicnode.com".into());
    let clean=address.trim().to_ascii_lowercase();let Some(hex)=clean.strip_prefix("0x") else{return json!({"ok":false,"address":address,"error":"invalid_address","network":"ethereum-sepolia","ensVersion":"v2-beta"})};
    if hex.len()!=40||!hex.bytes().all(|b|b.is_ascii_hexdigit()){return json!({"ok":false,"address":address,"error":"invalid_address","network":"ethereum-sepolia","ensVersion":"v2-beta"})}
    let reverse_name=format!("{hex}.addr.reverse");let reverse_node=namehash(&reverse_name);
    let result:Result<Value,String>=async{
        let Some(reverse_resolver)=registry_resolver(client,&rpc,&reverse_node).await? else{return Ok(json!({"ok":true,"address":clean,"ensName":Value::Null,"verified":false,"network":"ethereum-sepolia","ensVersion":"v2-beta"}))};
        let name_data=format!("0x{NAME_SELECTOR}{}",hex32(&reverse_node));let name_out=eth_call(client,&rpc,&reverse_resolver,name_data).await?;let Some(name)=decode_string(&name_out) else{return Ok(json!({"ok":true,"address":clean,"ensName":Value::Null,"verified":false,"network":"ethereum-sepolia","ensVersion":"v2-beta"}))};
        let forward_node=namehash(&name);let Some(forward_resolver)=registry_resolver(client,&rpc,&forward_node).await? else{return Ok(json!({"ok":true,"address":clean,"ensName":name,"forwardAddress":Value::Null,"verified":false,"network":"ethereum-sepolia","ensVersion":"v2-beta"}))};
        let addr_data=format!("0x{ADDR_SELECTOR}{}",hex32(&forward_node));let addr_out=eth_call(client,&rpc,&forward_resolver,addr_data).await?;let forward=decode_address(&addr_out);let verified=forward.as_deref().map(|v|v.eq_ignore_ascii_case(&clean)).unwrap_or(false);
        Ok(json!({"ok":true,"address":clean,"ensName":name,"forwardAddress":forward,"verified":verified,"network":"ethereum-sepolia","ensVersion":"v2-beta"}))
    }.await;
    result.unwrap_or_else(|detail|json!({"ok":false,"address":clean,"error":"ens_lookup_unavailable","detail":detail,"network":"ethereum-sepolia","ensVersion":"v2-beta"}))
}
