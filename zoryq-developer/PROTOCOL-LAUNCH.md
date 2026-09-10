# ZORYQ Protocol Launch Gate

This document defines the only acceptable path for deploying privileged ZORYQ Testnet protocol components such as DEX v1 and Lending.

## Required evidence before deployment

1. The configured Treasury address must match current on-chain ownership evidence for canonical components.
2. Treasury control must be proven with the `/admin-control` EIP-191 challenge flow. The proof signs a message only and must never request or store a private key or seed phrase.
3. Contract source and tests must be green in CI.
4. The exact creation artifact must be tied to a green CI commit and artifact digest.
5. The wallet must show the deployment target, constructor arguments, estimated gas and expected owner/fee recipient before signing.
6. The wallet must explicitly confirm each state-changing deployment transaction.
7. After broadcast, deployment is not accepted until the receipt has `status = 1`, deployed bytecode is non-empty, constructor configuration is readable, and intended ownership/fee-recipient values match the approved plan.
8. Application config is updated only after verification. A source file or transaction hash alone is not a deployed canonical contract.

## Current canonical inputs

- Chain ID: `5919065`
- zUSD: `0xd2121E96C6af936c0496fDB499c1D0613d26c2B9`
- Configured Treasury: `0xc0e03982FB8615ddf8b8faBd27e5A35541E12F33`
- DEX v1 constructor: `(zUSD, Treasury)`
- Lending constructor: `(zUSD)`
- Project Registry constructor: none

## Current build evidence

The protocol build generated from commit `5f997e14919f725ab85faf5d8bcd06bb9d98f030` passed the contract CI suite and produced artifact digest:

`sha256:9ba28507d7bb4653d0d5114746448be7d1a514918e84d2303d0b9eaad1e0168d`

The build artifact contains creation bytecode and ABI for `ZoryqDexV1`, `ZoryqLendingLab`, and `ZoryqProjectRegistry`.

## Explicitly prohibited

- Automatic deployment from a push event.
- Storing an admin private key in repository code, logs, browser storage, build artifacts or public environment variables.
- Deploying from an ephemeral key and then assuming the Treasury controls the result without a verified ownership transfer.
- Updating frontend addresses before receipt/code/configuration verification.
- Claiming DEX/Lending is live before the verification gate passes.

## Next gate

`/admin-control` must report `proven: true`. Once that is satisfied, the protocol launch surface can prepare wallet-confirmed deployment transactions and then run receipt/code/ownership verification before any address is published as canonical.
