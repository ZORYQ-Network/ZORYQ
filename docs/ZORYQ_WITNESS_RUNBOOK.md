# ZORYQ Standalone Witness Runbook

This runbook creates **verifiable witness evidence**, not validator authority. A witness verifies the public chain from another machine/account and produces a signed evidence bundle. It does not produce blocks and does not make the network decentralized by itself.

## Requirements

- Node.js 22+
- outbound HTTPS access to the public ZORYQ RPC and maturity endpoint
- no mnemonic, validator key, treasury key, Railway token or infrastructure credential

## One-command observation

```bash
node zoryq-mainnet/witness-node.mjs
```

Defaults point at the public ZORYQ testnet. The script:

1. downloads `/network-maturity.json`;
2. recomputes SHA-256 of the published canonical chain spec;
3. requires chain ID `5919065`;
4. requires canonical genesis SHA-256 `98cc8fd509be7822cd57c3999ee1c392d1f984580e145ee8b55db1092b80a5fd`;
5. queries the public RPC for chain ID, head block and parent block;
6. verifies parent linkage;
7. creates/reuses a local Ed25519 witness identity;
8. writes a signed machine-readable evidence bundle.

## External operator invocation

An external operator should use an operator ID and region they control:

```bash
ZORYQ_WITNESS_OPERATOR_ID=my-operator \
ZORYQ_WITNESS_REGION=region-name \
ZORYQ_WITNESS_CORE_CONTROLLED=false \
node zoryq-mainnet/witness-node.mjs
```

The resulting bundle still sets `independenceVerified=false`. That field must only be promoted after another verifier confirms the operator/infrastructure control boundary. Self-declaration alone never satisfies the decentralization gate.

## Verify the bundle

```bash
node zoryq-mainnet/verify-witness-evidence.mjs ./zoryq-witness-evidence.json
```

The verifier rejects wrong chain ID, wrong genesis SHA, stale evidence, malformed block hashes, digest tampering and invalid Ed25519 signatures.

## What counts as progress

- core-team witness: proves the software/evidence path works, **does not** count as an independent operator;
- external witness with unverified ownership: useful external reproduction, but not yet counted toward decentralization;
- externally controlled witness with independently verified ownership: counts toward witness/operator diversity, but still not validator consensus;
- multi-operator validator consensus: separate P0 gate defined in `docs/ZORYQ_MULTI_OPERATOR_CONSENSUS_SPEC.md`.

## Mainnet claim boundary

Witnesses improve independent verification and reduce reliance on a single observation source. They cannot replace decentralized block production/finality. Mainnet remains blocked until the validator acceptance matrix, adversarial tests, security review and independent-operator evidence all pass.
