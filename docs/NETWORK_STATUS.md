# ZORYQ Network Status

This document is the canonical human-readable network status. It separates public testnet evidence from mainnet claims.

## Current stage

**Public experimental testnet / active development.**

- Network: ZORYQ Testnet
- Chain ID: `5919065`
- Compatibility target: EVM
- Public RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Public faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet/claim`

Testnet ZQ has no implied monetary value.

## Evidence matrix

| Capability | Status | Evidence |
| --- | --- | --- |
| Public RPC / transaction path | PROVEN | README network configuration and public reproduction artifacts |
| Independent developer first transaction | PROVEN | `EXTERNAL_TRACTION_EVIDENCE.md` |
| Public faucet path | PROVEN | developer onboarding / first-transaction evidence |
| Non-dev multi-node engineering artifacts | WORKING | `infra/nondev/`, RFC-0001 and smoke workflow |
| Independent Node 2 | NOT_PROVEN | Issue #73 / `EXTERNAL_NODE2_HANDOFF.md` |
| Two independently controlled operators | NOT_PROVEN | required by mainnet gates |
| Decentralization | NOT_PROVEN | no sufficient independent-operator evidence |
| Mainnet | NOT_PROVEN | `MAINNET_READINESS.md` |
| Externally audited production security | NOT_PROVEN | `MAINNET_SECURITY_AUDIT_SCOPE.md` |

## Claim boundary

A green testnet transaction does not prove consensus safety, decentralization, sustained performance, economic security or mainnet readiness. Internal replicas controlled by the same operator do not count as independent-operator evidence.

## Promotion rule

Network status may move toward mainnet only when evidence packages named in `MAINNET_READINESS.md` and `MAINNET_RECOVERY_AND_AUDIT_GATES.md` exist and can be independently reviewed.
