# Contributing to KYVO

## Workflow
1. abra issue/design note para mudança material;
2. crie branch curta;
3. implemente com tests/documentação;
4. rode typecheck/lint/tests;
5. abra PR;
6. security-sensitive code exige revisão adicional.

## Definition of Done
- UI states de loading/error/empty;
- i18n sem strings críticas hardcoded;
- analytics sem secrets/PII desnecessária;
- acessibilidade básica;
- tests proporcionais;
- docs atualizadas;
- nenhum secret commitado.

## Crypto-specific review
Mudanças em wallet, signing, fees, swaps, bridges, token eligibility ou treasury não devem ser mergeadas apenas por revisão visual.

## Commits
Preferir Conventional Commits: `feat:`, `fix:`, `security:`, `docs:`, `chore:`.