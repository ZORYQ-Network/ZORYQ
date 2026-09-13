# ZORYQ OBEP External Challenge

This challenge is for independent developers, researchers and teams who want to verify the ZORYQ Outcome-Bound Economic Proof (OBEP) prototype without trusting the ZORYQ UI or internal CI claims.

OBEP is an experimental ZORYQ protocol primitive. It is **not a separate blockchain**. The live proofs below use the public ZORYQ Testnet (Chain ID `5919065`).

## Challenge A — verify the live reference proof

```bash
git clone https://github.com/ZORYQ-Network/ZORYQ.git
cd ZORYQ/zoryq-developer/obep
npm install
npm run verify:reference
```

The verifier independently queries the public ZORYQ RPC and checks:

- Chain ID;
- transaction and successful receipt;
- payer and recipient;
- settlement value;
- calldata commitment;
- authorization, executor and verifier signatures;
- `intentId`, `outcomeId` and output binding;
- Proof Pack consistency.

Reference transaction:

`0x573de41d87fd1bc9c6679f7addf6cbf03f724c15e03fc2fda1a187b9b12a7080`

Reference issue: #129

## Challenge B — independently verify the useful-task proof

ZORYQ also contains a deterministic task whose output can be recomputed independently before settlement is considered valid.

Relevant files:

- `zoryq-developer/obep/external-task/input.json`
- `zoryq-developer/obep/external-task/execute-task.mjs`
- `zoryq-developer/obep/external-task/verify-task.mjs`
- `zoryq-developer/obep/external-task/verify-live-task-proof.mjs`

First public useful-task settlement:

- tx: `0x472716d15ffe9b4440a818fec15bdf3a426cfa653e8e147a6be04fec1ab7ee4d`
- block: `127339`
- task output hash: `0x1198ac0402951123aa977a0d16cdca317f61e5448108da67629125c6c721cf4c`
- intent: `0x321a133dbcdb44b43870e1d25ab059932a9a8353033b9445d0d6566f8d3131c7`
- outcome: `0xaebba31f940705c9ca662c44d842263874a3f176594341acb04b1f9c0f06b588`
- Proof Pack hash: `0x34422480f23741db1d507712bc3d572d92686c5f72a315afdeabbd51953e41c3`

Reference issue: #130

## What counts as independent evidence

A useful external report should include:

1. developer/team identity or public GitHub account;
2. OS and Node.js version;
3. repository commit tested;
4. command executed;
5. transaction hash checked;
6. whether every binding passed;
7. any mismatch, ambiguity or security concern found;
8. optional fresh reproduction tx / Proof Pack hash.

A project-owned CI runner, project-owned wallet or same-operator machine does **not** count as independent validation.

## Claim boundary

Passing this challenge proves reproducibility of the current OBEP prototype only. It does not prove production readiness, audit completion, decentralization, adoption, economic demand, ERC compliance or novelty.

## Security

Do not post private keys, mnemonics, API keys, infrastructure credentials or other secrets. External verification requires only public repository data and the public ZORYQ RPC.