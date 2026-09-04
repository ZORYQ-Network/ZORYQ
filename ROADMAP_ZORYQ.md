# ZORYQ — Roadmap de Adoção, Receita e Network

## Visão
ZORYQ nasce **multi-chain primeiro**. O objetivo é conquistar usuários e volume usando redes que já possuem liquidez, ativos e infraestrutura. A blockchain própria é uma evolução posterior, não uma barreira de entrada.

## North Star
**One identity. One balance. Every chain.**

O usuário expressa o resultado que deseja; ZORYQ resolve rede, rota, segurança, custos e execução com o mínimo de complexidade possível.

---

## Fase 0 — Foundation / agora
**Objetivo:** produto instalável, arquitetura segura e base comercial.

Entregas:
- Android APK via GitHub Actions;
- identidade oficial ZORYQ;
- `app.zoryq.mobile`;
- wallet self-custody architecture;
- ZORYQ ONE preview;
- ZORYQ Guard preview;
- ZORYQ ID architecture;
- Swap + route review;
- SocialFi + Spotify;
- XP / quests / referrals;
- 11 idiomas + detecção automática;
- treasury registry EVM / Solana / Bitcoin;
- fee ledger e revenue reconciliation architecture;
- `preview` como modo obrigatório antes de cobrança real.

**Gate para avançar:** APK verde no CI, crashes críticos zerados no smoke test e nenhum segredo no client/repo.

---

## Fase 1 — Closed Alpha
**Objetivo:** validar retenção e UX antes de dinheiro real.

Entregas:
- onboarding simples;
- criação/importação segura de wallet via provider auditável;
- send/receive em testnet;
- ZORYQ Guard conectado a simulação real onde disponível;
- ZORYQ ONE usando quote providers em testnet;
- telemetry sem seed/private key/PII desnecessária;
- anti-phishing e blocklists;
- primeiras quests XP;
- referral attribution.

Métricas:
- activation rate;
- D1/D7 retention;
- intent completion rate;
- guard warnings per 1k transactions;
- crash-free sessions.

---

## Fase 2 — Revenue Beta
**Objetivo:** primeira receita real com risco controlado.

### 1. ZORYQ Route Fee
- fee inicial de referência: **15 bps / 0,15%**;
- somente quando provider/integrator suportar cobrança;
- fee exibida antes da assinatura;
- provider/network fee separada da ZORYQ fee;
- canary launch com limites;
- reconciliação por `tx_hash`, rede, ativo, gross fee, partner share e net ZORYQ revenue.

Treauries oficiais:
- EVM: `0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33`
- Solana: `53uWrDJCiGtFHZPFiCzuRGPbSxEYaep2JC5mCQqZV3jG`
- Bitcoin Native SegWit: `bc1q55tt9sphzstjvs3tzylxsltxvvwsv8l69dydmg`

### 2. ZORYQ Pro
Produto premium via billing nativo das lojas.

Benefícios candidatos:
- Guard avançado;
- alertas de risco e approvals;
- automações ONE;
- histórico/analytics avançados;
- fee discounts quando economicamente sustentável;
- personalização premium.

### 3. Referral / Revenue Share
Somente programas oficialmente suportados por protocolos e partners.

**Gate:** reconciliação diária sem divergência material, suporte/charge disclosures prontos e revisão jurídica/compliance aplicável.

---

## Fase 3 — Public Mainnet
**Objetivo:** distribuição e crescimento.

Entregas:
- wallet mainnet com security review;
- multi-chain send/receive;
- swap/cross-chain com route fallback;
- Guard obrigatório antes de transações de maior risco;
- ZORYQ ID beta;
- SocialFi com moderation/anti-spam;
- Pro nas lojas;
- dashboards de receita, volume, retention e fraud;
- incident response e feature kill-switches.

Growth loops:
- referral;
- creator/community quests;
- badges e reputação;
- shareable transaction/achievement cards sem expor dados sensíveis;
- localized onboarding;
- partnerships.

---

## Fase 4 — ZORYQ Guard / ONE API (B2B)
**Objetivo:** transformar tecnologia do app em infraestrutura vendável.

Produtos:
- `/guard/analyze` — risco, simulation, approvals, destination intelligence;
- `/intent/plan` — plano de execução multi-chain;
- `/route/quote` — quote normalizado;
- webhooks de risk/status;
- API keys, quotas e metering.

Modelo de receita:
- developer free tier limitado;
- usage-based;
- business plans;
- enterprise SLA futuramente.

---

## Fase 5 — ZORYQ ID Network Effect
**Objetivo:** substituir copiar/colar endereços por identidade verificável.

- `@usuario`;
- múltiplos namespaces por identidade;
- proof of wallet ownership;
- recipient preferences;
- address poisoning protection;
- contacts/reputation;
- privacy controls.

O ZORYQ ID nunca deve mover fundos por conta própria. Ele resolve destino; assinatura continua com o usuário.

---

## Fase 6 — ZORYQ Network Research
**Objetivo:** provar economicamente que uma rede própria faz sentido antes de lançá-la.

A ZORYQ Network só avança se houver tração suficiente para justificar infraestrutura própria.

Sinais:
- base relevante de MAU/WAU;
- volume mensal sustentável;
- receita recorrente;
- número relevante de transações;
- necessidade técnica/econômica não resolvida pelas redes existentes;
- possibilidade clara de melhorar custo/UX/latência.

Arquitetura preferida:
- **L2/appchain**, não uma L1 do zero;
- EVM compatibility onde fizer sentido;
- chain abstraction no app;
- bridge/security model auditado;
- sequencer/DA/upgrade controls claramente documentados;
- plano progressivo de descentralização.

---

## Fase 7 — ZORYQ Network Beta
O app continua multi-chain. A ZORYQ Network entra como **mais uma rota**.

Regra de UX:
> ZORYQ Network é usada porque oferece melhor resultado, não porque o usuário é obrigado.

ZORYQ ONE compara custo, velocidade e risco entre redes e pode selecionar a rede ZORYQ quando ela for objetivamente a melhor opção dentro das preferências do usuário.

---

## Token / Airdrop
XP **não é token** e não garante distribuição futura.

Antes de qualquer token:
- tokenomics;
- utility real;
- legal review;
- anti-sybil;
- snapshot rules;
- treasury/governance controls;
- disclosure público;
- segurança de claim contracts.

Até lá a comunicação permanece **Airdrop Coming Soon / potential eligibility**, sem promessa de valor ou quantidade.

---

## Ordem de monetização
1. Route/integrator fee;
2. ZORYQ Pro;
3. partner/referral revenue;
4. Guard/ONE API;
5. creator/digital features;
6. economia da ZORYQ Network somente após tração.

## Princípio final
**Primeiro distribuição. Depois infraestrutura própria.**

Construir a ZORYQ Network antes de conquistar usuários criaria uma rede vazia. Construir ZORYQ como interface universal primeiro permite que uma futura network já nasça com wallet, usuários, identidade, volume, comunidade e distribuição.
