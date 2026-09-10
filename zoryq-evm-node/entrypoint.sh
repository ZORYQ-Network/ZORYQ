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

# Testnet-only Autonomous Economy bootstrap. It runs out-of-band so health and
# RPC startup are never blocked. The script is state-file driven and exits
# immediately after the canonical demo has completed once on the persistent
# /data volume. It never prints or exports the Reth mnemonic/private keys.
if [ "${ZORYQ_AUTONOMOUS_DEMO_ENABLED:-true}" = "true" ] && [ -f /app/deploy-autonomous-economy.mjs ]; then
  (
    sleep 5
    attempt=0
    until node /app/deploy-autonomous-economy.mjs; do
      attempt=$((attempt + 1))
      if [ "$attempt" -ge 60 ]; then
        echo "[zoryq-autonomous] bootstrap gave up after ${attempt} attempts; node remains online"
        exit 0
      fi
      echo "[zoryq-autonomous] bootstrap attempt ${attempt} failed; retrying in 5s"
      sleep 5
    done
    echo "[zoryq-autonomous] canonical testnet demo complete"
  ) &
fi

# Infrastructure V5: native Rust entry gateway replaces the Node.js
# product-gateway process while keeping the same internal chain/social routes.
exec /usr/local/bin/zoryq-gateway
