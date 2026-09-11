# ZORYQ Wallet — Mainnet & Revenue Master Prompt

## Mission
Develop the ZORYQ Wallet as a secure self-custody wallet whose first production scope is multichain EVM. Compete on safety, clarity, extensibility and useful Web3 execution — not on unverified marketing claims. Never call the wallet production/mainnet ready solely because an APK builds.

## Current architecture target
- Android APK with React Native / Expo.
- Local self-custody: secrets never leave the device for signing.
- SecureStore-backed key material, using device authentication when available.
- Built-in support for major EVM mainnets plus a validated custom EVM network flow.
- Token watchlist by chain with ERC-20 metadata validation.
- Native and ERC-20 transfer flow with preflight simulation, gas estimation, explicit chain/asset/destination confirmation and explorer links.
- No hidden fee on ordinary transfers.

## Network model
Preload a conservative set of major EVM mainnets and ZORYQ Testnet. Every built-in RPC must use HTTPS. A custom network may be stored only after its RPC returns the exact Chain ID supplied by the user. Duplicate chain IDs must be prevented or deliberately replaced.

Do not claim that EVM support means Bitcoin, Solana, TON, Cosmos or other non-EVM families are supported. Those require separate key derivation, address validation, transaction serialization, signing and audit work before being added.

## Watchlist
Allow any ERC-20 to be added by contract address on the selected chain. Before adding:
1. validate address syntax;
2. require deployed bytecode;
3. read symbol/name/decimals;
4. reject nonsensical decimal values;
5. clearly warn that watchlisting does not imply trust or authenticity;
6. never issue token approval merely by adding a watchlist item.

Provide a small curated preset list for well-known assets, but never pretend the list is exhaustive.

## Signing security
- Keep private keys and mnemonic out of AsyncStorage.
- Store secrets only in SecureStore/device keystore/keychain.
- Prefer biometric/device authentication when the platform supports it.
- Never send seed/private key to RPC, API, telemetry, Treasury or support.
- Never log secrets.
- Explicitly warn before revealing or copying the recovery phrase.
- Mainnet release requires real-device verification of biometric vault behavior and backup/restore semantics.

## Transaction safety
Before sending a native or ERC-20 transfer:
- confirm current RPC Chain ID;
- simulate the call where supported;
- estimate gas;
- display network, asset, amount, recipient and maximum estimated network fee;
- make the user explicitly sign/send;
- store only non-secret local activity metadata;
- link the resulting transaction to the chain explorer.

## Treasury Revenue Engine
Wallet revenue must be transparent and limited to explicitly disclosed monetized actions.

Policy v1:
- native transfer wallet fee: 0 bps;
- ERC-20 transfer wallet fee: 0 bps;
- swap integration fee target: 25 bps (0.25%);
- no hidden fees;
- fee amount/percentage and recipient policy must be visible before signing.

For external EVM mainnets, integrate a server-side swap provider such as 0x Swap API. Never embed provider secret/API credentials in the APK. The trusted backend must inject the project-controlled Treasury recipient and fee policy, validate supported chains/tokens, return a quote with the integrator fee breakdown, and never receive the user's private key.

Mainnet monetization MUST remain fail-closed until both are explicitly configured:
- production Treasury EVM address that project governance has confirmed it controls;
- HTTPS swap backend with provider credentials kept server-side.

Do not silently default mainnet revenue to a testnet/admin address.

## ZORYQ-native revenue
The ZORYQ testnet DEX already has a transparent protocol-fee path. Keep testnet assets clearly labelled as having no guaranteed monetary value. A future ZORYQ mainnet DEX may route protocol fees to the approved mainnet Treasury only after its contracts, Treasury custody and token economics pass the mainnet release gates.

## Revenue accounting
Add future non-custodial accounting surfaces that let governance verify:
- chain;
- swap transaction;
- integrator fee token;
- integrator fee amount;
- Treasury recipient;
- provider fee separately from ZORYQ fee;
- cumulative Treasury revenue by chain/token.

Never fabricate revenue. Testnet protocol fees are test evidence, not business revenue.

## Release gates
Every wallet release must run:
- dependency install/alignment;
- TypeScript check;
- Expo Doctor;
- security/revenue static gate;
- Android prebuild;
- release APK build;
- package identity/version verification;
- artifact checksum.

Before public mainnet distribution also require:
- reproducible or controlled signed release pipeline;
- release signing key custody policy;
- dependency/SBOM scan;
- secret scan;
- independent security review;
- real-device tests on supported Android versions;
- create/import/restore regression tests;
- transaction tests on each advertised network class;
- malicious custom RPC/token tests;
- biometric invalidation/recovery tests;
- deep-link/phishing review;
- swap quote and fee disclosure tests;
- Treasury ownership/custody attestation;
- privacy policy and store compliance.

Until these external/production controls are complete, report `PRE_MAINNET_WALLET`, not `MAINNET_READY`.

## Product quality loop
On each execution:
1. inspect current Wallet code, CI and latest APK artifact;
2. fix the highest-risk security/usability defect first;
3. preserve self-custody;
4. add tests/gates for the defect;
5. build the APK;
6. inspect failure logs and fix root causes;
7. verify actual artifact checksum;
8. separate what is usable now from what still needs external production configuration.

## Competitive roadmap
After the EVM wallet core is stable, prioritize:
- WalletConnect / dApp connectivity with strict session permissions;
- phishing/domain risk warnings;
- transaction decoding and human-readable simulation;
- allowance manager and revoke flow;
- NFT portfolio with spam filtering;
- price/portfolio indexing that does not leak secrets;
- swaps/cross-chain routes with transparent fees;
- hardware wallet support;
- account abstraction/passkeys only with audited recovery design;
- Solana support using a separate audited Ed25519 keyring;
- Bitcoin support using a separate audited Bitcoin keyring and address/PSBT stack.

Never add a chain family by reusing EVM assumptions.

## Required report
After each run return:
- commits made;
- APK build result;
- artifact/checksum if built;
- networks and assets actually supported;
- security controls actually validated;
- revenue engine status and blockers;
- exact items preventing a real mainnet-ready declaration;
- next highest-value action.
