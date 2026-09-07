# ZORYQ Sepolia ETH -> ZQ Testnet Exchange

## Goal
Allow a user to send test ETH on Ethereum Sepolia to a dedicated ZORYQ Sepolia treasury flow and receive ZQ on the ZORYQ EVM Testnet after the source transaction is independently verified.

## Scope and legal/product boundary
- Testnet only.
- Sepolia ETH and ZQ Testnet are test assets and must be presented as having no monetary value.
- This is a Testnet exchange/faucet mechanism, not a trust-minimized bridge, investment product, token sale, promise of return, or representation of future Mainnet ZQ.
- Participation must not create any entitlement to future tokens, airdrops, profits or Mainnet assets.

## User flow
1. User connects the same EVM wallet identity used for ZORYQ.
2. Wallet switches to Ethereum Sepolia.
3. UI shows the current Testnet quote, limits and destination ZQ amount before confirmation.
4. User sends Sepolia ETH to a dedicated Sepolia-side ZORYQ treasury/vault contract.
5. The verifier waits for a configurable confirmation threshold and validates chain ID, vault address, event, sender, recipient, amount and deposit id.
6. The source transaction hash/deposit id is atomically marked as processed before fulfillment.
7. ZQ Testnet is delivered on ZORYQ Chain to the destination address recorded in the deposit event.
8. UI shows both the Sepolia source transaction and ZORYQ fulfillment transaction.

## Networks
### Ethereum Sepolia
- Chain ID: 11155111
- Asset received: test ETH
- Destination: dedicated Testnet treasury/vault contract; do not use a personal EOA as the public deposit endpoint.

### ZORYQ EVM Testnet
- Chain ID: 5919065
- Asset delivered: native ZQ Testnet
- ZQ Testnet has no monetary value and is not a claim on any future Mainnet token.

## Sepolia contract: ZoryqTestnetExchangeVault
Responsibilities:
- Accept deposits through an explicit payable deposit function, not ambiguous raw transfers.
- Record the intended ZORYQ recipient in the deposit event.
- Generate monotonic deposit IDs/nonces.
- Emit amount, sender, recipient and deposit ID.
- Pausable.
- Reentrancy protected.
- Enforce configurable minimum/maximum deposits and rate limits where practical.
- Treasury withdrawal restricted to a secured admin/multisig role.
- Emit administrative/configuration events.

## Fulfillment service
The initial Testnet fulfillment service may be centralized, but must:
- Never receive or store a user's seed phrase or private key.
- Use a dedicated least-privilege service credential, isolated from treasury/admin credentials.
- Verify Sepolia chain ID, finalized/confirmed receipt, canonical vault address, event signature, deposit ID, sender, ZORYQ recipient and amount.
- Reject failed/reverted transactions.
- Reject duplicate tx hashes and duplicate deposit IDs.
- Persist processing state atomically and idempotently.
- Use states such as observed -> confirmed -> reserved -> fulfilled, with reconciliation after crashes.
- Record the ZORYQ fulfillment tx hash.
- Apply per-wallet, per-transaction and rolling-period Testnet limits.
- Stop automatically if RPC/network consistency checks fail.

## Quote model
The Testnet conversion rate is configurable and explicitly synthetic. Example only:
`0.01 Sepolia ETH -> 1,000 ZQ Testnet`

The production UI must not imply a market price. Quote changes must be versioned/auditable and a deposit must bind to the quote/rate policy accepted at submission time or use a clearly disclosed deterministic rule.

## ZQ fulfillment
For the first implementation, fulfillment may use a dedicated funded ZQ Testnet distributor account with strict limits. It must not use the core admin/treasury key directly in an internet-facing service. A later version should use a dedicated on-chain distributor contract with role-based authorization, pause, quotas and replay-proof fulfillment IDs.

## Wallet UX
Add `Get ZQ with Sepolia ETH`:
- Sepolia ETH balance.
- Current synthetic Testnet quote.
- Amount to send.
- Estimated ZQ Testnet received.
- Minimum/maximum and rolling limits.
- Destination ZORYQ address.
- Source transaction status and confirmations.
- ZORYQ fulfillment transaction.
- Explicit label: `Testnet assets only — no monetary value`.
- Explicit label: `Does not create a right to future Mainnet ZQ or an airdrop`.

## Explorer / audit trail
Where practical, expose:
- Deposit ID.
- Sepolia source tx hash/reference.
- ZORYQ recipient.
- ZQ amount fulfilled.
- ZORYQ fulfillment tx hash.
- Fulfillment status.
Never expose service credentials or sensitive internal metadata.

## Security gates before public Testnet
- Contract unit tests and adversarial tests.
- Reentrancy protection.
- Pause/emergency stop.
- Replay protection for tx hash and deposit ID.
- Confirmation threshold.
- Chain-ID and contract-address pinning.
- Per-wallet/per-transaction/rolling limits.
- Idempotent fulfillment and crash recovery.
- Dedicated service key, separate treasury/admin roles.
- Secrets only in a deployment secret manager.
- No private keys, mnemonics or secrets in repo/client/public configuration.
- Monitoring for abnormal deposit/fulfillment ratios.
- Manual emergency reconciliation procedure.

## Mainnet policy — mandatory future gate
This Testnet mechanism MUST NOT be copied directly to Mainnet.
Before any real-value ETH -> ZQ mechanism or ZQ sale on Mainnet:
1. Define token legal classification, issuer/entity structure and applicable jurisdictions.
2. Obtain qualified legal/compliance review for Brazil and every intended distribution jurisdiction.
3. Assess securities/investment-contract, virtual-asset/VASP, payments/exchange, AML/KYC, sanctions, consumer-protection, tax, privacy/data-protection and marketing obligations as applicable.
4. Define transparent tokenomics, supply, treasury policy, pricing/liquidity mechanism, vesting, disclosures and conflicts.
5. Use audited production contracts, multisig/role separation, timelocks where appropriate, monitoring, incident response and independent security review.
6. Do not market guaranteed appreciation, returns, profit, future exchange listing or guaranteed airdrops.
7. Publish terms/risk disclosures and obtain any registrations, licenses or approvals that qualified counsel determines are required before launch.
8. Reassess requirements immediately before Mainnet because laws, regulatory guidance and product design can change.

This repository policy is a product/security gate, not legal advice and not a declaration that a Mainnet sale is lawful.

## Implementation phases
### Phase 1
- Sepolia vault contract.
- Tests for deposit IDs, limits, pause, admin controls and reentrancy.
- ZORYQ distributor contract or tightly limited Testnet distributor design.

### Phase 2
- Sepolia watcher/verifier.
- Confirmation policy.
- Idempotent fulfillment database/state.
- ZORYQ fulfillment and reconciliation.

### Phase 3
- Wallet screen.
- Explorer/history integration.
- End-to-end Testnet monitoring.

### Phase 4
- Threat-model review.
- Key/role isolation.
- Abuse/rate limiting.
- Failure recovery drills.
- Public Testnet launch only after E2E verification.

## Definition of done
`Sepolia ETH -> verified vault deposit -> ZQ Testnet fulfillment`
works end-to-end with source/destination transaction references, replay protection, limits, recovery, no user private key leaving the wallet, and clear Testnet/no-value disclosures.