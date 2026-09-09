# KYVO ONE — Intent Engine

## Objetivo
Fazer o usuário declarar o resultado desejado, sem precisar montar manualmente rede, bridge, DEX, gas e approvals.

Exemplos:
- `Quero enviar 500 USDC para @michael pela rota segura mais barata.`
- `Quero transformar 0,2 ETH em SOL.`
- `Mova meu USDC da Base para Solana com price impact máximo de 0,5%.`

## Pipeline
`Intent -> Constraints -> Candidate Routes -> Cost/Risk Ranking -> KYVO Guard -> Review -> Signature -> Execution`

## Review obrigatório
Antes da assinatura a KYVO deve exibir: ativo de entrada/saída, redes, valor esperado, gas, bridge/DEX fees, KYVO fee, slippage, price impact, tempo estimado e Guard score.

## MVP
O APK implementa planejamento local demonstrativo. A execução real depende de backend de routing, adapters de quotes e wallet segura.
