# ZORYQ Evolution Payments

## Status

**Product requirement / implementation contract.**

This document defines the payment gate for prompt-based application evolution in the ZORYQ AI App Factory.

No production-payment claim is valid until the selected network, asset, Treasury address, transaction construction, receipt verification and replay protection have been independently tested with public evidence.

## Product rule

Each application evolution costs **USD 1.99**.

An evolution is a user-requested modification to an existing generated application, for example:

- add a module;
- add or change fields or validation;
- change workflows or navigation;
- add a supported capability;
- request another material prompt-based evolution of the same application.

The payment destination is the **ZORYQ Treasury**.

The user chooses the supported network and supported asset before signing.

Initial target networks:

- ZORYQ
- Base
- Arbitrum
- Ethereum

Target assets where actually supported on the selected chain:

- ETH/native EVM asset where applicable
- USDC
- USDT

Additional networks/assets may be added only through an explicit allowlist.

## Canonical user flow

`Request evolution -> Show USD 1.99 price -> Select network -> Select asset -> Resolve Treasury -> Quote -> Connect wallet -> Simulate -> Authorize -> Send -> Verify receipt -> Reconcile -> Unlock evolution -> Generate Evolution Proof`

The application MUST NOT evolve merely because a wallet returned a transaction hash.

The evolution is unlocked only after the payment verifier confirms the transaction against the expected payment intent.

## Payment intent

Before wallet authorization, create an immutable/versioned payment intent containing at minimum:

```json
{
  "version": "1",
  "evolutionId": "string",
  "appId": "string",
  "requestHash": "0x...",
  "priceUsd": "1.99",
  "chainId": 0,
  "assetType": "native|erc20",
  "assetAddress": "0x...|native",
  "treasuryAddress": "0x...",
  "quotedAmount": "string",
  "quoteSource": "string",
  "quoteTimestamp": "ISO-8601",
  "quoteExpiresAt": "ISO-8601",
  "payer": "0x...",
  "nonce": "unique-string"
}
```

`chainId`, `assetAddress` and `treasuryAddress` MUST come from an allowlisted configuration, not arbitrary user input.

The Treasury address MUST NOT be hard-coded from an unverified value. Each supported chain requires an explicitly configured Treasury destination that is checked before enabling real payment.

## Stablecoin pricing

For supported stablecoins intended to represent USD 1:1, the target charge is **1.99 units**, represented using the token's actual onchain decimals.

Examples are illustrative only; token addresses and decimals must be read from the chain allowlist.

The verifier MUST check:

- expected token contract;
- expected Treasury destination;
- expected amount;
- successful transaction receipt;
- correct chain;
- payment intent nonce/evolution ID has not already been consumed.

## Native ETH pricing

For ETH/native-asset payment, the client/server obtains a fresh USD quote and computes the native amount equivalent to USD 1.99.

Requirements:

- use an explicitly approved price source;
- display quote timestamp and expiry;
- use bounded quote lifetime;
- show network gas separately from the USD 1.99 product price;
- reject stale quotes;
- never silently change the amount after wallet confirmation.

Price-source outages must fail closed for new native-asset payment intents. Stablecoin payment may remain available if independently healthy.

## Treasury configuration

Maintain an allowlist such as:

```json
{
  "chains": {
    "zoryq": {
      "chainId": 5919065,
      "treasuryAddress": null,
      "assets": []
    },
    "base": {
      "chainId": 8453,
      "treasuryAddress": null,
      "assets": []
    },
    "arbitrum": {
      "chainId": 42161,
      "treasuryAddress": null,
      "assets": []
    },
    "ethereum": {
      "chainId": 1,
      "treasuryAddress": null,
      "assets": []
    }
  }
}
```

`null` means **payments disabled** on that chain until the Treasury address is explicitly supplied and verified.

Do not infer that the same EVM address is controlled on every chain merely because address formats match.

## Verification gate

A payment is valid only if all applicable checks pass:

1. chain ID equals the intent chain ID;
2. transaction receipt exists and status indicates success;
3. transaction is final enough for the configured chain policy;
4. recipient is the configured ZORYQ Treasury;
5. token contract/native asset matches the intent;
6. amount is at least the exact required quoted amount under the configured rule;
7. payer matches the authorized payer if payer binding is enabled;
8. `evolutionId + nonce` has not already been consumed;
9. payment was made inside the intent validity window where required;
10. no reverted/replaced transaction is represented as successful.

For ERC-20 payments, verify the relevant `Transfer` event and transaction receipt rather than trusting UI state.

For native payments, verify transaction `to`, `value`, chain and receipt.

## Replay and double-payment protection

The system MUST maintain a consumed-payment/evolution record keyed by a canonical identifier such as:

`chainId + txHash + logIndex`

and separately bind it to:

`appId + evolutionId + nonce`.

A previously consumed transaction MUST NOT unlock a second evolution.

A second payment for an already-unlocked evolution must not silently create another evolution. It should enter a clearly defined reconciliation/refund-support state.

## Evolution unlock state machine

Recommended states:

- `DRAFT`
- `AWAITING_PAYMENT`
- `PAYMENT_SUBMITTED`
- `PAYMENT_VERIFYING`
- `PAYMENT_VERIFIED`
- `EVOLUTION_QUEUED`
- `EVOLUTION_RUNNING`
- `EVOLUTION_COMPLETE`
- `PAYMENT_FAILED`
- `PAYMENT_REVIEW_REQUIRED`

Only `PAYMENT_VERIFIED` may transition to `EVOLUTION_QUEUED` for paid evolution.

## Failure behavior

The UI MUST distinguish:

- user rejected signature;
- wrong network;
- wrong asset;
- insufficient funds;
- stale quote;
- RPC unavailable;
- transaction pending;
- transaction reverted;
- wrong Treasury destination;
- wrong amount;
- payment already consumed;
- verification timeout;
- payment succeeded but evolution generation failed.

If payment succeeded but generation fails, the payment remains accounted for and the system must preserve a recoverable retry/support state instead of charging again automatically.

## Accounting and revenue evidence

Evolution revenue must be tracked separately from arbitrary Treasury inflows.

Each verified evolution payment record should contain:

- evolution ID;
- application ID;
- payer public address;
- chain ID;
- asset;
- amount;
- USD product price at purchase;
- Treasury destination;
- transaction hash;
- log index when relevant;
- block number/hash;
- receipt status;
- verification timestamp;
- request hash;
- evolution result/version;
- reconciliation status.

Public metrics may report only verified records and should clearly distinguish payment count from unique paying users.

## Evolution Proof

After successful evolution, generate a machine-readable proof containing:

```json
{
  "evolutionId": "...",
  "appId": "...",
  "fromVersion": "...",
  "toVersion": "...",
  "requestHash": "0x...",
  "payment": {
    "chainId": 0,
    "asset": "...",
    "amount": "...",
    "treasury": "0x...",
    "txHash": "0x...",
    "receiptStatus": 1
  },
  "generatedAt": "..."
}
```

Do not include private keys, seed phrases, wallet secrets or privileged infrastructure credentials.

## UX requirements

The payment step should visibly show:

- `Evolution — $1.99`
- selected network;
- selected asset;
- Treasury destination in inspectable form;
- product price;
- estimated network fee separately;
- quote expiry for native-asset payments;
- explicit wallet authorization;
- transaction hash after submission;
- `Payment verified onchain` only after verification succeeds;
- link to the appropriate explorer where available;
- Evolution Proof after completion.

Preferred CTA sequence:

`EVOLVE -> CHOOSE NETWORK -> CHOOSE ASSET -> CONNECT WALLET -> REVIEW -> PAY & EVOLVE`

## Security invariants

- Treasury addresses and token contracts are allowlisted.
- No arbitrary destination can be supplied by the browser/client.
- No seed/private key is collected or stored by ZORYQ services.
- Payment intent has a unique nonce and replay domain.
- Quote has a bounded lifetime.
- Receipt is checked before unlock.
- ERC-20 transfer logs are checked where applicable.
- Wrong-chain payment does not satisfy the intent.
- Wrong-asset payment does not satisfy the intent.
- Wrong-destination payment does not satisfy the intent.
- Underpayment does not satisfy the intent.
- Consumed payment cannot be replayed.
- Accounting reconciles verified payment records against chain evidence.
- Emergency disable switch exists per network and per asset.

## Rollout gates

### Gate 0 — specification

- [x] USD 1.99 product rule defined
- [x] Treasury is the payment destination
- [x] user-selectable network/asset model defined
- [x] receipt/replay/accounting invariants defined

### Gate 1 — configuration

- [ ] Treasury address explicitly provided and verified for each enabled network
- [ ] token contracts/decimals verified for each enabled network
- [ ] approved quote source configured for native ETH payments
- [ ] per-chain confirmation/finality policy configured

### Gate 2 — implementation

- [ ] payment-intent endpoint/state implemented
- [ ] wallet network switching implemented
- [ ] native payment transaction builder implemented
- [ ] ERC-20 transfer transaction builder implemented
- [ ] verifier implemented
- [ ] replay/double-payment store implemented
- [ ] evolution unlock gate implemented
- [ ] accounting/reconciliation implemented
- [ ] emergency disable implemented

### Gate 3 — adversarial tests

- [ ] wrong chain rejected
- [ ] wrong Treasury rejected
- [ ] wrong token rejected
- [ ] underpayment rejected
- [ ] reverted transaction rejected
- [ ] forged tx hash rejected
- [ ] replay rejected
- [ ] stale quote rejected
- [ ] duplicate evolution unlock rejected
- [ ] payment-success/evolution-failure recovery tested

### Gate 4 — public evidence

- [ ] reproducible test payment on each enabled network/asset path
- [ ] public receipt evidence
- [ ] successful evolution unlocked from verified payment
- [ ] Evolution Proof generated
- [ ] independent external reproduction

Until Gate 4 evidence exists, describe the capability as implementation/experimental work rather than verified production monetization.

## Relationship to ZORYQ Autonomous

This protocol follows the same core evidence discipline as ZORYQ Autonomous:

`Intent -> Simulate -> Authorize -> Execute -> Verify -> Reconcile -> Proof`

It therefore provides a reusable real-payment primitive for future ZORYQ products while keeping application-evolution revenue distinguishable from Autonomous Company task payments and other Treasury flows.
