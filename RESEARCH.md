# ZORYQ Research Program

ZORYQ treats novel protocol work as research until implementation and evidence justify stronger language.

## Research lifecycle

Every major technical proposal should move through these stages:

1. **Problem** — precise limitation or opportunity.
2. **Related work** — prior protocols, papers and implementations.
3. **Hypothesis** — falsifiable statement.
4. **Design** — mechanism, assumptions and trade-offs.
5. **Prototype** — isolated implementation where appropriate.
6. **Tests** — correctness, failure and adversarial cases.
7. **Benchmark** — reproducible comparison against a fair baseline.
8. **Risk review** — security, centralization, complexity and operational risk.
9. **Decision** — reject, revise, keep experimental, or propose for integration.

Negative results remain valid research output.

## Evidence labels

Use these labels consistently:

- **TARGET** — desired future result; not measured.
- **HYPOTHESIS** — proposition under investigation.
- **EXPERIMENTAL** — prototype exists but is not production protocol behavior.
- **MEASURED** — reproduced by the documented benchmark in a specified environment.
- **TESTNET RESULT** — observed on a named ZORYQ testnet configuration.
- **INDEPENDENT RESULT** — reproduced by an independent party with evidence.

## Candidate research tracks

The following are research directions only unless their individual artifacts state otherwise:

- adaptive execution mesh;
- dependency-aware / predictive state scheduling;
- proof receipts and verifiable execution;
- streaming confirmation/finality semantics;
- congestion isolation;
- dynamic state partitioning;
- safe autonomous optimization;
- post-quantum migration strategies;
- verifiable AI / agent execution.

## Research scorecard

Each proposal should be scored from 0–5 where appropriate:

- Novelty
- Impact
- Feasibility
- Security
- Performance potential
- Complexity
- Reproducibility

A high novelty score is not proof of novelty. Prior-art review is required before public novelty claims.

## Required experiment metadata

Record at minimum:

- hypothesis;
- method;
- environment;
- hardware;
- software/compiler versions;
- commit hash;
- configuration;
- result;
- raw data location;
- limitations;
- next experiment.

See `research/` for working artifacts and `BENCHMARKS.md` for measurement rules.
