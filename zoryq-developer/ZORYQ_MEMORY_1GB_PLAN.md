# ZORYQ 1 GB Memory Optimization Plan

Status: isolated pre-deploy patch. This branch must not be promoted until CI and soak validation are green.

## Current process topology

The production runtime currently forms this chain:

`product-gateway -> traffic-gateway -> edge-gateway -> public-gateway -> server -> reth`

with additional Node.js processes for social-service, admin-control and explorer-service.

The product gateway also spawns `npm start`, adding an avoidable npm parent process before `traffic-gateway.mjs`.

## Goals

- normal container RAM: 400-650 MB
- expected peaks below 800 MB
- warning at 80% of a 1 GB container
- critical alert at 85%
- no unbounded in-memory maps in public gateways
- explorer index bounded by count and receipt concurrency
- per-process memory telemetry visible in logs

## Safe patch

1. Spawn `traffic-gateway.mjs` directly instead of `npm start`.
2. Give auxiliary Node processes explicit `--max-old-space-size` budgets.
3. Prune rate-limit maps after their windows expire rather than retaining IP keys indefinitely.
4. Bound explorer index size and receipt concurrency with environment variables.
5. Add lightweight RSS / heap telemetry for product, traffic and edge processes.
6. Keep Reth outside Node heap budgets; Reth remains the execution client.

## Initial memory budgets

These are guardrails, not reservations:

- product gateway: 96 MB old-space
- traffic gateway: 96 MB old-space
- edge gateway: 96 MB old-space
- public gateway: 128 MB old-space
- social service: 128 MB old-space
- admin verifier: 64 MB old-space
- explorer service: 160 MB old-space
- server/control plane: 192 MB old-space

Node RSS can exceed V8 old-space, so container-level telemetry remains authoritative.

## Follow-up consolidation

After this low-risk patch is measured, the next structural reduction is to merge routing layers so the runtime does not need product + traffic + edge + public as four separate Node processes. That refactor changes routing/security boundaries and therefore needs full RPC/faucet/explorer/social regression coverage.

## Release gate

Do not promote unless chain ID remains 5919065, RPC protections pass, faucet passes, explorer ordering passes, social endpoints pass, hard restart/state persistence passes, 60-minute soak shows no monotonic RSS growth, and peak memory remains below 800 MB under expected testnet workload.
