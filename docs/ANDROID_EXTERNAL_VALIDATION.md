# ZORIQ Android External Validation Protocol

This protocol is for developers and testers who want to independently reproduce the **ZORIQ Social → ZORYQ Wallet → ZORYQ Testnet** onboarding path.

The objective is not to produce a positive review. Failures, UX problems and security concerns are valid and useful results.

## Scope

Validate that a clean Android installation can progress from the ZORIQ social application to a self-custody test wallet and complete one verifiable ZORYQ Testnet transaction.

ZORYQ EVM Testnet parameters:

- Chain ID: `5919065`
- Native test symbol: `ZQ`
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet`

> Testnet only. ZQ has no monetary value. Never use a wallet containing real assets for this validation.

## Candidate build

Use the newest successful **Build ZORIQ Social + ZORYQ Wallet APK** artifact from GitHub Actions.

For the currently documented candidate:

- Commit: `b96d5e0ca3e46a9c692a2c30146406e40efd1340`
- Workflow run: `34616604067`
- Artifact: `ZORIQ-Social-ZORYQ-Wallet-APK-121`
- GitHub artifact archive digest: `sha256:371173badd5ebf226d72ddd391d73a9e7547a708e97c5cb2590bd5b3cf09ebb5`

If a newer successful artifact exists, use it and record its commit, workflow run and digest instead.

## Clean-install procedure

1. Use a clean Android emulator or a device where ZORIQ application data has been removed.
2. Record the Android version and device/emulator model.
3. Download the APK only from the repository's GitHub Actions artifact.
4. Record the workflow run and artifact digest before installation.
5. Install and launch the APK.
6. Confirm ZORIQ Social opens without a fatal startup error.
7. Open **Wallet / Recovery**.
8. Create a new wallet dedicated to this test. Do not import a wallet containing real assets.
9. Store the recovery phrase offline only if needed for the test. Never post it in GitHub, screenshots, chat, analytics or a bug report.
10. Confirm the wallet is using **ZORYQ EVM Testnet** and Chain ID `5919065`.
11. Request test ZQ through the supported faucet flow.
12. Record the faucet transaction hash if one is returned.
13. Send a small testnet transaction from the locally controlled wallet.
14. Record the transaction hash.
15. Verify inclusion through the explorer and/or JSON-RPC `eth_getTransactionReceipt`.
16. Restart the app and confirm the expected wallet address remains available before considering persistence successful.

## Evidence template

Post results to Issue #54 using this template:

```text
Result: PASS / PARTIAL / FAIL
Tester: <GitHub handle or anonymous identifier>
Android: <version>
Device/emulator: <model>
Commit: <sha>
Workflow run: <run id/url>
Artifact: <artifact name>
Artifact digest: <sha256>
Wallet address: <public test address only>
Faucet tx: <hash or N/A>
Test transaction: <hash or N/A>
Explorer/RPC evidence: <public URL or sanitized RPC result>
Restart persistence: PASS / FAIL / NOT TESTED

Observed issues:
- ...

Security/UX concerns:
- ...
```

## Pass criteria

A complete PASS requires all of the following:

- clean APK installation;
- application startup;
- local test-wallet creation;
- Chain ID `5919065` confirmed;
- faucet flow succeeds;
- transaction is locally signed and broadcast;
- transaction receives an on-chain receipt/inclusion evidence;
- transaction hash is independently queryable;
- wallet address persists after an application restart.

Anything less should be reported as `PARTIAL` or `FAIL` with the exact failing step.

## Security boundaries

Do not publish:

- recovery phrases;
- private keys;
- authentication tokens;
- Supabase secrets;
- device credentials;
- private personal data.

A successful run proves only that the documented testnet path worked for that tested build and environment. It does **not** prove an independent security audit, production readiness, mainnet readiness, decentralization, universal Android compatibility or economic security.

## Where to report

Public validation task: https://github.com/ZORYQ-Network/ZORYQ/issues/54
