# ZORYQ Consensus V2 — Runtime Evidence

Status: TESTNET EVIDENCE ONLY. This document records a successful ephemeral multi-node runtime test. It is not a mainnet-readiness attestation and does not replace persistent redundancy, disaster-recovery, external audit, or production signer controls.

## Successful proof

- GitHub Actions run: `34664387573`
- Commit under test: `6e48fb4a44d8950007ce1f71b146c6c1d1736857`
- Topology: 3 Reth execution clients + 3 Lighthouse consensus clients
- Validators: 24 total, distributed 8/8/8
- Network / chain ID: `5919065`
- Slot time: 4 seconds
- `Reth --dev`: forbidden by topology guard
- Consensus Engine API: enabled only inside the isolated EL<->CL test topology

## Runtime observations

The runtime test created all three Reth execution participants, all three Lighthouse consensus participants, and three validator clients. All three execution clients reported the same chain ID and the same execution genesis hash:

`0x5f08fd5ef54d29f9279cb5f66c0456eb59eb7c3daf58a5aa91bb335c1a4138b1`

The generated consensus genesis contained 24 validators with total effective balance of 768 ETH.

The network progressed from genesis and produced execution and consensus blocks across different participant pairs. The automated stability check observed all three execution and consensus clients transition to synchronized/healthy state.

Consensus finality was reached. The runtime reported finalized epoch `2` and the finality check completed successfully. Epoch 2 recorded 24/24 target votes, 24/24 head votes and 24/24 total votes (100%).

The Assertoor runtime checks completed successfully:

- `stability-check`: success
- `block-proposal-check`: success
- all three client pairs proposed blocks
- client pool: 3 good clients, 0 bad clients during the successful phase

## Bound artifacts

- Runtime proof artifact ID: `10288720518`
- Runtime proof artifact SHA-256: `9feb6ddc993e7a108d115a5793b3fff314c78d880549d09753a86f64386cc9f8`
- Enclave dump artifact ID: `10288720517`
- Enclave dump SHA-256: `940bb80e72bc1d35d7cab015a36576ea6cf622123d6c2ad52eea03199fa62efa`

These artifacts were produced by run `34664387573` and are evidence for this test only.

## Security note

The ethereum-package/Kurtosis devnet uses generated development mnemonics, validator keys, JWT material and prefunded development accounts. Some development keys are visible in the ephemeral CI logs/dump. They MUST be treated as public test credentials and MUST NEVER be reused for persistent staging, production, treasury, faucet custody, validator custody or mainnet.

Production/staging promotion requires newly generated secret material outside public CI, with explicit secret-management controls and no private key material committed or printed in logs.

## What is green now

- Multi-node EL+CL topology: GREEN for ephemeral testnet proof.
- Three execution nodes booting on one chain: GREEN for ephemeral testnet proof.
- Three consensus nodes booting on one chain: GREEN for ephemeral testnet proof.
- Chain synchronization: GREEN for ephemeral testnet proof.
- Consensus finality: GREEN for ephemeral testnet proof.
- Block production by all three participant pairs: GREEN for ephemeral testnet proof.

## What is still not green

- Persistent multi-provider redundancy.
- Single-node failure and recovery test.
- Fresh-node catch-up after failure.
- Disaster-recovery restore from backup.
- Production-grade key management / external signer.
- Frozen reproducible production genesis and pinned client images.
- Independent external security audit.
- Mainnet readiness.

Green means measured evidence within the scope stated above. It must not be generalized beyond that scope.