# ZORYQ — State-of-the-Art L1 Roadmap

Status: architecture roadmap, not a claim of current capability.

ZORYQ should optimize for **verifiable security, permissionless operation, developer velocity and agent-native UX** rather than marketing numbers. The current ZORYQ EVM Testnet is a centralized public testing environment; this roadmap defines the gates required to evolve it into a production-grade L1.

## Core architecture principle

**ZORYQ = secure permissionless L1 + EVM-grade compatibility + native smart-account UX + agent-native execution + identity/reputation + embedded financial primitives.**

The chain itself must remain small, deterministic and auditable. SocialFi, DEX, lending, PerpDEX, reputation and agent products should use protocol primitives where they materially improve safety/UX, but product complexity must not become consensus-critical without a strong reason.

## The improved priority order

The original 35-item list is directionally strong, but several items have hard dependencies. The production order should therefore be:

### P0 — Architecture and safety foundation

1. **Consensus + state-transition specification before decentralization claims**
   - Choose and document BFT family, finality semantics, validator lifecycle, fork choice, timing assumptions, fault threshold and recovery behavior.
   - No claim of BFT until fault injection proves the stated model.

2. **Reproducible independent node**
   - Fresh operator can bootstrap, sync, persist, restart and recover without privileged infrastructure credentials.
   - Deterministic genesis/config fingerprint and versioned protocol parameters.

3. **Three-to-seven node fault-tested devnet**
   - Independent keys, independent storage and at least three trust domains before a permissionless public validator program.
   - Test outage, partition, stale peer, rollback, rolling upgrade and RPC failover.

4. **Deterministic execution architecture**
   - Define transaction ordering, state access, conflict semantics, gas accounting, receipts and replay determinism.
   - Parallel execution is accepted only when every validator deterministically derives the same state root.

5. **Security engineering baseline**
   - Fuzzing, invariant tests, differential tests, malformed-input tests, state-transition replay, consensus adversarial tests and dependency pinning.
   - Security regressions block releases.

### P1 — Permissionless and scalable L1

6. **Permissionless validator/node admission**
   - Public bootstrap, peer discovery, validator registration/removal, key rotation and non-custodial operator flow.
   - No privileged sequencer or hidden allowlist in the steady state.

7. **Parallel execution**
   - Prefer deterministic optimistic or access-list/conflict-graph scheduling rather than speculative TPS claims.
   - Benchmark both ideal independent workloads and adversarial hot-state workloads.

8. **Fast finality with explicit safety envelope**
   - Target sub-second perceived confirmation only if network assumptions support it.
   - Publish p50/p95/p99 block inclusion and finality, not one best-case number.

9. **Censorship resistance + MEV policy**
   - Inclusion lists or equivalent forced-inclusion mechanism.
   - Deterministic/public ordering policy, encrypted mempool or other MEV mitigation only after threat modeling.
   - Measure censorship latency and sandwich/frontrun exposure.

10. **Multi-client protocol specification**
    - Stabilize protocol spec first; then require at least two independently maintained implementations before mainnet decentralization claims.
    - Differential state-root testing between clients is mandatory.

### P2 — User experience as protocol advantage

11. **Native smart accounts / Account Abstraction**
    - Passkeys, session keys, batching, recovery, multisig/policy controls and wallet-safe agent permissions.
    - Avoid seed-phrase dependence in the default consumer path without preventing self-custody.

12. **Native paymaster + gas sponsorship**
    - Apps can sponsor gas under bounded policies.
    - Rate limits, spending caps, simulation and replay protection are mandatory.

13. **Gasless onboarding**
    - First successful app interaction must not require the user to acquire ZQ beforehand.
    - Sponsorship must not weaken anti-spam economics.

14. **Predictable low fees**
    - Fee market should optimize predictability under load, not merely low idle-network prices.
    - Publish fee p50/p95/p99 under benchmarked congestion.

15. **Agent permissions as first-class account policy**
    - Human wallet remains root authority.
    - Agent permissions must be scoped by target, method, token/value, time, rate, budget and revocation.
    - State-changing operations require explicit policy/signer authorization.

### P3 — Verification, availability and interoperability

16. **State pruning + snapshots + historical access policy**
17. **Light clients / succinct verification path**
18. **Data availability strategy matched to hardware targets**
19. **Redundant public RPC with independent operators/providers**
20. **Official indexer and stable API contracts**
21. **Trust-minimized interoperability** only after finality/light-client assumptions are mature
22. **Oracle infrastructure** with multi-source resilience and stale-price protections

### P4 — Mainnet security and governance gates

23. **Independent protocol audit**
24. **Independent critical-contract/bridge audit**
25. **Permanent bug bounty**
26. **Upgrade security + timelocks + rollback discipline**
27. **Progressive governance decentralization**
28. **Validator economics / tokenomics validated by measured costs**
29. **Emergency powers sunset plan**
30. **Post-quantum migration roadmap**

### P5 — Native ecosystem differentiation

31. **Identity + reputation on-chain**
32. **AI agent infrastructure**
33. **Payments + micropayments**
34. **SocialFi primitives**
35. **Native DEX / lending / PerpDEX / optional privacy products**

Existing ZORYQ DEX and lending deployments are useful testnet applications, but they do not substitute for L1 decentralization or consensus maturity.

## What ZORYQ should try to beat competitors on

ZORYQ should not optimize for a single headline such as TPS. The technical wedge should be measurable across four dimensions:

- **Fast path from idea to verified on-chain product**: excellent EVM compatibility, SDKs, devkit, local simulation, explorer traces and reproducible examples.
- **Human + agent account model**: passkeys, scoped session keys, paymasters and explicit machine-action permissions.
- **Evidence-first decentralization**: public validator/node procedures, multi-client convergence, published fault tests and network-maturity telemetry.
- **Low-friction native economy**: payments, reputation and DeFi primitives that benefit from the account/agent model without contaminating consensus complexity.

## Non-negotiable evidence gates

A roadmap item is **not complete** because code exists. It is complete only when its exit evidence is reproducible.

| Capability | Minimum evidence before claiming it |
|---|---|
| Permissionless testnet | Unaffiliated operator joins from public docs with no manual allowlist |
| BFT | Documented fault threshold + automated partition/outage tests |
| Parallel execution | Deterministic state-root equivalence vs serial execution + conflict benchmarks |
| Decentralized | Multiple independent operators + no single privileged block producer/control path |
| Multi-client | Two independent implementations produce identical canonical results |
| Sub-second finality | Sustained p95/p99 measurements under geographic latency and load |
| Low fees | Congested-network fee distribution, not idle-network anecdote |
| MEV resistance | Adversarial transaction-ordering benchmarks and documented residual attacks |
| Censorship resistance | Forced-inclusion/inclusion-latency test under hostile proposer scenario |
| Interoperability | Explicit trust assumptions + failure-mode tests + audited verification path |
| AA/gasless | Recovery, replay, sponsorship-abuse and policy-bypass tests |
| Production security | Independent audits + bounty + incident/upgrade procedures |

## Objective performance scorecard

Do not use a permanent subjective “100/100”. Publish a versioned scorecard with measured dimensions:

- Safety / consensus correctness — 25%
- Decentralization / operator independence — 20%
- Client diversity / implementation resilience — 10%
- Execution performance / finality — 10%
- State growth / node accessibility — 10%
- Account UX / gas sponsorship — 10%
- Censorship / MEV resistance — 5%
- Developer experience — 5%
- Interoperability / light verification — 5%

Any critical safety failure caps the release at **NOT MAINNET READY**, regardless of aggregate score.

## Milestones

### ZORYQ M0 — current public centralized testnet

Allowed claims: public EVM-compatible testing environment, live RPC/explorer/faucet, agent-native developer tooling and testnet DeFi primitives.

Not allowed: decentralized, permissionless validator set, BFT-proven, multi-client, censorship-resistant or production-ready.

### ZORYQ M1 — reproducible network

Exit criteria:
- reproducible independent node;
- persistent sync/restart/recovery;
- versioned genesis/config fingerprint;
- consensus ADR/spec;
- automated deterministic state-transition tests;
- 3+ node devnet.

### ZORYQ M2 — permissionless fault-tested testnet

Exit criteria:
- public node/validator onboarding with no privileged allowlist;
- at least 5 independent operators across 3+ trust domains;
- partition/outage/recovery tests pass;
- redundant RPC;
- published latency/finality/fee/state-growth metrics.

### ZORYQ M3 — advanced execution + account UX

Exit criteria:
- deterministic parallel execution with equivalence testing;
- smart accounts/passkeys/session keys;
- bounded paymaster/gas sponsorship;
- MEV/censorship-defense prototype with adversarial tests;
- pruning/snapshot/light-client path.

### ZORYQ M4 — multi-client security candidate

Exit criteria:
- second independent node implementation;
- continuous differential testing;
- external protocol audit;
- critical contract/bridge audits where applicable;
- permanent bug bounty;
- upgrade governance and emergency-power sunset plan.

### ZORYQ M5 — mainnet candidate

Exit criteria:
- sustained testnet uptime across independent operators;
- no unresolved critical/high security findings;
- public incident drills;
- validator economics tested under realistic hardware/bandwidth costs;
- light-client/interoperability assumptions independently reviewed;
- mainnet launch decision based on evidence, not calendar date.

## Immediate execution order

1. Consensus/state-transition ADR and protocol spec.
2. Replace single-node testing architecture with reproducible peerable nodes.
3. Build deterministic 3-node harness and automated fault injection.
4. Add state-root convergence and replay tests.
5. Design parallel execution only on top of the deterministic state model.
6. Publish permissionless node bootstrap after private multi-node safety gates pass.
7. Add redundant RPC and network health telemetry.
8. Implement smart-account/paymaster prototype with bounded policies.
9. Begin second-client specification/differential harness before mainnet.
10. Formalize audit, bounty and governance gates.

## Product-layer sequencing

The current agent-native, DEX, lending, identity/reputation and SocialFi direction remains valuable, but the L1 progression takes priority. Product work should continue in parallel only when it does not create false decentralization/security claims or harden temporary centralized architecture into permanent protocol debt.

The long-term goal is not “the chain with the most features.” It is **the chain where security assumptions are explicit, decentralization is reproducible, execution is deterministic and fast, and humans plus AI agents can transact with less friction and better control than on legacy wallet flows.**
