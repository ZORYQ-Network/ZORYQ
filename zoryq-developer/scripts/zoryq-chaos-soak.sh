#!/usr/bin/env bash
set -euo pipefail

IMAGE="zoryq-chaos:${GITHUB_SHA:-local}"
VOLUME="zoryq-chaos-${GITHUB_RUN_ID:-$$}"
PORT="${ZORYQ_CHAOS_PORT:-18080}"
CONTAINER="zoryq-chaos-node"
ARTIFACT_DIR="${ZORYQ_CHAOS_ARTIFACT_DIR:-artifacts/zoryq-chaos}"
ADDRESS="0x1000000000000000000000000000000000000001"

mkdir -p "$ARTIFACT_DIR"

capture() {
  docker logs "$CONTAINER" >"$ARTIFACT_DIR/container-final.log" 2>&1 || true
  docker inspect "$CONTAINER" >"$ARTIFACT_DIR/container-final.inspect.json" 2>&1 || true
  docker exec "$CONTAINER" sh -c 'ls -lah /data; echo ---; cat /data/zoryq-persistence-status.json 2>/dev/null || true' >"$ARTIFACT_DIR/data-final.txt" 2>&1 || true
}

cleanup() {
  capture
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_node() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" \
    -p "${PORT}:8080" \
    -v "${VOLUME}:/data" \
    -e PORT=8080 \
    -e ZORYQ_REQUIRE_X_ATTESTATION=false \
    -e ZORYQ_STATE_INTERVAL=3600 \
    -e ZORYQ_STATE_INITIAL_CHECKPOINT_DELAY=3600 \
    -e ZORYQ_STATE_BACKUP_INTERVAL=3600 \
    "$IMAGE" >/dev/null
}

wait_health() {
  for _ in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:${PORT}/health" >"$ARTIFACT_DIR/health-latest.json" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  docker logs "$CONTAINER" >&2 || true
  return 1
}

rpc() {
  local method="$1" params="${2:-[]}" id="${3:-1}"
  curl -fsS -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":${id},\"method\":\"${method}\",\"params\":${params}}" \
    "http://127.0.0.1:${PORT}/rpc"
}

assert_chain() {
  local out
  out="$(rpc eth_chainId '[]')"
  OUT="$out" node -e "const x=JSON.parse(process.env.OUT);if(x.result!=='0x5a5159')throw Error('unexpected chain id '+JSON.stringify(x));"
}

balance() {
  local out
  out="$(rpc eth_getBalance \"[\\\"${ADDRESS}\\\",\\\"latest\\\"]\")"
  OUT="$out" node -e "const x=JSON.parse(process.env.OUT);if(!x.result)throw Error(JSON.stringify(x));process.stdout.write(String(BigInt(x.result)));"
}

checkpoint() {
  docker exec "$CONTAINER" node /app/rpc-state-checkpoint.mjs
}

assert_persistence_healthy() {
  docker exec "$CONTAINER" node - <<'NODE'
const fs=require('fs');
const x=JSON.parse(fs.readFileSync('/data/zoryq-persistence-status.json','utf8'));
if(!x.ok || x.source!=='anvil_dumpState' || !x.lastSuccessAt || !x.checkpointSha256) throw Error(JSON.stringify(x));
if(!fs.existsSync('/data/zoryq-state.current.json.gz')) throw Error('current checkpoint missing');
console.log(JSON.stringify(x));
NODE
}

echo '[chaos] build isolated node image'
docker build -t "$IMAGE" .
docker volume create "$VOLUME" >/dev/null

# Phase 1: establish state and capture it directly from Anvil memory.
echo '[chaos] phase 1: in-memory state -> RPC checkpoint'
run_node
wait_health
assert_chain
curl -fsS -H 'content-type: application/json' \
  --data "{\"address\":\"${ADDRESS}\"}" \
  "http://127.0.0.1:${PORT}/faucet" >"$ARTIFACT_DIR/faucet-local.json"
EXPECTED_BALANCE="$(balance)"
[ "$EXPECTED_BALANCE" -gt 0 ]
checkpoint | tee "$ARTIFACT_DIR/checkpoint-first.log"
assert_persistence_healthy >"$ARTIFACT_DIR/persistence-before-kill.json"

# Phase 2: immediate SIGKILL after a committed RPC checkpoint must preserve exact state.
echo '[chaos] phase 2: immediate SIGKILL and restore'
docker kill -s KILL "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
run_node
wait_health
assert_chain
RECOVERED_BALANCE="$(balance)"
[ "$RECOVERED_BALANCE" = "$EXPECTED_BALANCE" ] || { echo "balance mismatch after SIGKILL: expected=$EXPECTED_BALANCE actual=$RECOVERED_BALANCE" >&2; exit 1; }

# Phase 3: corrupt the live primary file. Boot must restore current/previous and never genesis-reset.
echo '[chaos] phase 3: corrupt primary state and recover transactionally'
docker stop "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
docker run --rm -v "${VOLUME}:/data" alpine:3.22 sh -c "printf '{broken' > /data/zoryq-state.json"
run_node
wait_health
assert_chain
RECOVERED_AFTER_CORRUPTION="$(balance)"
[ "$RECOVERED_AFTER_CORRUPTION" = "$EXPECTED_BALANCE" ] || { echo 'balance mismatch after corrupt-state recovery' >&2; exit 1; }

# Phase 4: concurrent checkpoint requests must coalesce behind exactly one writer.
echo '[chaos] phase 4: concurrent RPC checkpoint coalescing'
: >"$ARTIFACT_DIR/checkpoint-concurrency.log"
pids=()
for _ in 1 2 3 4 5; do
  docker exec "$CONTAINER" node /app/rpc-state-checkpoint.mjs >>"$ARTIFACT_DIR/checkpoint-concurrency.log" 2>&1 &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
assert_persistence_healthy >"$ARTIFACT_DIR/persistence-after-concurrency.json"
COALESCED="$(grep -c 'coalesced' "$ARTIFACT_DIR/checkpoint-concurrency.log" || true)"
[ "$COALESCED" -ge 1 ] || { echo 'concurrent checkpoints did not coalesce' >&2; exit 1; }

# Phase 5: force a crash after a fully validated temp snapshot but before atomic rename.
echo '[chaos] phase 5: crash inside atomic commit window'
: >"$ARTIFACT_DIR/checkpoint-crash.log"
docker exec -e ZORYQ_RPC_CHECKPOINT_TEST_DELAY_MS=8000 "$CONTAINER" node /app/rpc-state-checkpoint.mjs >>"$ARTIFACT_DIR/checkpoint-crash.log" 2>&1 &
CHECKPOINT_PID=$!
OPEN=0
for _ in $(seq 1 40); do
  if grep -q 'test crash window open' "$ARTIFACT_DIR/checkpoint-crash.log"; then OPEN=1; break; fi
  sleep 0.25
done
[ "$OPEN" -eq 1 ] || { cat "$ARTIFACT_DIR/checkpoint-crash.log" >&2; echo 'did not reach injected crash window' >&2; exit 1; }
docker kill -s KILL "$CONTAINER" >/dev/null || true
wait "$CHECKPOINT_PID" || true
docker rm "$CONTAINER" >/dev/null || true
run_node
wait_health
assert_chain
POST_CRASH_BALANCE="$(balance)"
[ "$POST_CRASH_BALANCE" = "$EXPECTED_BALANCE" ] || { echo 'balance mismatch after checkpoint-time crash' >&2; exit 1; }

# Phase 6: cleanup must remove partial temp/lock; retention remains current + previous only.
echo '[chaos] phase 6: bounded retention and clean restart'
docker exec "$CONTAINER" sh -c 'ls -lah /data' >"$ARTIFACT_DIR/data-listing.txt"
docker exec "$CONTAINER" sh -c 'test ! -e /data/zoryq-state.checkpoint.tmp.gz && test ! -e /data/zoryq-persistence.lock'
COUNT="$(docker exec "$CONTAINER" sh -c 'find /data -maxdepth 1 -type f \( -name "zoryq-state.current.json.gz" -o -name "zoryq-state.previous.json.gz" \) | wc -l')"
[ "$COUNT" -le 2 ]

curl -fsS "http://127.0.0.1:${PORT}/health" >"$ARTIFACT_DIR/health-final.json"
rpc eth_chainId '[]' >"$ARTIFACT_DIR/chain-id-final.json"
rpc eth_blockNumber '[]' >"$ARTIFACT_DIR/block-final.json"
docker stats --no-stream --format '{{json .}}' "$CONTAINER" >"$ARTIFACT_DIR/docker-stats.json"

echo '[chaos] PASS: live in-memory checkpoint survived SIGKILL, primary corruption, concurrency, and crash-before-rename'
