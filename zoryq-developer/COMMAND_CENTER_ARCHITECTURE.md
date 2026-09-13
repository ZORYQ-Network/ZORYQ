# ZORYQ Command Center — Architecture v1

## Purpose

The ZORYQ Command Center is the internal operational view for understanding current evidence, blockers, changes, priorities and data quality across ZORYQ. It is not a vanity dashboard and must never convert missing evidence into a positive metric.

## Architecture

V1 deliberately stays inside the existing `zoryq-web` static architecture. The browser loads a sanitized GitHub snapshot from `command-center-snapshot.json`, repository evidence from `network-maturity.json`, and read-only runtime signals from the public Testnet health/RPC/Explorer endpoints. No private GitHub credential is exposed to the browser.

Future versions may introduce a server-side ingestion layer and persistent metrics store when historical scoring, private integrations and authenticated views require them.

## Sitemap

V1:

- Overview
- Technology
- GitHub
- Traction
- Network
- Roadmap
- Tasks
- Alerts
- Sources

Planned extensions:

- Security
- Performance
- Testnet
- Developers
- Users
- Investors
- Partnerships
- Media
- Research
- Reports
- Settings

## Data model

Core logical entities:

- `metrics`: observed numeric/string values with source, timestamp and confidence;
- `scores`: calculated values plus formula, coverage and explanation;
- `events`: structured changes such as commits, CI results and network events;
- `tasks`: operational work with source, priority, owner/status when evidenced;
- `alerts`: material conditions with severity and evidence;
- `milestones`: roadmap state plus explicit exit criteria;
- `sources`: integration state and confidence;
- `snapshots`: time-bounded views used for history and Momentum.

## Available integrations

- Private GitHub repository through an authenticated external connector for snapshot generation.
- Repository-native `network-maturity.json` evidence.
- Public ZORYQ Testnet `/health` endpoint.
- Public ZORYQ Testnet JSON-RPC.
- Public Explorer statistics endpoint.
- Runtime memory endpoint.
- Existing Vercel production project and deployment workflow.

## Missing / incomplete integrations

- Automated private GitHub ingestion usable by the browser without exposing credentials.
- Historical time-series storage for Health/Momentum.
- Website analytics.
- X, Discord, Telegram, Reddit, LinkedIn and YouTube analytics.
- Investor CRM, grants and media feeds.
- Independent security audit evidence.
- Independent validator/node telemetry.

## Score engine policy

Health is a current-quality score. Momentum is a change/velocity score. They are separate.

Planned Health weights:

- Technology 20%
- Security 15%
- GitHub 10%
- Testnet 10%
- Performance 10%
- Developer Growth 10%
- User Growth 10%
- Traction 10%
- Research 5%

A score MUST remain `null` when evidence coverage is insufficient. Every future numeric score must expose component values, weights, timestamps, data coverage and source confidence. Momentum MUST NOT be calculated until at least two comparable snapshots exist.

## Homepage wireframe

`Header → Health + Momentum → ZORYQ Today → Technology | GitHub | Traction → Live Network → Critical Now | Top Opportunities → Roadmap → Action Center → Live Activity | Data Sources`

## ZORYQ Map structure

Root: ZORYQ

- Technology: Consensus, Execution, ZAEM, PSDG, State, Proof Layer
- Infrastructure: Devnet/Testnet, RPC, Explorer, Validators
- GitHub: Code, PRs, Issues, CI/CD, Releases
- Security: Audits, Fuzzing, Threat Model, Incidents
- Traction: Social, Community, Media, International
- Ecosystem: Developers, Apps, Partners, Integrations
- Capital: Investors, Grants, Accelerators, Funding
- Research: Hypotheses, Experiments, Benchmarks, Evidence

## Visualization policy

Charts exist only when a question requires them. Preferred mapping: line = evolution, bars = comparison, radar = multidimensional maturity, funnel = conversion, heatmap = activity/risk, map = geography, graph = dependency, gauge = readiness, timeline = roadmap. V1 avoids fake history, so historical charts are intentionally absent until snapshots exist.

## Implementation priorities

Phase 1: Overview, GitHub, Technology, Traction, Roadmap, Tasks, Alerts.

Phase 2: Security, Performance, Testnet, Developers, Users.

Phase 3: Investors, Partnerships, Media, Research, global maps.

Phase 4: AI Assistant, score automation, anomaly detection, daily/weekly reports.

## Stack decision

V1 uses the current static HTML/CSS/JavaScript stack because `zoryq-web` is already deployed this way. Introducing Next.js now would create migration risk without being required for the first operational view. A server-rendered TypeScript application becomes appropriate once private integrations, authentication, persistent history and server-side score computation are needed.

## Technical risks

1. Private GitHub data cannot be queried directly from client-side JavaScript without exposing credentials.
2. Health and Momentum are misleading without sufficient source coverage and historical snapshots.
3. Single-gateway Testnet topology creates infrastructure concentration risk.
4. Multi-validator consensus is not implemented in the current maturity record.
5. Analytics sources are not yet connected, so traction/adoption claims must remain blank.
6. Existing static deployment workflow deploys production from `zoryq-evm-testnet-node`; feature work should be reviewed before merge.
7. A future public dashboard must enforce a strict public/private data boundary.

## Acceptance criteria for V1

A reviewer can open one page and identify: current Testnet runtime status, evidence boundary, latest GitHub development snapshot, structural blockers, opportunities grounded in issues, roadmap exit criteria, action priorities and source freshness. Missing inputs are shown as No Data/Not Connected rather than inferred.
