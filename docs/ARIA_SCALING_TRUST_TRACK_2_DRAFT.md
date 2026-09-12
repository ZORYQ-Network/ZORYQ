# ARIA Scaling Trust — Track 2.2 Proposal Draft

## Working title

**Policy-Bound Agent Contracting and Verifiable Execution Reporting for Multi-Agent Systems**

## Track

**Track 2.2 — Components**

The proposal is intentionally framed as an open-source reusable component rather than as funding for a blockchain product or generic adoption effort.

## Section 0 — Summary

AI agents that interact with other agents need more than a natural-language instruction. They need a machine-checkable representation of what their user permits, a way to negotiate/contract without silently weakening those permissions, and a convincing report of what actually happened after execution.

We propose an open-source component suite that turns fuzzy user constraints into a bounded policy envelope, binds inter-agent agreements to that envelope, records a structured execution trace, and produces a succinct verifiable report that can be independently checked.

The project would focus on three reusable primitives:

1. **Policy Envelope** — a canonical machine-readable representation of allowed targets/capabilities, value/budget, rate, time, counterparty constraints and revocation.
2. **Contracting Guard** — validates proposed agent-to-agent agreements against the policy envelope and rejects negotiations that exceed authority or violate immutable constraints.
3. **Execution Proof Reporter** — converts a structured execution trace into a compact evidence bundle containing agreement hash, policy reference, action/receipt references, violations/failures and verifier outputs.

The initial implementation would be model-agnostic and transport-agnostic. It would not require agents to use a blockchain. Where economic actions occur on an EVM-compatible system, public transaction receipts can be included as one evidence source. The verifier should also work with signed non-chain events and simulated Arena traces.

The core research question is whether a small, explicit policy-and-evidence layer can reduce the risk that agents negotiate away user intent while still preserving useful autonomy and interoperability.

The project will deliver open-source schemas, a reference TypeScript implementation, adversarial tests, benchmark tasks, a deterministic verifier, integrations/adapters for Arena-style traces, and empirical evaluation across benign and adversarial multi-agent negotiations.

## 1. Programme & Technical

### 1.1 Problem

Multi-agent systems create a new security boundary: an agent can be manipulated by another agent into accepting an agreement that is locally plausible but inconsistent with the user's actual security policy.

Natural-language instructions are insufficient as the final authority layer because they are ambiguous, difficult to verify and easy to reinterpret during extended negotiation.

Even when an interaction completes, users need a concise way to determine whether the agent respected policy without replaying every model message manually.

### 1.2 Proposed architecture

#### A. Policy Envelope

Input:
- user goals and non-negotiable constraints;
- optional policy elicitation output;
- resource/budget limits;
- permitted counterparties/capabilities;
- expiry and revocation state.

Output:
- versioned canonical policy document;
- deterministic hash/identifier;
- explicit hard constraints and negotiable preferences;
- machine-checkable predicates.

Illustrative fields:
- allowed capabilities/targets;
- prohibited capabilities/targets;
- per-action and cumulative budgets;
- rate limits;
- time window;
- required evidence;
- counterparty restrictions;
- data-disclosure constraints;
- replay domain/nonce;
- revocation state.

#### B. Contracting Guard

Input:
- local Policy Envelope;
- proposed agreement/contract from another agent;
- negotiation context.

Output:
- ACCEPT / REJECT / ESCALATE;
- violated predicates if rejected;
- unresolved ambiguity if escalated;
- canonical agreement representation if accepted.

The guard must never let a lower-trust negotiation message redefine immutable policy constraints.

#### C. Execution Trace Schema

Records:
- policy and agreement references;
- participating agent/service identities;
- actions/calls;
- resource transfers;
- external receipts where available;
- human interventions;
- failures/reverts;
- timestamps and integrity references.

#### D. Verifiable Execution Reporter

Input:
- policy;
- accepted agreement;
- execution trace.

Output:
- compact structured report;
- policy compliance result;
- violations/uncertainties;
- trace/evidence hashes;
- verifier version;
- optional human-readable summary generated from the structured result, never the reverse.

### 1.3 Threat model

The project will explicitly test:
- prompt injection/persuasion from counterparties;
- negotiation that gradually weakens policy;
- ambiguous contract clauses;
- hidden value/budget escalation;
- replay of previously valid agreements/actions;
- forged receipts/evidence;
- missing or reordered trace events;
- compromised/untrusted counterparty metadata;
- agent collusion to create circular/self-serving evidence;
- policy version confusion;
- revocation races;
- attempts to make a failed/reverted action appear successful.

### 1.4 Differentiation

The proposal is not a generic agent framework and not an observability dashboard.

The technical wedge is a portable boundary between:
- fuzzy user intent;
- formal/bounded authority;
- negotiated agreement;
- execution trace;
- verifiable compliance report.

The goal is to make this reusable across different models, agent frameworks and settlement systems.

Before submission, add a structured comparison against current policy engines, agent guardrail systems, smart-account/session-key permission systems, agent observability tools and emerging multi-agent negotiation protocols.

### 1.5 Open-source deliverables

1. `policy-envelope` JSON Schema + canonical hashing rules;
2. `agent-contract` schema + validation rules;
3. `execution-trace` schema;
4. deterministic verifier library;
5. TypeScript reference implementation;
6. adapter for Arena-style challenge traces;
7. adversarial benchmark set;
8. reference basic agent using the component;
9. red-team harness;
10. reproducibility/evaluation report.

### 1.6 Metrics

Primary metrics:
- policy violation rate under adversarial negotiation;
- false accept / false reject rates;
- percentage of attacks correctly rejected or escalated;
- replay-detection rate;
- forged-evidence detection rate;
- verification latency/cost;
- utility achieved while remaining policy-compliant;
- generalisation across agent/model/framework combinations.

Secondary metrics:
- developer integration time;
- trace/report size;
- human reviewer time to validate an interaction;
- inter-verifier determinism.

### 1.7 Proposed stage gates

#### Gate 1 — formal data model

- schemas versioned;
- canonicalisation/hashing deterministic;
- hard vs negotiable policy semantics documented;
- baseline tests green.

#### Gate 2 — contracting guard

- deterministic constraint validation;
- negative tests for authority escalation;
- negotiation transcript corpus created;
- baseline attacker suite.

#### Gate 3 — evidence reporter

- trace verifier complete;
- forged/missing/reordered evidence tests;
- independent verification tool.

#### Gate 4 — Arena-style evaluation

- at least 3 distinct agent configurations;
- benign + adversarial tasks;
- utility/security results published;
- failure taxonomy documented.

#### Gate 5 — external reproduction

- clean third-party reproduction from public repository;
- independently rerun benchmark subset;
- reproducibility issues resolved or documented.

### 1.8 Project plan

Illustrative 9-month plan:

- Months 1–2: policy/contract/trace specifications, threat model, baseline corpus;
- Months 3–4: contracting guard, reference verifier, adversarial tests;
- Months 5–6: Arena adapter, multi-agent benchmark harness, red-team iterations;
- Months 7–8: performance/generalisation experiments, developer integrations;
- Month 9: independent reproduction, documentation, final evaluation and adoption-ready package.

A shorter 6-month scope is possible by narrowing the number of benchmark environments.

### 1.9 Technical risks / unknowns

- policy expressiveness may trade off against determinism/usability;
- natural-language-to-policy elicitation may remain probabilistic;
- contracts may include semantics not captured by the initial predicate model;
- attackers may exploit model behaviour outside the formal contract surface;
- evidence integrity does not itself prove semantic correctness of an external action;
- cross-framework identity and trace normalisation may be difficult;
- blockchain receipts are useful for economic execution evidence but are not sufficient to prove offchain task quality;
- strong formal guarantees may require narrower semantics than product-oriented agents prefer.

The proposal treats these as research questions rather than hiding them.

## 2. The Team

### Required fields before submission

- Project lead: `[TO FILL]`
- Legal name: `[TO FILL]`
- Location: `[TO FILL]`
- Relevant technical background: `[TO FILL]`
- Time commitment: `[TO FILL — ARIA usually prefers key leads >=50%, ideally ~80%]`
- Additional engineer/researcher(s): `[TO FILL]`
- Security/formal methods collaborator: `[TO FILL OR RECRUIT]`
- UK collaborator/operation plan: `[TO FILL]`

### Current demonstrated project capability

ZORYQ already has public work around:
- evidence-first engineering;
- machine-readable proof concepts;
- bounded agent-authority product specifications;
- public EVM testnet receipts;
- external reproduction tooling;
- adversarial/recovery/security claim gates.

This does not substitute for the specialised multi-agent security expertise required by this proposal. That gap should be addressed explicitly through hiring/collaboration.

## 3. Administrative Response

### Funding request

Track 2 permits projects in the £200k–£2m range. A realistic request must be derived from the actual team and scope rather than chosen for optics.

Illustrative 9-month budget target: `[£350k–£650k — TO VALIDATE]` covering:
- engineering;
- security/formal methods research;
- model/compute/evaluation costs;
- UK collaboration/operations;
- external review;
- project management and dissemination.

ARIA states it can fund 100% of project costs; final eligible-cost treatment must follow ARIA guidance.

### Background IP

Existing ZORYQ specifications/code may constitute background IP. Before submission, identify:
- exact repositories/components relied on;
- ownership rights;
- proposed open-source licence for funded outputs;
- separation between background ZORYQ platform IP and the open-source Track 2 component outputs.

### Commercial hypothesis

Open-source core components can support later commercial activity through:
- managed verification/evidence infrastructure;
- enterprise policy and integration tooling;
- hosted benchmarking/security evaluation;
- support/SLA services;
- adoption in agent-commerce products.

The ARIA-funded core should remain reusable and genuinely open according to the programme terms.

### Benefit to the UK

Because ZORYQ's founder is not currently established as UK-based in the public project record, this is a major application gate.

A credible proposal should include concrete UK commitments rather than generic statements. Options to evaluate:
- establish a UK project operation/entity if commercially and legally justified;
- recruit a UK-based security/formal-methods researcher;
- collaborate with a UK university/lab/company;
- spend a material portion of project costs in the UK;
- run UK-based evaluation workshops or integrations;
- contribute directly to the ARIA Arena/community and UK open-source ecosystem.

Do not promise >50% UK spend unless the founder is genuinely prepared and able to execute that plan.

## Why this matches Scaling Trust

The programme explicitly identifies:
- requirement capture from fuzzy goals to security policy;
- negotiation from individual policy to collective policy;
- contracting languages for agreements, verification, dispute resolution and logging;
- negotiation safety against persuasion/jailbreaking;
- reporting from execution traces to convincing statements.

This proposal targets the boundary between those components: policy-bound contracting and verifiable execution reporting.

## Submission blockers

Do not submit until these are completed:

- founder/team bios and real time commitments;
- UK benefit plan;
- open-source/IP plan;
- detailed technical comparison/related work;
- realistic budget spreadsheet;
- project timeline and staffing plan;
- at least one security/formal-methods collaborator or a credible hire plan;
- commercial hypothesis in ARIA's required format;
- proposal formatted to ARIA's PDF requirements (max 10 pages, Arial >=11pt, >=0.5-inch margins).
