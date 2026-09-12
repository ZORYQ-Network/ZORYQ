# ZORYQ Consensus V2 — Parallel Migration Plan

Status: TESTNET / PARALLEL VALIDATION. This plan must not replace the live ZORYQ testnet until every promotion gate below is green.

## Goal

Move from the current single-producer Reth `--dev` architecture to a real multi-node Execution Layer + Consensus Layer testnet, while keeping the existing live testnet untouched during validation.

## Target topology

- 3 independent Execution Layer nodes: Reth
- 3 independent Consensus Layer nodes: Lighthouse
- Validators distributed across all 3 participants
- ZORYQ network/chain identifier: 5919065
- Shared consensus/finality instead of local `--dev` block production
- Engine API enabled only on the private EL<->CL interface
- Public RPC separated from privileged Engine API
- Independent persistent storage per production node
- Metrics and finality evidence retained before promotion

## Phase A — Reproducible parallel devnet

Configuration: `infra/consensus-v2/network_params.yaml`

Reference implementation uses the EthPandaOps ethereum-package because it generates matching EL/CL genesis artifacts and connects Reth execution clients to Lighthouse consensus clients reproducibly.

Example launch on an isolated machine/runner with Docker + Kurtosis installed:

```bash
kurtosis run --enclave zoryq-consensus-v2 \
  github.com/ethpandaops/ethereum-package \
  --args-file infra/consensus-v2/network_params.yaml
```

Do not reuse the current Railway `/data` volume in this phase.

## Required evidence before Phase B

All conditions are mandatory:

1. All three EL clients are healthy.
2. All three CL clients are healthy.
3. Beacon finality advances for at least 3 epochs.
4. All execution clients report the same chain ID.
5. A common block height has the same block hash on all three execution clients.
6. Stop one participant and prove the remaining network continues finalizing.
7. Restart the stopped participant and prove it catches up without chain divergence.
8. No public endpoint exposes Engine API/JWT.
9. No node uses `--dev`, embedded mnemonic generation, or public signing APIs.
10. Capture genesis/config hashes and the client image versions used in the test.

## Phase B — Persistent staging

Only after Phase A passes:

- deploy 3 stateful nodes with independent persistent disks;
- place them in at least two failure domains;
- use stable P2P identities and explicit bootstrap peers;
- place public RPC behind the ZORYQ gateway/rate limits;
- keep CL/Engine API private;
- test backup/restore from a fresh machine;
- test loss of one execution+consensus participant;
- test restart and catch-up;
- retain evidence in the launch manifest.

A free Render observer without persistent storage does not count as production redundancy.

## Phase C — Promotion decision

Promotion is forbidden unless:

- Consensus V2 failure tests pass;
- disaster recovery evidence is complete;
- multi-node redundancy evidence is complete;
- production signer/key-management controls are ready;
- genesis/config is frozen and hash-bound;
- incident response runbook is tested;
- external security review/audit requirements are satisfied;
- current mainnet guard passes without bypasses.

## Rollback rule

The existing live testnet remains unchanged while Consensus V2 is being validated. If any consensus, finality, recovery, compatibility, or persistence test fails, discard/rebuild the parallel network. Never mutate/reset the live chain merely to make a readiness check pass.

## Promotion principle

Green means measured evidence, not configuration intent. A topology file alone is never proof of finality, synchronization, redundancy or mainnet readiness.
