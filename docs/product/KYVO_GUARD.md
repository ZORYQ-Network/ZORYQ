# KYVO Guard — Safety Layer

## Objetivo
Tornar o risco de uma assinatura compreensível antes da transação acontecer.

## Sinais de produção
- reputação de endereço/contrato;
- verificação, idade e controles administrativos do contrato;
- approvals e allowance scope;
- simulação de mudanças de saldo;
- chamadas internas/delegate calls;
- indicadores de phishing/drainer;
- liquidez/concentração/restrições de token;
- rede/token incompatíveis;
- metadata de risco de bridge/rota.

## Saída
- score 0–100;
- low / medium / high / blocked;
- explicação humana;
- asset deltas esperados;
- warnings de approval;
- resultado da simulação e timestamp.

Um score não é garantia. Recursos críticos podem ser bloqueados ou exigir override explícito de alto risco.
