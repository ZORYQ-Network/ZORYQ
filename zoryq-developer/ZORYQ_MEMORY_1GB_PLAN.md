# ZORYQ 1 GB Memory Optimization Plan

Status: isolated pre-deploy patch. Do not promote until CI and soak validation are green.

## Current process topology

`product-gateway -> traffic-gateway -> edge-gateway -> public-gateway -> server -> reth`

Additional Node.js processes: social-service, admin-control and explorer-service.

## Goals

- normal container RAM: 400-650 MB
- expected peaks below 800 MB
- warning at 80% of 1 GB
- critical alert at 85%
- no unbounded gateway maps
- bounded explorer history/concurrency
- per-process RSS/heap telemetry

## Safe patch

1. Remove the unnecessary `npm start` parent and spawn `traffic-gateway.mjs` directly.
2. Apply explicit V8 old-space budgets to auxiliary Node processes.
3. Prune expired rate-limit/IP maps.
4. Bound explorer transaction retention and receipt concurrency.
5. Emit lightweight RSS/heap telemetry.
6. Leave Reth outside Node heap budgets.

## Initial budgets

- product gateway: 96 MB
- traffic gateway: 96 MB
- edge gateway: 96 MB
- public gateway: 128 MB
- social service: 128 MB
- admin verifier: 64 MB
- explorer service: 160 MB
- server/control plane: 192 MB

These are V8 old-space guardrails, not RSS reservations.

## Follow-up

After measurement, merge redundant routing layers in a separate refactor. That changes security/routing boundaries and must carry complete RPC/faucet/explorer/social regression tests.

## Release gate

Do not promote unless chain ID 5919065, RPC protection, faucet, explorer ordering, social, hard restart/state persistence and a 60-minute soak all pass; target peak container RAM <800 MB.
