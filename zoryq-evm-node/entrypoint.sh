#!/bin/sh
set -eu

mkdir -p /data/reth /app/web /app/protocol-out
export ZORYQ_RETH_OPERATOR_COUNT="${ZORYQ_RETH_OPERATOR_COUNT:-24}"
export ZORYQ_SOCIAL_RELAYER_INDEX="${ZORYQ_SOCIAL_RELAYER_INDEX:-23}"
export ZORYQ_RETH_CHAIN_SPEC="${ZORYQ_RETH_CHAIN_SPEC:-/data/zoryq-reth-effective-genesis.json}"

# Railway production currently runs inside a ~1 GB memory budget. Keep Reth
# within conservative cache ceilings while preserving execution semantics.
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

# Prepare the effective chain spec before starting the native gateway.
node /app/prepare-reth-genesis.mjs

# Infrastructure V5: native Rust entry gateway replaces the Node.js
# product-gateway process while keeping the same internal chain/social routes.
exec /usr/local/bin/zoryq-gateway
