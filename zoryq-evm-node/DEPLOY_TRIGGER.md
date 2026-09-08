# ZORYQ EVM Testnet deployment trigger

Railway production service: `zoryq-evm-node-live`.

This file intentionally participates in the Railway watch pattern `zoryq-evm-node/**` so safe web/backend changes packaged by the root Docker image can trigger a fresh public Testnet deployment without creating another Railway service.

Current release intent:
- serve the advanced Genesis onboarding bundle;
- show pending vs verified vs finalized Score distinctly;
- show per-wallet Genesis progress and verification history;
- keep X social actions pending until OAuth/API verification exists;
- preserve Faucet → Swap → Stake → Explorer as the core Testnet flow.

Trigger generation: genesis-progress-history-2026-09-08
