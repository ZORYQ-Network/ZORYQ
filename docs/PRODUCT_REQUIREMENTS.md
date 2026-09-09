# Product Requirements — ZORYQ

## P0 — obrigatório antes de beta público
### Conta e onboarding
- Detectar idioma/região do dispositivo.
- Permitir troca manual de idioma/região.
- Criar/restaurar sessão com biometria/PIN/passkey quando suportado.
- Termos, privacidade e disclosure de risco antes de funções financeiras.

### Wallet
- Criar wallet self-custody por provider auditado/arquitetura MPC ou smart account aprovada.
- Importar/conectar wallet externa sem enviar seed/private key ao backend.
- Receber, enviar, QR, histórico, múltiplas contas e redes.
- Simular transação e mostrar destino, valor, rede e gas antes de assinar.

### Swap
- Quote real, slippage, price impact, gas, rota e fee ZORYQ.
- Cross-chain quando houver rota suportada.
- Aprovação exata por padrão quando tecnicamente possível.
- Bloqueio de execução quando quote expirar.

### SocialFi
- Feed, posts, mídia, comentários, likes, repost, bookmark, follow, block/report.
- Rate limiting, anti-spam e moderação.
- Privacidade por usuário.

### Integrações
- OAuth Authorization Code + PKCE quando necessário.
- Scopes mínimos e revogação de sessão.
- Integrações externas devem ser opcionais e isoladas da custódia da wallet.

### XP e quests
- Ledger append-only de eventos.
- Regras versionadas.
- Anti-sybil/anti-farming.
- Nenhuma promessa de token, alocação ou retorno financeiro sem decisão formal e documentação específica.

## P1 — pós-beta
- WalletConnect/Reown.
- Smart accounts e gas sponsorship seletivo.
- NFT gallery e collectibles.
- Perp/trading via protocolo externo auditado.
- Creator communities e Spaces.
- Referral revenue share.

## P2 — expansão
- Token somente após decisão formal.
- Governança progressiva.
- SDK/partner API.
- Marketplace de itens digitais.
- IA contextual opcional.

## Métricas principais
- ativação D1;
- wallets criadas/verificadas;
- MAU/WAU;
- retenção D7/D30;
- atividade on-chain e receita líquida;
- posts/engajamento saudável;
- conclusão de quests;
- fraude/sybil rate;
- crash-free sessions;
- latência de RPC, quote e assinatura.

## Identidade
Toda interface, documentação, artefato e identificador novo deve usar exclusivamente `ZORYQ` ou `zoryq` conforme o contexto técnico.
