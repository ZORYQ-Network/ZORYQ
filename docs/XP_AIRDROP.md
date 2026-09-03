# XP, Quests e Futuro Airdrop

## Princípio jurídico/produto
**XP não é token, saldo financeiro, promessa de token ou direito adquirido.** É uma métrica de progressão do produto.

## Eventos possíveis
- onboarding concluído;
- wallet verificada;
- swap válido;
- uso multi-chain;
- streak;
- quests;
- atividade social de qualidade;
- Spotify conectado;
- referrals qualificados;
- achievements.

## Ledger
Todo XP de produção deve nascer de evento server-side ou evento on-chain verificável. O ledger deve ser append-only, idempotente e auditável.

Campos sugeridos: `event_id`, `user_id`, `rule_version`, `source`, `source_ref`, `points`, `risk_score`, `created_at`.

## Anti-sybil
- caps diários/semanais;
- diminishing returns;
- device/account signals respeitando privacidade;
- wallet age/activity signals quando justificáveis;
- referral qualification;
- exclusão de wash activity;
- revisão de clusters suspeitos.

## Airdrop Coming Soon
A tela pode mostrar nível, XP, badges e status de atividade. Não mostrar quantidade estimada de tokens antes de tokenomics oficiais.

## Snapshot futuro
Um eventual snapshot deve registrar regras, timestamp/bloco, wallets elegíveis, score normalizado, exclusions e hash/manifesto verificável.

A conversão de XP para qualquer distribuição futura será decisão separada, publicada e versionada.