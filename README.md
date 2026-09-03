# KYVO Mobile

**Crypto without complexity.**

KYVO é um projeto crypto mobile-first que combina wallet self-custody, swap/cross-chain, SocialFi, Spotify, XP e três tecnologias próprias em desenvolvimento:

- **KYVO ONE** — intent engine: o usuário diz o resultado desejado e a KYVO planeja rede, rota, custo e execução.
- **KYVO Guard** — camada de segurança pré-assinatura, score e futura simulação on-chain.
- **KYVO ID** — identidade humana multi-chain, como `@usuario`, com endereços verificados.

## Produto atual
- KYVO Vault / wallet própria em arquitetura segura
- Swap e cross-chain com KYVO Fee transparente
- SocialFi + Spotify
- XP, quests, streak, referrals e **Airdrop Coming Soon**
- Multi-chain
- idioma/região automáticos + alteração manual
- KYVO ONE preview
- KYVO Guard preview
- KYVO Pro preparado para assinatura futura

## Receita
Caminhos priorizados:
1. **KYVO Route Fee** em operações elegíveis após cadastro do integrador + treasury;
2. **KYVO Pro** via billing nativo das lojas;
3. **KYVO Guard / ONE API** como produto B2B futuro.

A UI não significa que cobrança real esteja ativa. O modo `live` só deve ser habilitado quando partner account, backend e treasury estiverem configurados e testados.

## Documentação
O repositório contém whitepaper, arquitetura, segurança, compliance, taxas/treasury, token/airdrop, operações e ADRs. A nova camada de plataforma está documentada em:
- `docs/product/KYVO_ONE.md`
- `docs/product/KYVO_GUARD.md`
- `docs/product/KYVO_ID.md`
- `docs/business/MONETIZATION.md`
- `docs/business/REVENUE_LAUNCH.md`
- `docs/security/THREAT_MODEL.md`
- `docs/operations/MAINNET_CHECKLIST.md`
- `docs/operations/ROADMAP.md`

## APK pelo GitHub
O workflow `Build KYVO Android APK` extrai a base `kyvo-src.tgz`, aplica os arquivos em `overrides/`, roda validações Expo/TypeScript e gera o APK em **Actions → Artifacts**.

> O APK atual é de desenvolvimento/teste. Wallet com dinheiro real, swap mainnet e taxas reais só entram depois dos gates de segurança e integrações externas.
