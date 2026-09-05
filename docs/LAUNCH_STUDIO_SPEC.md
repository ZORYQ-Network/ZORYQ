# ZORYQ Launch Studio & AI Builder — Product Specification

## Objective
Reduce the work required to launch a credible Testnet project from days of manual integration to a guided flow that can be completed in one product.

## MVP flow
1. Connect/create ZORYQ Wallet.
2. Choose `Create Project`.
3. Select a template: Token, NFT Collection, Community or Game Starter.
4. Describe the project in natural language or fill fields manually.
5. AI Builder converts intent into structured configuration.
6. Studio validates parameters and shows warnings.
7. User reviews every contract/action and estimated Testnet gas.
8. Wallet explicitly signs deployment transactions.
9. Studio records project contracts in Project Registry.
10. Public project page shows verified addresses and Explorer links.
11. Creator can add onchain quests from Quest Registry.

## AI safety boundary
AI Builder can propose and explain. It cannot:
- access seed/private keys;
- sign for the user;
- silently change recipient/owner addresses;
- deploy without explicit wallet approval;
- claim a contract is audited unless the exact deployed bytecode/template version has that status.

## Token template v1
Required inputs:
- name;
- symbol;
- fixed initial supply;
- owner/recipient;
- optional capped minting only if explicitly selected and prominently disclosed.

Default preference: simple fixed-supply ERC-20 test template.

## NFT template v1
Required inputs:
- collection name;
- symbol;
- maximum supply;
- metadata base URI strategy;
- owner;
- mint permissions.

## Quest campaign
Creator selects:
- title/metadata;
- points;
- start/end;
- verification type;
- per-wallet limit;
- active/paused.

Prefer verification from chain events/receipts. Offchain/social evidence is marked as such.

## Project Registry
A registry entry should expose:
- project ID;
- creator/owner;
- metadata URI/hash;
- registered contract addresses;
- template/version IDs;
- creation block/time;
- active/deprecated status where appropriate.

## Public project page
Shows:
- project identity;
- creator wallet;
- verified contract addresses;
- token/NFT/quest modules;
- Explorer links;
- Testnet warning;
- activity metrics sourced from chain/indexer;
- no invented TVL/volume.

## Template lifecycle
Every deployable template has:
- semantic version;
- source repository path;
- compiler version/settings;
- bytecode hash where practical;
- test suite;
- security status: experimental / reviewed / externally audited;
- deprecation flag.

## Success criteria
- median first deployment under 10 minutes for a new Testnet user;
- no hidden signing steps;
- deployed addresses always recoverable from chain/registry;
- generated project page works on mobile;
- template/version visible to user;
- failures produce actionable diagnostics.

## Later modules
Only after MVP evidence:
- vesting;
- staking;
- memberships;
- marketplace primitives;
- liquidity helpers;
- governance templates;
- smart-account/paymaster project onboarding.