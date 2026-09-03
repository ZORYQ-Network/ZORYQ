# Architecture Decision Log

## ADR-001 — Mobile-first
**Decisão:** React Native/Expo como base inicial.
**Motivo:** Android/iOS com design compartilhado e acesso a APIs nativas quando necessário.

## ADR-002 — Self-custody
**Decisão:** KYVO não custodiará private keys no backend.
**Motivo:** reduzir superfície de custódia e manter controle do usuário.

## ADR-003 — XP separado de token
**Decisão:** XP não representa token nem claim garantido.
**Motivo:** flexibilidade de produto, anti-sybil e prudência regulatória.

## ADR-004 — Multi-chain por adapters
**Decisão:** capabilities por namespace/rede.
**Motivo:** evitar arquitetura EVM-only mascarada de multi-chain.

## ADR-005 — Spotify PKCE
**Decisão:** OAuth Authorization Code with PKCE no mobile.
**Motivo:** client secret não pode ser protegido dentro do app.

## ADR-006 — Fees transparentes
**Decisão:** fee KYVO sempre explícita no review.
**Motivo:** confiança e previsibilidade.

Novas decisões materiais devem ser adicionadas como ADRs.