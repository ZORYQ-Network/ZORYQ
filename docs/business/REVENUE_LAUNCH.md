# Revenue Launch — Caminho mais rápido responsável

## A. KYVO Route Fee
1. Abrir/aprovar conta de integrador no agregador escolhido.
2. Registrar o identificador KYVO.
3. Configurar a wallet pública de recebimento da treasury no portal do parceiro.
4. Guardar API secrets somente no backend/secret manager.
5. Fazer o mobile consumir quotes pelo backend KYVO.
6. Mostrar network/provider/KYVO fee separadamente.
7. Executar canary de baixo valor após revisão de segurança.

## B. KYVO Pro
1. Criar produtos nas lojas.
2. Configurar entitlement `kyvo_pro` no provider de subscriptions.
3. Integrar SDK nativo no development build.
4. Testar purchase, restore, cancel e entitlement expiry.
5. Liberar premium por feature flags/entitlements.

## C. B2B Guard pilot
Depois de simulação/risk data reais, oferecer piloto privado de Guard API para wallets/dApps com usage caps, logs e contrato comercial.

A documentação e a UI não geram receita sozinhas. Partner/store accounts e usuários reais são dependências obrigatórias.
