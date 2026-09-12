# ZORYQ OBEP Useful Task — Live Testnet Proof

Status: verified internal/public-CI proof on ZORYQ Testnet

This evidence demonstrates a deterministic useful task flowing through:

`task input -> execution output -> independent recomputation -> accepted outcome -> ZORYQ Testnet settlement -> public RPC verification -> Proof Pack`

It does **not** prove external economic demand or independent external executor/verifier participation. The executor/verifier wallets in this proof are ephemeral CI-only roles created by the ZORYQ workflow.

## Public evidence

GitHub Actions run:
`https://github.com/ZORYQ-Network/ZORYQ/actions/runs/34723435705`

Commit:
`2de0f478eddf2ad2a5345b75f2606524e37a280e`

ZORYQ chain ID:
`5919065`

Useful-task settlement transaction:
`0x472716d15ffe9b4440a818fec15bdf3a426cfa653e8e147a6be04fec1ab7ee4d`

Block:
`127339`

Task output hash:
`0x1198ac0402951123aa977a0d16cdca317f61e5448108da67629125c6c721cf4c`

OBEP intentId:
`0x321a133dbcdb44b43870e1d25ab059932a9a8353033b9445d0d6566f8d3131c7`

OBEP outcomeId:
`0xaebba31f940705c9ca662c44d842263874a3f176594341acb04b1f9c0f06b588`

Onchain commitment:
`0x8713c7d91ce98c2ad58755942529be6ac9724587fc870d9790b191b2451ed7df`

Proof Pack hash:
`0x34422480f23741db1d507712bc3d572d92686c5f72a315afdeabbd51953e41c3`

Workflow artifact digest:
`sha256:2dd0c8d685614e3f8a172873018040c611b6bcc9b1df50cbd4694decbc4853f2`

## Task

Input:
`zoryq-developer/obep/external-task/records.json`

Specification:
`zoryq-developer/obep/external-task/README.md`

Executor implementation:
`zoryq-developer/obep/external-task/compute-task.mjs`

Independent verifier:
`zoryq-developer/obep/external-task/verify-task.mjs`

The task produces a canonical SHA-256 input digest, record count, active record count, aggregate amount across active records, per-category active totals and a deterministic output hash.

The fixed dataset currently yields:
- record count: `6`
- active records: `4`
- active amount total: `78`
- category totals: `compute=17`, `storage=42`, `verification=19`

## Settlement gate

`external-task/live-task-proof.mjs` independently recomputes the task before settlement. If the recomputation differs from the executor output, the outcome is rejected and payment must not proceed.

After acceptance, the settlement transaction stores a commitment derived from:

`intentId + outcomeId + outputHash`

The transaction is then retrieved again from the public ZORYQ RPC and checked for payer, recipient, value, calldata and successful receipt.

## Independent proof verification

`external-task/verify-live-task-proof.mjs`:
1. recomputes the fixed task again from source input;
2. verifies the stored task digest/output hash;
3. verifies the OBEP Proof Pack;
4. recovers the Treasury, executor and verifier role attestations;
5. recomputes the onchain commitment;
6. queries the public ZORYQ RPC directly;
7. verifies transaction status, payer, recipient, value, calldata and tx hash.

The reference CI run passed this entire verification path.

## Claim boundary

This proves:
- deterministic useful-task execution can be bound to an OBEP outcome;
- payment can be gated on accepted deterministic recomputation;
- a real ZORYQ Testnet transaction can bind the accepted result;
- the resulting Proof Pack can be independently rechecked from the public RPC.

This does **not** prove:
- external user demand;
- an independent external executor;
- an independent external verifier;
- production security;
- decentralization;
- mainnet readiness;
- economic value of testnet ZQ.

The next evidence gate remains issue #130: repeat this lifecycle with genuinely independent external participants.
