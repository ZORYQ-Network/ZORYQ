#!/bin/sh
set -eu

STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
CURRENT="${ZORYQ_STATE_CURRENT:-/data/zoryq-state.current.json.gz}"
PREVIOUS="${ZORYQ_STATE_PREVIOUS:-/data/zoryq-state.previous.json.gz}"
LEGACY_GZ="${STATE}.bak.gz"
LEGACY_RAW="${STATE}.bak"
TMP="${ZORYQ_STATE_TMP:-/data/zoryq-state.checkpoint.tmp.gz}"
STATUS="${ZORYQ_PERSISTENCE_STATUS:-/data/zoryq-persistence-status.json}"
VALIDATOR="${ZORYQ_STREAM_VALIDATOR:-/app/persistence-validator.mjs}"
CHECKPOINT="${ZORYQ_CHECKPOINT_SCRIPT:-/app/atomic-checkpoint.sh}"
INTERVAL="${ZORYQ_STATE_BACKUP_INTERVAL:-300}"
INITIAL_DELAY="${ZORYQ_STATE_INITIAL_CHECKPOINT_DELAY:-45}"

valid_json(){ node "$VALIDATOR" "$1" >/dev/null 2>&1; }
valid_gzip_json(){ node "$VALIDATOR" "$1" --gzip >/dev/null 2>&1; }
now_ms(){ node -e 'process.stdout.write(String(Date.now()))'; }

write_boot_status(){
  [ -f "$CURRENT" ] || return 0
  valid_gzip_json "$CURRENT" || return 0
  digest="$(sha256sum "$CURRENT" | awk '{print $1}')"
  ts="$(now_ms)"
  t="${STATUS}.tmp"
  DIGEST="$digest" TS="$ts" node - <<'NODE' > "$t"
process.stdout.write(JSON.stringify({version:2,chainId:5919065,ok:true,message:'boot_checkpoint_verified',lastAttemptAt:Number(process.env.TS),lastSuccessAt:Number(process.env.TS),consecutiveFailures:0,checkpointSha256:process.env.DIGEST,durationMs:0}));
NODE
  mv "$t" "$STATUS"
  echo "[zoryq-state] verified boot checkpoint sha256=$digest"
}

restore_gzip(){
  src="$1"
  echo "[zoryq-state] restoring verified checkpoint $src"
  valid_gzip_json "$src" || return 1
  # The checkpoint remains intact as the source of truth. Remove an invalid/partial
  # live image first so recovery does not require space for two full states.
  rm -f "$STATE"
  if ! gzip -dc "$src" > "$STATE"; then
    rm -f "$STATE"
    return 1
  fi
  if ! valid_json "$STATE"; then
    rm -f "$STATE"
    return 1
  fi
  echo "[zoryq-state] checkpoint restored"
}
restore_raw(){
  src="$1"
  echo "[zoryq-state] restoring verified legacy checkpoint $src"
  valid_json "$src" || return 1
  rm -f "$STATE"
  if ! cp "$src" "$STATE"; then rm -f "$STATE"; return 1; fi
  valid_json "$STATE" || { rm -f "$STATE"; return 1; }
}

cleanup(){ rm -f "$TMP"; rm -rf /data/zoryq-persistence.lock 2>/dev/null || true; }
cleanup

persisted=0
for f in "$STATE" "$CURRENT" "$PREVIOUS" "$LEGACY_GZ" "$LEGACY_RAW"; do [ -e "$f" ] && persisted=1; done

# Migrate the old verified compressed backup by rename before recovery. This needs
# no additional disk space and gives the new recovery model a canonical checkpoint.
if [ ! -f "$CURRENT" ] && [ -f "$LEGACY_GZ" ] && valid_gzip_json "$LEGACY_GZ"; then
  mv "$LEGACY_GZ" "$CURRENT"
  echo "[zoryq-state] migrated legacy checkpoint to current"
fi

if [ -f "$STATE" ] && valid_json "$STATE"; then
  echo "[zoryq-state] primary state valid"
else
  restored=0
  if [ -f "$CURRENT" ] && valid_gzip_json "$CURRENT"; then restore_gzip "$CURRENT" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ -f "$PREVIOUS" ] && valid_gzip_json "$PREVIOUS"; then restore_gzip "$PREVIOUS" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ -f "$LEGACY_RAW" ] && valid_json "$LEGACY_RAW"; then restore_raw "$LEGACY_RAW" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ "$persisted" -eq 1 ]; then
    echo "[zoryq-state] FATAL: persisted state exists but no valid recovery image is available" >&2
    exit 70
  fi
  if [ "$restored" -eq 0 ]; then echo "[zoryq-state] no persisted state found; genesis start allowed"; fi
fi

# Once a verified compressed checkpoint exists, retire obsolete full-size legacy backup.
if [ -f "$CURRENT" ] && valid_gzip_json "$CURRENT"; then rm -f "$LEGACY_GZ" "$LEGACY_RAW"; write_boot_status; fi

npm start &
APP_PID=$!

terminate(){ kill -TERM "$APP_PID" 2>/dev/null || true; wait "$APP_PID" 2>/dev/null || true; exit 0; }
trap terminate TERM INT

(
  sleep "$INITIAL_DELAY"
  while kill -0 "$APP_PID" 2>/dev/null; do
    sh "$CHECKPOINT" || true
    sleep "$INTERVAL"
  done
) &
CHECKPOINT_PID=$!

set +e
wait "$APP_PID"
CODE=$?
kill "$CHECKPOINT_PID" 2>/dev/null || true
wait "$CHECKPOINT_PID" 2>/dev/null || true
exit "$CODE"
