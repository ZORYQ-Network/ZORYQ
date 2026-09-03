# Security Release Checklist

## Antes de qualquer beta com dinheiro real
- [ ] threat model revisado;
- [ ] dependency audit limpo/triado;
- [ ] lockfile versionado;
- [ ] secrets somente em secret manager/GitHub Secrets;
- [ ] nenhum secret no bundle mobile;
- [ ] wallet provider definido e revisado;
- [ ] seed/private key nunca chega ao backend;
- [ ] transaction confirmation testada;
- [ ] deep links validados;
- [ ] OAuth PKCE testado;
- [ ] certificate/network policy revisada;
- [ ] RLS/authorization testadas;
- [ ] rate limiting ativo;
- [ ] logs redigidos de PII/secrets;
- [ ] backup/recovery testados;
- [ ] incident runbook ensaiado;
- [ ] feature flags/kill switches ativos;
- [ ] APK/AAB de release assinado com processo controlado;
- [ ] pentest mobile/API concluído;
- [ ] findings críticos/altos resolvidos ou formalmente aceitos.

## Depois de release
- crash-free monitoring;
- anomaly monitoring;
- dependency alerts;
- provider status;
- treasury reconciliation;
- abuse/sybil dashboard;
- revisão de permissões trimestral.