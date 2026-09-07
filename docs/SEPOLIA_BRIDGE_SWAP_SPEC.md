# ZORYQ Sepolia Bridge + Swap Lab

## Goal
Enable users to bring test ETH from Ethereum Sepolia into the ZORYQ EVM Testnet as a representation token (`zETH`) and use it inside the ZORYQ Swap Lab.

## Scope
Testnet only. This design does not represent production-grade trust-minimized bridging and does not imply financial value.

## Target user flow
1. Connect wallet on Ethereum Sepolia.
2. Deposit Sepolia ETH into a Sepolia-side bridge contract.
3. Relayer/indexer detects the deposit event.
4. Relayer submits proof/reference to the ZORYQ-side bridge contract.
5. ZORYQ-side contract mints `zETH` 1:1 to the same wallet on ZORYQ.
6. User swaps `zETH`, `ZQ`, and `zUSD` inside ZORYQ Swap Lab.
7. For withdrawal, user burns `zETH` on ZORYQ.
8. Relayer observes burn and releases matching Sepolia ETH back to the user.

## Networks
### Ethereum Sepolia
- Native asset: ETH
- Purpose: source/sink test asset

### ZORYQ EVM Testnet
- Chain ID: 5919065
- Native asset: ZQ
- Wrapped bridge asset: zETH
- Existing lab asset: zUSD

## Contracts
### SepoliaBridgeVault
Responsibilities:
- Accept ETH deposits.
- Emit deterministic deposit events with nonce/deposit id.
- Release ETH on authorized withdrawal completion.
- Prevent duplicate withdrawal ids.
- Emergency pause for Testnet operations.

### ZoryqBridgedETH (zETH)
Responsibilities:
- ERC-20 representation of Sepolia ETH.
- 18 decimals.
- Mint/burn restricted to bridge controller.

### ZoryqBridgeController
Responsibilities:
- Mint zETH from valid Sepolia deposit references.
- Burn zETH for withdrawals.
- Prevent duplicate deposit ids/proof references.
- Emit bridge lifecycle events.
- Keep bridge admin separate from user wallets.

## Relayer
Initial Testnet relayer may be centralized but must:
- Never receive or store user wallet private keys.
- Use an isolated bridge service key only for bridge contract authorization.
- Verify chain ID, contract address, event signature, amount, recipient and deposit id.
- Persist processed deposits/withdrawals atomically.
- Be replay-safe and idempotent.

## Swap integration
Add zETH routes to Swap Lab:
- zETH <-> ZQ
- zETH <-> zUSD
- Optional multi-hop routing when direct reserves are unavailable.

For the first Testnet implementation, fixed-price lab routing is acceptable. Do not present it as a production AMM.

## Wallet UX
Wallet must expose a `Bridge / Sepolia ETH` entry with:
- Current network indicator.
- Sepolia ETH balance.
- zETH balance on ZORYQ.
- Deposit amount.
- Estimated received zETH.
- Deposit/withdrawal status.
- Source and destination transaction hashes.
- Clear label: `Testnet assets only — no monetary value`.

## Explorer
Explorer should identify bridge events:
- Sepolia deposit reference.
- ZORYQ zETH mint.
- zETH burn.
- Sepolia release reference.

## Security requirements before public Testnet
- Reentrancy guard on value-moving bridge functions.
- Pausable bridge operations.
- Replay protection for every deposit/withdrawal id.
- Daily and per-transaction Testnet limits.
- Separate bridge operator role.
- Admin ownership transfer events.
- No seed phrases/private keys in repository, client app or public config.
- Relayer secret stored only in deployment secret manager.

## Reward / Score integration
Bridge participation may create proof-of-participation evidence for ZORYQ Score, but:
- Bridge usage alone must not finalize points on the client.
- Score finalization must occur through the authorized reward finalization path.
- No guaranteed token, airdrop or monetary reward.

## Implementation phases
### Phase 1 — Contracts and tests
- zETH ERC-20.
- SepoliaBridgeVault.
- ZoryqBridgeController.
- Unit tests for replay, mint/burn, limits, ownership and pause.

### Phase 2 — Relayer
- Sepolia event watcher.
- ZORYQ event watcher.
- Idempotent persistence.
- Health endpoint and reconciliation routine.

### Phase 3 — Product integration
- Wallet bridge screen.
- zETH in Swap Lab.
- Explorer bridge labels.
- Bridge transaction history.

### Phase 4 — Public Testnet hardening
- Operator key isolation.
- Rate limits.
- Recovery/reconciliation procedure.
- End-to-end Sepolia -> ZORYQ -> Swap -> withdraw test.

## Definition of done
The feature is considered testable only when a user can complete:

`Sepolia ETH -> deposit -> zETH on ZORYQ -> swap -> burn zETH -> Sepolia ETH release`

with both-chain transaction references and no user private key leaving the wallet.
