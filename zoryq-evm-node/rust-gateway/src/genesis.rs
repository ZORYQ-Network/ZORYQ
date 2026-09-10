use chrono::{SecondsFormat, Utc};
use reqwest::Client;
use serde_json::{json, Map, Value};
use std::{env, fs, time::{SystemTime, UNIX_EPOCH}};

const SWAP:&str="0x8205f34b803edd79ddca414f00e12ecddeddacbe";
const STAKE:&str="0xbb26faadd1e083c7c0dc0a82ddb96cc45253ecb1";

fn score_file() -> String {
    env::var("ZORYQ_GENESIS_SCORE_STATE").unwrap_or_else(|_| "/data/genesis-score.json".into())
}

fn load_score() -> Value {
    let mut state = fs::read_to_string(score_file())
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or_else(|| json!({"version":3,"wallets":{},"usedProofs":{}}));
    if let Some(obj) = state.as_object_mut() {
        obj.insert("version".into(), json!(3));
        if !obj.get("wallets").map(Value::is_object).unwrap_or(false) { obj.insert("wallets".into(), json!({})); }
        if !obj.get("usedProofs").map(Value::is_object).unwrap_or(false) { obj.insert("usedProofs".into(), json!({})); }
    }
    state
}

fn save_score(state:&Value)->Result<(),String>{
    let path=score_file(); let tmp=format!("{path}.tmp");
    let body=serde_json::to_vec_pretty(state).map_err(|e|e.to_string())?;
    fs::write(&tmp,body).map_err(|e|e.to_string())?;
    fs::rename(&tmp,&path).map_err(|e|e.to_string())
}

pub fn normalize_address(value: &str) -> Option<String> {
    let s = value.trim().to_ascii_lowercase();
    if s.len() == 42 && s.starts_with("0x") && s[2..].bytes().all(|b| b.is_ascii_hexdigit()) { Some(s) } else { None }
}
fn normalize_hash(value:&str)->Option<String>{let s=value.trim().to_ascii_lowercase();if s.len()==66&&s.starts_with("0x")&&s[2..].bytes().all(|b|b.is_ascii_hexdigit()){Some(s)}else{None}}

fn actions_for_wallet(wallet: Option<&Value>) -> Vec<Value> {
    let mut rows: Vec<Value> = wallet.and_then(|w| w.get("actions")).and_then(Value::as_object).map(|m| m.values().cloned().collect()).unwrap_or_default();
    rows.sort_by_key(|a| a.get("createdAt").and_then(Value::as_u64).unwrap_or(0)); rows
}
fn points(actions: &[Value], verification: Option<&str>) -> i64 { actions.iter().filter(|a| verification.map(|v| a.get("verification").and_then(Value::as_str) == Some(v)).unwrap_or(true)).map(|a| a.get("points").and_then(Value::as_i64).unwrap_or(0)).sum() }

pub fn wallet_status(address: &str) -> Value {
    let state = load_score(); let wallet = state.get("wallets").and_then(Value::as_object).and_then(|m| m.get(address)); let actions = actions_for_wallet(wallet);
    let required = ["x_follow", "faucet", "swap", "stake"];
    let completed = required.iter().filter(|name| actions.iter().any(|a| a.get("action").and_then(Value::as_str) == Some(**name))).count();
    json!({"ok":true,"address":address,"pendingScore":points(&actions,None),"verifiedOnchainScore":points(&actions,Some("onchain")),"verifiedExternalScore":points(&actions,Some("external-ensv2")),"socialPendingScore":points(&actions,Some("self-attested")),"finalizedOnchainScore":0,"genesis":{"completed":completed,"total":required.len(),"eligible":completed==required.len(),"status":if completed==required.len(){"pending-finalization"}else{"in-progress"}},"actions":actions})
}

pub fn network_intelligence() -> Value {
    let state=load_score(); let wallets:Map<String,Value>=state.get("wallets").and_then(Value::as_object).cloned().unwrap_or_default(); let mut by_action=Map::new(); let(mut total,mut onchain,mut external,mut social_pending,mut eligible_wallets)=(0u64,0u64,0u64,0u64,0u64);
    for wallet in wallets.values(){let actions=actions_for_wallet(Some(wallet));let mut kinds=std::collections::HashSet::new();for a in actions{total+=1;if let Some(action)=a.get("action").and_then(Value::as_str){kinds.insert(action.to_string());let current=by_action.get(action).and_then(Value::as_u64).unwrap_or(0)+1;by_action.insert(action.into(),json!(current));}match a.get("verification").and_then(Value::as_str){Some("onchain")=>onchain+=1,Some("external-ensv2")=>external+=1,Some("self-attested")=>social_pending+=1,_=>{}}}if ["x_follow","faucet","swap","stake"].iter().all(|k|kinds.contains(*k)){eligible_wallets+=1;}}
    json!({"ok":true,"generatedAt":Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true),"wallets":wallets.len(),"actions":{"total":total,"onchain":onchain,"external":external,"socialPending":social_pending},"byAction":by_action,"genesis":{"eligibleWallets":eligible_wallets,"finalizedOnchainScore":0},"disclosure":"Metrics are derived from ZORYQ Genesis records. On-chain actions are receipt-verified; external identity and self-attested social actions are separated. No score finalization is live."})
}

async fn rpc(client:&Client,rpc_url:&str,method:&str,params:Value)->Result<Value,String>{let r=client.post(rpc_url).json(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params})).send().await.map_err(|e|e.to_string())?;let j:Value=r.json().await.map_err(|e|e.to_string())?;if let Some(e)=j.get("error"){return Err(e.get("message").and_then(Value::as_str).unwrap_or("rpc_error").to_string())}Ok(j.get("result").cloned().unwrap_or(Value::Null))}

pub async fn record_onchain(client:&Client,rpc_url:&str,address_raw:&str,action:&str,hash_raw:&str)->Result<Value,(u16,Value)>{
    let address=normalize_address(address_raw).ok_or((400,json!({"ok":false,"error":"invalid_address"})))?;
    if action!="swap"&&action!="stake"{return Err((400,json!({"ok":false,"error":"unsupported_action"})))}
    let hash=normalize_hash(hash_raw).ok_or((400,json!({"ok":false,"error":"tx_hash_required"})))?;
    let (receipt,tx)=tokio::join!(rpc(client,rpc_url,"eth_getTransactionReceipt",json!([hash])),rpc(client,rpc_url,"eth_getTransactionByHash",json!([hash])));
    let receipt=receipt.map_err(|e|(503,json!({"ok":false,"error":"rpc_unavailable","detail":e})))?; let tx=tx.map_err(|e|(503,json!({"ok":false,"error":"rpc_unavailable","detail":e})))?;
    if receipt.is_null()||receipt.get("status").and_then(Value::as_str)!=Some("0x1")||tx.is_null(){return Err((400,json!({"ok":false,"error":"transaction_not_confirmed"})))}
    if tx.get("from").and_then(Value::as_str).map(|v|v.to_ascii_lowercase())!=Some(address.clone()){return Err((400,json!({"ok":false,"error":"transaction_sender_mismatch"})))}
    let to=tx.get("to").and_then(Value::as_str).unwrap_or("").to_ascii_lowercase(); let expected=if action=="swap"{SWAP}else{STAKE};
    if to!=expected{return Err((400,json!({"ok":false,"error":if action=="swap"{"not_swap_transaction"}else{"not_stake_transaction"}})))}
    let mut state=load_score(); let proof_key=format!("tx:{hash}");
    if let Some(owner)=state.get("usedProofs").and_then(Value::as_object).and_then(|m|m.get(&proof_key)).and_then(Value::as_str){if owner!=format!("{address}:{action}"){return Err((409,json!({"ok":false,"error":"proof_already_used"})))}}
    let wallets=state.get_mut("wallets").and_then(Value::as_object_mut).unwrap(); let wallet=wallets.entry(address.clone()).or_insert_with(||json!({"actions":{}})); if !wallet.get("actions").map(Value::is_object).unwrap_or(false){wallet["actions"]=json!({});}
    let actions=wallet.get_mut("actions").and_then(Value::as_object_mut).unwrap(); if actions.contains_key(action){return Ok(json!({"duplicate":true,"status":wallet_status(&address)}))}
    let now=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64; let points=if action=="swap"{250}else{300}; let entry=json!({"action":action,"points":points,"verification":"onchain","campaignId":"genesis-v1","proofRef":proof_key,"txHash":hash,"metadata":{},"createdAt":now}); actions.insert(action.into(),entry.clone()); state.get_mut("usedProofs").and_then(Value::as_object_mut).unwrap().insert(proof_key,json!(format!("{address}:{action}"))); save_score(&state).map_err(|e|(500,json!({"ok":false,"error":"score_persist_failed","detail":e})))?;
    Ok(json!({"ok":true,"entry":entry,"status":wallet_status(&address)}))
}
