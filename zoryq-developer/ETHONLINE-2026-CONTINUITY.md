# ZORYQ — ETHOnline 2026 Continuity Submission Draft

## Project
ZORYQ is an agent-native EVM testnet and builder intelligence platform focused on reducing the distance between an idea and verifiable on-chain usage.

## Continuity disclosure
ZORYQ existed before ETHOnline 2026. This submission must be registered under the Continuity Track. Only features built or materially extended during the event window should be presented as hackathon work.

## New/extended work during ETHOnline 2026
- Agent-native discovery surfaces (`/llms.txt`, `/.well-known/zoryq-agent.json`, action/project schemas).
- Project Intelligence scanner and Builder Reputation specification.
- ENSv2 Sepolia reverse/forward verification flow exposed through `/identity/ens` and separated from on-chain ZORYQ score classes.
- Native DEX v1 deployment and live verification.
- Native Lending deployment and live verification.
- On-chain Project Registry deployment and live verification.
- Treasury wallet EIP-191 control proof without private-key custody.
- Public network maturity status and transparent centralized-testnet disclosure.
- EIP-3091-style Explorer route surface.

## Strongest partner-prize target
### ENS — Best Integration of ENSv2 into an Existing Project
ZORYQ uses ENSv2 on Ethereum Sepolia as a verifiable external identity signal for builders/agents. The flow performs reverse lookup and then verifies the forward resolution matches the wallet before marking the identity evidence as verified. ENS identity evidence is kept separate from self-attested social evidence and from ZORYQ on-chain actions.

Why ENS improves ZORYQ:
- Human-readable identity for builders and agents.
- External identity evidence that cannot be replaced by a cosmetic hard-coded label.
- A bridge between Ethereum identity and ZORYQ Builder Reputation / Genesis Intelligence.
- Future delegated agent namespaces can map agents to owners/builders while preserving explicit verification classes.

Live evidence:
- ZORYQ testnet chain ID: `5919065`
- ENS verification endpoint: `/identity/ens?address=<wallet>`
- Genesis/identity integration: `zoryq-evm-node/public-gateway.mjs`
- Public Intelligence UI: `/intelligence`

## Product proof
Verified current testnet contracts:
- DEX v1: `0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156`
- Lending: `0xA08d491c06a2B01bbe6866CA87302c794aD9fB77`
- Project Registry: `0x180042c92A42f183A67005E8C0968a1F190aab33`
- zUSD: `0xd2121E96C6af936c0496fDB499c1D0613d26c2B9`

Public surfaces:
- `/start`
- `/developer`
- `/ecosystem`
- `/swap`
- `/lending`
- `/explorer`
- `/intelligence`
- `/network-maturity`

## Demo video plan (2–4 minutes)
1. Show ZORYQ network + public RPC and Explorer.
2. Connect a wallet and run ENSv2 identity verification against Sepolia.
3. Show that verified ENS identity is classified separately from social/self-attested and ZORYQ on-chain proof.
4. Show DEX/Lending/Project Registry addresses and live Explorer evidence.
5. Show agent discovery schemas and Project Intelligence.
6. End on the Network Maturity page explaining what is live vs roadmap.

## Submission blockers that must be resolved before final submission
- ETHGlobal partner rules require a public repository / accessible source link. The current main development repository is private; publish an eligible public repository or make the submission source publicly accessible before final submission.
- Record a 2–4 minute demo video.
- Ensure the ETHGlobal project is registered as Continuity.
- Clearly identify pre-existing work and event-window additions.

## Claims policy
Do not claim ZORYQ is decentralized or multi-validator today. Do not assign monetary value to ZQ/zUSD. Do not claim Genesis Score is finalized on-chain. Do not claim integrations that are not demonstrably live.
