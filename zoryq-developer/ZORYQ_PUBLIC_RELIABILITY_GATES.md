# ZORYQ Public Reliability Gates

Status: engineering release policy. These gates are intentionally stricter than a simple HTTP healthcheck.

## Principle

Do not send a large public audience to the ZORYQ faucet, RPC or explorer until the network has demonstrated sustained reliability under realistic load. A successful deployment or a single `200 OK` is not sufficient evidence.

## Current risk register — 2026-09-09

Observed from the live Railway service:

- latest production deployment is successful and the healthcheck passes;
- public `/health`, `/rpc`, `/start`, `/docs` and `/explorer` have recently returned HTTP 200;
- current CPU utilization is low and current memory is below the configured memory limit;
- however, 7-day telemetry recorded a memory peak above the current reported ~1 GB memory limit, which requires investigation before a large traffic campaign;
- disk usage is already close to the 500 MB persistent-volume capacity and needs headroom/retention work before broad promotion;
- runtime repeatedly logs `skipped snapshot because state copy was incomplete`; snapshot/backup durability must be fixed and recovery-tested;
- some non-critical static routes return 404 (for example favicon and a leaderboard asset); these do not prove RPC instability but should be cleaned up before a polished launch.

No mass-user launch should be approved from the present evidence alone.

## Release stages

### R0 — Engineering only

Allowed: internal development and CI.

### R1 — Controlled testnet

Allowed: small external tester group.

Required:
- RPC/faucet/explorer reachable;
- chain ID invariant verified;
- restart recovery tested;
- state persistence verified;
- no unresolved data-loss issue;
- rate limits enabled on expensive/public-abuse endpoints.

### R2 — Public beta

Allowed: public links and moderate community onboarding.

Required rolling evidence for at least 7 consecutive days:
- RPC availability >= 99.5%;
- health endpoint availability >= 99.9%;
- explorer availability >= 99.5%;
- faucet service availability >= 99.0% excluding quota/rate-limit responses;
- no chain-ID mismatch;
- no unexplained state rollback;
- no unresolved crash loop;
- p95 RPC latency target declared and met for the supported method mix;
- resource headroom policy met;
- backup/snapshot + restore drill passed;
- faucet abuse controls tested;
- incident runbook and rollback procedure tested.

### R3 — Large campaign ready

Allowed: campaigns intended to bring hundreds/thousands of testers.

Required rolling evidence for at least 30 consecutive days:
- RPC availability >= 99.9%;
- health availability >= 99.95%;
- explorer availability >= 99.9%;
- no severity-1 unresolved incident;
- load test at >= 3x expected campaign peak for 60 minutes without data loss;
- soak test at expected peak for >= 24 hours;
- p95 and p99 latency remain inside published budgets;
- memory peak <= 70% of provisioned limit during expected-load soak;
- persistent disk <= 60% at campaign start with growth forecast and alerting;
- automated restart/recovery verified;
- tested backup restore with measured RPO/RTO;
- faucet quotas, per-IP/per-address controls and global circuit breaker verified;
- RPC request-size, batch-size, concurrency and expensive-method limits verified;
- public status surface available;
- on-call/incident ownership defined.

## Resource headroom policy

Do not size production to average usage. Capacity decisions use observed peaks plus campaign load tests.

Before R3:
- CPU: maintain >= 50% headroom at expected peak;
- memory: maintain >= 30% headroom at expected peak, preferably >= 50% for an immature node;
- disk: maintain >= 40% free persistent capacity at launch and project growth for 30 days;
- network: establish expected ingress/egress from load tests rather than current low-traffic telemetry.

If any hard resource exceeds 85%, enter degraded-risk state and stop increasing traffic until capacity or retention is corrected.

## RPC protection requirements

Public RPC must implement or enforce at the edge:
- maximum request body size;
- maximum JSON-RPC batch size;
- per-IP request rate;
- per-IP concurrent request cap;
- method-specific budgets for expensive calls;
- request timeout;
- upstream concurrency/backpressure;
- explicit blocklist for privileged development/admin methods;
- deterministic overload response;
- metrics for accepted, rejected, timed-out and failed calls.

Rate limiting must protect availability without hiding capacity problems.

## Faucet protection requirements

Before mass onboarding:
- per-address cooldown;
- per-IP/device abuse friction where appropriate;
- maximum amount per claim/day;
- global daily issuance budget;
- global circuit breaker;
- low-balance alert;
- transaction confirmation tracking;
- idempotency/replay handling;
- no private key or signing secret exposed to the browser;
- monitoring must use dry-run/status checks rather than consume faucet funds.

## State durability gates

A blockchain endpoint that stays online but loses state is not reliable.

Required:
- primary state integrity check at startup;
- atomic or consistency-safe snapshot mechanism;
- snapshot completion telemetry;
- snapshot age alert;
- restore test into an isolated node;
- state digest comparison after restore;
- documented RPO and RTO;
- disk-full behavior test;
- safe handling of interrupted snapshots.

The repeated `state copy was incomplete` snapshot message is a release blocker for R3 until its cause is understood and a successful restore drill is demonstrated.

## Deployment safety

Production changes should follow:

1. CI/build passes.
2. Isolated/preview validation passes.
3. Smoke and conformance checks pass.
4. Deploy with health gate.
5. Post-deploy RPC/chain-ID/head-progression checks pass.
6. Observe error/latency/resource metrics.
7. Roll back on regression.

Avoid coupling documentation/web-only changes to node redeploys unless necessary. Deployment frequency is not a reliability metric.

## Load and soak test matrix

Test separately:
- health/readiness traffic;
- `eth_chainId`/light reads;
- block/receipt/log reads;
- transaction submission;
- mixed realistic RPC traffic;
- maximum allowed JSON-RPC batches;
- faucet status/claim traffic with safe test accounts;
- explorer traffic;
- malformed/abusive traffic;
- sudden 10x burst;
- sustained expected peak;
- 3x campaign peak.

Record p50/p95/p99, success rate, timeouts, resource use, queue/backpressure, state progression and recovery.

## Go / no-go rule

A large public campaign is **NO-GO** if any of the following is true:
- unresolved state persistence/snapshot failure;
- resource sizing cannot survive tested campaign load;
- no restore drill;
- RPC or faucet lacks abuse/circuit-breaker controls;
- recent crash loop or unexplained state rollback;
- no rollback/runbook path;
- availability evidence window has not been completed.

Marketing pressure never overrides these gates.