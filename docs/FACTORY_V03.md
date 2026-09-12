# ZORYQ AI App Factory v0.3

Status: experimental testnet product surface.

## What v0.3 adds

- server-side generalized prompt compiler with a reusable module catalog;
- domain presets for condominium, clinic, education, commerce, restaurants, logistics, construction, agencies and support/helpdesk;
- generic schema fallback when a requested domain is not in the catalog;
- evolution of an existing application spec without discarding the previous app;
- add/remove module, add field, rename app and cloud/blockchain toggles in supported evolution prompts;
- public `/factory/compile`, `/factory/evolve`, `/factory/compiler/status` endpoints;
- public `/factory/studio-v3` proving surface;
- hardened cloud store with atomic primary file, rolling backup, append-only journal, quotas, audit events, export and optimistic revisions;
- existing owner/admin/editor/viewer roles retained;
- PostgreSQL/Supabase target migration in `infra/factory-postgres/001_init.sql`.

## Claim boundary

The compiler is substantially broader than v0.2, but it is **not** represented as universal arbitrary software synthesis. It is designed for schema-driven CRUD/workflow applications and known reusable capabilities. External APIs, arbitrary business engines, custom binary/native code, complex media pipelines and high-risk smart contracts require dedicated capability modules and validation.

The current live cloud store remains an experimental Railway-volume implementation. v0.3 makes it more durable and concurrency-aware, but it is not a substitute for a production PostgreSQL deployment with managed backups, point-in-time recovery, database observability and independently reviewed security.

## PostgreSQL cutover gate

Do not reuse an unrelated existing Supabase project. A dedicated ZORYQ Factory database should be provisioned before applying `infra/factory-postgres/001_init.sql`. After provisioning, the migration should be applied, RLS/security advisors checked, a backup/restore drill run, and dual-write/readback evidence captured before the JSON+journal store is retired.

## APK status

A real per-app Android build workflow exists and has produced a personalized installable debug APK with SHA-256 evidence. The remaining product gap is an authenticated build broker that can request the workflow or an isolated Android build worker and return the resulting artifact directly to the Factory UI. That requires a dedicated credential/worker boundary and should not be emulated with a public GitHub token.

## External-user evidence

Project-controlled CI proves public reproducibility but does not count as independent human adoption. Independent reproduction remains a separate evidence gate. The product should record verifiable evidence only after an external operator/user performs the flow from infrastructure and credentials not controlled by the ZORYQ primary operator.
