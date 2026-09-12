# ZORYQ Autonomous — External Work + Revenue Proof

Status: **implementation candidate; not yet canonical or deployed**.

This document defines the evidence gate for upgrading ZORYQ Autonomous from synthetic testnet economics to an externally funded testnet work cycle.

## Why this exists

`ZoryqAutonomousCompanyV3` can demonstrate bounded roles, owner-approved AI plans, agent payments, replay protection and deterministic accounting. Its revenue, however, is synthetic dUSD created by the demo contract. That must never be described as real external revenue.

`ZoryqExternalWorkProof` creates a stricter evidence path:

1. company owner creates a work order with a unique `specHash`;
2. company owner records a unique `deliveryHash`;
3. a **different address** pays native testnet ZQ;
4. the contract forwards the payment directly to the declared treasury;
5. the same successful transaction records payer, amount, delivery hash and timestamps;
6. a deterministic `proofDigest` binds the final evidence record.

## Claim gate

A work order may be called **externally funded on testnet** only if all of these are independently verified through public RPC:

- contract bytecode exists on Chain ID `5919065`;
- `WorkOrderCreated` exists for the work order;
- `WorkDelivered` exists with the declared delivery hash;
- payer is different from `companyOwner`;
- `ExternalRevenueReceived` exists;
- transaction receipt has `status = 0x1`;
- transaction `value` equals `revenueZqWei`;
- treasury balance delta is consistent with the payment, excluding unrelated concurrent transfers;
- `paid = true` and `cancelled = false` in contract state;
- spec and delivery hashes resolve to public evidence or an independently inspectable artifact.

This still does **not** prove legal consideration, market demand, profitability, independent AI reasoning or production readiness. Those remain separate claims.

## Adversarial properties covered by unit tests

- payment before delivery is rejected;
- owner self-payment is rejected;
- double payment is rejected;
- failed treasury forwarding does not become recorded revenue;
- cancelled work cannot be paid;
- paid work cannot be cancelled;
- spec hash replay is rejected;
- delivery hash replay is rejected;
- proof digest binds the final work/revenue state.

## Canonical live reproduction checklist

After CI is green and the contract is deployed to the public ZORYQ EVM Testnet:

1. publish deployment address + deployment tx;
2. create a fresh work order using a public spec artifact;
3. record a public delivery artifact hash;
4. use an independent/fresh payer wallet to submit a small native-ZQ payment;
5. record the payment tx hash and receipt;
6. read the work-order state via public RPC;
7. read `proofDigest(workOrderId)`;
8. export a machine-readable Proof Pack containing all hashes, addresses, block numbers and claim boundaries;
9. ask a third party to reproduce the verification without private credentials.

Until steps 1–9 are complete, the P0 #59 external-revenue gate remains open.
