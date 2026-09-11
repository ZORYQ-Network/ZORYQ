#!/usr/bin/env bash
set -euo pipefail

: "${ZORYQ_MAINNET_CHAIN_ID:?ZORYQ_MAINNET_CHAIN_ID is required}"
: "${ZORYQ_MAINNET_GENESIS_PATH:?ZORYQ_MAINNET_GENESIS_PATH is required}"
: "${ZORYQ_MAINNET_GENESIS_SHA256:?ZORYQ_MAINNET_GENESIS_SHA256 is required}"
: "${ZORYQ_MAINNET_JWT_SECRET_PATH:?ZORYQ_MAINNET_JWT_SECRET_PATH is required}"
: "${ZORYQ_MAINNET_LAUNCH_MANIFEST:?ZORYQ_MAINNET_LAUNCH_MANIFEST is required}"
: "${ZORYQ_MAINNET_LAUNCH_POLICY:?ZORYQ_MAINNET_LAUNCH_POLICY is required}"
: "${ZORYQ_MAINNET_LAUNCH_APPROVALS:?ZORYQ_MAINNET_LAUNCH_APPROVALS is required}"

if [[ "${ZORYQ_NETWORK_MODE:-}" != "mainnet" ]]; then
  echo '[zoryq-mainnet] refusing startup unless ZORYQ_NETWORK_MODE=mainnet' >&2
  exit 80
fi
if [[ "${ZORYQ_MAINNET_CHAIN_ID}" == "5919065" ]]; then
  echo '[zoryq-mainnet] testnet chain id is forbidden in mainnet runtime' >&2
  exit 80
fi
for file in "$ZORYQ_MAINNET_GENESIS_PATH" "$ZORYQ_MAINNET_JWT_SECRET_PATH" "$ZORYQ_MAINNET_LAUNCH_MANIFEST" "$ZORYQ_MAINNET_LAUNCH_POLICY" "$ZORYQ_MAINNET_LAUNCH_APPROVALS"; do
  if [[ ! -f "$file" ]]; then
    echo "[zoryq-mainnet] required file missing: $file" >&2
    exit 80
  fi
done

actual_genesis_sha="$(sha256sum "$ZORYQ_MAINNET_GENESIS_PATH" | awk '{print $1}')"
if [[ "$actual_genesis_sha" != "${ZORYQ_MAINNET_GENESIS_SHA256,,}" ]]; then
  echo '[zoryq-mainnet] genesis SHA-256 mismatch' >&2
  exit 80
fi

export ZORYQ_SERVER_SOURCE=/app/backend.mjs
export ZORYQ_GENESIS_PREP_SOURCE=/app/genesis-ceremony.mjs
node /app/mainnet-guard.mjs
node /app/launch-certificate.mjs \
  --manifest "$ZORYQ_MAINNET_LAUNCH_MANIFEST" \
  --policy "$ZORYQ_MAINNET_LAUNCH_POLICY" \
  --approvals "$ZORYQ_MAINNET_LAUNCH_APPROVALS"

if [[ "${ZORYQ_MAINNET_PREFLIGHT_ONLY:-false}" == "true" ]]; then
  echo '[zoryq-mainnet] preflight complete; runtime intentionally not started'
  exit 0
fi

RETH_DATA_DIR="${ZORYQ_RETH_DATA_DIR:-/data/reth-mainnet}"
AUTHRPC_ADDR="${ZORYQ_AUTHRPC_ADDR:-127.0.0.1}"
AUTHRPC_PORT="${ZORYQ_AUTHRPC_PORT:-8551}"
mkdir -p "$RETH_DATA_DIR"

# Production execution mode: deliberately no --dev, no --dev.mnemonic and no
# debug/tracing module on the regular HTTP RPC. Block production must be driven
# by an authenticated consensus client over Engine API using the shared JWT.
reth node \
  --chain "$ZORYQ_MAINNET_GENESIS_PATH" \
  --datadir "$RETH_DATA_DIR" \
  --http \
  --http.addr 127.0.0.1 \
  --http.port 8545 \
  --http.api eth,net,web3 \
  --authrpc.addr "$AUTHRPC_ADDR" \
  --authrpc.port "$AUTHRPC_PORT" \
  --authrpc.jwtsecret "$ZORYQ_MAINNET_JWT_SECRET_PATH" \
  --rpc.max-request-size 1 \
  --rpc.max-response-size 16 &
reth_pid=$!

PORT="${PORT:-8080}" ZORYQ_RETH_RPC_URL=http://127.0.0.1:8545 node /app/backend.mjs &
backend_pid=$!

shutdown() {
  kill -TERM "$backend_pid" "$reth_pid" 2>/dev/null || true
  wait "$backend_pid" "$reth_pid" 2>/dev/null || true
}
trap shutdown TERM INT EXIT

# If either process exits, stop the other. A production supervisor can then
# restart the whole unit instead of leaving a half-alive execution stack.
wait -n "$reth_pid" "$backend_pid"
code=$?
shutdown
trap - TERM INT EXIT
exit "$code"
