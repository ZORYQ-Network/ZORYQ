#!/usr/bin/env bash
set -euo pipefail

: "${ZORYQ_MAINNET_CHAIN_ID:?ZORYQ_MAINNET_CHAIN_ID is required}"
: "${ZORYQ_MAINNET_GENESIS_PATH:?ZORYQ_MAINNET_GENESIS_PATH is required}"
: "${ZORYQ_MAINNET_GENESIS_SHA256:?ZORYQ_MAINNET_GENESIS_SHA256 is required}"
: "${ZORYQ_MAINNET_JWT_SECRET_PATH:?ZORYQ_MAINNET_JWT_SECRET_PATH is required}"
: "${ZORYQ_MAINNET_RELEASE_COMMIT:?ZORYQ_MAINNET_RELEASE_COMMIT is required}"
: "${ZORYQ_MAINNET_IMAGE_DIGEST:?ZORYQ_MAINNET_IMAGE_DIGEST is required}"
: "${ZORYQ_MAINNET_AUDIT_REPORT_PATH:?ZORYQ_MAINNET_AUDIT_REPORT_PATH is required}"
: "${ZORYQ_MAINNET_INCIDENT_RUNBOOK_PATH:?ZORYQ_MAINNET_INCIDENT_RUNBOOK_PATH is required}"
: "${ZORYQ_MAINNET_RECOVERY_EVIDENCE_PATH:?ZORYQ_MAINNET_RECOVERY_EVIDENCE_PATH is required}"
: "${ZORYQ_MAINNET_VALIDATOR_REGISTRY_PATH:?ZORYQ_MAINNET_VALIDATOR_REGISTRY_PATH is required}"
: "${ZORYQ_MAINNET_CONSENSUS_EVIDENCE_PATH:?ZORYQ_MAINNET_CONSENSUS_EVIDENCE_PATH is required}"
: "${ZORYQ_MAINNET_KEY_CUSTODY_EVIDENCE_PATH:?ZORYQ_MAINNET_KEY_CUSTODY_EVIDENCE_PATH is required}"
: "${ZORYQ_MAINNET_RELEASE_GOVERNANCE_PATH:?ZORYQ_MAINNET_RELEASE_GOVERNANCE_PATH is required}"
: "${ZORYQ_MAINNET_OBSERVABILITY_EVIDENCE_PATH:?ZORYQ_MAINNET_OBSERVABILITY_EVIDENCE_PATH is required}"
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
if [[ ! "${ZORYQ_MAINNET_RELEASE_COMMIT}" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo '[zoryq-mainnet] release commit must be a full 40-character git SHA' >&2
  exit 80
fi
if [[ ! "${ZORYQ_MAINNET_IMAGE_DIGEST}" =~ ^sha256:[0-9a-fA-F]{64}$ ]]; then
  echo '[zoryq-mainnet] image digest must be a sha256 OCI digest' >&2
  exit 80
fi

required_files=(
  "$ZORYQ_MAINNET_GENESIS_PATH"
  "$ZORYQ_MAINNET_JWT_SECRET_PATH"
  "$ZORYQ_MAINNET_AUDIT_REPORT_PATH"
  "$ZORYQ_MAINNET_INCIDENT_RUNBOOK_PATH"
  "$ZORYQ_MAINNET_RECOVERY_EVIDENCE_PATH"
  "$ZORYQ_MAINNET_VALIDATOR_REGISTRY_PATH"
  "$ZORYQ_MAINNET_CONSENSUS_EVIDENCE_PATH"
  "$ZORYQ_MAINNET_KEY_CUSTODY_EVIDENCE_PATH"
  "$ZORYQ_MAINNET_RELEASE_GOVERNANCE_PATH"
  "$ZORYQ_MAINNET_OBSERVABILITY_EVIDENCE_PATH"
  "$ZORYQ_MAINNET_LAUNCH_MANIFEST"
  "$ZORYQ_MAINNET_LAUNCH_POLICY"
  "$ZORYQ_MAINNET_LAUNCH_APPROVALS"
)
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[zoryq-mainnet] required file missing: $file" >&2
    exit 80
  fi
done

jwt_secret="$(tr -d '[:space:]' < "$ZORYQ_MAINNET_JWT_SECRET_PATH")"
if [[ ! "$jwt_secret" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo '[zoryq-mainnet] Engine API JWT must contain exactly 32 bytes encoded as hex' >&2
  exit 80
fi
unset jwt_secret

sha_file() { sha256sum "$1" | awk '{print $1}'; }
manifest_value() {
  node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const v=m[process.argv[2]]; if(v===undefined||v===null) process.exit(3); process.stdout.write(String(v));' "$ZORYQ_MAINNET_LAUNCH_MANIFEST" "$1"
}
require_manifest_hash() {
  local field="$1"
  local file="$2"
  local label="$3"
  local declared
  declared="$(manifest_value "$field")"
  if [[ "${declared,,}" != "$(sha_file "$file")" ]]; then
    echo "[zoryq-mainnet] launch certificate is not bound to the supplied ${label}" >&2
    exit 80
  fi
}

actual_genesis_sha="$(sha_file "$ZORYQ_MAINNET_GENESIS_PATH")"
if [[ "$actual_genesis_sha" != "${ZORYQ_MAINNET_GENESIS_SHA256,,}" ]]; then
  echo '[zoryq-mainnet] genesis SHA-256 mismatch' >&2
  exit 80
fi

manifest_chain_id="$(manifest_value chainId)"
manifest_genesis_sha="$(manifest_value genesisSha256)"
manifest_release_commit="$(manifest_value releaseCommit)"
manifest_image_digest="$(manifest_value imageDigest)"

if [[ "$manifest_chain_id" != "$ZORYQ_MAINNET_CHAIN_ID" ]]; then
  echo '[zoryq-mainnet] launch certificate chainId does not match runtime' >&2
  exit 80
fi
if [[ "${manifest_genesis_sha,,}" != "$actual_genesis_sha" ]]; then
  echo '[zoryq-mainnet] launch certificate is not bound to the supplied genesis' >&2
  exit 80
fi
if [[ "${manifest_release_commit,,}" != "${ZORYQ_MAINNET_RELEASE_COMMIT,,}" ]]; then
  echo '[zoryq-mainnet] launch certificate is not bound to the supplied release commit' >&2
  exit 80
fi
if [[ "${manifest_image_digest,,}" != "${ZORYQ_MAINNET_IMAGE_DIGEST,,}" ]]; then
  echo '[zoryq-mainnet] launch certificate is not bound to the supplied image digest' >&2
  exit 80
fi

require_manifest_hash auditReportSha256 "$ZORYQ_MAINNET_AUDIT_REPORT_PATH" 'audit report'
require_manifest_hash incidentRunbookSha256 "$ZORYQ_MAINNET_INCIDENT_RUNBOOK_PATH" 'incident runbook'
require_manifest_hash recoveryDrillSha256 "$ZORYQ_MAINNET_RECOVERY_EVIDENCE_PATH" 'recovery evidence'
require_manifest_hash validatorRegistrySha256 "$ZORYQ_MAINNET_VALIDATOR_REGISTRY_PATH" 'validator registry'
require_manifest_hash consensusEvidenceSha256 "$ZORYQ_MAINNET_CONSENSUS_EVIDENCE_PATH" 'consensus evidence'
require_manifest_hash keyCustodyEvidenceSha256 "$ZORYQ_MAINNET_KEY_CUSTODY_EVIDENCE_PATH" 'key-custody evidence'
require_manifest_hash releaseGovernanceSha256 "$ZORYQ_MAINNET_RELEASE_GOVERNANCE_PATH" 'release-governance evidence'
require_manifest_hash observabilityEvidenceSha256 "$ZORYQ_MAINNET_OBSERVABILITY_EVIDENCE_PATH" 'observability evidence'

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
