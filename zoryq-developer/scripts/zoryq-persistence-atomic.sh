#!/bin/sh
set -eu

STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
PID_FILE="${ZORYQ_ANVIL_PID_FILE:-/data/zoryq-anvil.pid}"
CURRENT="${ZORYQ_STATE_CURRENT:-/data/zoryq-state.current.json.gz}"
PREVIOUS="${ZORYQ_STATE_PREVIOUS:-/data/zoryq-state.previous.json.gz}"
TMP="${ZORYQ_STATE_TMP:-/data/zoryq-state.checkpoint.tmp.gz}"
STATUS="${ZORYQ_PERSISTENCE_STATUS:-/data/zoryq-persistence-status.json}"
LOCK="${ZORYQ_PERSISTENCE_LOCK:-/data/zoryq-persistence.lock}"
CHAIN_ID="${ZORYQ_CHAIN_ID:-5919065}"
VALIDATOR="${ZORYQ_STREAM_VALIDATOR:-zoryq-developer/scripts/zoryq-json-stream-validate.mjs}"
LOCK_OWNED=0
WRITER_PAUSED=0
WRITER_PID=""

now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
valid_json() { node "$VALIDATOR" "$1" >/dev/null 2>&1; }
valid_gzip_json() { node "$VALIDATOR" "$1" --gzip >/dev/null 2>&1; }

atomic_status() {
  ok="$1"; message="$2"; digest="${3:-}"; failures="${4:-0}"; ts="$(now_ms)"; t="${STATUS}.tmp"
  OK="$ok" MSG="$message" DIGEST="$digest" FAILURES="$failures" TS="$ts" CHAIN_ID="$CHAIN_ID" node - <<'NODE' > "$t"
const x={version:1,chainId:Number(process.env.CHAIN_ID),ok:process.env.OK==='true',message:process.env.MSG,lastAttemptAt:Number(process.env.TS),consecutiveFailures:Number(process.env.FAILURES)};
if(process.env.OK==='true')x.lastSuccessAt=Number(process.env.TS);
if(process.env.DIGEST)x.checkpointSha256=process.env.DIGEST;
process.stdout.write(JSON.stringify(x));
NODE
  mv "$t" "$STATUS"
}

read_failures() {
  [ -f "$STATUS" ] || { echo 0; return; }
  FILE="$STATUS" node -e "try{const x=JSON.parse(require('fs').readFileSync(process.env.FILE));process.stdout.write(String(Number(x.consecutiveFailures||0)))}catch{process.stdout.write('0')}"
}

acquire_lock() {
  if mkdir "$LOCK" 2>/dev/null; then LOCK_OWNED=1; return 0; fi
  return 1
}
release_lock() {
  if [ "$LOCK_OWNED" -eq 1 ]; then rmdir "$LOCK" 2>/dev/null || true; LOCK_OWNED=0; fi
}
resume_writer() {
  if [ "$WRITER_PAUSED" -eq 1 ] && [ -n "$WRITER_PID" ]; then
    kill -CONT "$WRITER_PID" 2>/dev/null || true
    WRITER_PAUSED=0
  fi
}
cleanup() { resume_writer; rm -f "$TMP"; release_lock; }
trap cleanup EXIT INT TERM HUP

fail_checkpoint() {
  msg="$1"; failures="$(( $(read_failures) + 1 ))"
  atomic_status false "$msg" '' "$failures"
  return 1
}

checkpoint() {
  if ! acquire_lock; then echo '[zoryq-state] checkpoint coalesced: writer already active'; return 0; fi
  [ -f "$STATE" ] || { fail_checkpoint state_missing; return 1; }
  [ -f "$PID_FILE" ] || { fail_checkpoint writer_pid_missing; return 1; }
  WRITER_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  case "$WRITER_PID" in ''|*[!0-9]*) fail_checkpoint writer_pid_invalid; return 1;; esac
  kill -0 "$WRITER_PID" 2>/dev/null || { fail_checkpoint writer_not_running; return 1; }

  kill -STOP "$WRITER_PID"
  WRITER_PAUSED=1

  # Validate from a bounded-memory stream while the only writer is paused.
  if ! valid_json "$STATE"; then fail_checkpoint live_state_invalid_while_writer_paused; return 1; fi

  rm -f "$TMP"
  # gzip streams from disk; the complete state is never duplicated into Node memory.
  gzip -c "$STATE" > "$TMP"
  if ! valid_gzip_json "$TMP"; then fail_checkpoint checkpoint_validation_failed; return 1; fi

  digest="$(sha256sum "$TMP" | awk '{print $1}')"
  # Rotation is bounded: at most current + previous. The validated tmp becomes current atomically.
  if [ -f "$CURRENT" ]; then mv "$CURRENT" "$PREVIOUS"; fi
  mv "$TMP" "$CURRENT"
  atomic_status true checkpoint_committed "$digest" 0
  echo "[zoryq-state] atomic checkpoint committed sha256=$digest"
}

checkpoint
