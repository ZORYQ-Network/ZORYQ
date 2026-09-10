# ZORYQ Architecture

## Purpose

ZORYQ currently combines a developing blockchain/network track with a mobile-first Web3 application track. The architecture must keep these layers explicit so product functionality is not confused with protocol evidence.

## System map

```text
Users / Developers
        |
        +--------------------+
        |                    |
  ZORYQ Applications    Developer / RPC clients
        |                    |
 Wallet / Swap / Social      |
 XP / Mobile / Identity      |
        |                    |
        +------ Provider / Network Boundary ------+
                             |
                    ZORYQ Network / Testnet
                             |
          RPC -> admission -> execution -> state
                             |
                  consensus / finality
                             |
                    storage / networking
```

The lower protocol path above is a target architecture map. Individual components are considered implemented only when corresponding source, configuration and tests are present and reviewable.

## Track A — Network / protocol

Protocol engineering should progressively make these components explicit:

- network identity and chain configuration;
- peer-to-peer networking;
- RPC and transaction admission;
- mempool/pipeline behavior;
- execution engine;
- EVM compatibility boundary;
- state transition engine;
- consensus and finality;
- storage, snapshots and recovery;
- observability;
- proof/verifiability layer where research proves useful.

Normative behavior belongs in `SPECIFICATION.md` and accepted RFC/ADR artifacts. Research hypotheses belong under `research/` until validated.

## Track B — Application platform

### Mobile

React Native + Expo architecture. Expo Router may organize routes. Sensitive state and visual/UI state should not share insecure storage.

### Wallet layer

A `WalletProvider` abstraction can support embedded wallets, smart accounts and external wallets. Private keys and seed phrases must never transit through the ZORYQ backend.

### Swap layer

A `QuoteProvider` abstraction normalizes supported aggregators/bridges. The UI should receive identifiable quotes with validity, fee, gas, price impact and execution payload information before signing.

### Social layer

Authenticated APIs handle posts, follows, messages, report/block and media. Authorization must be enforced server-side; client state is not an authorization boundary.

### XP engine

Prefer immutable events → versioned rules → derived balance → optional snapshots. XP integrity must not depend on client-only updates.

### Integrations

External providers receive only necessary scopes/data. OAuth integrations should use platform-appropriate secure flows such as PKCE when applicable.

## Transaction UX boundary

For an application-mediated transaction:

1. user selects an operation;
2. app requests route/quote or constructs the requested transaction;
3. returned data is validated and time-bounded where relevant;
4. app presents costs, destination and material risk;
5. wallet requests explicit local confirmation;
6. user signs locally;
7. client observes network status;
8. backend records only permitted metadata;
9. reward logic evaluates only eligible verifiable events.

This flow does not define ZORYQ consensus or canonical protocol transaction semantics; those require separate specification.

## Security boundaries

- zero-trust assumptions between modules where practical;
- least privilege;
- no seed/private key in backend, logs, analytics or crash reporting;
- explicit input validation at RPC/API boundaries;
- risky features behind controlled rollout/rollback mechanisms;
- isolated `dev`, `staging`, `testnet` and production environments as they become applicable;
- security-sensitive protocol changes require threat-model review.

## Research boundary

Future work such as adaptive execution, dependency graphs, proof receipts, congestion isolation and streaming finality must remain labeled as research until specification, prototype, tests, benchmark and risk analysis exist.

See `../PROTOCOL.md`, `../SPECIFICATION.md`, `../RESEARCH.md` and `SECURITY_THREAT_MODEL.md`.
