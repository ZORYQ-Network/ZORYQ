# Estrutura Alvo do Repositório

A fase atual usa `kyvo-source.zip` como bootstrap reproduzível do APK. A estrutura alvo é manter código-fonte diretamente versionado:

```text
Kyvo-mobile/
  app/                 # Expo Router screens
  src/
    components/
    context/
    data/
    i18n/
    services/
    theme/
    wallet/
    swap/
    social/
    rewards/
  assets/
  docs/
  supabase/
    migrations/
    functions/
  tests/
    unit/
    integration/
    e2e/
  .github/
    workflows/
    ISSUE_TEMPLATE/
  app.json
  eas.json
  package.json
  package-lock.json
  SECURITY.md
  WHITEPAPER.md
```

## Regra
Código crítico não deve permanecer permanentemente dentro de ZIP. O ZIP é apenas mecanismo de bootstrap desta primeira automação e deve ser removido quando o source tree for publicado diretamente no repositório.