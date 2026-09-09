#!/bin/sh
set -eu

mkdir -p /data/reth /app/web /app/protocol-out
export ZORYQ_RETH_OPERATOR_COUNT="${ZORYQ_RETH_OPERATOR_COUNT:-24}"
export ZORYQ_SOCIAL_RELAYER_INDEX="${ZORYQ_SOCIAL_RELAYER_INDEX:-23}"
export ZORYQ_RETH_CHAIN_SPEC="${ZORYQ_RETH_CHAIN_SPEC:-/data/zoryq-reth-effective-genesis.json}"
export ZORYQ_PRODUCT_HEAP_MB="${ZORYQ_PRODUCT_HEAP_MB:-96}"
# Default ceiling inherited by Node children that do not have a stricter per-role
# command-line limit. Explicit --max-old-space-size flags below/inside launchers win.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=192}"

# Prepare an effective chain spec once. On a fresh network this adds the funded
# operator pool. On an explicit production migration it converts the last
# verified Anvil account state into the Reth genesis allocation.
node --max-old-space-size=128 /app/prepare-reth-genesis.mjs

exec node --max-old-space-size="${ZORYQ_PRODUCT_HEAP_MB}" /app/product-gateway.mjs
