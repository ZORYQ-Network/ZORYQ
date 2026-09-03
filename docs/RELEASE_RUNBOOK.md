# Release Runbook

## Branches
- `main`: release-ready;
- feature branches curtas;
- PR obrigatório quando equipe crescer.

## CI
Cada alteração deve passar typecheck, lint, tests, Expo Doctor e build Android. Releases de produção adicionam signing controlado, AAB e store pipeline.

## Versionamento
SemVer para app quando possível e `versionCode` Android monotônico.

## Ambientes
`dev`, `staging`, `production` com project IDs, API URLs e secrets isolados.

## Release candidate
1. freeze de features;
2. dependency/security check;
3. smoke tests Android/iOS;
4. wallet/transaction tests;
5. i18n checks;
6. privacy/permissions checks;
7. rollout notes;
8. staged rollout.

## Rollback
Mobile binaries não somem instantaneamente. Recursos críticos devem usar feature flags server-side para desligamento imediato sem depender de nova loja.