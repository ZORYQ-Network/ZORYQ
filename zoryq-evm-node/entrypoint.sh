#!/bin/sh
set -eu

STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
CURRENT="${ZORYQ_STATE_CURRENT:-/data/zoryq-state.current.json.gz}"
PREVIOUS="${ZORYQ_STATE_PREVIOUS:-/data/zoryq-state.previous.json.gz}"
LEGACY_GZ="${STATE}.bak.gz"
LEGACY_RAW="${STATE}.bak"
TMP="${ZORYQ_STATE_TMP:-/data/zoryq-state.checkpoint.tmp.gz}"
RECOVER_TMP="${STATE}.recover.tmp"
STATUS="${ZORYQ_PERSISTENCE_STATUS:-/data/zoryq-persistence-status.json}"
VALIDATOR="${ZORYQ_STREAM_VALIDATOR:-/app/persistence-validator.mjs}"
CHECKPOINT="${ZORYQ_CHECKPOINT_SCRIPT:-/app/atomic-checkpoint.sh}"
INTERVAL="${ZORYQ_STATE_BACKUP_INTERVAL:-300}"
INITIAL_DELAY="${ZORYQ_STATE_INITIAL_CHECKPOINT_DELAY:-45}"

valid_json(){ node "$VALIDATOR" "$1" >/dev/null 2>&1; }
valid_gzip_json(){ node "$VALIDATOR" "$1" --gzip >/dev/null 2>&1; }

restore_gzip(){ src="$1"; echo "[zoryq-state] restoring verified checkpoint $src"; gzip -dc "$src" > "$RECOVER_TMP"; valid_json "$RECOVER_TMP" || { rm -f "$RECOVER_TMP"; return 1; }; mv "$RECOVER_TMP" "$STATE"; echo "[zoryq-state] checkpoint restored"; }
restore_raw(){ src="$1"; echo "[zoryq-state] restoring verified legacy checkpoint $src"; cp "$src" "$RECOVER_TMP"; valid_json "$RECOVER_TMP" || { rm -f "$RECOVER_TMP"; return 1; }; mv "$RECOVER_TMP" "$STATE"; }

cleanup(){ rm -f "$TMP" "$RECOVER_TMP"; rm -rf /data/zoryq-persistence.lock 2>/dev/null || true; }
cleanup

persisted=0
for f in "$STATE" "$CURRENT" "$PREVIOUS" "$LEGACY_GZ" "$LEGACY_RAW"; do [ -e "$f" ] && persisted=1; done

if [ -f "$STATE" ] && valid_json "$STATE"; then
  echo "[zoryq-state] primary state valid"
else
  restored=0
  if [ -f "$CURRENT" ] && valid_gzip_json "$CURRENT"; then restore_gzip "$CURRENT" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ -f "$PREVIOUS" ] && valid_gzip_json "$PREVIOUS"; then restore_gzip "$PREVIOUS" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ -f "$LEGACY_GZ" ] && valid_gzip_json "$LEGACY_GZ"; then restore_gzip "$LEGACY_GZ" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ -f "$LEGACY_RAW" ] && valid_json "$LEGACY_RAW"; then restore_raw "$LEGACY_RAW" && restored=1; fi
  if [ "$restored" -eq 0 ] && [ "$persisted" -eq 1 ]; then
    echo "[zoryq-state] FATAL: persisted state exists but no valid recovery image is available" >&2
    exit 70
  fi
  if [ "$restored" -eq 0 ]; then echo "[zoryq-state] no persisted state found; genesis start allowed"; fi
fi

# Migrate the old verified compressed backup by rename, requiring no extra disk space.
if [ ! -f "$CURRENT" ] && [ -f "$LEGACY_GZ" ] && valid_gzip_json "$LEGACY_GZ"; then
  mv "$LEGACY_GZ" "$CURRENT"
  echo "[zoryq-state] migrated legacy checkpoint to current"
fi
# Once a verified current checkpoint exists, retire obsolete full-size artifacts.
if [ -f "$CURRENT" ] && valid_gzip_json "$CURRENT"; then rm -f "$LEGACY_GZ" "$LEGACY_RAW"; fi

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
