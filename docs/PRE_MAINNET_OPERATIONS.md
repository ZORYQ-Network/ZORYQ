# ZORYQ Pre-Mainnet Operations

This document is an operational checklist, not a claim that mainnet is live or externally audited.

## 1. Safety invariant

Production mainnet must remain fail-closed until the launch guard has no blockers. Never bypass `zoryq-evm-node/mainnet-guard.mjs`, never reuse testnet chain ID 5919065, and never embed mnemonics/private keys in genesis, CI, images or repository files.

## 2. Required evidence bundle

Before launch, archive and independently verify: deterministic genesis + SHA-256, PoMI manifest + commitment, threshold-signed launch certificate, release bundle/integrity output, release-governance evidence, multi-operator evidence from independent operators, validator registry, production-consensus attestation, external signer/HSM/KMS attestation, security audit report, recovery rehearsal output, incident runbook approval and observability/alerting evidence.

## 3. PoMI / Proof of Mainnet Integrity

`zoryq-mainnet/pomi.mjs` canonicalizes release identity, policy and evidence file digests into a SHA-256 commitment. It emits a 32-byte `genesisAnchor.value` intended for the genesis `extraData` field where the selected production consensus permits it. The generated genesis must then be re-verified with `--genesis`; a mismatch fails.

Example rehearsal only:

```bash
node zoryq-mainnet/pomi.mjs --manifest /secure/pomi-input.json --out /secure/pomi
node zoryq-mainnet/genesis-ceremony.mjs --config /secure/mainnet-config.json --out /secure/genesis
node zoryq-mainnet/pomi.mjs --manifest /secure/pomi-input.json --out /secure/pomi-verified --genesis /secure/genesis/genesis.json
```

Do not copy placeholder addresses, commits or rehearsal data into production.

## 4. Release governance

Release candidate must be immutable by commit SHA and reviewed through PR. Require independent human approvals, green required checks, signed/tagged release artifacts where available, and no direct production deployment from an unreviewed branch. The repository currently contains release-governance evidence tooling; GitHub branch protection/rulesets must be enforced by an administrator before mainnet.

Recommended minimum: 2 human reviewers, CODEOWNERS for mainnet/runtime/security paths, required status checks for launch guard, readiness, release integrity, supply-chain, recovery, RPC conformance and PoMI, and no force-push/deletion on the release branch/tag.

## 5. Multi-operator evidence

Use `multi-operator-evidence.mjs` only with evidence produced by genuinely independent operators/infrastructure. CI fixtures prove the verifier logic, not decentralization. Mainnet launch evidence must include different operator identities, endpoints/regions/providers where applicable, signed observations and matching chain/genesis identity.

## 6. Recovery runbook

1. Declare incident severity and freeze release/deploy actions.
2. Preserve logs, deployment IDs, node data snapshots and hashes before mutation.
3. Determine whether the issue is RPC-only, execution/state, consensus, signer/key, networking, storage or application-layer.
4. If state corruption is suspected, stop the affected node before restore; never restore over a running writer.
5. Recover from a verified snapshot/checkpoint only after hash/network/genesis validation.
6. Bring up one isolated node, verify chain ID/genesis/head/finality, then rejoin traffic gradually.
7. Run RPC conformance, state recovery tests and live smoke before declaring recovery.
8. Produce a post-incident evidence bundle with timeline, root cause, corrective action and regression test.

## 7. Incident response

Severity P0: signing/key compromise, consensus safety failure, conflicting finalized state, unauthorized release or systemic fund risk. Immediately stop automated deployment/signing paths and invoke key/validator emergency procedures.

Severity P1: public RPC unavailable or widespread stalled block production without evidence of safety violation. Fail traffic away from unhealthy replicas, preserve evidence and recover under change control.

Never publish private keys, mnemonics, raw auth tokens or signer credentials in incident tickets or public logs.

## 8. Observability minimum

Before mainnet, alert on: process/restart status, RPC availability and latency, block height progression, peer count, sync lag, disk usage/inodes, memory/CPU, finality/head divergence between operators, signer availability, failed transaction rate, abnormal RPC method/error spikes, volume health and backup age. Alerts need an owned escalation path and a tested notification destination.

## 9. Simple public testnet experience

Current public testnet users should only need the published RPC/explorer/wallet surfaces. A smoke test should verify `/health`, RPC `eth_chainId`, current block height, explorer load and a read-only account/balance call. Faucet/test tokens are testnet-only and must remain visibly labeled as having no monetary value.

## 10. Launch decision

A green CI suite is necessary but not sufficient. Mainnet remains blocked until external audit evidence, production signer custody, production consensus/validator infrastructure, independent operator evidence, branch/release protections, backups/restore rehearsal, monitoring/on-call and final genesis/PoMI/launch-certificate ceremony are all real and archived.
