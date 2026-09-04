# ZORYQ Genesis & Treasury Architecture v1

Status: DRAFT — do not use for production funds before audit and final parameter approval.

## 1. Principle

ZORYQ Chain, ZORYQ Wallet, the pre-mainnet token and the future mainnet must share one supply accounting model, one address registry and one security policy. No production key or recovery phrase belongs in source code, CI, chat logs or databases.

## 2. Solo-founder signer model

ZORYQ is currently developed by one founder. The recommended treasury setup is therefore **2-of-3 keys controlled by one founder but held on separate devices and in separate physical locations**. This does not provide organizational decentralization, but it removes the single-key failure mode.

Suggested setup:

- Signer A — primary hardware wallet, used for normal approvals.
- Signer B — second hardware wallet, stored separately and used only for treasury approvals/recovery.
- Signer C — offline emergency signer, stored in a sealed backup location.
- Threshold — 2 of 3.

Rules:

- Never keep two signer recovery phrases in the same physical place.
- Never import treasury signer seeds into browser extensions used for daily browsing.
- Never use the deployer EOA as treasury.
- Operations wallet may be 1-of-1 but must hold only a small working balance.
- When ZORYQ gains trusted contributors, migrate signer control to independent people/entities.

## 3. Required treasury compartments

The following addresses/vaults must be separate even when ultimately governed by the same Safe/multisig policy:

1. `TREASURY_CORE` — strategic reserve and long-term treasury.
2. `ECOSYSTEM_GRANTS` — dApp grants, hackathons and developer incentives.
3. `COMMUNITY_REWARDS` — testnet/mainnet campaigns, XP and community rewards.
4. `VALIDATOR_INCENTIVES` — validator bootstrap and staking incentives.
5. `LIQUIDITY_RESERVE` — DEX/CEX liquidity only.
6. `TEAM_VESTING` — founder/team allocation behind vesting contracts.
7. `STRATEGIC_VESTING` — future investors/partners, if any.
8. `OPERATIONS` — limited hot wallet for ordinary expenses.
9. `MIGRATION_ESCROW` — pre-mainnet token migration accounting.
10. `EMERGENCY_GUARDIAN` — restricted emergency authority; must not be able to freely seize user funds.

## 4. Pre-mainnet token policy

If ZQ launches first on an EVM network (for example Base or Arbitrum), it must be explicitly documented as a **pre-mainnet representation**.

Recommended properties:

- Token symbol: `ZQ`
- Standard: ERC-20
- Decimals: 18
- Fixed supply at deployment
- No arbitrary owner mint after deployment
- No hidden transfer tax
- No blacklist/freeze unless a future legal/compliance requirement explicitly justifies it
- Contract source verified publicly
- Treasury receives the initial supply and distributes only according to published allocations

The final supply number is intentionally **not fixed in this draft**. It must be approved before deployment and then mirrored in ZORYQ Mainnet genesis accounting.

## 5. 1:1 migration rule

The intended migration policy is:

`1 ZQ pre-mainnet surrendered = 1 ZQ native mainnet entitlement`

The migration contract should escrow (or burn, if formally chosen) pre-mainnet ZQ and emit an immutable event containing:

- EVM sender
- amount
- destination ZORYQ `zq1...` address
- timestamp/block
- migration nonce/id

At mainnet launch, native claims are created only from validated migration records. A token cannot be spendable on both networks while simultaneously counting twice toward circulating native supply.

## 6. Supply conservation

Define:

`GENESIS_SUPPLY = uncirculated_native_reserve + migrated_entitlements + genesis_allocations`

Pre-mainnet tokens that remain transferable outside the migration system must be accounted for separately. Never represent the same economic unit as fully circulating on both networks without a lock/burn backing model.

## 7. ZORYQ Mainnet genesis registry

Before mainnet, publish a signed registry containing:

- chain name
- chain ID
- network/version
- native symbol and decimals
- total genesis supply
- validator genesis set
- treasury `zq1...` addresses
- vesting contract/module addresses
- migration root/snapshot reference
- RPC endpoints
- explorer URL
- release hashes for node software and wallet builds

## 8. Address registry

No real address is invented in documentation. Fill these only after wallets/vaults are created and independently verified:

```text
EVM_DEPLOYER=
EVM_TREASURY_SAFE=
EVM_OPERATIONS=
EVM_PREMAINNET_ZQ=
EVM_MIGRATION_ESCROW=
EVM_TEAM_VESTING=
EVM_ECOSYSTEM_VAULT=

ZORYQ_TREASURY_CORE=
ZORYQ_ECOSYSTEM_GRANTS=
ZORYQ_COMMUNITY_REWARDS=
ZORYQ_VALIDATOR_INCENTIVES=
ZORYQ_LIQUIDITY_RESERVE=
ZORYQ_OPERATIONS=
ZORYQ_EMERGENCY_GUARDIAN=
```

Every production address must be verified on at least two independent displays/sources before funding.

## 9. Ownership and admin policy

- Production contracts should avoid upgradeability unless a strong reason exists.
- If upgradeability is introduced, upgrades require multisig + timelock + public notice.
- Token ownership/admin, if any, points to treasury governance rather than the deployer EOA.
- Deployer key should be retired from privileged roles after deployment.
- Emergency functions must be narrow, documented and testable.

## 10. Wallet/Chain harmony

The same network constants must be consumed by ZORYQ Wallet, Explorer, SDK and nodes:

- address prefix `zq`
- chain ID
- token symbol `ZQ`
- decimals
- transaction canonical encoding
- signature domain/version
- fee units
- RPC method names

A release must fail CI when wallet and chain network constants disagree.

## 11. Production gates

No mainnet or real-money token deployment until all are true:

- tokenomics approved and frozen
- contracts tested
- migration flow tested end-to-end on testnet
- independent smart-contract review/audit
- chain consensus/network review
- recovery drill for treasury signer loss
- restore drill for ZORYQ Wallet seed
- documented incident response
- verified contract source and reproducible build hashes
- legal/tax review appropriate to launch jurisdictions

