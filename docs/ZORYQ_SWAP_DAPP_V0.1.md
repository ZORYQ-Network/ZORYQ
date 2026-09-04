# ZORYQ Swap dApp v0.1 — Testnet

Official Testnet dApp URL:

`https://juordakzclqefpuauzjq.supabase.co/functions/v1/zoryq-testnet/swap`

## Pair
- ZQ / tUSDC
- Constant-product AMM
- 0.30% swap fee
- 0.50% default minimum-output tolerance in the current UI
- Minimum swap amount: 1 token

## Wallet connection
The dApp uses the injected `window.zoryq` provider from ZORYQ Wallet Browser Extension v0.4+.

Required provider methods:
- `zoryq_requestAccounts`
- `zoryq_signMessage`
- `zoryq_signTransaction`

No seed or private key is sent to the dApp or Testnet API.

## Testnet farming
- Main ZQ faucet remains 25 test ZQ + 50 points with 24h cooldown.
- Swap dApp includes a one-time faucet of 1,000 tUSDC + 10 points per wallet.
- A confirmed eligible swap awards 5 points.
- Rewarded swaps are capped at 20 per wallet per UTC day; swaps continue to work after the points cap.
- ZQ and tUSDC are Testnet assets with no financial value.

## Signed swap transaction
The wallet signs a transaction using `zoryq-tx-v1:` and ML-DSA-65. Example unsigned payload:

```json
{
  "version": 1,
  "chain_id": "zoryq-testnet-1",
  "type": "swap",
  "from": "zq1...",
  "token_in": "ZQ",
  "token_out": "tUSDC",
  "amount_in": 10,
  "min_out": 9.9,
  "fee": 0,
  "nonce": 0,
  "timestamp": 0
}
```

The wallet adds `pubkey_format`, `pubkey`, and `signature`. The Testnet API verifies the ML-DSA-65 signature and sender address before executing the AMM state transition.

## Current architecture note
This is a functional Testnet AMM running on the shared ZORYQ Testnet ledger/API. It is not yet a mainnet smart contract or production DEX and must not be presented as one.