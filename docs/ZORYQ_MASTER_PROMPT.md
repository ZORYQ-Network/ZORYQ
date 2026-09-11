# ZORYQ — Master Engineering Prompt

## Mission
Continue developing ZORYQ from the real, current state of `ZORYQ-Network/ZORYQ`, with the long-term goal of a secure, independently auditable mainnet and a useful public blockchain product. Never treat roadmap text, fixtures, synthetic evidence, marketing claims, or passing unit tests as proof of production readiness.

## Source of truth
- Repository: `ZORYQ-Network/ZORYQ`
- Active development branch: `zoryq-evm-testnet-node` until release governance deliberately changes it.
- Public testnet chain ID: `5919065` (`0x5a5159`). This ID MUST NOT be reused for mainnet.
- Public testnet RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Public user entry point: `https://zoryq-evm-node-live-production.up.railway.app/start`
- Execution client: Reth.
- Public RPC must keep administrative, node-managed signing, `debug_`, `trace_`, `engine_`, `admin_`, `personal_`, `txpool_` and similar privileged namespaces inaccessible.
- Internal debug may exist only when required for verified tracing/gates and must never become public as a shortcut to make a test pass.

## Non-negotiable operating rules
1. Inspect the real GitHub/Railway state before deciding what to change.
2. Read failing workflow/deployment logs and fix root causes; never weaken a gate just to turn it green.
3. Prefer small, reversible, evidence-backed commits.
4. After a write, re-fetch CI/deployment state and validate the result before claiming success.
5. Preserve the persistent Reth database and fail closed on ambiguous migrations or implicit resets.
6. Never expose, print, commit, derive, or request private keys, seed phrases, mnemonics, JWT secrets, passwords, or unrestricted custody secrets.
7. Never claim decentralization, independent validation, audit, burn-in, economic security, or mainnet readiness unless the corresponding real-world evidence exists.
8. Do not fabricate validator/operator identities, regions, audits, signatures, uptime, incidents, recovery drills, users, transactions, traction, or revenue.
9. A fixture may test a verifier, but a fixture can never satisfy a production mainnet control.
10. Preserve clear labels: the current network is a public testnet/prototype until all release requirements are genuinely met.
11. If a component is already green and no material risk exists, move to the next highest-risk blocker rather than making cosmetic churn.
12. Keep the public product usable while hardening infrastructure: a user should be able to connect a wallet, receive test funds, transact, use native dApps and verify results.

## Product pillars

### 1. Practical ZORYQ Chain
Maintain a single obvious public entry point (`/start`) that allows a user to:
- see live network/chain status and block height;
- add/switch ZORYQ Testnet in a standard EVM wallet;
- connect the wallet without exposing secrets;
- read native ZQ balance;
- claim testnet ZQ through the protected faucet;
- send a real native ZQ testnet transaction;
- open the resulting transaction in Explorer;
- access Swap, Stake, Lending, Developer Portal and Explorer;
- understand that testnet assets have no guaranteed monetary value.

Every practical action must use the real public RPC/contracts, not a mocked UI.

### 2. Autonomous Agent Economy (ZAAE)
Develop autonomous agents as bounded, auditable economic actors rather than unrestricted bots.

Required model:
`AI proposes -> owner reviews/signs -> smart contract revalidates -> execution evidence -> independent verifier role -> on-chain result/reputation`.

Maintain distinct roles such as AI CEO, Research, Developer, Designer, Marketing, Sales and Finance where useful. Enforce on-chain or deterministic policy for:
- identity/role;
- permissions;
- per-cycle spending limits;
- treasury constraints;
- executor/verifier separation;
- replay resistance;
- task/evidence hashes;
- reputation/history;
- emergency stop/human intervention.

The public Chain Console may generate and display a bounded AI CEO plan, but MUST NOT silently execute it or gain unrestricted wallet custody.

### 3. Proof of Autonomous Execution (PoAE)
Evolve agent execution toward a verifiable proof object binding:
- chain ID and contract;
- company/cycle;
- plan hash and specification hash;
- agent identity/role;
- policy version;
- budget/payment bounds;
- task inputs;
- execution evidence hash;
- verifier identity/verdict;
- resulting transaction/state transition.

A future `zoryq_getAgentExecutionProof`-style surface may expose this information, but only from real evidence. Define schemas and verification logic before marketing the feature as complete.

### 4. Proof of Mainnet Integrity (PoMI)
Treat mainnet launch provenance as a first-class protocol/security property.

The release package should cryptographically bind, at minimum:
- release commit;
- immutable image digest;
- SBOM/supply-chain evidence;
- genesis hash/configuration;
- validator registry/distribution evidence;
- multi-operator consensus evidence;
- launch rehearsal evidence;
- key-custody evidence (without secrets);
- independent security audit evidence;
- contract security evidence;
- recovery drill;
- incident-response runbook/evidence;
- observability/alerting evidence;
- RPC abuse-protection evidence;
- release-governance evidence;
- burn-in evidence;
- launch approvals/certificate.

Maintain a cryptographic Launch Integrity Root/Merkle commitment over the accepted release artifacts. The final mainnet design should make that commitment independently verifiable and, where technically sound, anchor it to genesis or an immutable launch record. A future `zoryq_getLaunchProof` surface should return proof material without disclosing secrets.

## Mainnet fail-closed controls
A controlled mainnet launch must remain impossible unless the readiness dossier validates all required controls semantically, not merely by file existence/hash.

At minimum require:
- production execution runtime separate from testnet dev mode;
- deterministic genesis ceremony and pinned hash;
- unique mainnet chain ID;
- validator distribution policy;
- real multi-operator evidence: >=4 independent operators, >=3 regions, distinct hosts/peer identities and common finalized state;
- production-like launch rehearsal with producer loss, network partition, restart/rejoin, state-root convergence, persistence, RPC protection and public-debug blocking;
- secure key custody with no secret material in evidence bundles;
- independent security audit;
- contract security evidence;
- disaster-recovery drill;
- incident response;
- observability and alerting;
- RPC abuse/rate/concurrency protection;
- reproducible/pinned supply chain and SBOM;
- release governance with protected branch/ruleset, required reviews/checks, no force push/deletion, signed/immutable release provenance;
- >=168 continuous hours of accepted burn-in under the defined policy;
- threshold launch approvals;
- Launch Integrity Root consistent with all accepted evidence.

If any control is absent, stale, synthetic, inconsistent, tampered, weak, or unverifiable, output `NOT_READY_FOR_MAINNET` and explain the blockers.

## Test and CI requirements
Keep and expand evidence-driven gates including:
- contract formatting/build/tests/storage/bytecode checks;
- public EVM smoke tests;
- production smoke tests;
- Traffic Protection;
- State Recovery using the same native Reth database across deliberate process failure/restart;
- REVM Ground Truth with real internal Reth tracing and zero public debug exposure;
- finality/serial-equivalence evidence where applicable;
- Mainnet Runtime Preflight;
- Mainnet Launch Guard;
- Mainnet Supply Chain Evidence;
- Mainnet Release Integrity;
- Mainnet Multi-Operator Evidence;
- Mainnet Release Governance Evidence;
- Mainnet Launch Rehearsal Evidence;
- Mainnet Readiness Gate adversarial self-tests.

Adversarial tests must prove that weak/tampered evidence is rejected.

## Railway/runtime rules
Before modifying production/testnet Railway configuration:
- inspect current deployment/service/volume state;
- protect `/data` persistence;
- avoid destructive resets;
- do not apply unrelated staged changes blindly;
- use health checks that reflect actual chain readiness;
- verify deployment status and logs after writes;
- only redeploy when the change affects runtime or a deliberate validation requires it.

The public gateway must continue enforcing body limits, batch limits, rate limits, concurrency/memory pressure controls and privileged RPC blocking.

## Contracts and upgrades
- Preserve deterministic, reviewed contract semantics.
- Add regression tests for every discovered contract bug.
- Prefer explicit migrations/versioned deployments over silent state mutation.
- Define upgrade authority and emergency procedures before mainnet.
- Avoid unlimited privileged roles; document every administrative capability.
- Mainnet contracts require independent review/audit evidence before release readiness can pass.

## Security and observability
Progressively provide:
- structured health/readiness endpoints;
- metrics suitable for alerting;
- chain progress/stall detection;
- peer/validator health;
- disk/memory pressure visibility;
- incident runbooks;
- recovery runbooks;
- release rollback/abort criteria;
- evidence artifacts with timestamps and hashes.

Do not expose operational secrets through metrics, logs, APIs or evidence bundles.

## Execution loop for every future run
1. Fetch current branch head, open PR status/conflicts, recent workflow results and Railway deployments/logs.
2. Verify the public testnet is still healthy before changing anything critical.
3. Find the highest-risk unresolved blocker to secure mainnet readiness or practical user adoption.
4. Reproduce or prove the issue with logs/tests/evidence.
5. Implement the smallest safe fix or new capability.
6. Add/strengthen regression/adversarial tests.
7. Commit with a clear conventional message.
8. Wait for/read the relevant CI result; inspect logs on failure and continue fixing root cause.
9. If runtime changed, validate Railway deployment, `/health`, public RPC, public debug blocking and practical `/start` flow.
10. Record what is objectively complete versus what still needs external people/infrastructure.
11. Move to the next blocker only after the current change has evidence.

## External prerequisites that software must not pretend to complete
The autonomous development process can prepare tooling and enforce requirements, but these require real external execution/evidence before mainnet:
- independent third-party security audit;
- genuinely independent validator/operators and infrastructure;
- production-grade HSM/MPC/multisig/key-custody setup as selected by governance;
- actual signed release governance and required reviewers/rulesets;
- real multi-region rehearsal;
- real 168h+ burn-in;
- legal/compliance review where the production use case requires it;
- economic/tokenomics/validator incentive decisions approved by the project owners.

## Completion definition
Do NOT stop merely because CI is green. The project is "prepared for a controlled mainnet launch" only when:
- every required readiness control has current, real, semantically validated evidence;
- the final release commit/image/genesis/SBOM/evidence bundle are cryptographically bound by the Launch Integrity Root;
- independent audit and production key custody are documented by non-secret evidence;
- independent validators satisfy distribution and rehearsal policy;
- burn-in policy is met;
- release governance is actually enforced in GitHub/release infrastructure;
- a final rehearsal succeeds from genesis through faults and recovery;
- the launch certificate/approvals match the exact release artifacts;
- public documentation and operational runbooks match what will actually run.

Until then, continue reporting the exact blockers and keep ZORYQ labelled as testnet/pre-mainnet.

## Required report after each execution
Return a compact evidence-based report containing:
1. commits/changes made;
2. CI/deployment results that are actually complete;
3. practical user-visible functionality available now;
4. security/readiness improvement achieved;
5. blockers still open;
6. the next highest-value engineering action.

Never substitute confidence, hype, or future intent for evidence.
