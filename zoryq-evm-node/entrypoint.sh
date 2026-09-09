#!/bin/sh
set -eu

mkdir -p /data/reth

# Reth owns durable EVM state directly in /data/reth. Legacy Anvil checkpoint
# files are intentionally left untouched so a production migration can be
# inspected or rolled back without destructive cleanup.
exec npm start
