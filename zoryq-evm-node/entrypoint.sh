#!/bin/sh
set -eu

mkdir -p /data/reth /app/web /app/protocol-out
export ZORYQ_RETH_OPERATOR_COUNT="${ZORYQ_RETH_OPERATOR_COUNT:-24}"
export ZORYQ_SOCIAL_RELAYER_INDEX="${ZORYQ_SOCIAL_RELAYER_INDEX:-23}"
export ZORYQ_RETH_CHAIN_SPEC="${ZORYQ_RETH_CHAIN_SPEC:-/data/zoryq-reth-effective-genesis.json}"

# Fail closed before touching chain state. Testnet remains the default; an
# explicit mainnet launch is refused until the production consensus, signer,
# genesis and audit requirements are genuinely satisfied.
node /app/mainnet-guard.mjs

# Railway production currently runs inside a ~1 GB memory budget. Keep Reth
# within conservative cache ceilings while preserving execution semantics.
# P2P listening is explicit. Optional bootnodes/trusted peers are accepted only
# through dedicated environment variables so a second operator can join without
# baking infrastructure-specific peer identities into the image.
mkdir -p /tmp/zoryq-bin
cat > /tmp/zoryq-bin/reth <<'EOF'
#!/bin/sh
set -eu
set -- "$@" \
  --addr "${ZORYQ_RETH_P2P_ADDR:-0.0.0.0}" \
  --port "${ZORYQ_RETH_P2P_PORT:-30303}" \
  --engine.cross-block-cache-size 64 \
  --engine.memory-block-buffer-target 2 \
  --engine.persistence-threshold 2 \
  --engine.disable-state-cache \
  --engine.disable-prewarming \
  --tx-channel-memory-limit 33554432 \
  --rpc.evm-memory-limit 67108864

if [ -n "${ZORYQ_RETH_BOOTNODES:-}" ]; then
  set -- "$@" --bootnodes "$ZORYQ_RETH_BOOTNODES"
fi
if [ -n "${ZORYQ_RETH_TRUSTED_PEERS:-}" ]; then
  set -- "$@" --trusted-peers "$ZORYQ_RETH_TRUSTED_PEERS"
fi

exec /usr/local/bin/reth "$@"
EOF
chmod +x /tmp/zoryq-bin/reth
export PATH="/tmp/zoryq-bin:$PATH"

# Prepare the effective chain spec before starting the native gateway.
node /app/prepare-reth-genesis.mjs

# Canonical Autonomous Economy v0.1 bootstrap.
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

# Legacy one-prompt company proof stays available for compatibility.
if [ "${ZORYQ_ONE_PROMPT_DEMO_ENABLED:-true}" = "true" ] && [ -f /app/deploy-one-prompt-company.mjs ]; then
  (
    sleep 9
    attempt=0
    until node /app/deploy-one-prompt-company.mjs; do
      attempt=$((attempt + 1))
      if [ "$attempt" -ge 60 ]; then
        echo "[zoryq-company] bootstrap gave up after ${attempt} attempts; node remains online"
        exit 0
      fi
      echo "[zoryq-company] bootstrap attempt ${attempt} failed; retrying in 5s"
      sleep 5
    done
    echo "[zoryq-company] one-prompt digital company demo complete"
  ) &
fi

# Autonomous Company v2 remains available as the seven-agent deterministic proof.
if [ "${ZORYQ_AUTONOMOUS_COMPANY_V2_ENABLED:-true}" = "true" ] && [ -f /app/deploy-autonomous-company-v2.mjs ]; then
  (
    sleep 13
    attempt=0
    until node /app/deploy-autonomous-company-v2.mjs; do
      attempt=$((attempt + 1))
      if [ "$attempt" -ge 60 ]; then
        echo "[zoryq-company-v2] bootstrap gave up after ${attempt} attempts; node remains online"
        exit 0
      fi
      echo "[zoryq-company-v2] bootstrap attempt ${attempt} failed; retrying in 5s"
      sleep 5
    done
    echo "[zoryq-company-v2] autonomous company v2 canonical demo complete"
  ) &
fi

# Autonomous Company v3 adds the AI CEO execution boundary: an offchain AI may
# propose strategy, role routing and payments, but the owner signs and this
# contract enforces membership, permissions, limits and verifier separation.
if [ "${ZORYQ_AUTONOMOUS_COMPANY_V3_ENABLED:-true}" = "true" ] && [ -f /app/deploy-autonomous-company-v3.mjs ]; then
  (
    sleep 17
    attempt=0
    until node /app/deploy-autonomous-company-v3.mjs; do
      attempt=$((attempt + 1))
      if [ "$attempt" -ge 60 ]; then
        echo "[zoryq-company-v3] bootstrap gave up after ${attempt} attempts; node remains online"
        exit 0
      fi
      echo "[zoryq-company-v3] bootstrap attempt ${attempt} failed; retrying in 5s"
      sleep 5
    done
    echo "[zoryq-company-v3] autonomous company v3 canonical demo complete"
  ) &
fi

# External-work proof upgrades the demo from synthetic accounting to a receipt-
# backed native-ZQ payment bound to public work evidence. Owner and payer are
# deliberately separate testnet addresses, but both remain operator-controlled;
# this is not represented as independent third-party demand.
if [ "${ZORYQ_EXTERNAL_WORK_PROOF_ENABLED:-true}" = "true" ] && [ -f /app/deploy-external-work-proof.mjs ]; then
  (
    sleep 21
    attempt=0
    until node /app/deploy-external-work-proof.mjs; do
      attempt=$((attempt + 1))
      if [ "$attempt" -ge 60 ]; then
        echo "[zoryq-external-work-proof] bootstrap gave up after ${attempt} attempts; node remains online"
        exit 0
      fi
      echo "[zoryq-external-work-proof] bootstrap attempt ${attempt} failed; retrying in 5s"
      sleep 5
    done
    echo "[zoryq-external-work-proof] canonical receipt-backed testnet proof complete"
  ) &
fi

# Native Rust edge gateway with the Node chain backend kept internal only.
exec /usr/local/bin/zoryq-gateway
