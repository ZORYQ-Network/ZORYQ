# ZORYQ Mainnet Recovery and Audit Gates

Status: required evidence plan; not proof of mainnet readiness.

This document converts the remaining `mainnet-guard.mjs` blockers into concrete evidence packages. No item is green because a checkbox is written here; it becomes green only when the referenced evidence exists and can be independently reviewed.

## 1. Production consensus evidence

Required package:

- exact client versions and build hashes;
- consensus configuration and genesis/config hashes;
- validator/operator topology;
- finality semantics and failure assumptions;
- Engine API/JWT boundary description;
- fork-choice and divergence test results;
- one-node outage and recovery result;
- multi-node convergence samples;
- known limitations.

## 2. External signer / key custody

Required package:

- signer roles separated from application/runtime hosts;
- no mainnet mnemonic/private key in repository, image, logs or plaintext deployment variables where avoidable;
- documented key-generation ceremony;
- operator access-control matrix;
- rotation/revocation procedure;
- emergency signer replacement procedure;
- evidence that a compromised web/RPC host cannot unilaterally control consensus-critical signing.

Do not publish secret material. Publish architecture, public keys/addresses where appropriate, hashes, redacted procedure evidence and reviewer attestations.

## 3. Multi-node redundancy

Required package:

- at least two independently controlled operators;
- distinct node identities and storage;
- matching chain/config hashes;
- peer/convergence evidence;
- same finalized/canonical block hash samples;
- restart/rejoin from local persistent state;
- loss of one node without loss of canonical network progress, if the selected consensus design is intended to tolerate it.

Two replicas controlled by the same primary operator are operational redundancy but are not independent-operator evidence.

## 4. Disaster recovery drill

Run a documented drill that records:

- backup scope and retention policy;
- encrypted backup creation;
- integrity hash before restore;
- clean-host restore procedure;
- restored node identity policy;
- time to recover;
- block/head/finality comparison after recovery;
- data loss window, if any;
- failures and corrective actions.

A backup that has never been restored is not accepted as disaster-recovery evidence.

## 5. Security audit readiness

Before paying for or claiming an external audit, prepare an audit bundle containing:

- architecture and trust boundaries;
- consensus/finality specification;
- threat model;
- privileged roles and upgrade paths;
- key-management design;
- RPC exposure policy;
- faucet/test-only code explicitly separated from production paths;
- dependency/SBOM output;
- reproducible build instructions;
- test coverage and fuzz/property-test inventory;
- previous incidents and known issues;
- in-scope commit hash.

An audit claim must name the auditor, exact scope/commit, report date, unresolved findings and public report or verifiable disclosure where legally possible.

## 6. Incident response

Required runbook must cover:

- severity levels;
- detection and alert ownership;
- RPC abuse/outage;
- validator or signer compromise;
- chain divergence/finality failure;
- dependency vulnerability;
- data corruption;
- key revocation/rotation;
- communications authority;
- evidence preservation;
- postmortem policy.

Run at least one tabletop exercise before mainnet promotion.

## 7. Mainnet launch manifest

The final launch manifest must bind all evidence artifacts by SHA-256 and include:

- distinct mainnet Chain ID;
- immutable genesis/config hash;
- consensus evidence hash;
- key-custody evidence hash;
- redundancy evidence hash;
- disaster-recovery evidence hash;
- external audit report hash;
- incident-runbook hash;
- release commit/tag.

`mainnet-guard.mjs` remains fail-closed until the bound evidence is genuinely present.

## Promotion rule

Mainnet status remains **not claimed** until every mandatory gate is backed by evidence and an independent review can reproduce the essential safety assertions. Targets, internal screenshots, CI green status, or testnet success do not substitute for these gates.
