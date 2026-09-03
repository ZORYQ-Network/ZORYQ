# Incident Response

## Severidade
- **SEV-0:** possível perda de fundos/chaves/treasury.
- **SEV-1:** execução financeira incorreta, auth bypass ou data breach relevante.
- **SEV-2:** indisponibilidade importante, abuso amplo ou integração comprometida.
- **SEV-3:** bug funcional sem risco material.

## Primeiros passos
1. preservar evidências;
2. acionar owner de segurança;
3. desabilitar feature via flag quando possível;
4. revogar credenciais comprometidas;
5. pausar rotas/providers afetados;
6. avaliar comunicação a usuários/partners;
7. corrigir, validar e monitorar;
8. publicar postmortem proporcional.

## Wallet/Swap
Se houver suspeita de payload malicioso, interromper imediatamente o provider/rota afetado. Nunca pedir seed phrase ao usuário durante suporte.

## Social
Phishing/impersonation em massa pode exigir bloqueio de links/domínios e suspensão temporária de contas.

## Postmortem
Registrar timeline, impacto, causa raiz, detecção, contenção, correção, ações preventivas e responsáveis. Evitar culpar indivíduos; corrigir sistema/processo.