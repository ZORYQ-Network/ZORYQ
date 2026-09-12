# Digital Science Catalyst Grant 2026 — Draft Proposal

## Working title

**Trustworthy Research Agents with Verifiable Action Trails and Portable Proof Packs**

## Important scope note

This proposal is a focused research-workflow application of ZORYQ's broader Agent Commerce & Trust Layer. It should be submitted only if ZORYQ is willing to build and test the research-specific workflow described here. Do not imply that this research product already exists.

## 1. THE PROBLEM

Research institutions are beginning to use multi-step AI agents for evidence synthesis, literature workflows, review support and funding decisions. The challenge is not only whether an agent can produce an answer; it is whether a researcher, institution or funder can reliably reconstruct what the agent did, what sources and tools it used, what actions were authorized, where a human intervened, and which outputs can be trusted.

Today, audit information is usually fragmented across application logs, model traces and vendor systems. This makes institutional governance difficult when a workflow crosses multiple tools or agents.

The target user is a research team or institution using multi-step AI workflows where provenance, human override and accountability matter.

## 2. YOUR WORKFLOW

We propose a narrow prototype for a **Research Agent Proof Pack**.

Example workflow: evidence synthesis for a research decision.

1. A researcher creates a task with a question, allowed data sources and policy constraints.
2. An orchestrator decomposes the task into retrieval, source-checking, synthesis and review steps.
3. Each agent/service receives bounded permissions rather than blanket authority.
4. Source retrieval and tool use are recorded as structured evidence events.
5. The agent produces a draft synthesis with explicit provenance links.
6. A human reviewer can approve, reject, annotate or override critical steps.
7. The system exports a portable Proof Pack containing task definition, source references, agent/tool identities, permissions, actions, human interventions, outputs and integrity hashes.
8. A verifier can inspect the package independently of the agent's own narrative.

The initial prototype would not attempt to put all research data onchain. Instead, blockchain-compatible hashes/receipts would be used selectively as an independent integrity anchor for evidence bundles and authorization-relevant events.

## 3. TRUST, AUDIT AND GOVERNANCE

The core design principle is that the user must be able to inspect **what happened**, not merely trust a final answer.

Trust controls:
- explicit agent/service identity;
- bounded permissions;
- source provenance references;
- step-level evidence events;
- human approval/override points;
- cryptographic hashing of evidence bundles;
- immutable or append-only version lineage for task revisions;
- clear failure/uncertainty states;
- portable Proof Pack export.

If an agent is uncertain, violates policy, loses source provenance or encounters an unsupported action, the workflow should flag/escalate rather than silently continue.

Accountability remains with the human/institution configuring and approving the workflow; the system is designed to make that responsibility inspectable rather than obscure it.

## 4. TEAM

- Founder: `[TO FILL]`
- Background: `[TO FILL]`
- Technical contributors/advisors: `[TO FILL]`

Relevant project work already exists in ZORYQ around evidence-first engineering, agent authorization concepts, public testnet receipts and portable proof design. The research-specific workflow would be a new focused implementation.

## 5. WHERE YOU ARE TODAY

Current stage: early prototype / experimental infrastructure.

Existing public evidence:
- experimental EVM-compatible ZORYQ Testnet;
- Chain ID `5919065`;
- public RPC/faucet;
- independent developer first-transaction reproduction completed on 2026-09-12;
- public evidence/claim-gating methodology;
- Autonomous Company / Agent Commerce specifications and Proof Pack design direction.

What does not yet exist:
- a production research workflow integration;
- institutional users;
- research-specific customer validation;
- audited production security.

The grant would fund the research-focused prototype and validation rather than polishing a generic blockchain demo.

## 6. ALTERNATIVES AND COMPETITORS

Current approaches include:
- vendor-specific AI audit logs;
- workflow-engine traces;
- LLM observability platforms;
- provenance metadata standards;
- manual review/checklists;
- doing nothing beyond storing prompts and outputs.

The proposed differentiation is a portable, system-agnostic evidence package combining identity, permissions, provenance, human intervention and integrity anchoring across a multi-agent workflow.

Before submission, add 3–5 concrete competitor URLs and compare scope honestly.

## 7. WHERE THIS GOES

Long term, the Proof Pack model could become reusable trust infrastructure for high-stakes agentic workflows across research institutions, publishers, funders and regulated knowledge work.

Potential commercial model:
- institutional subscription;
- managed evidence/provenance API;
- enterprise policy/governance integrations;
- self-hosted or private deployment support.

## 8. FIT WITH DIGITAL SCIENCE

This proposal fits **evidence synthesis / research integrity / institutional research workflows**.

Digital Science is a strong fit because the programme explicitly values multi-step agentic workflows with provenance, governance and auditability rather than single-prompt applications. The project would benefit from access to research workflow expertise and real institutional feedback to test whether the proposed evidence model solves a genuine operational problem.

## 9. BUDGET — up to £25,000

Illustrative allocation:

- £8,000 — research-workflow prototype engineering;
- £5,000 — provenance / Proof Pack schema and verifier;
- £4,000 — security/threat-model review and negative testing;
- £3,000 — user research with researchers/institutional stakeholders;
- £3,000 — integration/demo with one existing research workflow/tool;
- £2,000 — documentation, reproducibility and evaluation materials.

Final budget should reflect actual team costs and grant eligibility rules.

## Outcome metrics

Prototype metrics should be measurable, for example:
- percentage of workflow steps with complete provenance;
- time required for a reviewer to reconstruct an agent's actions;
- number of policy violations correctly blocked/escalated;
- verifier success rate on untampered vs tampered Proof Packs;
- reviewer hours saved versus manual audit;
- external reproduction of the verification process.

## Submission blocker checklist

Before applying, complete:
- founder/team section;
- one specific research workflow and user persona;
- 3–5 stakeholder interviews if possible;
- one integration target used by researchers today;
- competitor URLs;
- a research-specific demo or mock flow;
- exact budget and delivery timeline.
