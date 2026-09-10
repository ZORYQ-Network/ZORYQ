# Arquitetura ZORYQ

## Visão
Arquitetura mobile-first com separação explícita entre **UI**, **domínio**, **providers financeiros**, **identidade**, **backend social**, **reward engine** e **telemetria**.

## Camadas
### Mobile
React Native + Expo. Expo Router organiza rotas. Estado sensível e estado visual não devem compartilhar o mesmo storage.

### Wallet layer
Abstração `WalletProvider` para permitir embedded wallet, smart account e wallets externas. Private keys/seed phrases nunca transitam pelo backend ZORYQ.

### Swap layer
`QuoteProvider` normaliza agregadores/bridges. A UI recebe quote assinado/identificado, validade, fee, gas, price impact e payload de execução.

### Social layer
API autenticada para posts, follows, mensagens, report/block e mídia. RLS/authorization server-side obrigatório.

### XP engine
Eventos imutáveis → regras versionadas → saldo derivado → snapshots opcionais. Nunca atualizar XP apenas no cliente.

### Integrations
Spotify usa OAuth PKCE no mobile. Providers externos recebem apenas scopes e dados necessários.

### Observabilidade
Crashes, performance, erros de API e métricas de produto devem excluir secrets, seeds, assinaturas e conteúdo privado por padrão.

## Fluxo de transação
1. usuário escolhe operação;
2. app solicita quote;
3. backend/provider retorna quote com TTL;
4. app exibe custos e risco;
5. wallet solicita confirmação local;
6. usuário assina;
7. app acompanha status on-chain;
8. backend registra apenas metadata permitida;
9. reward engine avalia evento elegível.

## Princípios
- zero trust entre módulos;
- least privilege;
- feature flags para recursos de alto risco;
- rollback simples;
- nenhuma chave privada em logs, analytics, crash reports ou banco ZORYQ;
- ambientes `dev`, `staging`, `production` isolados.