#!/bin/sh
set -eu

mkdir -p /data/reth /app/web /app/protocol-out
export ZORYQ_RETH_OPERATOR_COUNT="${ZORYQ_RETH_OPERATOR_COUNT:-24}"
export ZORYQ_SOCIAL_RELAYER_INDEX="${ZORYQ_SOCIAL_RELAYER_INDEX:-23}"
export ZORYQ_RETH_CHAIN_SPEC="${ZORYQ_RETH_CHAIN_SPEC:-/data/zoryq-reth-effective-genesis.json}"

# Railway production currently runs inside a ~1 GB memory budget. Reth v2.5.x
# defaults include multi-GB execution caches that are appropriate for larger
# nodes but can trigger cgroup OOM/SIGKILL in this compact public testnet.
# Keep the consensus/execution behavior unchanged while placing conservative
# ceilings on caches and per-RPC EVM memory.
mkdir -p /tmp/zoryq-bin
cat > /tmp/zoryq-bin/reth <<'EOF'
#!/bin/sh
exec /usr/local/bin/reth "$@" \
  --engine.cross-block-cache-size 64 \
  --engine.memory-block-buffer-target 2 \
  --engine.persistence-threshold 2 \
  --engine.disable-state-cache \
  --engine.disable-prewarming \
  --tx-channel-memory-limit 33554432 \
  --rpc.evm-memory-limit 67108864
EOF
chmod +x /tmp/zoryq-bin/reth
export PATH="/tmp/zoryq-bin:$PATH"

# Prepare an effective chain spec once. On a fresh network this adds the funded
# operator pool. On an explicit production migration it converts the last
# verified Anvil account state into the Reth genesis allocation.
node /app/prepare-reth-genesis.mjs

exec node /app/product-gateway.mjs
