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
MAX_FAILURES="${ZORYQ_PERSISTENCE_MAX_FAILURES:-3}"

now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
valid_json() { FILE="$1" node -e "const fs=require('fs');JSON.parse(fs.readFileSync(process.env.FILE,'utf8'));" >/dev/null 2>&1; }
valid_gzip_json() { FILE="$1" node -e "const fs=require('fs'),z=require('zlib');JSON.parse(z.gunzipSync(fs.readFileSync(process.env.FILE)).toString('utf8'));" >/dev/null 2>&1; }

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

acquire_lock() { mkdir "$LOCK" 2>/dev/null; }
release_lock() { rmdir "$LOCK" 2>/dev/null || true; }

resume_writer() {
  if [ -n "${WRITER_PID:-}" ]; then kill -CONT "$WRITER_PID" 2>/dev/null || true; fi
}
trap 'resume_writer; rm -f "$TMP"; release_lock' EXIT INT TERM HUP

checkpoint() {
  if ! acquire_lock; then echo '[zoryq-state] checkpoint coalesced: writer already active'; return 0; fi
  [ -f "$STATE" ] || { atomic_status false state_missing '' "$(( $(read_failures) + 1 ))"; return 1; }
  [ -f "$PID_FILE" ] || { atomic_status false writer_pid_missing '' "$(( $(read_failures) + 1 ))"; return 1; }
  WRITER_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  case "$WRITER_PID" in ''|*[!0-9]*) atomic_status false writer_pid_invalid '' "$(( $(read_failures) + 1 ))"; return 1;; esac
  kill -0 "$WRITER_PID" 2>/dev/null || { atomic_status false writer_not_running '' "$(( $(read_failures) + 1 ))"; return 1; }

  kill -STOP "$WRITER_PID"
  if ! valid_json "$STATE"; then
    failures="$(( $(read_failures) + 1 ))"
    atomic_status false live_state_invalid_while_writer_paused '' "$failures"
    return 1
  fi

  rm -f "$TMP"
  gzip -c "$STATE" > "$TMP"
  if ! valid_gzip_json "$TMP"; then
    failures="$(( $(read_failures) + 1 ))"
    atomic_status false checkpoint_validation_failed '' "$failures"
    return 1
  fi

  digest="$(sha256sum "$TMP" | awk '{print $1}')"
  if [ -f "$CURRENT" ]; then mv "$CURRENT" "$PREVIOUS"; fi
  mv "$TMP" "$CURRENT"
  atomic_status true checkpoint_committed "$digest" 0
  echo "[zoryq-state] atomic checkpoint committed sha256=$digest"
}

checkpoint
