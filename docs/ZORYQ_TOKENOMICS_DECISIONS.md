# ZORYQ Tokenomics Decision Register

Status: DRAFT. Values marked `TBD` must not be deployed until explicitly approved.

## Fixed protocol choices proposed

| Parameter | Proposed value |
|---|---|
| Native symbol | ZQ |
| Native address prefix | zq |
| Pre-mainnet token standard | ERC-20 |
| Pre-mainnet decimals | 18 |
| Migration ratio | 1:1 |
| Pre-mainnet minting | Fixed supply at deployment; no later mint |
| Transfer tax | None |
| Blacklist | None by default |
| Faucet test reward | 25 test ZQ |
| Faucet points | +50 |
| Faucet cooldown | 24 hours per authenticated wallet |

## Economic values requiring founder approval

- Maximum/genesis supply: `TBD`
- Initial circulating supply: `TBD`
- Community rewards allocation: `TBD`
- Ecosystem grants allocation: `TBD`
- Validator incentives allocation: `TBD`
- Liquidity allocation: `TBD`
- Founder/team allocation: `TBD`
- Founder/team cliff: `TBD`
- Founder/team vesting duration: `TBD`
- Strategic/partner allocation: `TBD`
- Treasury reserve: `TBD`

## Recommended allocation constraints

These are guardrails, not final tokenomics:

1. Founder/team tokens should not be fully liquid at TGE.
2. Community/ecosystem allocations should have transparent release mechanics.
3. Liquidity reserves must be separated from operating treasury.
4. No hidden mint authority should exist after the fixed-supply token is deployed.
5. Mainnet genesis must reconcile every pre-mainnet migrated entitlement 1:1.
6. Testnet points must not be represented as guaranteed financial value or guaranteed future token allocation.

## Freeze procedure

Before a real token deployment:

1. Fill every `TBD`.
2. Confirm percentages total exactly 100%.
3. Confirm token units match 18 decimals on EVM and the selected native mainnet precision.
4. Publish the final allocation table.
5. Tag the repository commit containing the frozen tokenomics.
6. Deploy only from the audited/frozen commit.
