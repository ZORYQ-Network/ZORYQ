# ZORYQ Atomic Persistence Architecture

This document defines the crash-consistent persistence model for the current ZORYQ Anvil-backed testnet. It replaces the former best-effort approach of compressing a live state file while the executor may be writing to it.

## Problem

The executor periodically rewrites `/data/zoryq-state.json`. A concurrent `gzip -c` can observe a partially rewritten JSON document and produce an invalid checkpoint. Retrying reduces probability but does not eliminate the race.

## Required invariant

A checkpoint is accepted only if the executor writer is paused, the source state validates while paused, the compressed temporary checkpoint validates, its digest is recorded, and the final filename is installed atomically before the writer resumes.

## Files

- live executor state: `/data/zoryq-state.json`
- current verified checkpoint: `/data/zoryq-state.current.json.gz`
- previous verified checkpoint: `/data/zoryq-state.previous.json.gz`
- temporary checkpoint: `/data/zoryq-state.checkpoint.tmp.gz`
- persistence status: `/data/zoryq-persistence-status.json`
- executor PID: `/data/zoryq-anvil.pid`

Only `current` and `previous` checkpoints are retained. Temporary and obsolete legacy files are cleaned.

## Checkpoint transaction

1. Acquire a single-writer checkpoint lock.
2. Resolve the executor PID and send `SIGSTOP`.
3. Validate the live JSON while the writer is stopped.
4. Stream the live file through gzip into a temporary file.
5. Validate the compressed temporary JSON.
6. Compute SHA-256 over the compressed checkpoint.
7. Rotate `current` to `previous` with rename.
8. Rename the validated temporary file to `current` atomically.
9. Atomically write persistence metadata.
10. Send `SIGCONT` to the executor.
11. Release the lock.

Any failure resumes the executor, leaves the last valid checkpoint untouched where possible, records the failure and removes the temporary file.

## Boot recovery

Startup must never silently discard an expected persisted state.

Recovery order:

1. validate live state;
2. otherwise restore `current` if valid;
3. otherwise restore `previous` if valid;
4. otherwise use the legacy checkpoint only during migration;
5. if persisted artifacts exist but none validate, fail startup instead of silently starting from genesis.

An empty/genesis start is allowed only when no persisted chain state/checkpoint exists.

## Health semantics

Persistence health is separate from process health.

Healthy readiness requires:

- Chain ID 5919065;
- EVM RPC ready;
- a valid block number;
- live state path known;
- persistence status not reporting consecutive checkpoint failures above the configured threshold;
- last successful checkpoint not older than the allowed age once the node has completed its first checkpoint interval.

`/health` exposes persistence status. A dedicated `/ready` endpoint is intended for infrastructure readiness decisions.

## Resource policy

Checkpointing streams from disk and does not use `readFileSync`/`JSON.stringify` to duplicate the full chain state in Node memory. Only two compressed checkpoints are retained.

Operational thresholds:

- disk >=70%: warning / cleanup old temporary artifacts;
- disk >=80%: do not create additional nonessential backup artifacts;
- disk >=85%: critical;
- memory >=75%: avoid nonessential heavy work;
- memory >=85%: critical.

Volume expansion to 2-5 GB remains recommended after the software fix, but capacity is not a substitute for bounded retention and crash-consistent writes.
