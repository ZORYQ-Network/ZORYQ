#!/bin/sh
set -eu

mkdir -p /data/reth /app/web /app/protocol-out
export ZORYQ_RETH_OPERATOR_COUNT="${ZORYQ_RETH_OPERATOR_COUNT:-24}"
export ZORYQ_SOCIAL_RELAYER_INDEX="${ZORYQ_SOCIAL_RELAYER_INDEX:-23}"
export ZORYQ_RETH_CHAIN_SPEC="${ZORYQ_RETH_CHAIN_SPEC:-/data/zoryq-reth-effective-genesis.json}"

# Prepare an effective chain spec once. On a fresh network this adds the funded
# operator pool. On an explicit production migration it converts the last
# verified Anvil account state into the Reth genesis allocation.
node /app/prepare-reth-genesis.mjs

exec node /app/product-gateway.mjs
