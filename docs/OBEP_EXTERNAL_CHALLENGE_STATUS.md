# ZORYQ OBEP External Challenge — Status

Last updated: 2026-09-12

| Gate | Target | Current | Verified |
| --- | --- | --- | --- |
| Reference proof reproducibility | one-command public verification | implemented | yes, internal/public CI |
| Useful deterministic task | recompute -> accept -> settle -> verify | implemented | yes, internal/public CI + ZORYQ Testnet |
| External verifier | independent developer verifies reference proof | 0 verified for OBEP | no |
| External useful-task executor | independent executor produces task output | 0 | no |
| External useful-task verifier | independent verifier recomputes outcome | 0 | no |
| External reproduction settlement | fresh independent OBEP settlement on ZORYQ Testnet | 0 | no |

## Public entry points

- Challenge guide: `docs/OBEP_EXTERNAL_CHALLENGE.md`
- Reference verification: issue #129
- Useful-task challenge: issue #130
- Submission template: `.github/ISSUE_TEMPLATE/obep-external-verification.yml`

## Evidence policy

Internal CI proves engineering reproducibility but does not count as external adoption. A qualifying external result must come from a distinct person/team outside the ZORYQ project and include enough public non-secret evidence to reproduce or audit the result.
