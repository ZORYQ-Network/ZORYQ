# ZORYQ Specification Framework

> Status: **incomplete / experimental**. This file defines how the ZORYQ protocol specification should be written; it is not yet a complete implementable protocol specification.

## Specification requirements

A specification section is considered implementation-grade only when it defines:

- inputs and outputs;
- deterministic behavior;
- validation rules;
- error/rejection behavior;
- state transitions;
- serialization/encoding where relevant;
- security assumptions;
- compatibility/versioning rules;
- test vectors or conformance tests.

## Normative language

Use **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** only for behavior that is actually intended to be normative.

Research ideas should use non-normative language until accepted through the RFC/ADR process.

## Planned specification map

1. Network identity and chain configuration
2. Accounts and addresses
3. Transactions
4. Mempool admission
5. Execution semantics
6. State model
7. Block/proposal format
8. Consensus
9. Confirmation and finality
10. Peer-to-peer networking
11. Synchronization
12. Snapshots and recovery
13. RPC
14. Smart-contract/EVM compatibility
15. Fees and resource accounting
16. Upgrades and version negotiation
17. Cryptographic primitives
18. Security limits and denial-of-service controls
19. Test vectors
20. Conformance criteria

## Compatibility claims

Any EVM compatibility claim should state the tested scope and version/fork assumptions. Compatibility is not binary: unsupported opcodes, RPC differences, gas behavior, precompiles, transaction types and edge cases must be documented.

## Independent implementation goal

Long term, the specification should be precise enough that a second implementation can reproduce consensus-critical behavior without reading the reference client's internals.
