#!/bin/sh
set -eu
STATE="${ZORYQ_STATE_PATH:-/data/zoryq-state.json}"
CURRENT="${ZORYQ_STATE_CURRENT:-/data/zoryq-state.current.json.gz}"
PREVIOUS="${ZORYQ_STATE_PREVIOUS:-/data/zoryq-state.previous.json.gz}"
TMP="${ZORYQ_STATE_TMP:-/data/zoryq-state.checkpoint.tmp.gz}"
STATUS="${ZORYQ_PERSISTENCE_STATUS:-/data/zoryq-persistence-status.json}"
LOCK="${ZORYQ_PERSISTENCE_LOCK:-/data/zoryq-persistence.lock}"
VALIDATOR="${ZORYQ_STREAM_VALIDATOR:-/app/persistence-validator.mjs}"
LOCK_OWNED=0; WRITER_PAUSED=0; WRITER_PID=""
now_ms(){ node -e 'process.stdout.write(String(Date.now()))'; }
valid_json(){ node "$VALIDATOR" "$1" >/dev/null 2>&1; }
valid_gzip_json(){ node "$VALIDATOR" "$1" --gzip >/dev/null 2>&1; }
read_failures(){ [ -f "$STATUS" ] || { echo 0; return; }; FILE="$STATUS" node -e "try{const x=JSON.parse(require('fs').readFileSync(process.env.FILE));process.stdout.write(String(Number(x.consecutiveFailures||0)))}catch{process.stdout.write('0')}"; }
write_status(){ ok="$1"; msg="$2"; digest="${3:-}"; failures="${4:-0}"; dur="${5:-0}"; disk="${6:-0}"; ts="$(now_ms)"; t="${STATUS}.tmp"; FILE="$STATUS" OK="$ok" MSG="$msg" DIGEST="$digest" FAILURES="$failures" DUR="$dur" DISK="$disk" TS="$ts" node - <<'NODE' > "$t"
const fs=require('fs');let prev={};try{prev=JSON.parse(fs.readFileSync(process.env.FILE,'utf8'))}catch{};const ok=process.env.OK==='true';const x={version:2,chainId:5919065,ok,message:process.env.MSG,lastAttemptAt:Number(process.env.TS),consecutiveFailures:Number(process.env.FAILURES),durationMs:Number(process.env.DUR),diskPercent:Number(process.env.DISK)};if(ok){x.lastSuccessAt=Number(process.env.TS);x.checkpointSha256=process.env.DIGEST}else{if(prev.lastSuccessAt)x.lastSuccessAt=prev.lastSuccessAt;if(prev.checkpointSha256)x.checkpointSha256=prev.checkpointSha256}process.stdout.write(JSON.stringify(x));
NODE
mv "$t" "$STATUS"; }
acquire(){ if mkdir "$LOCK" 2>/dev/null; then LOCK_OWNED=1; return 0; fi; return 1; }
release(){ if [ "$LOCK_OWNED" -eq 1 ]; then rmdir "$LOCK" 2>/dev/null || true; LOCK_OWNED=0; fi; }
resume(){ if [ "$WRITER_PAUSED" -eq 1 ] && [ -n "$WRITER_PID" ]; then kill -CONT "$WRITER_PID" 2>/dev/null || true; WRITER_PAUSED=0; fi; }
cleanup(){ resume; rm -f "$TMP"; release; }
trap cleanup EXIT INT TERM HUP
find_writer(){ for c in /proc/[0-9]*/comm; do [ -r "$c" ] || continue; [ "$(cat "$c" 2>/dev/null || true)" = "anvil" ] || continue; basename "$(dirname "$c")"; return 0; done; return 1; }
disk_pct(){ df -Pk "$(dirname "$STATE")" | awk 'NR==2{gsub("%","",$5);print $5+0}'; }
fail(){ msg="$1"; d="${2:-0}"; write_status false "$msg" '' "$(( $(read_failures)+1 ))" 0 "$d"; return 1; }
checkpoint(){ acquire || { echo '[zoryq-state] checkpoint coalesced'; return 0; }; [ -f "$STATE" ] || { fail state_missing; return 1; }; WRITER_PID="$(find_writer || true)"; [ -n "$WRITER_PID" ] || { fail writer_not_found; return 1; }; disk="$(disk_pct)"; if [ "$disk" -ge 85 ]; then fail disk_critical_checkpoint_deferred "$disk"; return 1; fi; if [ "$disk" -ge 80 ]; then rm -f "$PREVIOUS"; fi; [ "$disk" -lt 70 ] || echo "[zoryq-state] disk warning ${disk}%"; start="$(now_ms)"; kill -STOP "$WRITER_PID"; WRITER_PAUSED=1; valid_json "$STATE" || { fail live_state_invalid_while_writer_paused "$disk"; return 1; }; rm -f "$TMP"; gzip -c "$STATE" > "$TMP"; valid_gzip_json "$TMP" || { fail checkpoint_validation_failed "$disk"; return 1; }; digest="$(sha256sum "$TMP"|awk '{print $1}')"; sync -f "$TMP" 2>/dev/null || true; [ -f "$CURRENT" ] && mv "$CURRENT" "$PREVIOUS"; mv "$TMP" "$CURRENT"; sync -f "$CURRENT" 2>/dev/null || true; dur="$(( $(now_ms)-start ))"; write_status true checkpoint_committed "$digest" 0 "$dur" "$disk"; echo "[zoryq-state] atomic checkpoint committed sha256=$digest durationMs=$dur"; }
checkpoint
