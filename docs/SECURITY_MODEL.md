# ZORYQ Unified Security Model

Security is a platform property. A green CI build is necessary but never substitutes for independent security evidence.

## Trust boundaries

### Wallet boundary

Secrets stay local. Mnemonic/private-key material must not cross into Social, Games, backend APIs, analytics or logs. Android Keystore protects the local encryption key; sensitive plaintext exists only transiently when signing/recovery requires it.

### Application boundary

Applications request scoped actions from the Wallet. They receive public identity/session context, never general signing authority.

### Backend boundary

Backends validate authorization server-side, rate-limit public surfaces, expire sessions and treat all client data as untrusted.

### Chain/RPC boundary

RPC input is hostile input. Transaction admission, chain ID, nonce, fees, destination and payload must be validated at appropriate layers.

### Autonomous-agent boundary

Agents never receive unlimited budgets by default. Authority is explicit, scoped, revocable and auditable. High-risk actions require policy gates or human confirmation until proven safe.

## Existing automated controls

Repository controls include Brand Guard, CodeQL and module/unit CI. Canonical Android workflows build from reviewable source and reject committed keystore/private-key material in the source-export path.

## Required production controls

- release signing with exclusive protected keys;
- dependency/SBOM scanning;
- secret scanning;
- replay protection and session expiration;
- transaction confirmation and chain-ID validation;
- rate limiting and abuse controls;
- backup/restore drills;
- incident-response exercises;
- least-privilege infrastructure roles;
- independent assessment/audit of critical wallet and protocol paths.

## Claim rule

Do not claim an external audit unless the auditor, exact commit/scope, report date and unresolved findings are identifiable. Do not publish sensitive findings before coordinated remediation.
