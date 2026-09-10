# ZORYQ Adaptive Execution Mesh — Threat Model v0.1

Status: **research / pre-consensus**

Target: ZORYQ EVM Testnet, Chain ID `5919065`.

AEM is not currently authoritative for canonical execution. The threat model is intentionally written before canonical integration.

## Security objective

For the same pre-state and canonically ordered transaction list, AEM must never produce a consensus-observable result different from valid serial EVM execution. Performance optimizations may fail closed to serial execution; they may not fail open to divergent state.

## Protected invariants

- final state root equals canonical serial execution;
- receipt status/logs/gas-visible semantics remain equivalent;
- same-sender nonce ordering is preserved;
- speculative writes cannot become canonical before validation;
- local CPU/RAM/thread timing cannot change consensus results;
- proof/witness availability cannot be confused with consensus finality;
- malformed dependency hints cannot bypass canonical validation;
- failure of the adaptive layer cannot corrupt the Reth database.

## Adversaries

### A1 — Malicious transaction author

Attempts to craft transactions whose apparent dependency profile differs from actual state access.

Examples: branch-dependent storage, dynamic mappings, calldata-derived slots, proxy/delegatecall indirection, CREATE/CREATE2 interactions, reentrancy and state-dependent external calls.

**Required defense:** prediction is advisory. Actual execution read/write versions are validated before canonical commit. Unknown/dynamic cases default to speculative or serial-safe lanes.

### A2 — Conflict-bomb attacker

Submits workloads designed to maximize speculative invalidation and re-execution while paying minimal gas.

**Required defense:** speculation budget, deterministic contention thresholds, bounded retries and rapid degradation to serial-safe execution. Resource asymmetry must be benchmarked.

### A3 — Scheduler manipulation / MEV actor

Attempts to influence lane selection or local scheduling to change economically relevant ordering.

**Required defense:** canonical transaction order remains external to AEM v0.x. Lane selection may optimize work but cannot silently reorder canonical commits. Any future MEV policy must be separately specified and threat-modeled.

### A4 — Nondeterminism attacker

Exploits machine-local differences in cores, timing, memory pressure, network arrival order or AI predictions to create validator divergence.

**Required defense:** consensus-visible classification inputs must be deterministic and protocol-versioned. Machine-local signals may tune speculative concurrency only when canonical results remain unchanged.

### A5 — Access-list liar

Supplies incomplete or misleading EIP-2930 access information.

**Required defense:** access lists are hints unless the EVM semantics themselves enforce their meaning. Missing accesses discovered during execution invalidate speculation; they do not authorize an incorrect commit.

### A6 — Proxy/upgrade ambiguity

A contract changes implementation or uses delegatecall so a previously learned state profile becomes unsafe.

**Required defense:** dependency profiles bind to code hash / implementation context and expire or invalidate on code/profile changes. Unrecognized proxy paths are not fast-path eligible.

### A7 — Same-sender nonce race

Concurrent transactions from one account are scheduled in a way that violates nonce semantics.

**Required defense:** deterministic dependency edge between same-sender nonce chains; never classify conflicting nonce sequences as independent fast path.

### A8 — Revert-semantic divergence

Speculation changes which transaction reverts, emitted logs, gas behavior or visible return values.

**Required defense:** receipt/revert parity is part of serial-equivalence testing. Expected reverts are evidence to compare, not harness failures.

### A9 — State/storage pressure

Attackers maximize read/write amplification or state growth so the scheduler accelerates CPU work into a storage bottleneck.

**Required defense:** measure database reads/writes, state growth and IOPS; cap speculative overlays; include state-explosion workloads and resource-price analysis before canonical activation.

### A10 — Proof-path resource exhaustion

Transactions intentionally force expensive proof/witness generation.

**Required defense:** proof generation remains asynchronous and non-consensus-critical in early phases; separate quotas/fees/budgets apply. Failure to generate an optional proof cannot invalidate an otherwise canonical transaction unless a future protocol explicitly defines that requirement.

### A11 — Shadow-to-canonical contamination

A bug causes research/shadow output to affect production transaction ordering, state or health.

**Required defense:** shadow engine is a read-only observer with no wallet, no private key, no transaction-submission capability and no write path to Reth. Its failure is non-fatal to chain execution.

### A12 — Evidence forgery / misleading dashboard

Telemetry is presented as if it were live consensus evidence when it is merely predicted metadata.

**Required defense:** every record carries `evidenceClass`, `canonical=false`, classifier version, source block hash and explicit limitations. Dashboard labels must distinguish prediction from measured read/write instrumentation.

## Mandatory adversarial workloads

1. hidden writes behind delegatecall/proxy chains;
2. calldata/state-derived storage keys;
3. branch-dependent access sets;
4. reentrancy-sensitive interactions;
5. deliberate conflict storms at 0/10/30/50/80/100% contention;
6. high revert ratios;
7. gas-heavy failed speculation;
8. same-sender nonce chains;
9. CREATE/CREATE2 address interactions;
10. upgrades invalidating learned code profiles;
11. misleading access lists;
12. hot AMM pool mixed with independent transfers/social actions;
13. state explosion and storage amplification;
14. process crash during shadow computation;
15. different CPU/thread configurations producing the same deterministic classification digest.

## Release blockers

Canonical AEM activation is prohibited while any of these remain true:

- unexplained serial-equivalence mismatch;
- undetected dependency false-negative reaching commit;
- State Recovery regression;
- Public EVM Smoke or Production Smoke regression attributable to the protocol release;
- no reproducible multi-node evidence;
- scheduler can change canonical order without an approved ordering specification;
- benchmark omits adverse contention or hardware disclosure;
- shadow engine can mutate canonical state;
- rollback strategy is absent.

## Red Team decision rule

A proposed optimization survives only if it answers all four questions:

1. How can an adversary make it wrong?
2. How can an adversary make it slower than serial?
3. How can an adversary make it consume disproportionate validator resources?
4. How do honest nodes detect the attack before canonical state diverges?

If question 4 has no defensible answer, the feature does not advance.