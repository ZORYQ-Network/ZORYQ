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
  docker exec "$CONTAINER" sh -c 'find /data -maxdepth 4 -type f -o -type d | sort; echo ---; cat /data/zoryq-persistence-status.json 2>/dev/null || true' >"$ARTIFACT_DIR/data-final.txt" 2>&1 || true
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
    if curl -fsS "http://127.0.0.1:${PORT}/health" >"$ARTIFACT_DIR/health-latest.json" 2>/dev/null; then return 0; fi
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
  ADDRESS="$ADDRESS" PORT="$PORT" node - <<'NODE'
const body={jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[process.env.ADDRESS,'latest']};
const r=await fetch(`http://127.0.0.1:${process.env.PORT}/rpc`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const x=await r.json();
if(!x.result) throw Error(JSON.stringify(x));
process.stdout.write(String(BigInt(x.result)));
NODE
}
checkpoint() { docker exec "$CONTAINER" node /app/rpc-state-checkpoint.mjs; }
restore_checkpoint() { docker exec -e ZORYQ_BOOT_RECOVERY=true "$CONTAINER" node /app/rpc-state-restore.mjs; }
assert_persistence_healthy() {
  docker exec "$CONTAINER" node -e "const fs=require('fs');const x=JSON.parse(fs.readFileSync('/data/zoryq-persistence-status.json','utf8'));if(!x.ok||x.source!=='anvil_dumpState_blob'||!x.lastSuccessAt||!x.checkpointSha256)throw Error(JSON.stringify(x));const root='/data/zoryq-checkpoints/current';if(!fs.existsSync(root+'/state.hex.gz')||!fs.existsSync(root+'/meta.json'))throw Error('current blob checkpoint missing');console.log(JSON.stringify(x));"
}
remove_primary_state() {
  docker run --rm -v "${VOLUME}:/data" alpine:3.22 sh -c 'rm -f /data/zoryq-state.json /data/zoryq-state.json.bak /data/zoryq-state.json.bak.gz'
}

echo '[chaos] build isolated node image'
docker build -t "$IMAGE" .
docker volume create "$VOLUME" >/dev/null

# Phase 1: establish state and capture the live Anvil memory image.
echo '[chaos] phase 1: live in-memory state -> native RPC blob checkpoint'
run_node
wait_health
assert_chain
curl -fsS -H 'content-type: application/json' \
  --data "{\"address\":\"${ADDRESS}\"}" \
  "http://127.0.0.1:${PORT}/faucet" >"$ARTIFACT_DIR/faucet-local.json"
EXPECTED_BALANCE="$(balance)"
printf '%s\n' "$EXPECTED_BALANCE" >"$ARTIFACT_DIR/balance-before-checkpoint.txt"
[ "$EXPECTED_BALANCE" != "0" ]
checkpoint | tee "$ARTIFACT_DIR/checkpoint-first.log"
assert_persistence_healthy >"$ARTIFACT_DIR/persistence-before-kill.json"

# Phase 2: immediate SIGKILL, start a clean private Anvil, load the blob, and prove exact state.
echo '[chaos] phase 2: immediate SIGKILL and native blob restore'
docker kill -s KILL "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
remove_primary_state
run_node
restore_checkpoint | tee "$ARTIFACT_DIR/restore-after-kill.log"
wait_health
assert_chain
RECOVERED_BALANCE="$(balance)"
[ "$RECOVERED_BALANCE" = "$EXPECTED_BALANCE" ] || { echo "balance mismatch after SIGKILL: expected=$EXPECTED_BALANCE actual=$RECOVERED_BALANCE" >&2; exit 1; }

# Create a second committed generation so fallback can be tested independently.
checkpoint | tee "$ARTIFACT_DIR/checkpoint-second.log"
assert_persistence_healthy >"$ARTIFACT_DIR/persistence-second.json"

# Phase 3: corrupt current checkpoint; restore must reject it and fall back to previous.
echo '[chaos] phase 3: corrupt current checkpoint and recover from previous'
docker kill -s KILL "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
remove_primary_state
docker run --rm -v "${VOLUME}:/data" alpine:3.22 sh -c "printf 'corrupt' > /data/zoryq-checkpoints/current/state.hex.gz"
run_node
restore_checkpoint 2>&1 | tee "$ARTIFACT_DIR/restore-fallback.log"
wait_health
assert_chain
RECOVERED_AFTER_CORRUPTION="$(balance)"
[ "$RECOVERED_AFTER_CORRUPTION" = "$EXPECTED_BALANCE" ] || { echo 'balance mismatch after previous-checkpoint recovery' >&2; exit 1; }
grep -q 'candidate current rejected' "$ARTIFACT_DIR/restore-fallback.log" || { echo 'corrupt current was not explicitly rejected' >&2; exit 1; }
grep -q 'restored from previous' "$ARTIFACT_DIR/restore-fallback.log" || { echo 'previous checkpoint was not used' >&2; exit 1; }

# Re-establish a valid current after fallback.
checkpoint | tee "$ARTIFACT_DIR/checkpoint-after-fallback.log"
assert_persistence_healthy >"$ARTIFACT_DIR/persistence-after-fallback.json"

# Phase 4: concurrent requests must coalesce behind one writer.
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

# Phase 5: crash after temp checkpoint is validated but before directory rename.
echo '[chaos] phase 5: crash inside atomic commit window'
: >"$ARTIFACT_DIR/checkpoint-crash.log"
docker exec -e ZORYQ_RPC_CHECKPOINT_TEST_DELAY_MS=8000 "$CONTAINER" node /app/rpc-state-checkpoint.mjs >>"$ARTIFACT_DIR/checkpoint-crash.log" 2>&1 &
CHECKPOINT_PID=$!
OPEN=0
for _ in $(seq 1 60); do
  if grep -q 'test crash window open' "$ARTIFACT_DIR/checkpoint-crash.log"; then OPEN=1; break; fi
  sleep 0.25
done
[ "$OPEN" -eq 1 ] || { cat "$ARTIFACT_DIR/checkpoint-crash.log" >&2; echo 'did not reach injected crash window' >&2; exit 1; }
docker kill -s KILL "$CONTAINER" >/dev/null || true
wait "$CHECKPOINT_PID" || true
docker rm "$CONTAINER" >/dev/null || true
remove_primary_state
run_node
restore_checkpoint | tee "$ARTIFACT_DIR/restore-after-checkpoint-crash.log"
wait_health
assert_chain
POST_CRASH_BALANCE="$(balance)"
[ "$POST_CRASH_BALANCE" = "$EXPECTED_BALANCE" ] || { echo 'balance mismatch after checkpoint-time crash' >&2; exit 1; }

# Phase 6: boot recovery removes only stale temp/lock; retained generations remain bounded.
echo '[chaos] phase 6: bounded retention and clean boot recovery'
docker exec "$CONTAINER" sh -c 'find /data/zoryq-checkpoints -maxdepth 3 -print | sort' >"$ARTIFACT_DIR/data-listing.txt"
docker exec "$CONTAINER" sh -c 'test ! -e /data/zoryq-checkpoints/.writer-lock && ! find /data/zoryq-checkpoints -maxdepth 1 -name ".tmp-*" | grep -q .'
COUNT="$(docker exec "$CONTAINER" sh -c 'find /data/zoryq-checkpoints -maxdepth 1 -type d \( -name current -o -name previous \) | wc -l')"
[ "$COUNT" -le 2 ]

curl -fsS "http://127.0.0.1:${PORT}/health" >"$ARTIFACT_DIR/health-final.json"
rpc eth_chainId '[]' >"$ARTIFACT_DIR/chain-id-final.json"
rpc eth_blockNumber '[]' >"$ARTIFACT_DIR/block-final.json"
docker stats --no-stream --format '{{json .}}' "$CONTAINER" >"$ARTIFACT_DIR/docker-stats.json"

echo '[chaos] PASS: native live-state checkpoint survived SIGKILL, corrupt-current fallback, concurrency, and crash-before-rename'
