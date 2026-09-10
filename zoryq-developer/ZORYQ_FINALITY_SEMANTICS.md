# ZORYQ finality semantics and claim policy

Status: **Gate C not passed**

This document defines the words ZORYQ may use for transaction progress until protocol-level finality evidence exists. It intentionally separates fast RPC acknowledgement and block inclusion from finality.

## Normative transaction states

### submitted

A client has sent a transaction to a ZORYQ RPC endpoint. No acceptance, propagation, execution, inclusion or durability claim follows from submission alone.

### accepted

The execution endpoint returned a transaction hash or otherwise acknowledged the transaction as accepted for processing. `accepted` is a mempool/RPC state. It is **not** inclusion and **not** finality.

### included

`eth_getTransactionReceipt` returns a receipt with a non-null `blockHash` and `blockNumber`. The transaction is included in the canonical view observed by that RPC endpoint at the measurement instant.

An included transaction with `status = 0x1` executed successfully. An included transaction with `status = 0x0` reverted. Receipt success does not upgrade the transaction to final.

### safe

`safe` is reserved for a protocol-defined safety threshold whose source, assumptions and failure behavior are documented and independently testable. ZORYQ currently has no project-level evidence gate that proves this state.

If the underlying execution client answers the Ethereum `safe` block tag, that response is recorded as a client capability only. It must not be presented as ZORYQ protocol finality without a ZORYQ consensus/finality definition and fault model.

### finalized

`finalized` means the protocol's documented finality rule has been satisfied under its stated fault assumptions and there is evidence that the rule is enforced by the running multi-node protocol.

ZORYQ currently does **not** have sufficient evidence to make a finality-time claim. An execution client's `finalized` JSON-RPC tag, a fast block interval, a successful receipt, or an RPC response time is not by itself proof of ZORYQ finality.

## Current claim boundary

Until Gate C passes, public and developer claims must use `submitted`, `accepted` and `included` precisely as defined above. Do not claim:

- sub-second finality;
- instant finality;
- deterministic finality;
- BFT finality;
- economic finality;
- irreversible confirmation;
- a measured `included -> final` latency.

`confirmed` is ambiguous and should be avoided in new protocol evidence. Where legacy UI/code uses `confirmed`, it means receipt-observed inclusion/success only unless the surface explicitly states otherwise.

## Gate C evidence required

Gate C passes only when all of the following are present for the exact tested commit/configuration:

1. A protocol-level finality rule with the actors/consensus mechanism that produce it.
2. Explicit safety and liveness assumptions, including the tolerated node/validator fault threshold.
3. A machine-readable signal that identifies when a transaction/block satisfies that rule.
4. A measurement harness that records timestamps for RPC ingress, acceptance, inclusion and finality.
5. p50/p95/p99 distributions for:
   - RPC ingress -> accepted;
   - accepted -> included;
   - included -> final;
   - submission -> finality.
6. Block/slot interval distribution.
7. Reorg count and maximum observed reorg depth.
8. Failed/reverted transaction ratio.
9. Raw machine-readable results and the reproducibility manifest required by the conformance specification.
10. Multi-node fault/recovery evidence demonstrating that the finality rule behaves as documented under the stated fault model.

## Evidence status

| Evidence | Current status | Claim impact |
| --- | --- | --- |
| RPC acceptance can be measured | available | may report acceptance latency when measured |
| Receipt inclusion can be measured | available | may report inclusion latency when measured |
| Successful receipt (`0x1`) | available | proves successful included execution only |
| `safe` client tag | capability must be probed | no ZORYQ safety claim |
| `finalized` client tag | capability must be probed | no ZORYQ finality claim |
| ZORYQ protocol finality rule | **missing** | Gate C blocked |
| Multi-node finality fault evidence | **missing** | Gate C blocked |
| included -> final p50/p95/p99 | **missing** | no finality-time claim |

## Relationship to current implementation

The current node stack uses Reth as the execution client. Gateway code may observe a successful receipt and historically describe it as `transaction_not_confirmed` when absent, but that application-level wording is not a protocol-finality definition. This document therefore establishes the conservative evidence boundary without changing the public RPC/faucet/explorer runtime.

## Next implementation requirement

Before exposing a ZORYQ `finalized` status, the protocol must first define and implement the source of finality independently of RPC response speed. Once that exists, `zoryq-developer/verification/finality-probe.mjs` can be extended from capability/inclusion measurement to true finality measurement and Gate C can be evaluated.