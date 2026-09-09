# ZORYQ Execution Interface

This interface is the migration seam between the current development executor and a future distributed ZORYQ execution/consensus stack.

## Why

The public testnet currently uses Anvil as an EVM development executor. It is useful for compatibility and product validation but it must not be confused with ZORYQ's target distributed execution architecture.

Applications and evidence tooling should depend on a small adapter contract rather than on Anvil-specific behavior. A future client can replace the backend while preserving the public EVM/RPC surface.

## Required adapter capabilities

- chain ID
- raw transaction submission
- receipt lookup
- block height
- block lookup
- state digest / roots

Future adapters add peer/consensus evidence, sync state and validator metadata without changing application semantics.

## Finality vocabulary

ZORYQ tooling now distinguishes four stages:

1. `accepted` — transaction was accepted by the submission surface; not proof of inclusion.
2. `included` — receipt exists in a block.
3. `confirmed` — configured confirmation threshold reached.
4. `final` — configured finality policy reached.

On the current Anvil-backed testnet, `final` is a **development confirmation policy**, not consensus finality. Production-grade finality claims remain blocked until a distributed consensus protocol proves a stronger irreversible-finality rule.

## Migration invariant

A replacement executor is not accepted merely because it is faster. It must pass EVM/RPC conformance, serial-equivalence/correctness, state-root comparison where applicable, restart/recovery tests, deterministic error behavior, benchmark reproducibility, and multi-node failure tests.
