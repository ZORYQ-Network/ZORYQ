# ZORYQ Mainnet Security Audit Scope

Status: pre-audit engineering scope. This document does not claim that an external audit has occurred or that mainnet is ready.

## Objective

Define the minimum external review surface that must be assessed before any ZORYQ mainnet-readiness claim. The audit must evaluate both code and operational controls; green CI alone is not evidence of security.

## In scope

### 1. Consensus and finality
- selected consensus-client configuration and version pinning;
- validator/proposer duties and failure behavior;
- fork-choice/finality assumptions;
- equivocation/slashing exposure where applicable;
- loss of quorum and degraded-mode behavior;
- time/clock assumptions;
- chain split detection and operator response.

### 2. Execution / Engine API boundary
- Reth configuration and exact version/image digest;
- Engine API exposure and network isolation;
- JWT generation, distribution, storage and rotation;
- rejection of unauthenticated/unauthorized Engine API traffic;
- execution/consensus compatibility and failure handling;
- Engine API endpoint must not be internet-public by default.

### 3. Genesis and chain identity
- immutable genesis artifact;
- chain ID/network ID separation from testnet;
- published SHA-256/digest verification;
- validator/deposit/consensus genesis consistency;
- no implicit reset or silent chain-spec substitution.

### 4. Key custody and signer separation
- validator/signing keys generated outside source control;
- no seed phrase/private key in repository, container image or CI logs;
- least-privilege access to signing material;
- separation of deployment/admin/treasury/validator roles;
- key rotation/revocation procedure;
- emergency compromise procedure.

### 5. P2P and network security
- peer discovery/bootstrap configuration;
- anti-eclipse/Sybil considerations;
- inbound/outbound firewall policy;
- protection of RPC, metrics and management surfaces;
- peer identity persistence across restart;
- multi-operator control-boundary verification.

### 6. RPC and public gateway
- method allow/deny policy;
- administrative/signing methods disabled publicly;
- rate limiting and abuse controls;
- request/body limits and batch behavior;
- CORS and origin policy;
- error behavior without secret leakage;
- faucet abuse controls separated from consensus-critical secrets.

### 7. Smart contracts and autonomous-company surfaces
- privilege model and upgrade/admin assumptions;
- treasury/payment authorization;
- verifier/worker separation;
- reentrancy, authorization, accounting and replay risks;
- emergency-stop behavior;
- invariant/property tests where material.

### 8. Supply chain and CI/CD
- pinned dependencies and base images where practical;
- provenance of Reth/Lighthouse/Kurtosis/ethereum-package artifacts;
- branch/release protections;
- secret handling in CI;
- dependency and container scanning;
- reproducible build/release evidence.

### 9. Persistence, backup and disaster recovery
- database consistency assumptions;
- backup creation and integrity validation;
- clean-host restore drill;
- node rejoin and canonical convergence after restore;
- one-node-loss recovery;
- corrupted-state/fork handling;
- recovery-point/recovery-time targets clearly labeled as targets until measured.

### 10. Monitoring and incident response
- head/finality/peer divergence alerts;
- signer/validator health;
- disk/memory/CPU saturation;
- abnormal RPC/faucet activity;
- log retention and evidence preservation;
- incident classification, containment and postmortem process.

## Required evidence package for auditors

The review package should contain:

1. exact commit SHA and release tag under review;
2. architecture diagram and trust boundaries;
3. execution + consensus startup configuration with secrets redacted;
4. pinned genesis/config hashes;
5. threat model;
6. mainnet guard policy;
7. disaster-recovery runbook and latest drill evidence;
8. incident-response runbook;
9. multi-node convergence/finality evidence;
10. independent operator evidence;
11. external first-transaction reproduction evidence;
12. contract addresses/ABIs/source mappings for in-scope contracts;
13. dependency/SBOM or equivalent dependency inventory;
14. known limitations and accepted risks.

## Severity expectations

- Critical: unauthorized signing/funds/control, consensus safety failure, arbitrary chain-state manipulation, secret compromise enabling control.
- High: practical chain halt, persistent divergence, privilege escalation, major fund/accounting flaw, remote compromise of node/gateway.
- Medium: bounded DoS, information exposure, abuse-control bypass, recovery weakness without immediate safety break.
- Low/Informational: hardening, documentation, observability and defense-in-depth findings.

## Launch policy

Mainnet remains blocked if:
- any unresolved Critical finding exists;
- any unresolved High finding lacks explicit remediation and re-test evidence;
- the audited commit differs materially from the release candidate without delta review;
- consensus/recovery/operator evidence is missing;
- the launch manifest cannot bind the audited artifacts and evidence hashes.

A completed audit is evidence, not a guarantee. Mainnet promotion requires the audit plus the independent operational gates defined elsewhere in the repository.
