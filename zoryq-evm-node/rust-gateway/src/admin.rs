use chrono::{SecondsFormat, Utc};
use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};
use rand::{rngs::OsRng, RngCore};
use reqwest::Client;
use serde_json::{json, Value};
use sha2::{Digest as Sha2Digest, Sha256};
use sha3::{Digest as Sha3Digest, Keccak256};
use std::{collections::HashMap, env, fs, sync::OnceLock, time::{Duration, Instant}};
use tokio::sync::Mutex;

const TTL:Duration=Duration::from_secs(600);
#[derive(Clone)] struct Challenge{address:String,issued_at:String,message:String,created:Instant}
static CHALLENGES:OnceLock<Mutex<HashMap<String,Challenge>>>=OnceLock::new();
fn challenges()->&'static Mutex<HashMap<String,Challenge>>{CHALLENGES.get_or_init(||Mutex::new(HashMap::new()))}
fn proof_file()->String{env::var("ZORYQ_ADMIN_CONTROL_PROOF").unwrap_or_else(|_|"/data/admin-control-proof.json".into())}
fn deployment_file()->String{env::var("ZORYQ_PROTOCOL_DEPLOYMENTS").unwrap_or_else(|_|"/data/protocol-deployments.json".into())}
fn treasury()->String{env::var("ZORYQ_ADMIN_TREASURY").unwrap_or_else(|_|"0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33".into()).to_ascii_lowercase()}
fn zusd()->String{env::var("ZORYQ_ZUSD").unwrap_or_else(|_|"0xd2121e96c6af936c0496fdb499c1d0613d26c2b9".into()).to_ascii_lowercase()}
fn read_json(path:&str,fallback:Value)->Value{fs::read_to_string(path).ok().and_then(|s|serde_json::from_str(&s).ok()).unwrap_or(fallback)}
fn proof()->Option<Value>{let p=read_json(&proof_file(),Value::Null);if p.is_null(){None}else{Some(p)}}
fn proven(p:Option<&Value>)->bool{p.and_then(|v|v.get("address")).and_then(Value::as_str).map(|a|a.eq_ignore_ascii_case(&treasury())).unwrap_or(false)}
fn normalize_address(v:&str)->Option<String>{let s=v.trim().to_ascii_lowercase();if s.len()==42&&s.starts_with("0x")&&s[2..].bytes().all(|b|b.is_ascii_hexdigit()){Some(s)}else{None}}
fn normalize_hash(v:&str)->Option<String>{let s=v.trim().to_ascii_lowercase();if s.len()==66&&s.starts_with("0x")&&s[2..].bytes().all(|b|b.is_ascii_hexdigit()){Some(s)}else{None}}
fn message_for(address:&str,nonce:&str,issued_at:&str)->String{format!("ZORYQ Admin Control Proof\nTreasury: {}\nSigner: {}\nNonce: {}\nIssued At: {}\nPurpose: prove control of the configured ZORYQ Testnet administrative wallet without revealing its private key.\nThis signature does not authorize a transaction or transfer assets.",treasury(),address,nonce,issued_at)}
fn hex_encode(bytes:&[u8])->String{bytes.iter().map(|b|format!("{b:02x}")).collect()}
fn hex_decode(s:&str)->Result<Vec<u8>,String>{let s=s.strip_prefix("0x").unwrap_or(s);if s.len()%2!=0{return Err("invalid_hex".into())}let mut out=Vec::with_capacity(s.len()/2);for i in (0..s.len()).step_by(2){out.push(u8::from_str_radix(&s[i..i+2],16).map_err(|_|"invalid_hex")?)}Ok(out)}
fn ethereum_message_hash(message:&str)->[u8;32]{let prefix=format!("\x19Ethereum Signed Message:\n{}",message.len());let mut h=Keccak256::new();h.update(prefix.as_bytes());h.update(message.as_bytes());let out=h.finalize();let mut r=[0u8;32];r.copy_from_slice(&out);r}
fn recover_address(message:&str,signature:&str)->Result<String,String>{let b=hex_decode(signature)?;if b.len()!=65{return Err("invalid_signature".into())}let sig=Signature::try_from(&b[..64]).map_err(|_|"invalid_signature")?;let v=match b[64]{27|28=>b[64]-27,0|1=>b[64],_=>return Err("invalid_signature".into())};let rid=RecoveryId::try_from(v).map_err(|_|"invalid_signature")?;let key=VerifyingKey::recover_from_prehash(&ethereum_message_hash(message),&sig,rid).map_err(|_|"invalid_signature")?;let p=key.to_encoded_point(false);let mut h=Keccak256::new();h.update(&p.as_bytes()[1..]);let out=h.finalize();Ok(format!("0x{}",hex_encode(&out[12..])))}
fn write_json_atomic(path:&str,v:&Value)->Result<(),String>{let tmp=format!("{path}.tmp");fs::write(&tmp,serde_json::to_vec_pretty(v).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;fs::rename(&tmp,path).map_err(|e|e.to_string())}

pub fn status()->Value{let p=proof();let meta=p.as_ref().map(|v|json!({"address":v.get("address").cloned().unwrap_or(Value::Null),"provenAt":v.get("provenAt").cloned().unwrap_or(Value::Null),"proofDigest":v.get("proofDigest").cloned().unwrap_or(Value::Null),"chainId":v.get("chainId").cloned().unwrap_or(Value::Null)}));json!({"ok":true,"treasury":treasury(),"zUSD":zusd(),"proven":proven(p.as_ref()),"proof":meta,"disclosure":"No private key or wallet signature is stored. Only a digest and verification metadata are persisted."})}
pub fn deployments()->Value{let p=proof();json!({"ok":true,"treasury":treasury(),"zUSD":zusd(),"controlProven":proven(p.as_ref()),"deployments":read_json(&deployment_file(),json!({}))})}

pub async fn challenge(address_raw:&str)->Result<Value,(u16,Value)>{let address=normalize_address(address_raw).ok_or((400,json!({"ok":false,"error":"invalid_address"})))?;let t=treasury();if address!=t{return Err((403,json!({"ok":false,"error":"signer_must_equal_configured_treasury","treasury":t})))}let mut nonce=[0u8;24];OsRng.fill_bytes(&mut nonce);let nonce=hex_encode(&nonce);let issued=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);let message=message_for(&address,&nonce,&issued);let mut g=challenges().lock().await;g.retain(|_,c|c.created.elapsed()<TTL);g.insert(nonce.clone(),Challenge{address:address.clone(),issued_at:issued.clone(),message:message.clone(),created:Instant::now()});Ok(json!({"ok":true,"treasury":t,"address":address,"nonce":nonce,"issuedAt":issued,"expiresInSeconds":600,"message":message}))}

pub async fn prove(nonce:&str,signature:&str)->Result<Value,(u16,Value)>{let mut g=challenges().lock().await;g.retain(|_,c|c.created.elapsed()<TTL);let Some(c)=g.get(nonce).cloned() else{return Err((400,json!({"ok":false,"error":"invalid_or_expired_challenge"})))};let signer=recover_address(&c.message,signature).map_err(|_|(400,json!({"ok":false,"error":"invalid_signature"})))?;let t=treasury();if signer!=t||signer!=c.address{return Err((403,json!({"ok":false,"error":"signature_not_configured_treasury","treasury":t,"signer":signer})))}let mut h=Sha256::new();h.update(format!("{}:{}",c.message,signature).as_bytes());let digest=format!("0x{}",hex_encode(&h.finalize()));let proof=json!({"address":signer,"chainId":5919065,"provenAt":Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true),"proofDigest":digest,"method":"EIP-191 personal_sign challenge"});write_json_atomic(&proof_file(),&proof).map_err(|e|(500,json!({"ok":false,"error":"proof_persist_failed","detail":e})))?;g.remove(nonce);Ok(json!({"ok":true,"treasury":t,"proven":true,"proof":proof,"next":"Administrative control is cryptographically proven. Protocol deployments still require explicit wallet confirmation and post-deployment verification."}))}

async fn rpc(client:&Client,rpc_url:&str,method:&str,params:Value)->Result<Value,String>{let r=client.post(rpc_url).json(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params})).send().await.map_err(|e|e.to_string())?;let j:Value=r.json().await.map_err(|e|e.to_string())?;if let Some(e)=j.get("error"){return Err(e.get("message").and_then(Value::as_str).unwrap_or("rpc_error").to_string())}Ok(j.get("result").cloned().unwrap_or(Value::Null))}
fn selector(sig:&str)->String{let mut h=Keccak256::new();h.update(sig.as_bytes());format!("0x{}",hex_encode(&h.finalize()[..4]))}
async fn eth_call(client:&Client,rpc_url:&str,address:&str,sig:&str)->Result<String,String>{rpc(client,rpc_url,"eth_call",json!([{"to":address,"data":selector(sig)},"latest"])).await?.as_str().map(str::to_string).ok_or_else(||"invalid_call_result".into())}
fn decode_u256_hex(v:&str)->Result<u128,String>{let b=hex_decode(v)?;if b.len()>32{return Err("invalid_uint".into())}let slice=if b.len()>16{if b[..b.len()-16].iter().any(|x|*x!=0){return Err("uint_too_large".into())}&b[b.len()-16..]}else{&b[..]};let mut a=[0u8;16];a[16-slice.len()..].copy_from_slice(slice);Ok(u128::from_be_bytes(a))}
fn decode_address_hex(v:&str)->Result<String,String>{let b=hex_decode(v)?;if b.len()<32{return Err("invalid_address_result".into())}Ok(format!("0x{}",hex_encode(&b[b.len()-20..])))}
fn receipt_block(v:&Value)->Result<u64,String>{let s=v.get("blockNumber").and_then(Value::as_str).ok_or_else(||"missing_block_number".to_string())?;u64::from_str_radix(s.trim_start_matches("0x"),16).map_err(|_|"invalid_block_number".into())}

pub async fn verify_deployment(client:&Client,rpc_url:&str,kind:&str,address_raw:&str,tx_hash_raw:&str)->Result<Value,(u16,Value)>{
 if !proven(proof().as_ref()){return Err((403,json!({"ok":false,"error":"treasury_control_proof_required"})))}
 let address=normalize_address(address_raw).ok_or((400,json!({"ok":false,"error":"invalid_contract_address"})))?;
 let tx_hash=normalize_hash(tx_hash_raw).ok_or((400,json!({"ok":false,"error":"invalid_tx_hash"})))?;
 if !matches!(kind,"dexV1"|"lending"|"projectRegistry"){return Err((500,json!({"ok":false,"error":"unsupported_protocol_kind"})))}
 let code=rpc(client,rpc_url,"eth_getCode",json!([address,"latest"])).await.map_err(|e|(500,json!({"ok":false,"error":e})))?;
 let code=code.as_str().unwrap_or("0x");if code=="0x"{return Err((500,json!({"ok":false,"error":"deployed_bytecode_missing"})))}let bytecode_bytes=(code.len().saturating_sub(2))/2;
 let receipt=rpc(client,rpc_url,"eth_getTransactionReceipt",json!([tx_hash])).await.map_err(|e|(500,json!({"ok":false,"error":e})))?;
 if receipt.is_null()||receipt.get("status").and_then(Value::as_str)!=Some("0x1"){return Err((500,json!({"ok":false,"error":"deployment_receipt_not_successful"})))}
 let receipt_address=receipt.get("contractAddress").and_then(Value::as_str).and_then(normalize_address);if receipt_address.as_deref()!=Some(&address){return Err((500,json!({"ok":false,"error":"receipt_contract_address_mismatch"})))}
 let block_number=receipt_block(&receipt).map_err(|e|(500,json!({"ok":false,"error":e})))?;
 let mut verified=json!({"kind":kind,"address":address,"txHash":tx_hash,"blockNumber":block_number,"bytecodeBytes":bytecode_bytes,"verifiedAt":Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true)});
 if kind=="dexV1"{
   let(owner,fee,token,total,lp,protocol)=tokio::join!(eth_call(client,rpc_url,&address,"owner()"),eth_call(client,rpc_url,&address,"feeRecipient()"),eth_call(client,rpc_url,&address,"token()"),eth_call(client,rpc_url,&address,"TOTAL_FEE_BPS()"),eth_call(client,rpc_url,&address,"LP_FEE_BPS()"),eth_call(client,rpc_url,&address,"PROTOCOL_FEE_BPS()"));
   let owner=decode_address_hex(&owner.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let fee=decode_address_hex(&fee.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let token=decode_address_hex(&token.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;
   let total=decode_u256_hex(&total.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let lp=decode_u256_hex(&lp.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let protocol=decode_u256_hex(&protocol.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;
   if owner!=treasury(){return Err((500,json!({"ok":false,"error":"dex_owner_mismatch"})))}if fee!=treasury(){return Err((500,json!({"ok":false,"error":"dex_fee_recipient_mismatch"})))}if token!=zusd(){return Err((500,json!({"ok":false,"error":"dex_token_mismatch"})))}if(total,lp,protocol)!=(30,20,10){return Err((500,json!({"ok":false,"error":"dex_fee_constants_mismatch"})))}
   if let Some(o)=verified.as_object_mut(){o.insert("owner".into(),json!(owner));o.insert("feeRecipient".into(),json!(fee));o.insert("token".into(),json!(token));o.insert("totalFeeBps".into(),json!(30));o.insert("lpFeeBps".into(),json!(20));o.insert("protocolFeeBps".into(),json!(10));}
 }else if kind=="lending"{
   let(owner,token,max_ltv,threshold,apr)=tokio::join!(eth_call(client,rpc_url,&address,"owner()"),eth_call(client,rpc_url,&address,"debtToken()"),eth_call(client,rpc_url,&address,"maxLtvBps()"),eth_call(client,rpc_url,&address,"liquidationThresholdBps()"),eth_call(client,rpc_url,&address,"aprBps()"));
   let owner=decode_address_hex(&owner.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let token=decode_address_hex(&token.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;
   if owner!=treasury(){return Err((500,json!({"ok":false,"error":"lending_owner_mismatch"})))}if token!=zusd(){return Err((500,json!({"ok":false,"error":"lending_token_mismatch"})))}
   let max_ltv=decode_u256_hex(&max_ltv.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let threshold=decode_u256_hex(&threshold.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;let apr=decode_u256_hex(&apr.map_err(|e|(500,json!({"ok":false,"error":e})))?).map_err(|e|(500,json!({"ok":false,"error":e})))?;
   if let Some(o)=verified.as_object_mut(){o.insert("owner".into(),json!(owner));o.insert("debtToken".into(),json!(token));o.insert("maxLtvBps".into(),json!(max_ltv));o.insert("liquidationThresholdBps".into(),json!(threshold));o.insert("aprBps".into(),json!(apr));}
 }else{
   let count=eth_call(client,rpc_url,&address,"projectCount()").await.map_err(|e|(500,json!({"ok":false,"error":e})))?;let count=decode_u256_hex(&count).map_err(|e|(500,json!({"ok":false,"error":e})))?;if let Some(o)=verified.as_object_mut(){o.insert("projectCount".into(),json!(count.to_string()));}
 }
 let mut deployments=read_json(&deployment_file(),json!({}));if !deployments.is_object(){deployments=json!({})}deployments.as_object_mut().unwrap().insert(kind.to_string(),verified.clone());write_json_atomic(&deployment_file(),&deployments).map_err(|e|(500,json!({"ok":false,"error":"deployment_persist_failed","detail":e})))?;
 Ok(json!({"ok":true,"verified":verified,"canonicalCandidate":true,"notice":"This deployment passed receipt, bytecode and protocol configuration checks. Frontend publication should use this verified record as its source."}))
}
