#!/bin/sh
set -eu

STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
BACKUP="${STATE}.bak"
TMP="${STATE}.snapshot.tmp"

valid_json() {
  FILE="$1" node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.env.FILE,'utf8'));" >/dev/null 2>&1
}

recover_state() {
  [ -f "$STATE" ] || return 0
  if valid_json "$STATE"; then
    echo "[zoryq-state] primary state valid"
    return 0
  fi

  echo "[zoryq-state] primary state is corrupted; attempting recovery"
  if [ -f "$BACKUP" ] && valid_json "$BACKUP"; then
    cp "$BACKUP" "$STATE"
    echo "[zoryq-state] restored last verified backup"
  else
    CORRUPT="${STATE}.corrupt.$(date +%s)"
    mv "$STATE" "$CORRUPT"
    echo "[zoryq-state] no valid backup; quarantined corrupt state at $CORRUPT"
  fi
}

snapshot_state() {
  [ -f "$STATE" ] || return 0
  rm -f "$TMP"
  if cp "$STATE" "$TMP" 2>/dev/null && valid_json "$TMP"; then
    mv "$TMP" "$BACKUP"
    echo "[zoryq-state] verified recovery snapshot updated"
  else
    rm -f "$TMP"
    echo "[zoryq-state] skipped snapshot because state copy was incomplete"
  fi
}

recover_state

npm start &
APP_PID=$!

terminate() {
  kill -TERM "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  exit 0
}
trap terminate TERM INT

(
  while kill -0 "$APP_PID" 2>/dev/null; do
    sleep "${ZORYQ_STATE_BACKUP_INTERVAL:-300}"
    snapshot_state || true
  done
) &
BACKUP_PID=$!

set +e
wait "$APP_PID"
CODE=$?
kill "$BACKUP_PID" 2>/dev/null || true
wait "$BACKUP_PID" 2>/dev/null || true
exit "$CODE"
