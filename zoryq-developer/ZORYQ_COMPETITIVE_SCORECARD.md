# ZORYQ Evidence-Weighted Competitive Scorecard

Last updated: 2026-09-09.

This scorecard is an internal engineering prioritization tool. Competitor numbers and stages change; re-verify before external publication. ZORYQ scores are deliberately evidence-weighted: roadmap ambition does not receive the same credit as externally reproducible implementation.

## Scoring model

| Dimension | Weight | What earns a high score |
|---|---:|---|
| Execution correctness & performance | 20 | Correct EVM behavior, concurrency safety, low latency, saturation benchmarks |
| Finality / consensus evidence | 15 | Explicit finality model, multi-node safety/liveness and fault tests |
| Decentralization / validator accessibility | 10 | External operators can join and reproduce network operation |
| Security / MEV / economic safety | 15 | Threat models, negative tests, audits, protected order flow and safe failure modes |
| Developer experience | 10 | Stable RPC, SDKs, docs, explorer, faucet, examples and conformance |
| Agentic primitives | 10 | Bounded permissions, agent wallets, simulation, receipts and revocation |
| Social / identity / reputation | 7 | Portable evidence-aware graph and usable consumer surfaces |
| Financial / payments primitives | 7 | DEX/perps/payment paths with robust risk controls |
| Reliability / operations | 6 | Public SLOs, monitoring, incident response, reproducible deployments |

Total: 100.

## ZORYQ current evidence map

| Dimension | Current evidence status | Next evidence that materially increases score |
|---|---|---|
| Execution correctness & performance | CI VERIFIED for core EVM flows; performance claims not yet benchmarked | Open benchmark harness + concurrency serial-equivalence suite |
| Finality / consensus evidence | DESIGNED / incomplete evidence | Formal finality definition + multi-node fault harness |
| Validator accessibility | TARGET | Independent node bootstrap runbook and external operator reproduction |
| Security / MEV / economic safety | PARTIAL | RPC threat suite, agent negative tests, MEV threat model, independent audit |
| Developer experience | PARTIAL / PUBLICLY VERIFIED surfaces | Versioned RPC conformance matrix + SDK release CI |
| Agentic primitives | PROTOTYPE | Signed capability envelope enforced with budgets, expiry, replay protection and revocation |
| Social / identity / reputation | PROTOTYPE | Durable portable graph + moderation/privacy + on-chain/verifiable evidence links |
| Financial / payments | PARTIAL / PROTOTYPE | Audited DEX/payment primitives; PerpDEX risk engine before launch |
| Reliability / operations | PARTIAL | Public SLO dashboard + rolling availability/head-progression evidence |

## P0 engineering sequence

1. **Correctness before speed** — build serial-equivalence and RPC conformance gates.
2. **Define finality precisely** — separate accepted, included and final states in protocol and metrics.
3. **Benchmark transparently** — publish raw p50/p95/p99 latency and saturation curves with hardware manifest.
4. **Multi-node evidence** — automate bootstrap, restart, lag, partition and recovery scenarios.
5. **Agent capability enforcement** — signed scoped permissions, simulation, budgets, expiry, replay prevention, revocation and receipts.
6. **MEV/economic threat model** — identify front-running, sandwich, censorship, liquidation/oracle and sequencer/validator risks before claiming protection.
7. **External reproduction** — make a fresh operator able to reproduce node setup and benchmark results without private assistance.
8. **Audit-ready surfaces** — freeze and document critical scopes before independent review.

## Features that should NOT distract P0

Do not sacrifice protocol evidence for cosmetic TPS claims, additional demo pages, token-price narratives, premature mainnet language, unsupported decentralization claims, or feature count. A smaller set of independently proven primitives is strategically stronger.

## Definition of “better”

For ZORYQ, “better than peers” should mean a measurable combination of:

- competitive real-time execution under realistic mixed workloads;
- correctness under contention;
- explicit and reproducible finality;
- strong developer compatibility;
- safer agent authority than generic wallet delegation;
- integrated social/reputation/payment primitives that reduce application complexity;
- transparent security and operational evidence;
- external reproducibility.

A score above leading peers should only be published after the corresponding evidence bundle exists.