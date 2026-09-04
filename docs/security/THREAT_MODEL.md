# KYVO Threat Model

## Ativos protegidos
- autoridade de assinatura da wallet;
- passkeys/sessões;
- mappings KYVO ID;
- quotes e payloads de transação;
- fee destinations;
- XP/eligibility;
- contas sociais.

## Ameaças principais
1. exfiltração de seed/private key;
2. substituição maliciosa do payload antes da assinatura;
3. manipulação de quote/rota;
4. approval phishing e allowances ilimitadas;
5. alteração indevida da treasury;
6. vazamento de OAuth/session tokens;
7. sybil/wash/referral fraud;
8. phishing por perfis sociais;
9. supply-chain compromise;
10. abuso de privilégios administrativos.

## Controles
- nenhuma private key no backend/repo/logs;
- wallet provider + secure native storage/passkeys;
- simulação e asset deltas antes de signing;
- minimal approvals;
- TLS, allowlists e validação de payload;
- least privilege e audit logs;
- secret rotation;
- dependency/secret scanning;
- anti-abuse/rate limits;
- mudança de treasury com aprovação reforçada.

Falha crítica em custody, signing integrity ou treasury routing bloqueia mainnet.
