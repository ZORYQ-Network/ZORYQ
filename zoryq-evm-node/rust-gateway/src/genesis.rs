use serde_json::{json, Map, Value};
use std::{env, fs, time::{SystemTime, UNIX_EPOCH}};

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
        if !obj.get("wallets").map(Value::is_object).unwrap_or(false) {
            obj.insert("wallets".into(), json!({}));
        }
        if !obj.get("usedProofs").map(Value::is_object).unwrap_or(false) {
            obj.insert("usedProofs".into(), json!({}));
        }
    }
    state
}

pub fn normalize_address(value: &str) -> Option<String> {
    let s = value.trim().to_ascii_lowercase();
    if s.len() == 42 && s.starts_with("0x") && s[2..].bytes().all(|b| b.is_ascii_hexdigit()) {
        Some(s)
    } else {
        None
    }
}

fn actions_for_wallet(wallet: Option<&Value>) -> Vec<Value> {
    let mut rows: Vec<Value> = wallet
        .and_then(|w| w.get("actions"))
        .and_then(Value::as_object)
        .map(|m| m.values().cloned().collect())
        .unwrap_or_default();
    rows.sort_by_key(|a| a.get("createdAt").and_then(Value::as_u64).unwrap_or(0));
    rows
}

fn points(actions: &[Value], verification: Option<&str>) -> i64 {
    actions.iter().filter(|a| {
        verification.map(|v| a.get("verification").and_then(Value::as_str) == Some(v)).unwrap_or(true)
    }).map(|a| a.get("points").and_then(Value::as_i64).unwrap_or(0)).sum()
}

pub fn wallet_status(address: &str) -> Value {
    let state = load_score();
    let wallet = state.get("wallets").and_then(Value::as_object).and_then(|m| m.get(address));
    let actions = actions_for_wallet(wallet);
    let required = ["x_follow", "faucet", "swap", "stake"];
    let completed = required.iter().filter(|name| actions.iter().any(|a| a.get("action").and_then(Value::as_str) == Some(**name))).count();
    json!({
        "ok": true,
        "address": address,
        "pendingScore": points(&actions, None),
        "verifiedOnchainScore": points(&actions, Some("onchain")),
        "verifiedExternalScore": points(&actions, Some("external-ensv2")),
        "socialPendingScore": points(&actions, Some("self-attested")),
        "finalizedOnchainScore": 0,
        "genesis": {
            "completed": completed,
            "total": required.len(),
            "eligible": completed == required.len(),
            "status": if completed == required.len() { "pending-finalization" } else { "in-progress" }
        },
        "actions": actions
    })
}

pub fn network_intelligence() -> Value {
    let state = load_score();
    let wallets: Map<String, Value> = state.get("wallets").and_then(Value::as_object).cloned().unwrap_or_default();
    let mut by_action = Map::new();
    let mut total = 0u64;
    let mut onchain = 0u64;
    let mut external = 0u64;
    let mut social_pending = 0u64;
    let mut eligible_wallets = 0u64;
    for wallet in wallets.values() {
        let actions = actions_for_wallet(Some(wallet));
        let mut kinds = std::collections::HashSet::new();
        for a in actions {
            total += 1;
            if let Some(action) = a.get("action").and_then(Value::as_str) {
                kinds.insert(action.to_string());
                let current = by_action.get(action).and_then(Value::as_u64).unwrap_or(0) + 1;
                by_action.insert(action.into(), json!(current));
            }
            match a.get("verification").and_then(Value::as_str) {
                Some("onchain") => onchain += 1,
                Some("external-ensv2") => external += 1,
                Some("self-attested") => social_pending += 1,
                _ => {}
            }
        }
        if ["x_follow", "faucet", "swap", "stake"].iter().all(|k| kinds.contains(*k)) {
            eligible_wallets += 1;
        }
    }
    let generated_at_unix = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    json!({
        "ok": true,
        "generatedAtUnix": generated_at_unix,
        "wallets": wallets.len(),
        "actions": {"total": total, "onchain": onchain, "external": external, "socialPending": social_pending},
        "byAction": by_action,
        "genesis": {"eligibleWallets": eligible_wallets, "finalizedOnchainScore": 0},
        "disclosure": "Metrics are derived from ZORYQ Genesis records. On-chain actions are receipt-verified; external identity and self-attested social actions are separated. No score finalization is live."
    })
}
