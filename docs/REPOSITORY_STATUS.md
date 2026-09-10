# Repository Status and Evidence Boundary

This document records what the current `ZORYQ-Network/ZORYQ` repository demonstrates and what remains an architectural target, research topic or external system.

## What is directly present in this repository

- project and product documentation;
- security policy and threat-model documentation;
- contribution guidance;
- GitHub issue and pull-request templates;
- GitHub Actions for brand validation and Android APK builds;
- a packaged mobile source archive consumed by the Android build workflow.

## What is not presently exposed as normal source files here

The current repository tree does not expose a complete blockchain node/protocol implementation, consensus engine, state engine, networking stack, RPC server implementation, benchmark suite or reproducible multi-node devnet as normal source directories.

Therefore, architectural descriptions of those areas must be read as project direction, external implementation context or research until code and reproducible evidence are committed or linked.

## Claim classification

Use these labels in technical documentation:

- **Implemented** — code is present and testable.
- **Measured** — reproducible benchmark or test evidence is available.
- **Deployed** — a running environment exists and can be independently checked.
- **Experimental** — implementation exists but is not production-ready.
- **Research** — architecture or mechanism is being investigated.
- **Target** — intended future capability without sufficient implementation evidence yet.

Do not silently convert a Target or Research item into an Implemented or Measured claim.

## Evidence required for performance claims

A throughput, latency, recovery, finality or resource-efficiency claim should include, where applicable:

- commit SHA;
- hardware and operating system;
- node count and topology;
- configuration;
- workload definition;
- duration;
- raw results;
- benchmark code;
- limitations.

## Current priority

The repository should progressively replace packaged or externally implied implementation with inspectable source code, tests, specifications and reproducible benchmarks. Until then, the README and technical documents should clearly distinguish the product vision from what this repository itself proves.
