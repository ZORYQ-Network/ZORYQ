#!/bin/sh
set -eu
ROOT="$(mktemp -d)"
trap 'kill ${WRITER:-0} 2>/dev/null || true; rm -rf "$ROOT"' EXIT INT TERM
STATE="$ROOT/state.json"; PID="$ROOT/writer.pid"; CURRENT="$ROOT/current.gz"; PREVIOUS="$ROOT/previous.gz"; STATUS="$ROOT/status.json"; LOCK="$ROOT/lock"
SCRIPT="zoryq-developer/scripts/zoryq-persistence-atomic.sh"

printf '{"chainId":5919065,"block":0,"payload":"boot"}' > "$STATE"

# Simulate an executor that repeatedly replaces its live state atomically.
STATE="$STATE" node - <<'NODE' &
const fs=require('fs'); const p=process.env.STATE; let n=0;
setInterval(()=>{n++; const t=p+'.writer.tmp'; fs.writeFileSync(t,JSON.stringify({chainId:5919065,block:n,payload:'x'.repeat(20000)})); fs.renameSync(t,p);},5);
NODE
WRITER=$!
printf '%s' "$WRITER" > "$PID"
sleep 0.2

run_checkpoint() {
  ZORYQ_STATE_PATH="$STATE" ZORYQ_ANVIL_PID_FILE="$PID" ZORYQ_STATE_CURRENT="$CURRENT" ZORYQ_STATE_PREVIOUS="$PREVIOUS" ZORYQ_STATE_TMP="$ROOT/tmp.gz" ZORYQ_PERSISTENCE_STATUS="$STATUS" ZORYQ_PERSISTENCE_LOCK="$LOCK" sh "$SCRIPT"
}

run_checkpoint
[ -s "$CURRENT" ]
gzip -dc "$CURRENT" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const x=JSON.parse(s);if(x.chainId!==5919065)process.exit(2)})"
node -e "const x=JSON.parse(require('fs').readFileSync('$STATUS'));if(!x.ok||!x.checkpointSha256||x.consecutiveFailures!==0)process.exit(3)"
FIRST_HASH="$(sha256sum "$CURRENT" | awk '{print $1}')"

sleep 0.1
run_checkpoint
[ -s "$CURRENT" ]
[ -s "$PREVIOUS" ]
SECOND_HASH="$(sha256sum "$CURRENT" | awk '{print $1}')"
[ "$FIRST_HASH" != "$SECOND_HASH" ] || { echo 'expected checkpoint rotation to capture newer state'; exit 4; }

# A stale lock must coalesce rather than launch a competing writer.
mkdir "$LOCK"
run_checkpoint
rmdir "$LOCK"
[ "$(sha256sum "$CURRENT" | awk '{print $1}')" = "$SECOND_HASH" ]

# Corrupt live state while writer is stopped permanently; last valid checkpoint must survive.
kill -STOP "$WRITER"
printf '{broken' > "$STATE"
set +e
run_checkpoint
RC=$?
set -e
[ "$RC" -ne 0 ]
[ "$(sha256sum "$CURRENT" | awk '{print $1}')" = "$SECOND_HASH" ] || { echo 'valid current checkpoint was modified on failed transaction'; exit 5; }
node -e "const x=JSON.parse(require('fs').readFileSync('$STATUS'));if(x.ok||x.consecutiveFailures<1)process.exit(6)"
kill -CONT "$WRITER"

# Both retained checkpoints must remain valid JSON.
for f in "$CURRENT" "$PREVIOUS"; do gzip -dc "$f" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>JSON.parse(s))"; done

echo 'atomic persistence tests passed'
