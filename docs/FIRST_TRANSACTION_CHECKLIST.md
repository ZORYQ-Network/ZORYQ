# ZORYQ First Transaction — External Reproduction Checklist

This checklist defines the evidence required to move the ZORYQ developer funnel from **Faucet → First Transaction** out of P0 hardening.

> ZORYQ is an experimental public testnet. This is a verification checklist, not a production-readiness claim.

## Canonical network identity

- Network: **ZORYQ Testnet**
- Chain ID: `5919065`
- Native test currency: `ZQ`
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Faucet entry point: `https://zoryq-evm-node-live-production.up.railway.app/start`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Independent registry evidence: `ethereum-lists/chains` PR #8687

The URLs above are public registry values. Their publication does **not** by itself prove availability or reliability.

## Reproduction gate

A successful external reproduction must show all of the following:

- [ ] Create a fresh wallet whose private key has never been used by ZORYQ infrastructure.
- [ ] Use only the documented public faucet path; do not use a privileged treasury transfer.
- [ ] Record the faucet request time and the public response/error class, without publishing secrets.
- [ ] Query the wallet balance through the canonical RPC and show `balance > 0`.
- [ ] Sign a real testnet transaction with the fresh wallet.
- [ ] Broadcast it through the canonical RPC.
- [ ] Record the transaction hash.
- [ ] Retrieve `eth_getTransactionReceipt` and verify `status = 0x1`.
- [ ] Confirm the transaction through the public explorer when available.
- [ ] Record client/tool version and any failure encountered.

## Evidence to publish

A valid proof should contain:

1. UTC timestamp;
2. fresh public wallet address;
3. chain ID;
4. faucet path used;
5. pre/post balance observations;
6. transaction hash;
7. receipt status;
8. client/tool and version;
9. concise reproduction steps;
10. limitations or errors encountered.

**Never publish a private key, seed phrase, signing secret, infrastructure credential, or privileged faucet/treasury secret.**

## Failure taxonomy

If reproduction fails, classify the failure rather than hiding it:

- `FAUCET_UNREACHABLE` — public faucet cannot be reached;
- `FAUCET_INVALID_REQUEST` — documented request shape is rejected;
- `FAUCET_RATE_LIMITED` — legitimate fresh-wallet request is throttled;
- `FAUCET_COOLDOWN` — address is under documented cooldown;
- `FAUCET_NO_FUNDS` — request is accepted but balance does not increase;
- `RPC_UNREACHABLE` — canonical RPC cannot be reached;
- `RPC_BALANCE_MISMATCH` — faucet reports success but RPC balance disagrees;
- `TX_REJECTED` — signed transaction is rejected;
- `RECEIPT_MISSING` — accepted transaction does not produce a retrievable receipt;
- `RECEIPT_FAILED` — receipt exists with unsuccessful status;
- `EXPLORER_MISMATCH` — RPC evidence and explorer presentation disagree.

Failures are engineering evidence. Do not weaken anti-abuse controls or evidence gates simply to make this checklist pass.

## Definition of done

This gate is complete only after at least one **independent external developer** reproduces:

`fresh wallet → public faucet → RPC balance > 0 → signed transaction → receipt status 0x1`

and publishes enough non-secret evidence for another developer to verify the result.

After that, upgrade `docs/DEVELOPER_ONBOARDING.md` into a copy-paste zero-to-build tutorial and proceed to the next gate: **First Contract**.
