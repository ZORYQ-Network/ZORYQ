#!/usr/bin/env bash
set -euo pipefail

IMAGE="zoryq-chaos:${GITHUB_SHA:-local}"
VOLUME="zoryq-chaos-${GITHUB_RUN_ID:-$$}"
PORT="${ZORYQ_CHAOS_PORT:-18080}"
CONTAINER="zoryq-chaos-node"
ARTIFACT_DIR="${ZORYQ_CHAOS_ARTIFACT_DIR:-artifacts/zoryq-chaos}"
ADDRESS="0x1000000000000000000000000000000000000001"

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  docker logs "$CONTAINER" >"$ARTIFACT_DIR/container-final.log" 2>&1 || true
  docker inspect "$CONTAINER" >"$ARTIFACT_DIR/container-final.inspect.json" 2>&1 || true
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
    -e ZORYQ_STATE_INTERVAL=30 \
    -e ZORYQ_STATE_INITIAL_CHECKPOINT_DELAY=5 \
    -e ZORYQ_STATE_BACKUP_INTERVAL=20 \
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

wait_for_checkpoint() {
  for _ in $(seq 1 90); do
    if docker exec "$CONTAINER" sh -c 'test -f /data/zoryq-persistence-status.json && node -e "const x=JSON.parse(require(\"fs\").readFileSync(\"/data/zoryq-persistence-status.json\",\"utf8\"));process.exit(x.ok&&x.lastSuccessAt?0:1)"' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo '[chaos] build isolated node image'
docker build -t "$IMAGE" .
docker volume create "$VOLUME" >/dev/null

# Phase 1: establish state and a verified atomic checkpoint.
echo '[chaos] phase 1: establish persistent state'
run_node
wait_health
assert_chain
curl -fsS -H 'content-type: application/json' \
  --data "{\"address\":\"${ADDRESS}\"}" \
  "http://127.0.0.1:${PORT}/faucet" >"$ARTIFACT_DIR/faucet-local.json"
EXPECTED_BALANCE="$(balance)"
[ "$EXPECTED_BALANCE" -gt 0 ]
wait_for_checkpoint
docker exec "$CONTAINER" cp /data/zoryq-persistence-status.json /tmp/persistence-status.json
docker cp "$CONTAINER:/tmp/persistence-status.json" "$ARTIFACT_DIR/persistence-before-kill.json"

# Phase 2: ungraceful process death must not lose the committed checkpoint.
echo '[chaos] phase 2: SIGKILL container and recover'
docker kill -s KILL "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
run_node
wait_health
assert_chain
RECOVERED_BALANCE="$(balance)"
[ "$RECOVERED_BALANCE" = "$EXPECTED_BALANCE" ] || { echo "balance mismatch after SIGKILL: expected=$EXPECTED_BALANCE actual=$RECOVERED_BALANCE" >&2; exit 1; }

# Phase 3: corrupt the live primary state. Boot must recover from current/previous;
# silently starting a new genesis chain is forbidden.
echo '[chaos] phase 3: corrupt primary state and recover transactionally'
docker stop "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null
docker run --rm -v "${VOLUME}:/data" alpine:3.22 sh -c "printf '{broken' > /data/zoryq-state.json"
run_node
wait_health
assert_chain
RECOVERED_AFTER_CORRUPTION="$(balance)"
[ "$RECOVERED_AFTER_CORRUPTION" = "$EXPECTED_BALANCE" ] || { echo "balance mismatch after corrupt-state recovery" >&2; exit 1; }

# Phase 4: concurrent checkpoint requests must coalesce behind one writer.
echo '[chaos] phase 4: concurrent checkpoint coalescing'
for _ in 1 2 3 4 5; do docker exec "$CONTAINER" sh /app/atomic-checkpoint.sh >>"$ARTIFACT_DIR/checkpoint-concurrency.log" 2>&1 & done
wait
sleep 2
docker exec "$CONTAINER" cat /data/zoryq-persistence-status.json >"$ARTIFACT_DIR/persistence-after-concurrency.json"
STATUS="$(cat "$ARTIFACT_DIR/persistence-after-concurrency.json")"
STATUS="$STATUS" node -e "const x=JSON.parse(process.env.STATUS);if(!x.ok||Number(x.consecutiveFailures)!==0)throw Error('persistence not healthy '+JSON.stringify(x));"

# Phase 5: kill during checkpoint. A partially-written temp file must never replace
# the last verified current checkpoint.
echo '[chaos] phase 5: crash during checkpoint'
docker exec "$CONTAINER" sh /app/atomic-checkpoint.sh >>"$ARTIFACT_DIR/checkpoint-crash.log" 2>&1 &
sleep 1
docker kill -s KILL "$CONTAINER" >/dev/null || true
wait || true
docker rm "$CONTAINER" >/dev/null || true
run_node
wait_health
assert_chain
POST_CRASH_BALANCE="$(balance)"
[ "$POST_CRASH_BALANCE" = "$EXPECTED_BALANCE" ] || { echo 'balance mismatch after checkpoint crash' >&2; exit 1; }

# Retention must be bounded: current + previous only, no stale checkpoint temp.
echo '[chaos] phase 6: bounded retention'
docker exec "$CONTAINER" sh -c 'ls -lah /data' >"$ARTIFACT_DIR/data-listing.txt"
docker exec "$CONTAINER" sh -c 'test ! -e /data/zoryq-state.checkpoint.tmp.gz'
COUNT="$(docker exec "$CONTAINER" sh -c 'find /data -maxdepth 1 -type f \( -name "zoryq-state.current.json.gz" -o -name "zoryq-state.previous.json.gz" \) | wc -l')"
[ "$COUNT" -le 2 ]

curl -fsS "http://127.0.0.1:${PORT}/health" >"$ARTIFACT_DIR/health-final.json"
rpc eth_chainId '[]' >"$ARTIFACT_DIR/chain-id-final.json"
rpc eth_blockNumber '[]' >"$ARTIFACT_DIR/block-final.json"
docker stats --no-stream --format '{{json .}}' "$CONTAINER" >"$ARTIFACT_DIR/docker-stats.json"

echo '[chaos] PASS: atomic persistence survived SIGKILL, primary corruption, concurrent checkpoints, and checkpoint-time crash'
