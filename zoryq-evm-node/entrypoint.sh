#!/bin/sh
set -eu

STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
LEGACY_BACKUP="${STATE}.bak"
BACKUP="${STATE}.bak.gz"
TMP="${STATE}.snapshot.tmp.gz"
SNAPSHOT_RETRIES="${ZORYQ_STATE_SNAPSHOT_RETRIES:-3}"
SNAPSHOT_RETRY_DELAY="${ZORYQ_STATE_SNAPSHOT_RETRY_DELAY:-2}"

valid_json() {
  FILE="$1" node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.env.FILE,'utf8'));" >/dev/null 2>&1
}

valid_gzip_json() {
  FILE="$1" node -e "const fs=require('fs'),z=require('zlib'); JSON.parse(z.gunzipSync(fs.readFileSync(process.env.FILE)).toString('utf8'));" >/dev/null 2>&1
}

recover_state() {
  [ -f "$STATE" ] || return 0
  if valid_json "$STATE"; then
    echo "[zoryq-state] primary state valid"
    return 0
  fi

  echo "[zoryq-state] primary state is corrupted; attempting recovery"
  if [ -f "$BACKUP" ] && valid_gzip_json "$BACKUP"; then
    gzip -dc "$BACKUP" > "${STATE}.recover.tmp"
    if valid_json "${STATE}.recover.tmp"; then
      mv "${STATE}.recover.tmp" "$STATE"
      echo "[zoryq-state] restored last verified compressed backup"
      return 0
    fi
    rm -f "${STATE}.recover.tmp"
  fi

  if [ -f "$LEGACY_BACKUP" ] && valid_json "$LEGACY_BACKUP"; then
    cp "$LEGACY_BACKUP" "$STATE"
    echo "[zoryq-state] restored last verified legacy backup"
    return 0
  fi

  CORRUPT="${STATE}.corrupt.$(date +%s)"
  mv "$STATE" "$CORRUPT"
  echo "[zoryq-state] no valid backup; quarantined corrupt state at $CORRUPT"
}

snapshot_once() {
  rm -f "$TMP"
  if gzip -c "$STATE" > "$TMP" 2>/dev/null && valid_gzip_json "$TMP"; then
    mv "$TMP" "$BACKUP"
    # Remove the old uncompressed backup only after a verified compressed backup exists.
    rm -f "$LEGACY_BACKUP"
    echo "[zoryq-state] verified compressed recovery snapshot updated"
    return 0
  fi
  rm -f "$TMP"
  return 1
}

snapshot_state() {
  [ -f "$STATE" ] || return 0
  attempt=1
  while [ "$attempt" -le "$SNAPSHOT_RETRIES" ]; do
    if snapshot_once; then
      return 0
    fi
    if [ "$attempt" -lt "$SNAPSHOT_RETRIES" ]; then
      sleep "$SNAPSHOT_RETRY_DELAY"
    fi
    attempt=$((attempt + 1))
  done
  echo "[zoryq-state] snapshot deferred: no consistent state image after ${SNAPSHOT_RETRIES} attempts"
  return 1
}

cleanup_stale_artifacts() {
  rm -f "$TMP" "${STATE}.recover.tmp"
  # Keep at most two quarantined corrupt states to prevent unbounded disk growth.
  ls -1t "${STATE}.corrupt."* 2>/dev/null | awk 'NR>2' | xargs -r rm -f -- 2>/dev/null || true
}

cleanup_stale_artifacts
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
