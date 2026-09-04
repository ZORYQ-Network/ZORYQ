# ZORYQ Mainnet Launch Checklist

This checklist is a release gate. A box remaining unchecked means the corresponding production step is not ready.

## A. Protocol freeze

- [ ] Chain ID chosen and collision-checked
- [ ] Native ZQ precision/decimals frozen
- [ ] `zq1...` address codec frozen
- [ ] Canonical transaction encoding frozen
- [ ] ML-DSA-65 signing domain/version frozen
- [ ] Fee model frozen
- [ ] Validator/staking parameters frozen
- [ ] Genesis supply frozen

## B. Wallet ↔ Chain compatibility

- [ ] APK and extension derive the same address from the same seed
- [ ] Wallet signs exactly the canonical transaction bytes expected by nodes
- [ ] Challenge-signature authentication is enabled for faucet/dApps
- [ ] Chain rejects replayed signatures/nonces
- [ ] Wallet displays network/chain ID before signing
- [ ] Wallet refuses transactions for unknown network IDs without explicit user action
- [ ] CI contains compatibility vectors shared by wallet and chain

## C. Treasury and keys

- [ ] 2-of-3 solo-founder treasury setup created
- [ ] Signer A hardware key tested
- [ ] Signer B hardware key tested
- [ ] Signer C offline recovery key tested
- [ ] Recovery phrases stored in three separate secure locations
- [ ] Treasury recovery drill performed
- [ ] Deployer wallet separated from treasury
- [ ] Operations hot wallet funded only with limited amount
- [ ] Production address registry signed and archived

## D. Pre-mainnet EVM token (only if used)

- [ ] Target network selected
- [ ] Fixed total supply approved
- [ ] `ZQPreMainnet.sol` reviewed/audited
- [ ] No privileged mint path exists
- [ ] Treasury Safe address verified
- [ ] Contract deployed from frozen commit
- [ ] Source code verified on explorer
- [ ] Contract address published in official registry
- [ ] Test transfer and permit completed

## E. Migration 1:1

- [ ] Migration escrow reviewed/audited
- [ ] Destination `zq1...` validation finalized
- [ ] Migration event indexer running
- [ ] Duplicate/replay protection tested
- [ ] Mainnet claim/root generation reproducible
- [ ] Conservation-of-supply invariant tested
- [ ] Full dress rehearsal performed on testnet
- [ ] Migration start/end policy published

## F. Network operations

- [ ] At least 3 independently running validator processes
- [ ] Prefer validators on independent infrastructure/providers/regions
- [ ] P2P peer discovery/static seeds configured
- [ ] RPC nodes separated from validator signing nodes where practical
- [ ] Monitoring and alerts configured
- [ ] Backups and restore procedure tested
- [ ] Validator key rotation/recovery runbook written
- [ ] Explorer and indexer synchronized
- [ ] Public RPC rate limiting enabled
- [ ] DDoS/abuse controls reviewed

## G. Security

- [ ] Smart contracts independently reviewed
- [ ] Consensus/network implementation independently reviewed
- [ ] Wallet key storage independently reviewed
- [ ] No seed/private key appears in repository history, CI logs or databases
- [ ] Dependency versions pinned
- [ ] Reproducible release artifacts and SHA-256 hashes published
- [ ] Incident response procedure tested
- [ ] Responsible disclosure/security contact published

## H. Ecosystem / dApps

- [ ] ZORYQ RPC/API specification published
- [ ] `window.zoryq` provider specification published
- [ ] SDK released with versioning
- [ ] Example dApp can connect, read state and request signatures
- [ ] Testnet faucet available
- [ ] Explorer URLs and contract/token registry available
- [ ] Developer quickstart validated by a clean environment

## I. Legal/communications

- [ ] Token terminology and risk disclosures reviewed for launch jurisdictions
- [ ] No guaranteed-return language
- [ ] Testnet points clearly described as experimental/non-guaranteed
- [ ] Treasury/token allocations publicly documented where appropriate
- [ ] Privacy policy/terms prepared for public-facing services

## Launch rule

Mainnet release should be cut from a signed Git tag only after all applicable gates above are complete. No production seed phrase or validator private key is generated or stored by CI.
