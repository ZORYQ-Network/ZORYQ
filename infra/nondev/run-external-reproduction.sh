#!/usr/bin/env bash
set -euo pipefail

ENCLAVE="${ZORYQ_NONDEV_ENCLAVE:-zoryq-nondev-external}"
OUT="${ZORYQ_NONDEV_EVIDENCE:-./zoryq-nondev-external-evidence.json}"
KEEP="${ZORYQ_NONDEV_KEEP_ENCLAVE:-0}"
PACKAGE="${ZORYQ_ETHEREUM_PACKAGE:-github.com/ethpandaops/ethereum-package}"
ARGS_FILE="${ZORYQ_NONDEV_ARGS_FILE:-infra/nondev/network_params.yaml}"

for cmd in docker kurtosis jq curl; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "missing prerequisite: $cmd" >&2
    exit 10
  }
done

[[ -f "$ARGS_FILE" ]] || { echo "missing args file: $ARGS_FILE" >&2; exit 11; }
[[ -x infra/nondev/verify-cluster.sh ]] || chmod +x infra/nondev/verify-cluster.sh

echo "[zoryq] external non-dev reproduction"
echo "[zoryq] enclave=$ENCLAVE"
echo "[zoryq] evidence=$OUT"
echo "[zoryq] package=$PACKAGE"

echo "[zoryq] starting Kurtosis engine"
kurtosis engine start >/dev/null

cleanup() {
  if [[ "$KEEP" != "1" ]]; then
    kurtosis enclave rm -f "$ENCLAVE" >/dev/null 2>&1 || true
  else
    echo "[zoryq] keeping enclave $ENCLAVE because ZORYQ_NONDEV_KEEP_ENCLAVE=1"
  fi
}
trap cleanup EXIT

if kurtosis enclave inspect "$ENCLAVE" >/dev/null 2>&1; then
  echo "[zoryq] enclave already exists; remove it or choose ZORYQ_NONDEV_ENCLAVE" >&2
  exit 12
fi

echo "[zoryq] launching 2x Reth + 2x Lighthouse isolated candidate"
kurtosis run --enclave "$ENCLAVE" "$PACKAGE" --args-file "$ARGS_FILE"

echo "[zoryq] verifying chain identity, convergence, finality, peers and Node 2 restart/rejoin"
infra/nondev/verify-cluster.sh "$ENCLAVE" | tee "$OUT"

jq -e '.ok == true and .restartRejoin.canonicalAfterRestart == true' "$OUT" >/dev/null || {
  echo "[zoryq] evidence gate failed" >&2
  exit 20
}

SHA256="$(sha256sum "$OUT" | awk '{print $1}')"
echo "[zoryq] PASS"
echo "[zoryq] evidence_sha256=$SHA256"
echo "[zoryq] evidence_path=$OUT"
echo "[zoryq] claim boundary: this reproduces the non-dev architecture; it is not proof of an independently controlled public Node 2 or decentralization."
