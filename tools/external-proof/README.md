# ZORYQ External First-Transaction Proof

This tool exists to make the first independent developer reproduction simple and evidence-first.

It performs:

`fresh wallet -> public faucet -> RPC balance -> signed transaction -> successful receipt`

The wallet private key is generated in process memory, is never printed, and is not written to disk by this tool.

## Requirements

- Node.js 20+
- npm
- normal Internet access to the public ZORYQ testnet endpoints

## Run

```bash
cd tools/external-proof
npm install
npm run prove
```

Optional endpoint overrides:

```bash
ZORYQ_RPC_URL="https://.../rpc" \
ZORYQ_FAUCET_URL="https://.../faucet/claim" \
npm run prove
```

## Successful evidence

A successful run prints JSON containing only non-secret evidence such as:

- UTC timestamps;
- Chain ID;
- public fresh-wallet address;
- faucet HTTP outcome and faucet transaction hash;
- observed funded balance;
- signed transaction hash/from/to/value;
- receipt block number and status.

A successful proof requires `chainId=5919065`, funded balance greater than zero, and receipt `status=1`.

## Failure is useful evidence

If the faucet returns 4xx/5xx, rate limits, fails to fund the wallet, or the transaction fails, publish the non-secret output/error to Issue #55. Do not work around public controls with privileged credentials.

## Never publish

- wallet private key;
- seed phrase;
- infrastructure credential;
- faucet signing key;
- provider token;
- private discovery secret.

## Independence boundary

For the external-developer milestone, the person running this tool must not be acting as the ZORYQ primary infrastructure operator. A core-team run is useful regression evidence but does not satisfy the independent-developer gate.
