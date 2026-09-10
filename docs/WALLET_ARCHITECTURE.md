# ZORYQ Wallet Architecture

## Objetivo
Oferecer wallet própria dentro do app com experiência simples, preservando self-custody e evitando custódia operacional pela ZORYQ.

## Modelo recomendado
A implementação de produção deve escolher uma arquitetura auditável entre:
- embedded wallet com chaves distribuídas/MPC;
- smart account com passkey e recuperação;
- key material protegido por hardware-backed keystore quando aplicável.

`expo-secure-store` pode proteger pequenos secrets/tokens locais, mas não deve ser tratado isoladamente como estratégia completa para material criptográfico irrecuperável. O projeto seguirá threat modeling e controles OWASP MASVS.

## Regras inegociáveis
- seed/private key nunca enviada ao Supabase, analytics ou API ZORYQ;
- seed nunca exibida automaticamente;
- screenshots bloqueados em telas críticas quando suportado;
- clipboard com aviso/limpeza para secrets;
- biometria/PIN para ações sensíveis;
- confirmação explícita de rede, destino e valor;
- proteção contra address poisoning e clipboard replacement;
- warning de approvals ilimitadas;
- revogação/gerenciamento de sessões dApp;
- recovery documentado e testado.

## Wallets externas
Suportar WalletConnect/Reown e conectores nativos conforme ecossistema. A wallet ZORYQ continua sendo a experiência padrão, não requisito obrigatório.

## Redes
A wallet layer deve usar namespaces por ecossistema (`eip155`, `solana`, `bitcoin`, etc.) e adapters separados. Não assumir que uma API EVM funciona em Solana/Bitcoin/TON/Sui.

## Mainnet gate
Mainnet só é habilitada após:
1. provider definido;
2. threat model revisado;
3. auditoria/assessment independente do fluxo crítico;
4. testes em dispositivos reais;
5. incident response ativo;
6. backups e recovery testados;
7. kill switch/feature flag disponível.