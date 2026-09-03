# Swap e Trading

## Swap
O swap é não custodial. A KYVO orquestra quote e UX; a execução ocorre na wallet/protocolo.

### Quote obrigatório
- token/rede de origem e destino;
- quantidade entrada/saída;
- mínimo recebido;
- slippage;
- price impact;
- gas estimado;
- fee KYVO;
- fee de terceiros;
- rota/provider;
- TTL do quote.

### KYVO Fee
A taxa deve ser configurada server-side e enviada no quote quando o provider permitir integrator fees. O usuário visualiza a taxa antes da assinatura. Nunca esconder fee no rate exibido.

### Segurança
- token approval exata como padrão;
- simulação quando disponível;
- quote expiry;
- denylist/risk signals;
- warning para tokens ilíquidos;
- proteção contra rota alterada após confirmação.

## Cross-chain
Exibir etapas e status separadamente: approval → source tx → bridge → destination settlement.

## Trading futuro
Perps/derivativos entram apenas via protocolo externo auditado e adapter isolado. A fonte da posição, PnL e liquidação deve ser o protocolo/on-chain, não um gráfico de mercado.

## XP
Volume bruto não deve gerar XP linear ilimitado. Usar caps, diminishing returns, diversidade temporal e anti-wash para evitar farming artificial.