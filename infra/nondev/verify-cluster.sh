#!/usr/bin/env bash
set -euo pipefail

ENCLAVE="${1:-zoryq-nondev}"
EL1="el-1-reth-lighthouse"
EL2="el-2-reth-lighthouse"
CL1="cl-1-lighthouse-reth"
CL2="cl-2-lighthouse-reth"

port_url() {
  local service="$1" port="$2"
  kurtosis port print "$ENCLAVE" "$service" "$port"
}

refresh_urls() {
  EL1_RPC="$(port_url "$EL1" rpc)"
  EL2_RPC="$(port_url "$EL2" rpc)"
  CL1_HTTP="$(port_url "$CL1" http)"
  CL2_HTTP="$(port_url "$CL2" http)"
}
refresh_urls

rpc() {
  curl -fsS -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":[]}" "$1" | jq -r '.result // empty'
}

hex_to_dec() { printf '%d\n' "$((16#${1#0x}))"; }

block_hash() {
  curl -fsS -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"$2\",false]}" "$1" | jq -r '.result.hash // empty'
}

finalized_epoch() {
  curl -fsS "$1/eth/v1/beacon/states/head/finality_checkpoints" | jq -r '.data.finalized.epoch // empty'
}

peer_count() {
  curl -fsS "$1/eth/v1/node/peers" | jq '.data | length'
}

CHAIN1="$(rpc "$EL1_RPC" eth_chainId)"
CHAIN2="$(rpc "$EL2_RPC" eth_chainId)"
[[ "$CHAIN1" == "$CHAIN2" ]] || { echo "chain id mismatch: $CHAIN1 vs $CHAIN2"; exit 20; }

# Wait until BOTH nodes have advanced and Lighthouse has finalized a non-genesis epoch.
# Minimal preset finality may still take several minutes, so give the CI proof room to
# observe actual finality rather than accepting epoch 0.
READY=false
for _ in $(seq 1 180); do
  B1_HEX="$(rpc "$EL1_RPC" eth_blockNumber || true)"
  B2_HEX="$(rpc "$EL2_RPC" eth_blockNumber || true)"
  F1="$(finalized_epoch "$CL1_HTTP" 2>/dev/null || true)"
  F2="$(finalized_epoch "$CL2_HTTP" 2>/dev/null || true)"
  if [[ -n "$B1_HEX" && -n "$B2_HEX" && -n "$F1" && -n "$F2" ]]; then
    B1="$(hex_to_dec "$B1_HEX")"; B2="$(hex_to_dec "$B2_HEX")"
    if (( B1 > 2 && B2 > 2 && 10#$F1 > 0 && 10#$F2 > 0 )); then
      READY=true
      break
    fi
  fi
  sleep 4
done
$READY || { echo "cluster did not reach non-genesis finality in time: blocks=${B1:-?}/${B2:-?} finality=${F1:-?}/${F2:-?}"; exit 21; }

TARGET=$(( B1 < B2 ? B1 : B2 ))
TARGET_HEX=$(printf '0x%x' "$TARGET")
H1="$(block_hash "$EL1_RPC" "$TARGET_HEX")"
H2="$(block_hash "$EL2_RPC" "$TARGET_HEX")"
[[ -n "$H1" && "$H1" == "$H2" ]] || { echo "canonical hash mismatch at $TARGET: $H1 vs $H2"; exit 22; }
[[ "$F1" == "$F2" ]] || { echo "finality mismatch: $F1 vs $F2"; exit 23; }

P1="$(peer_count "$CL1_HTTP")"
P2="$(peer_count "$CL2_HTTP")"
(( P1 > 0 && P2 > 0 )) || { echo "consensus peers missing: $P1 $P2"; exit 24; }

PRE_RESTART_BLOCK=$B2
PRE_RESTART_FINALITY=$F2
RESTART_STARTED_AT=$(date +%s)

# Restart the complete Node 2 pair. Kurtosis service stop/start retains the service
# definition and filesystem, so this checks rejoin from the same prototype state and
# identity instead of creating a fresh replacement node.
kurtosis service stop "$ENCLAVE" "$CL2"
kurtosis service stop "$ENCLAVE" "$EL2"
sleep 10
kurtosis service start "$ENCLAVE" "$EL2"
kurtosis service start "$ENCLAVE" "$CL2"
refresh_urls

REJOINED=false
for _ in $(seq 1 120); do
  B1_HEX="$(rpc "$EL1_RPC" eth_blockNumber 2>/dev/null || true)"
  B2_HEX="$(rpc "$EL2_RPC" eth_blockNumber 2>/dev/null || true)"
  F1R="$(finalized_epoch "$CL1_HTTP" 2>/dev/null || true)"
  F2R="$(finalized_epoch "$CL2_HTTP" 2>/dev/null || true)"
  P2R="$(peer_count "$CL2_HTTP" 2>/dev/null || echo 0)"
  if [[ -n "$B1_HEX" && -n "$B2_HEX" && -n "$F1R" && -n "$F2R" ]]; then
    B1R="$(hex_to_dec "$B1_HEX")"; B2R="$(hex_to_dec "$B2_HEX")"
    if (( B2R > PRE_RESTART_BLOCK && P2R > 0 && 10#$F2R >= 10#$PRE_RESTART_FINALITY )); then
      SAMPLE=$(( B1R < B2R ? B1R : B2R ))
      SAMPLE_HEX=$(printf '0x%x' "$SAMPLE")
      RH1="$(block_hash "$EL1_RPC" "$SAMPLE_HEX")"
      RH2="$(block_hash "$EL2_RPC" "$SAMPLE_HEX")"
      if [[ -n "$RH1" && "$RH1" == "$RH2" && "$F1R" == "$F2R" ]]; then
        REJOINED=true
        break
      fi
    fi
  fi
  sleep 4
done
$REJOINED || { echo "Node 2 failed restart/rejoin convergence"; exit 25; }

RECOVERY_SECONDS=$(( $(date +%s) - RESTART_STARTED_AT ))

cat <<JSON
{
  "ok": true,
  "networkId": "$CHAIN1",
  "preRestart": {
    "sampleBlock": $TARGET,
    "sampleHash": "$H1",
    "finalizedEpoch": "$F1",
    "consensusPeers": {"node1": $P1, "node2": $P2}
  },
  "restartRejoin": {
    "node2PreRestartBlock": $PRE_RESTART_BLOCK,
    "node2PostRestartBlock": $B2R,
    "finalizedEpoch": "$F2R",
    "sampleBlock": $SAMPLE,
    "sampleHash": "$RH2",
    "node2ConsensusPeers": $P2R,
    "canonicalAfterRestart": true,
    "recoverySeconds": $RECOVERY_SECONDS
  }
}
JSON
