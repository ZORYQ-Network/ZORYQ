use chrono::{SecondsFormat, Utc};
use reqwest::{Client, Url};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{env, fs, sync::OnceLock, time::{SystemTime, UNIX_EPOCH}};
use tokio::sync::Mutex;

const SWAP:&str="0x8205f34b803edd79ddca414f00e12ecddeddacbe";
const STAKE:&str="0xbb26faadd1e083c7c0dc0a82ddb96cc45253ecb1";
static SCORE_LOCK:OnceLock<Mutex<()>>=OnceLock::new();

fn score_lock()->&'static Mutex<()> { SCORE_LOCK.get_or_init(||Mutex::new(())) }
fn score_file()->String { env::var("ZORYQ_GENESIS_SCORE_STATE").unwrap_or_else(|_|"/data/genesis-score.json".into()) }
fn now_ms()->u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }
fn proof_hash(value:&str)->String { let mut h=Sha256::new(); h.update(value.as_bytes()); format!("0x{:x}",h.finalize()) }

fn load_score()->Value {
    let mut state=fs::read_to_string(score_file()).ok().and_then(|s|serde_json::from_str::<Value>(&s).ok()).unwrap_or_else(||json!({"version":3,"wallets":{},"usedProofs":{}}));
    if let Some(obj)=state.as_object_mut(){obj.insert("version".into(),json!(3));if !obj.get("wallets").map(Value::is_object).unwrap_or(false){obj.insert("wallets".into(),json!({}));}if !obj.get("usedProofs").map(Value::is_object).unwrap_or(false){obj.insert("usedProofs".into(),json!({}));}}
    state
}
fn save_score(state:&Value)->Result<(),String>{let path=score_file();let tmp=format!("{path}.tmp");let body=serde_json::to_vec_pretty(state).map_err(|e|e.to_string())?;fs::write(&tmp,body).map_err(|e|e.to_string())?;fs::rename(&tmp,&path).map_err(|e|e.to_string())}

pub fn normalize_address(value:&str)->Option<String>{let s=value.trim().to_ascii_lowercase();if s.len()==42&&s.starts_with("0x")&&s[2..].bytes().all(|b|b.is_ascii_hexdigit()){Some(s)}else{None}}
fn normalize_hash(value:&str)->Option<String>{let s=value.trim().to_ascii_lowercase();if s.len()==66&&s.starts_with("0x")&&s[2..].bytes().all(|b|b.is_ascii_hexdigit()){Some(s)}else{None}}
fn actions_for_wallet(wallet:Option<&Value>)->Vec<Value>{let mut rows:Vec<Value>=wallet.and_then(|w|w.get("actions")).and_then(Value::as_object).map(|m|m.values().cloned().collect()).unwrap_or_default();rows.sort_by_key(|a|a.get("createdAt").and_then(Value::as_u64).unwrap_or(0));rows}
fn points(actions:&[Value],verification:Option<&str>)->i64{actions.iter().filter(|a|verification.map(|v|a.get("verification").and_then(Value::as_str)==Some(v)).unwrap_or(true)).map(|a|a.get("points").and_then(Value::as_i64).unwrap_or(0)).sum()}

pub fn wallet_status(address:&str)->Value{
    let state=load_score();let wallet=state.get("wallets").and_then(Value::as_object).and_then(|m|m.get(address));let actions=actions_for_wallet(wallet);let required=["x_follow","faucet","swap","stake"];let completed=required.iter().filter(|name|actions.iter().any(|a|a.get("action").and_then(Value::as_str)==Some(**name))).count();
    json!({"ok":true,"address":address,"pendingScore":points(&actions,None),"verifiedOnchainScore":points(&actions,Some("onchain")),"verifiedExternalScore":points(&actions,Some("external-ensv2")),"socialPendingScore":points(&actions,Some("self-attested")),"finalizedOnchainScore":0,"genesis":{"completed":completed,"total":required.len(),"eligible":completed==required.len(),"status":if completed==required.len(){"pending-finalization"}else{"in-progress"}},"actions":actions})
}

pub fn network_intelligence()->Value{
    let state=load_score();let wallets:Map<String,Value>=state.get("wallets").and_then(Value::as_object).cloned().unwrap_or_default();let mut by_action=Map::new();let(mut total,mut onchain,mut external,mut social_pending,mut eligible_wallets)=(0u64,0u64,0u64,0u64,0u64);
    for wallet in wallets.values(){let actions=actions_for_wallet(Some(wallet));let mut kinds=std::collections::HashSet::new();for a in actions{total+=1;if let Some(action)=a.get("action").and_then(Value::as_str){kinds.insert(action.to_string());let current=by_action.get(action).and_then(Value::as_u64).unwrap_or(0)+1;by_action.insert(action.into(),json!(current));}match a.get("verification").and_then(Value::as_str){Some("onchain")=>onchain+=1,Some("external-ensv2")=>external+=1,Some("self-attested")=>social_pending+=1,_=>{}}}if ["x_follow","faucet","swap","stake"].iter().all(|k|kinds.contains(*k)){eligible_wallets+=1;}}
    json!({"ok":true,"generatedAt":Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true),"wallets":wallets.len(),"actions":{"total":total,"onchain":onchain,"external":external,"socialPending":social_pending},"byAction":by_action,"genesis":{"eligibleWallets":eligible_wallets,"finalizedOnchainScore":0},"disclosure":"Metrics are derived from ZORYQ Genesis records. On-chain actions are receipt-verified; external identity and self-attested social actions are separated. No score finalization is live."})
}

async fn rpc(client:&Client,rpc_url:&str,method:&str,params:Value)->Result<Value,String>{let r=client.post(rpc_url).json(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params})).send().await.map_err(|e|e.to_string())?;let j:Value=r.json().await.map_err(|e|e.to_string())?;if let Some(e)=j.get("error"){return Err(e.get("message").and_then(Value::as_str).unwrap_or("rpc_error").to_string())}Ok(j.get("result").cloned().unwrap_or(Value::Null))}

pub async fn record_onchain(client:&Client,rpc_url:&str,address_raw:&str,action:&str,hash_raw:&str)->Result<Value,(u16,Value)>{
    let address=normalize_address(address_raw).ok_or((400,json!({"ok":false,"error":"invalid_address"})))?;if action!="swap"&&action!="stake"{return Err((400,json!({"ok":false,"error":"unsupported_action"})))}let hash=normalize_hash(hash_raw).ok_or((400,json!({"ok":false,"error":"tx_hash_required"})))?;
    let(receipt,tx)=tokio::join!(rpc(client,rpc_url,"eth_getTransactionReceipt",json!([hash])),rpc(client,rpc_url,"eth_getTransactionByHash",json!([hash])));let receipt=receipt.map_err(|e|(503,json!({"ok":false,"error":"rpc_unavailable","detail":e})))?;let tx=tx.map_err(|e|(503,json!({"ok":false,"error":"rpc_unavailable","detail":e})))?;
    if receipt.is_null()||receipt.get("status").and_then(Value::as_str)!=Some("0x1")||tx.is_null(){return Err((400,json!({"ok":false,"error":"transaction_not_confirmed"})))}if tx.get("from").and_then(Value::as_str).map(|v|v.to_ascii_lowercase())!=Some(address.clone()){return Err((400,json!({"ok":false,"error":"transaction_sender_mismatch"})))}let to=tx.get("to").and_then(Value::as_str).unwrap_or("").to_ascii_lowercase();let expected=if action=="swap"{SWAP}else{STAKE};if to!=expected{return Err((400,json!({"ok":false,"error":if action=="swap"{"not_swap_transaction"}else{"not_stake_transaction"}})))}
    let _guard=score_lock().lock().await;let mut state=load_score();let proof=proof_hash(&hash);let owner_key=format!("{address}:{action}");if let Some(owner)=state.get("usedProofs").and_then(Value::as_object).and_then(|m|m.get(&proof)).and_then(Value::as_str){if owner!=owner_key{return Err((409,json!({"ok":false,"error":"proof_already_used"})))}}
    let wallets=state.get_mut("wallets").and_then(Value::as_object_mut).unwrap();let wallet=wallets.entry(address.clone()).or_insert_with(||json!({"actions":{}}));if !wallet.get("actions").map(Value::is_object).unwrap_or(false){wallet["actions"]=json!({});}let actions=wallet.get_mut("actions").and_then(Value::as_object_mut).unwrap();if actions.contains_key(action){return Ok(json!({"duplicate":true,"status":wallet_status(&address)}))}
    let points=if action=="swap"{250}else{300};let entry=json!({"action":action,"points":points,"verification":"onchain","campaignId":"genesis-v1","proofRef":proof,"txHash":hash,"metadata":{},"createdAt":now_ms()});actions.insert(action.into(),entry.clone());state.get_mut("usedProofs").and_then(Value::as_object_mut).unwrap().insert(proof,json!(owner_key));save_score(&state).map_err(|e|(500,json!({"ok":false,"error":"score_persist_failed","detail":e})))?;Ok(json!({"ok":true,"entry":entry,"status":wallet_status(&address)}))
}

pub async fn record_faucet(address_raw:&str,proof_ref:&str,tx_hash:&str)->Result<Value,(u16,Value)>{
    let address=normalize_address(address_raw).ok_or((400,json!({"ok":false,"error":"invalid_address"})))?;let _guard=score_lock().lock().await;let mut state=load_score();let owner_key=format!("{address}:faucet");let proof=proof_hash(proof_ref);
    if let Some(owner)=state.get("usedProofs").and_then(Value::as_object).and_then(|m|m.get(&proof)).and_then(Value::as_str){if owner!=owner_key{return Err((409,json!({"ok":false,"error":"proof_already_used"})))}}
    let wallets=state.get_mut("wallets").and_then(Value::as_object_mut).unwrap();let wallet=wallets.entry(address.clone()).or_insert_with(||json!({"actions":{}}));if !wallet.get("actions").map(Value::is_object).unwrap_or(false){wallet["actions"]=json!({});}let actions=wallet.get_mut("actions").and_then(Value::as_object_mut).unwrap();if actions.contains_key("faucet"){return Ok(json!({"duplicate":true,"status":wallet_status(&address)}))}
    let entry=json!({"action":"faucet","points":100,"verification":"server","campaignId":"genesis-v1","proofRef":proof,"txHash":if tx_hash.is_empty(){Value::Null}else{json!(tx_hash)},"metadata":{},"createdAt":now_ms()});actions.insert("faucet".into(),entry.clone());state.get_mut("usedProofs").and_then(Value::as_object_mut).unwrap().insert(proof,json!(owner_key));save_score(&state).map_err(|e|(500,json!({"ok":false,"error":"score_persist_failed","detail":e})))?;Ok(json!({"ok":true,"entry":entry,"status":wallet_status(&address)}))
}

fn normalize_campaign(value:&str)->Option<String>{
    let s=value.trim().to_ascii_lowercase();
    if s.is_empty()||s.len()>64{return None}
    let mut chars=s.chars();let first=chars.next()?;
    if !first.is_ascii_lowercase()&&!first.is_ascii_digit(){return None}
    if chars.all(|c|c.is_ascii_lowercase()||c.is_ascii_digit()||matches!(c,'.'|'_'|'-')){Some(s)}else{None}
}

fn x_share_proof(value:&str)->Option<String>{
    let u=Url::parse(value.trim()).ok()?;
    let host=u.host_str()?.to_ascii_lowercase();
    if host!="x.com"&&host!="www.x.com"{return None}
    let parts=u.path_segments()?.collect::<Vec<_>>();
    if parts.len()<3||parts[1]!="status"||parts[0].is_empty()||parts[2].is_empty()||!parts[2].bytes().all(|b|b.is_ascii_digit()){return None}
    Some(format!("x-status:{}",parts[2]))
}

pub async fn record_social(address_raw:&str,action:&str,campaign_raw:&str,x_handle:&str,proof_raw:&str)->Result<Value,(u16,Value)>{
    let address=normalize_address(address_raw).ok_or((400,json!({"ok":false,"error":"invalid_address"})))?;
    if action!="x_follow"&&action!="x_share"{return Err((400,json!({"ok":false,"error":"unsupported_action"})))}
    let campaign_id=normalize_campaign(if campaign_raw.trim().is_empty(){"genesis-v1"}else{campaign_raw}).ok_or((400,json!({"ok":false,"error":"invalid_campaign"})))?;
    if action=="x_follow"&&x_handle.trim().trim_start_matches('@').to_ascii_lowercase()!="zoriqnetwork"{return Err((400,json!({"ok":false,"error":"official_x_handle_required"})))}
    let proof_ref=if action=="x_share"{x_share_proof(proof_raw).ok_or((400,json!({"ok":false,"error":"valid_x_post_url_required"})))?}else if proof_raw.trim().is_empty(){format!("x_follow:{address}")}else{proof_raw.to_string()};
    let key=if action=="x_share"{format!("x_share:{campaign_id}")}else{"x_follow".into()};let owner_key=format!("{address}:{key}");let proof=proof_hash(&proof_ref);let points=if action=="x_follow"{50}else{200};
    let _guard=score_lock().lock().await;let mut state=load_score();
    if let Some(owner)=state.get("usedProofs").and_then(Value::as_object).and_then(|m|m.get(&proof)).and_then(Value::as_str){if owner!=owner_key{return Err((409,json!({"ok":false,"error":"proof_already_used"})))}}
    let wallets=state.get_mut("wallets").and_then(Value::as_object_mut).unwrap();let wallet=wallets.entry(address.clone()).or_insert_with(||json!({"actions":{}}));if !wallet.get("actions").map(Value::is_object).unwrap_or(false){wallet["actions"]=json!({});}let actions=wallet.get_mut("actions").and_then(Value::as_object_mut).unwrap();if actions.contains_key(&key){return Ok(json!({"duplicate":true,"status":wallet_status(&address)}))}
    let entry=json!({"action":action,"points":points,"verification":"self-attested","campaignId":campaign_id,"proofRef":proof,"txHash":Value::Null,"metadata":{},"createdAt":now_ms()});actions.insert(key,entry.clone());state.get_mut("usedProofs").and_then(Value::as_object_mut).unwrap().insert(proof,json!(owner_key));save_score(&state).map_err(|e|(500,json!({"ok":false,"error":"score_persist_failed","detail":e})))?;
    Ok(json!({"ok":true,"entry":entry,"status":wallet_status(&address),"notice":"Social points are pending until X OAuth/API verification is enabled."}))
}
