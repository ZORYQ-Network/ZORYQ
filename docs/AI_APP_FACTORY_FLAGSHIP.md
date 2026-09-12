# ZORYQ AI App Factory — Flagship Product & Traction Loop

Status: product strategy / evidence-gated execution plan

## Mission

ZORYQ should become a network people use because it enables experiences that are difficult to reproduce with a traditional blockchain-only product.

The product strategy is organized around three engines:

1. **ZORYQ AI App Factory** — idea → usable application.
2. **Autonomous Company** — goal + budget → bounded agent organization that can work, hire, pay, receive and account onchain.
3. **ZORYQ Network** — verifiable infrastructure for identity, payments, execution and evidence.

The blockchain is infrastructure, not the end-user pitch. The product wedge is useful software first, with ZORYQ introduced where verifiability, payments, ownership, identity or autonomous execution add value.

## Flagship experience

Target flow:

**Prompt → objective understanding → application generation → functional preview → Web app → Android APK → optional ZORYQ integration → verifiable onchain proof → sharing → application evolution.**

Core rule:

> When a user asks for an application, code is not the final product. The final product must be a usable application.

The public value proposition should remain understandable in under 30 seconds:

> **Describe what you need. ZORYQ turns the idea into usable software and, when useful, connects that software to the blockchain.**

## Current evidence boundary

Capabilities are classified as:

- 🟢 **Verified** — implemented and backed by a concrete build/deploy/reproduction artifact.
- 🟡 **Experimental** — implemented partially or still being validated.
- 🔵 **Research / roadmap** — not yet implemented as a general capability.

Current status as of 2026-09-12:

| Capability | Status | Evidence boundary |
| --- | --- | --- |
| Prompt-driven Factory surface | 🟢 Verified | Public Launch Studio deployed on the ZORYQ testnet service |
| Functional generated Web runtime | 🟢 Verified | Generated-app runtime supports working template-based applications |
| Budget / inventory / tasks / CRM / generic records | 🟢 Verified implementation | Runtime contains concrete UI, persistence and interaction logic for these templates; each template still needs broader external reproduction |
| Local persistent data | 🟢 Verified implementation | Generated runtime stores application records in browser localStorage |
| JSON export | 🟢 Verified implementation | Generated runtime exports local application/spec data |
| Android installable App Runner | 🟢 Verified build | GitHub Actions produced an installable debug APK artifact |
| Deep-link generated app into Android runner | 🟢 Verified implementation | Android runner accepts only the ZORYQ public host and remembers the last generated app |
| Optional ZORYQ testnet proof | 🟡 Experimental | Runtime includes wallet/faucet/contract proof flow; broader independent product reproduction is still required |
| Arbitrary dynamic UI generation from any prompt | 🔵 Roadmap | Current Factory classifies prompts into bounded templates |
| Dynamic backend/API generation | 🔵 Roadmap | Not a general Factory capability yet |
| Dynamic database/schema generation | 🔵 Roadmap | Not a general Factory capability yet |
| Authentication and role generation | 🔵 Roadmap | Not a general Factory capability yet |
| Unique standalone APK compiled per generated application | 🔵 Roadmap | Current Android artifact is a generic ZORYQ App Runner, not a separately packaged APK for every prompt |
| Security-audited generated smart contracts | 🔵 Roadmap | No such claim should be made without independent audit evidence |
| Autonomous Company → generated operational app | 🔵 Roadmap | Integration target, not a completed general capability |

Do not describe generated applications or contracts as secure, audited, production-ready, autonomous, or universally generated unless the corresponding evidence gate is satisfied.

## Acquisition loop

The Factory is a network acquisition engine:

**Visitor → creates first app → uses app → creates wallet → receives testnet ZQ → completes first transaction → uses an onchain feature → shares app → returns → creates more apps → becomes builder / developer / contributor.**

Every Factory improvement should be evaluated by its effect on this loop, not only by feature count.

## P0 product objective

Move from **template selection** toward **dynamic software generation** while preserving safety and reproducibility.

The first complex proving case should be a multi-module application such as:

> **Create a condominium management system with residents, packages, reservations, incidents and notifications.**

The proving case is successful only when the result is usable software, not a JSON plan or code dump.

Minimum P0 acceptance path:

1. interpret the prompt into an explicit application specification;
2. generate navigation and screens specific to the request;
3. generate fields and validation rules specific to the request;
4. provide persistent storage;
5. generate functional CRUD flows across multiple modules;
6. produce a usable Web deployment;
7. provide a usable Android experience;
8. allow optional ZORYQ integration without forcing blockchain where it is unnecessary;
9. expose an evidence record showing what was generated, tested and deployed;
10. allow the user to evolve the application with another prompt.

## Product architecture target

```text
Natural-language prompt
        ↓
Intent / requirement compiler
        ↓
Application specification
        ↓
┌──────────────────────────────────────────┐
│ UI generator                             │
│ Navigation generator                     │
│ Domain/data model generator              │
│ Validation/business-rule generator       │
│ Storage/backend adapter                  │
│ Auth/roles adapter                       │
│ ZORYQ integration adapter (optional)     │
│ Test generator                           │
└──────────────────────────────────────────┘
        ↓
Build + validation + security gates
        ↓
Functional preview
        ↓
Web deployment + Android package/runner
        ↓
Usage telemetry + evidence
        ↓
Prompt-based evolution
```

## Autonomous Company connection

The Factory should eventually become the UI/application layer for Autonomous Company.

Example future request:

> **Create a marketing company with a budget of 500 ZQ.**

Target output may include:

1. company dashboard;
2. required agents;
3. roles and permissions;
4. budget controls;
5. task management;
6. payments;
7. receipts;
8. reports;
9. onchain proof and accounting artifacts.

This must remain separated into verified capability vs roadmap. The AI must not be allowed to possess unrestricted treasury keys. User-controlled signing, bounded permissions, policy enforcement and evidence gates remain required.

## Metrics

Track only metrics that can be measured from real events:

- Factory visitors;
- prompts started;
- applications generated;
- generated applications actually opened;
- Android APK downloads and, when technically measurable with consent, installs/opens;
- recurring users;
- applications shared;
- wallets created;
- faucet claims originating from the Factory;
- first transactions originating from the Factory;
- applications using a ZORYQ feature;
- external developers modifying or contributing;
- applications created by third parties;
- retention.

Distinguish **Target / Current / Growth / Verified**. Do not convert targets into adoption claims.

## Prioritization rule

For each execution cycle:

**analyze → identify largest bottleneck → rank by Impact × Confidence ÷ Effort → implement → test → measure → record evidence → update next bottleneck.**

Prioritize bottlenecks that prevent a new user from reaching:

**Prompt → usable app → Web/Android → first useful ZORYQ interaction.**

If a Factory improvement solves a larger acquisition/onboarding/product bottleneck than a promotional action, the product improvement wins.

## Traction principle

Do not lead with:

> Come use our blockchain.

Lead with a useful outcome:

> Tell ZORYQ what application you need and use what it creates.

Then let identity, wallet, ZQ, contracts, payments, agents and verifiable execution appear only when they improve the product experience.

## Definition of success

The goal is not merely to have an app generator.

The goal is a **product loop that naturally introduces users to ZORYQ because the software itself is useful**.
