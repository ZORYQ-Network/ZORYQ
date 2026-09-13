# ZORYQ Non-Dev Cluster Reproduction

This directory contains the first executable **non-dev** ZORYQ network prototype based on:

- 2× Reth execution clients;
- 2× Lighthouse consensus clients;
- Kurtosis + `ethereum-package` orchestration;
- ZORYQ network ID `5919065`;
- convergence, finality, peer and restart/rejoin verification.

This is a prototype/reproduction surface. It is **not** the current public production network, not proof of decentralization, and not mainnet readiness.

## One-command reproduction

Prerequisites:

- Docker;
- Kurtosis CLI;
- `jq`;
- `curl`.

From repository root:

```bash
chmod +x infra/nondev/run-external-reproduction.sh
./infra/nondev/run-external-reproduction.sh
```

On success the script writes:

`./zoryq-nondev-external-evidence.json`

and prints its SHA-256.

The verifier requires:

- both EL nodes to report the same chain ID;
- both nodes to advance beyond genesis;
- non-genesis Lighthouse finality;
- matching canonical EL block hash;
- matching finalized epoch;
- non-zero consensus peers;
- Node 2 restart from retained state;
- post-restart block advancement;
- canonical convergence after restart.

## Keep the enclave for inspection

```bash
ZORYQ_NONDEV_KEEP_ENCLAVE=1 ./infra/nondev/run-external-reproduction.sh
```

Use a custom enclave name:

```bash
ZORYQ_NONDEV_ENCLAVE=my-zoryq-test ./infra/nondev/run-external-reproduction.sh
```

## Evidence submission

A useful external report should include:

- public GitHub identity/team;
- operating system;
- Docker and Kurtosis versions;
- repository commit SHA;
- generated evidence JSON SHA-256;
- whether the convergence/finality/restart gate passed;
- any failure or ambiguity observed.

Post non-secret evidence to Issue #73.

## Independence boundary

Running this challenge on external compute proves **external reproducibility of the non-dev architecture**. It does not by itself satisfy the independent Node 2 gate, because the launched cluster is still an isolated reproduction. The stronger Node 2 milestone requires an independently controlled operator to join a ZORYQ non-dev public candidate/network under a separate account/control boundary and publish convergence/restart evidence.

Never publish private keys, validator secrets, Engine JWT secrets, mnemonics, cloud credentials or infrastructure tokens.
