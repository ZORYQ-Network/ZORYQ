# Estrutura Oficial do Repositório ZORYQ

Este repositório concentra o ecossistema ZORYQ. A organização deve permanecer previsível: cada diretório representa uma responsabilidade clara e nomes legados não devem voltar a ser introduzidos.

```text
ZORYQ/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/              # CI, validação, deploy e smoke tests
├── docs/                       # arquitetura, produto, segurança e roadmap
├── registry/                   # metadados públicos da rede
├── zoryq-contracts/            # contratos Solidity e testes Foundry
├── zoryq-developer/            # documentação avançada, specs e ferramentas builders
├── zoryq-evm-node/             # node, gateways, explorer indexer e persistência
├── zoryq-mobile/               # aplicativo mobile ZORYQ Wallet
├── zoryq-public-devkit/        # kit público para integração com a rede
├── zoryq-validator-agent/      # agente/cliente de validação
├── zoryq-web/                  # superfícies web públicas
├── BRAND.md                    # identidade oficial
├── CONTRIBUTING.md             # regras de contribuição
├── Dockerfile                  # imagem principal da infraestrutura
├── README.md                   # entrada pública do projeto
├── SECURITY.md                 # política de segurança
└── WHITEPAPER.md               # visão técnica/econômica
```

## Regras de organização

1. Use `ZORYQ` em comunicação e `zoryq` em nomes técnicos lowercase.
2. Não adicionar arquivos compactados como fonte primária do projeto.
3. Não manter workflows duplicados ou obsoletos.
4. Arquivos temporários de deploy não devem permanecer versionados após cumprirem sua função.
5. Código de produção, contratos, web, mobile e tooling devem permanecer em diretórios separados.
6. Documentos devem apontar para caminhos reais e atuais do repositório.
7. Novas features devem entrar no diretório da responsabilidade correspondente, evitando pastas genéricas ou duplicadas.
8. Nomes de projetos anteriores não fazem parte da identidade atual nem devem aparecer em interfaces, documentação ou artefatos novos.

## Convenção de nomes

| Contexto | Padrão |
|---|---|
| Marca | `ZORYQ` |
| Prefixo técnico | `zoryq-` |
| Rede | `ZORYQ EVM Testnet` |
| Wallet | `ZORYQ Wallet` |
| Social | `ZORYQ Social` |
| Token nativo da testnet | `ZQ` |

## Objetivo

Quem abrir o repositório deve identificar imediatamente um único projeto, uma única marca e uma arquitetura clara. O histórico Git pode preservar a evolução interna, mas o estado atual do código deve representar exclusivamente ZORYQ.
