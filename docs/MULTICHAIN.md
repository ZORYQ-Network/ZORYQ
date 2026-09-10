# Estratégia Multi-chain

## Objetivo
A ZORYQ deve crescer por adapters e catálogo dinâmico, evitando telas e regras hardcoded por rede.

## Namespaces
- EVM / `eip155`
- Solana
- Bitcoin
- Sui
- TON
- Tron
- outros apenas com adapter explícito

## Chain Registry
Cada rede possui `namespace`, `chainId`, nome, moeda nativa, explorers, RPC policy, status, capabilities e risk tier.

## Capabilities
Uma rede pode suportar apenas leitura de saldo, enquanto outra suporta send, swap, bridge, NFTs e smart accounts. A UI deve derivar ações de `capabilities`, não do nome da rede.

## RPC
- múltiplos RPCs por rede quando viável;
- health check e fallback;
- rate limit;
- nunca confiar em um RPC para validação crítica sem sanity checks.

## Tokens
Token metadata deve vir de fontes aprovadas e cacheadas. Tokens adicionados por contrato precisam de warning e risk scan.

## Segurança cross-chain
Bridges são risco adicional. A ZORYQ deve exibir origem, destino, tempo estimado, provider, fee, slippage, status de bridge e link de tracking.