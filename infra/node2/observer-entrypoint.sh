#!/bin/sh
set -eu

# ZORYQ Node 2 - observer/follower bootstrap.
# This process MUST NOT create or use a dev mnemonic and MUST NOT run --dev.
# It is intentionally incapable of independently producing blocks.

CHAIN_SPEC="${ZORYQ_NODE2_CHAIN_SPEC:-/data/zoryq-reth-effective-genesis.json}"
DATA_DIR="${ZORYQ_NODE2_DATA_DIR:-/data/reth}"
HTTP_ADDR="${ZORYQ_NODE2_HTTP_ADDR:-127.0.0.1}"
HTTP_PORT="${ZORYQ_NODE2_HTTP_PORT:-8545}"
P2P_ADDR="${ZORYQ_NODE2_P2P_ADDR:-0.0.0.0}"
P2P_PORT="${ZORYQ_NODE2_P2P_PORT:-30303}"
PEERS_FILE="${ZORYQ_NODE2_PEERS_FILE:-/data/known-peers.json}"
TRUSTED_PEERS="${ZORYQ_NODE2_TRUSTED_PEERS:-}"
BOOTNODES="${ZORYQ_NODE2_BOOTNODES:-}"

if [ ! -s "$CHAIN_SPEC" ]; then
  echo "[zoryq-node2] FATAL: exact chain spec missing at $CHAIN_SPEC" >&2
  echo "[zoryq-node2] Copy the exact effective genesis from Node 1; never regenerate it from a new mnemonic." >&2
  exit 72
fi

mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR" 2>/dev/null || true

set -- node \
  --chain "$CHAIN_SPEC" \
  --datadir "$DATA_DIR" \
  --addr "$P2P_ADDR" \
  --port "$P2P_PORT" \
  --peers-file "$PEERS_FILE" \
  --http \
  --http.addr "$HTTP_ADDR" \
  --http.port "$HTTP_PORT" \
  --http.api eth,net,web3

if [ -n "$TRUSTED_PEERS" ]; then
  set -- "$@" --trusted-peers "$TRUSTED_PEERS"
fi

if [ -n "$BOOTNODES" ]; then
  set -- "$@" --bootnodes "$BOOTNODES"
fi

# Conservative memory settings suitable for a small VPS. They can be tuned only
# after observing real memory/disk/peer metrics.
set -- "$@" \
  --engine.cross-block-cache-size 64 \
  --engine.memory-block-buffer-target 2 \
  --engine.persistence-threshold 2 \
  --engine.disable-state-cache \
  --engine.disable-prewarming \
  --tx-channel-memory-limit 33554432 \
  --rpc.evm-memory-limit 67108864

echo "[zoryq-node2] starting observer; chain=$CHAIN_SPEC data=$DATA_DIR p2p=$P2P_ADDR:$P2P_PORT"
exec reth "$@"
