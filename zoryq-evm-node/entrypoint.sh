#!/bin/sh
set -eu

STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
CURRENT="${ZORYQ_STATE_CURRENT:-/data/zoryq-state.current.json.gz}"
PREVIOUS="${ZORYQ_STATE_PREVIOUS:-/data/zoryq-state.previous.json.gz}"
LEGACY_GZ="${STATE}.bak.gz"
LEGACY_RAW="${STATE}.bak"
STATUS="${ZORYQ_PERSISTENCE_STATUS:-/data/zoryq-persistence-status.json}"
CHECKPOINT_ROOT="${ZORYQ_CHECKPOINT_ROOT:-/data/zoryq-checkpoints}"
RPC_CHECKPOINT="${ZORYQ_RPC_CHECKPOINT_SCRIPT:-/app/rpc-state-checkpoint.mjs}"
INTERVAL="${ZORYQ_STATE_BACKUP_INTERVAL:-300}"
INITIAL_DELAY="${ZORYQ_STATE_INITIAL_CHECKPOINT_DELAY:-45}"
VALIDATOR="${ZORYQ_STREAM_VALIDATOR:-/app/persistence-validator.mjs}"

valid_json(){ node "$VALIDATOR" "$1" >/dev/null 2>&1; }
valid_gzip_json(){ node "$VALIDATOR" "$1" --gzip >/dev/null 2>&1; }
has_native_checkpoint(){
  [ -f "$CHECKPOINT_ROOT/current/meta.json" ] && [ -f "$CHECKPOINT_ROOT/current/state.hex.gz" ] && return 0
  [ -f "$CHECKPOINT_ROOT/previous/meta.json" ] && [ -f "$CHECKPOINT_ROOT/previous/state.hex.gz" ] && return 0
  return 1
}

# Only boot-time residue is safe to remove. Never delete current/previous generations here.
rm -rf "$CHECKPOINT_ROOT/.writer-lock" 2>/dev/null || true
if [ -d "$CHECKPOINT_ROOT" ]; then
  find "$CHECKPOINT_ROOT" -maxdepth 1 -type d -name '.tmp-*' -exec rm -rf {} + 2>/dev/null || true
fi

persisted=0
for f in "$STATE" "$CURRENT" "$PREVIOUS" "$LEGACY_GZ" "$LEGACY_RAW"; do [ -e "$f" ] && persisted=1; done
has_native_checkpoint && persisted=1 || true

# Prefer the native RPC checkpoint when it exists. server.mjs restores it before it starts HTTP.
# Remove an invalid live JSON so Anvil can start cleanly and accept anvil_loadState.
if has_native_checkpoint; then
  if [ -f "$STATE" ] && ! valid_json "$STATE"; then
    echo "[zoryq-state] invalid live JSON removed; native RPC boot recovery required"
    rm -f "$STATE"
  fi
else
  # One-time compatibility path for deployments that still only have the legacy snapshots.
  if [ ! -f "$CURRENT" ] && [ -f "$LEGACY_GZ" ] && valid_gzip_json "$LEGACY_GZ"; then
    mv "$LEGACY_GZ" "$CURRENT"
    echo "[zoryq-state] migrated legacy compressed checkpoint to current"
  fi

  if [ -f "$STATE" ] && valid_json "$STATE"; then
    echo "[zoryq-state] primary state valid"
  else
    restored=0
    if [ -f "$CURRENT" ] && valid_gzip_json "$CURRENT"; then
      echo "[zoryq-state] restoring legacy current checkpoint"
      rm -f "$STATE"
      if gzip -dc "$CURRENT" > "$STATE" && valid_json "$STATE"; then restored=1; else rm -f "$STATE"; fi
    fi
    if [ "$restored" -eq 0 ] && [ -f "$PREVIOUS" ] && valid_gzip_json "$PREVIOUS"; then
      echo "[zoryq-state] restoring legacy previous checkpoint"
      rm -f "$STATE"
      if gzip -dc "$PREVIOUS" > "$STATE" && valid_json "$STATE"; then restored=1; else rm -f "$STATE"; fi
    fi
    if [ "$restored" -eq 0 ] && [ -f "$LEGACY_RAW" ] && valid_json "$LEGACY_RAW"; then
      cp "$LEGACY_RAW" "$STATE" && restored=1
    fi
    if [ "$restored" -eq 0 ] && [ "$persisted" -eq 1 ]; then
      echo "[zoryq-state] FATAL: persisted legacy state exists but no valid recovery image is available" >&2
      exit 70
    fi
    if [ "$restored" -eq 0 ]; then echo "[zoryq-state] no persisted state found; genesis start allowed"; fi
  fi
fi

npm start &
APP_PID=$!

terminate(){
  kill -TERM "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  exit 0
}
trap terminate TERM INT

# Native RPC checkpoints are now the only normal runtime checkpoint path.
# The old atomic-checkpoint.sh remains in the image only for legacy compatibility/testing.
(
  sleep "$INITIAL_DELAY"
  while kill -0 "$APP_PID" 2>/dev/null; do
    node "$RPC_CHECKPOINT" || true
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
