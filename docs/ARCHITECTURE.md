# Arquitetura ZORYQ

## Visão
ZORYQ adota separação explícita entre **interface**, **wallet**, **execução EVM**, **gateways públicos**, **serviços sociais**, **indexação**, **contratos**, **persistência** e **observabilidade**.

## Camadas
### Interfaces
As superfícies web e mobile devem permanecer desacopladas da infraestrutura de execução. Interfaces nunca devem depender de segredos do backend.

### Wallet layer
A abstração de wallet deve permitir embedded wallet, smart accounts e wallets externas. Private keys e seed phrases nunca transitam por APIs ZORYQ.

### Execution layer
A ZORYQ EVM Testnet expõe interfaces JSON-RPC compatíveis com clientes EVM. O cliente de execução deve permanecer isolado atrás dos gateways públicos e controles de tráfego.

### Gateway layer
Gateways separam tráfego público, administração, explorer, faucet e serviços de produto. Métodos administrativos ou inseguros não devem ser expostos pela superfície pública.

### Social layer
Perfis, posts e ações sociais usam autorização por wallet e devem distinguir claramente estado off-chain de provas ancoradas on-chain.

### Explorer e indexação
Indexadores derivados não são fonte de verdade da chain. Devem ser reconstruíveis, limitados em memória e resistentes a dados incompletos.

### Contratos
Contratos Solidity ficam isolados em `zoryq-contracts/`, com testes reproduzíveis e artefatos gerados fora do código-fonte principal.

### Persistência
Estado persistente deve usar escrita atômica, validação e procedimentos explícitos de restore/checkpoint. Dados críticos não devem depender de arquivos temporários de deploy.

### Observabilidade
Crashes, performance, memória, erros RPC e métricas operacionais devem excluir secrets, seeds, private keys, assinaturas sensíveis e conteúdo privado por padrão.

## Fluxo simplificado
```text
Wallets / Apps / Builders
          |
          v
   Public ZORYQ Gateway
          |
    +-----+------+----------------+
    |            |                |
    v            v                v
 EVM RPC      Explorer         Social/API
    |            |                |
    v            v                v
Execution     Indexers        Product state
 Client
    |
    v
Persistent storage / checkpoints
```

## Princípios
- zero trust entre módulos;
- least privilege;
- superfícies públicas mínimas;
- limites explícitos de tráfego e memória;
- feature flags para recursos de alto risco;
- rollback e recovery documentados;
- nenhuma chave privada em logs, analytics ou bancos de produto;
- ambientes de desenvolvimento, staging e produção isolados;
- `ZORYQ` como única identidade oficial do sistema.
