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

EL1_RPC="$(port_url "$EL1" rpc)"
EL2_RPC="$(port_url "$EL2" rpc)"
CL1_HTTP="$(port_url "$CL1" http)"
CL2_HTTP="$(port_url "$CL2" http)"

rpc() {
  curl -fsS -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":[]}" "$1" | jq -r '.result // empty'
}

hex_to_dec() { printf '%d\n' "$((16#${1#0x}))"; }

CHAIN1="$(rpc "$EL1_RPC" eth_chainId)"
CHAIN2="$(rpc "$EL2_RPC" eth_chainId)"
[[ "$CHAIN1" == "$CHAIN2" ]] || { echo "chain id mismatch: $CHAIN1 vs $CHAIN2"; exit 20; }

# Wait for both nodes to advance beyond genesis and agree on a recent canonical hash.
for _ in $(seq 1 90); do
  B1_HEX="$(rpc "$EL1_RPC" eth_blockNumber)"
  B2_HEX="$(rpc "$EL2_RPC" eth_blockNumber)"
  if [[ -n "$B1_HEX" && -n "$B2_HEX" ]]; then
    B1="$(hex_to_dec "$B1_HEX")"; B2="$(hex_to_dec "$B2_HEX")"
    if (( B1 > 2 && B2 > 2 )); then break; fi
  fi
  sleep 4
done

TARGET=$(( B1 < B2 ? B1 : B2 ))
TARGET_HEX=$(printf '0x%x' "$TARGET")
block_hash() {
  curl -fsS -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"$2\",false]}" "$1" | jq -r '.result.hash // empty'
}
H1="$(block_hash "$EL1_RPC" "$TARGET_HEX")"
H2="$(block_hash "$EL2_RPC" "$TARGET_HEX")"
[[ -n "$H1" && "$H1" == "$H2" ]] || { echo "canonical hash mismatch at $TARGET: $H1 vs $H2"; exit 21; }

# Finality must be observable and consistent on both consensus clients.
F1="$(curl -fsS "$CL1_HTTP/eth/v1/beacon/states/head/finality_checkpoints" | jq -r '.data.finalized.epoch // empty')"
F2="$(curl -fsS "$CL2_HTTP/eth/v1/beacon/states/head/finality_checkpoints" | jq -r '.data.finalized.epoch // empty')"
[[ -n "$F1" && -n "$F2" && "$F1" == "$F2" ]] || { echo "finality mismatch: $F1 vs $F2"; exit 22; }

P1="$(curl -fsS "$CL1_HTTP/eth/v1/node/peers" | jq '.data | length')"
P2="$(curl -fsS "$CL2_HTTP/eth/v1/node/peers" | jq '.data | length')"
(( P1 > 0 && P2 > 0 )) || { echo "consensus peers missing: $P1 $P2"; exit 23; }

cat <<JSON
{
  "ok": true,
  "networkId": "$CHAIN1",
  "sampleBlock": $TARGET,
  "sampleHash": "$H1",
  "finalizedEpoch": "$F1",
  "consensusPeers": {"node1": $P1, "node2": $P2}
}
JSON
