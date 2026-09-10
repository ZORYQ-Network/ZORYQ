use serde_json::{json, Value};
use std::{env, fs};

fn proof_file()->String{env::var("ZORYQ_ADMIN_CONTROL_PROOF").unwrap_or_else(|_|"/data/admin-control-proof.json".into())}
fn deployment_file()->String{env::var("ZORYQ_PROTOCOL_DEPLOYMENTS").unwrap_or_else(|_|"/data/protocol-deployments.json".into())}
fn treasury()->String{env::var("ZORYQ_ADMIN_TREASURY").unwrap_or_else(|_|"0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33".into()).to_ascii_lowercase()}
fn zusd()->String{env::var("ZORYQ_ZUSD").unwrap_or_else(|_|"0xd2121e96c6af936c0496fdb499c1d0613d26c2b9".into()).to_ascii_lowercase()}
fn read_json(path:&str,fallback:Value)->Value{fs::read_to_string(path).ok().and_then(|s|serde_json::from_str(&s).ok()).unwrap_or(fallback)}
fn proof()->Option<Value>{let p=read_json(&proof_file(),Value::Null);if p.is_null(){None}else{Some(p)}}
fn proven(p:Option<&Value>)->bool{p.and_then(|v|v.get("address")).and_then(Value::as_str).map(|a|a.eq_ignore_ascii_case(&treasury())).unwrap_or(false)}

pub fn status()->Value{
 let p=proof();
 let meta=p.as_ref().map(|v|json!({"address":v.get("address").cloned().unwrap_or(Value::Null),"provenAt":v.get("provenAt").cloned().unwrap_or(Value::Null),"proofDigest":v.get("proofDigest").cloned().unwrap_or(Value::Null),"chainId":v.get("chainId").cloned().unwrap_or(Value::Null)}));
 json!({"ok":true,"treasury":treasury(),"zUSD":zusd(),"proven":proven(p.as_ref()),"proof":meta,"disclosure":"No private key or wallet signature is stored. Only a digest and verification metadata are persisted."})
}

pub fn deployments()->Value{
 let p=proof();
 json!({"ok":true,"treasury":treasury(),"zUSD":zusd(),"controlProven":proven(p.as_ref()),"deployments":read_json(&deployment_file(),json!({}))})
}
