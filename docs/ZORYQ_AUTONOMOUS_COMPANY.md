# ZORYQ Autonomous Company

> Give ZORYQ a goal and a budget. It creates an autonomous company of agents that works, hires, pays, earns and accounts onchain.

## Product thesis

ZORYQ Autonomous should be a first-class experience visible from the chain's main developer/user surface, not a hidden research demo. A user supplies a goal, budget, duration and autonomy policy. ZORYQ then creates a bounded autonomous organization composed of agents and services that can plan work, accept or create tasks, hire specialized agents, execute authorized actions, make and receive testnet payments, and produce verifiable evidence of what happened.

This is an experimental testnet product thesis. It must never imply production autonomy, audited financial safety, decentralization, guaranteed profitability or real-world legal company status until separately proven.

## Core user experience

### Create

Inputs:
- Goal
- Budget
- Duration
- Autonomy mode: Supervised / Balanced / Autonomous
- Allowed assets and maximum spend
- Optional constraints: approved services, blocked targets, rate limits, geographic/time constraints

Primary action:

`CREATE AUTONOMOUS COMPANY`

### Live company view

The company screen should expose a live, inspectable state:

- Company ID and status
- Goal and measurable success criteria
- Goal progress
- Treasury: initial budget / remaining budget / committed budget
- Revenue received
- Active agents
- Contractors/services
- Open / active / completed / failed tasks
- Verified actions
- Payments sent / received
- Current permissions
- Risk alerts
- Proof Pack / audit trail

A live organization graph should show the orchestrator and every agent/service it has hired or delegated to. Selecting any node must reveal identity, role, permissions, budget, tasks, payments, receipts, reputation and evidence.

## Canonical lifecycle

`Goal -> Plan -> Company -> Agents -> Tasks -> Hire -> Simulate -> Authorize -> Execute -> Pay/Receive -> Verify -> Reputation -> Proof Pack -> Goal Progress`

Every state-changing step must be evidence-backed and inspectable.

## Protocol primitives

### 1. Company Identity

Each autonomous company has:
- stable company ID;
- controller/root authority;
- creator account;
- objective hash;
- policy/version reference;
- treasury reference;
- creation block/time;
- lifecycle status.

### 2. Agent Identity

Each agent has:
- stable agent ID;
- controller or parent company;
- declared role/capabilities;
- service endpoint metadata when applicable;
- reputation/evidence references;
- active/revoked status.

### 3. Goal & Plan Envelope

The initial goal is immutable or versioned. Plans may evolve, but each revision must record:
- parent plan;
- reason for revision;
- affected tasks/budget;
- authorization requirement;
- timestamp/block/evidence reference.

### 4. Scoped Authorization

No agent receives unlimited authority by default. Permissions must constrain:
- target;
- method/capability;
- asset/value;
- per-action spend;
- cumulative budget;
- rate;
- time window;
- nonce/replay domain;
- chain/account/session;
- revocation.

### 5. Task Market / Internal Hiring

A company can create work items containing:
- task ID;
- requested capability;
- acceptance criteria;
- maximum compensation;
- deadline;
- evidence requirements;
- allowed execution scope.

Agents/services may be selected through deterministic policy or an explicit marketplace/discovery layer. Hiring must create an inspectable contract/task relationship.

### 6. Simulation & Intent

Before critical state-changing actions, record:
- intent envelope;
- expected target/method/value;
- simulation result when available;
- risk flags;
- estimated cost;
- required authority.

Simulation is never authorization.

### 7. Execution Receipt

Successful work cannot be asserted from agent text alone. Record verifiable execution evidence:
- transaction hash where applicable;
- chain ID;
- block number/hash;
- receipt status;
- calls/effects summary;
- linked task/permission/intent;
- evidence URI/hash.

Failed/reverted execution must never be shown as successful.

### 8. Payments & Revenue

A company may send or receive experimental testnet payments. Each payment should bind:
- payer;
- payee;
- task/service/invoice ID;
- asset;
- amount;
- authorization;
- transaction hash;
- receipt status.

Testnet ZQ has no implied monetary value.

### 9. Reputation

Reputation is evidence-weighted, not self-asserted. Inputs may include:
- completed tasks;
- failed/reverted tasks;
- timeliness;
- budget adherence;
- independent counterparties;
- dispute outcomes;
- verifiable receipts.

Self-interaction and circular farming must not materially increase reputation.

### 10. Proof Pack / Accounting

Every company can produce a portable machine-readable Proof Pack containing:
- original goal and revisions;
- company/agent identities;
- plans/tasks;
- permissions;
- hires;
- actions;
- transactions;
- payments/revenue;
- failures;
- current treasury;
- evidence hashes;
- goal-progress computation.

The human-readable UI should render the same facts.

## Autonomy modes

### Supervised
Human approval required for every state-changing action or spend.

### Balanced
Pre-authorized low-risk actions execute inside strict caps. Higher-risk actions require approval.

### Autonomous
Agents may execute inside a bounded policy envelope without per-action approval. Root authority retains revocation and emergency stop.

`Autonomous` never means unlimited authority.

## Security invariants

- Root authority remains revocable by the user/controller.
- No seed phrase/private key is collected by ZORYQ services.
- Every delegated permission is bounded, inspectable and revocable.
- Replay protection across chain/account/session/action.
- Spending caps and rate limits are mandatory.
- Simulation cannot substitute for authorization.
- Receipt status must be verified before success is recorded.
- Agent/service metadata is untrusted input.
- Failed tasks must update accounting/reputation correctly.
- Treasury accounting must reconcile with onchain evidence.
- Emergency stop must prevent new delegated executions.

## MVP vertical slice

The first undeniable demo should be deliberately narrow:

1. User creates a company with one concrete goal and testnet budget.
2. Orchestrator decomposes it into 2-5 tasks.
3. Company selects or creates at least two specialized agents/services.
4. One task requires an internal hire/contract.
5. One state-changing action is simulated and authorized.
6. At least one successful testnet payment occurs.
7. At least one payment/revenue receipt is verified.
8. Goal progress updates from evidence, not agent claims.
9. UI shows live org graph + treasury + tasks + transactions.
10. User exports a Proof Pack and independently verifies the transaction(s).

## Evidence gates before capability claims

Do not claim that ZORYQ Autonomous can truly work/hire/pay/earn/account until the corresponding capability has a reproducible testnet path with public evidence.

Minimum gates:
- [ ] fresh user can create a company;
- [ ] company state can be independently read;
- [ ] agents have verifiable identities and bounded permissions;
- [ ] task creation and assignment are recorded;
- [ ] delegated execution enforces scope/replay/budget limits;
- [ ] payment receipt is verified before success;
- [ ] incoming payment/revenue can be linked to a company/task/service;
- [ ] treasury accounting reconciles against RPC/onchain state;
- [ ] failed/reverted actions are represented correctly;
- [ ] permission revocation blocks subsequent execution;
- [ ] emergency stop works;
- [ ] exported Proof Pack is reproducible and machine-readable;
- [ ] at least one independent external reproduction exists.

## Developer surface

Expose a clear Autonomous entrypoint from the ZORYQ developer/product surface with:
- Create Company
- Company Explorer
- Agent Explorer
- Task/Service Marketplace
- Treasury & Accounting
- Permissions
- Proof Pack
- SDK / API
- Example app
- Security model
- Experimental testnet notice

## SDK target

A TypeScript SDK should eventually support a compact flow such as:

```ts
const company = await zoryq.autonomous.createCompany({
  goal,
  budget,
  duration,
  autonomy: "balanced",
  policy
});

await company.plan();
await company.hire(serviceId, scope);
await company.execute(taskId);
const proof = await company.proofPack();
```

The SDK must never hide authorization, signer or evidence boundaries.

## WOW moment

The product should make a complex autonomous-agent architecture understandable in seconds:

**A user gives ZORYQ a mission and a bounded budget. The interface visibly creates an organization, shows its agents working and hiring, and lets anyone inspect exactly what was authorized, executed, paid, received and proven onchain.**

That is the experience target. Implementation and public claims remain evidence-gated.