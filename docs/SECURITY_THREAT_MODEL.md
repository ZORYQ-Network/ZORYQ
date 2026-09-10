# Threat Model ZORYQ

## Ativos críticos
- chaves/seed/passkeys;
- sessão de usuário;
- OAuth tokens;
- payloads de transação;
- wallet addresses e preferências;
- mensagens/conteúdo privado;
- XP ledger e snapshots;
- treasury/configuração de fees;
- chaves de backend e CI/CD.

## Adversários
- malware local;
- phishing/impersonation;
- extensão/wallet maliciosa;
- RPC/provider comprometido;
- supply-chain npm;
- account takeover;
- insider indevido;
- bot/sybil farmer;
- attacker em API/social;
- CI/CD compromise.

## Cenários prioritários
### Wallet drain
Mitigações: transaction preview, simulation, allow/deny signals, approval warnings, domain/session controls.

### Seed leakage
Mitigações: nunca backend/log/analytics; hardware-backed storage/provider auditado; telas protegidas; recovery controlado.

### Quote manipulation
Mitigações: TTL, server-side quote identity, sanity checks, min received e confirmation screen.

### XP farming
Mitigações: event ledger, idempotency, caps, risk scoring e review.

### Social phishing
Mitigações: URL reputation, report/block, labels, impersonation checks.

### Supply chain
Mitigações: lockfile, Dependabot/renovation control, provenance quando disponível, CI pinning e review de native modules.

## Baseline
O programa de segurança deve mapear controles ao OWASP MASVS/MASTG para storage, crypto, auth, network, platform, code e resilience.