#!/bin/sh
set -eu

# ZORYQ testnet profile for a 1 GB container.
# This wrapper changes cache/concurrency ceilings only; the chain spec, datadir,
# dev finality and RPC method set are still supplied by server.mjs.
exec /usr/local/bin/reth \
  --engine.cross-block-cache-size="${ZORYQ_RETH_CROSS_BLOCK_CACHE_MB:-64}" \
  --engine.persistence-threshold="${ZORYQ_RETH_PERSISTENCE_THRESHOLD:-2}" \
  --engine.memory-block-buffer-target="${ZORYQ_RETH_MEMORY_BLOCK_BUFFER_TARGET:-2}" \
  --rpc.max-connections="${ZORYQ_RETH_RPC_MAX_CONNECTIONS:-128}" \
  --rpc.max-blocking-io-requests="${ZORYQ_RETH_RPC_BLOCKING_IO:-32}" \
  --rpc.evm-memory-limit="${ZORYQ_RETH_RPC_EVM_MEMORY_LIMIT:-134217728}" \
  --rpc-cache.max-blocks="${ZORYQ_RETH_RPC_CACHE_BLOCKS:-512}" \
  --rpc-cache.max-receipts="${ZORYQ_RETH_RPC_CACHE_RECEIPTS:-1000}" \
  --rpc-cache.max-bals="${ZORYQ_RETH_RPC_CACHE_BALS:-128}" \
  --rpc-cache.max-concurrent-db-requests="${ZORYQ_RETH_RPC_CACHE_DB_REQUESTS:-64}" \
  --rpc-cache.max-cached-tx-hashes="${ZORYQ_RETH_RPC_CACHE_TX_HASHES:-5000}" \
  "$@"
