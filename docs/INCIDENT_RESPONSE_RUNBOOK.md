# ZORYQ Incident Response Runbook

Status: operational runbook template; tabletop and live-drill evidence still required.

## Severity

- **SEV-1:** signer/validator compromise, chain divergence/finality failure, critical exploit, unauthorized upgrade, widespread loss of availability.
- **SEV-2:** sustained RPC/faucet/explorer outage, one-operator loss, serious dependency vulnerability without active exploitation, repeated node crash/corruption.
- **SEV-3:** degraded service, isolated endpoint failure, non-critical monitoring or UX incident.

## First 15 minutes

1. Assign incident lead and evidence recorder.
2. Record UTC start time, affected services, current chain/finality state and known symptoms.
3. Preserve logs and machine state before destructive actions.
4. If secrets or signers may be compromised, stop affected signing duties and begin revocation/rotation procedure.
5. If chain divergence is suspected, stop promotional claims and unsafe automated recovery; compare trusted operator heads/finality before resuming.
6. Separate containment from restoration: prevent further damage first.

## Scenario playbooks

### Signer or validator compromise

- isolate affected signer/validator;
- revoke access where architecture supports it;
- activate documented replacement/rotation procedure;
- verify other signers and hosts independently;
- inspect unauthorized proposals/transactions/config changes;
- do not reuse potentially compromised secrets;
- require explicit security review before reactivation.

### Chain divergence or finality failure

- capture execution head, consensus head, finalized checkpoint and peer state from every independent operator;
- stop unsafe validator automation where continuing could deepen divergence;
- compare genesis/config/client versions;
- identify first divergent slot/block;
- preserve evidence before resync/recovery;
- execute only a protocol-defined recovery procedure;
- publish a postmortem before claiming normal finality guarantees again.

### RPC abuse / denial of service

- preserve request/error metrics;
- rate-limit abusive classes without disabling protocol-critical validation;
- isolate public gateway from execution/consensus management APIs;
- confirm administrative, Engine API and signing methods remain inaccessible publicly;
- restore traffic gradually and watch saturation/error rates.

### Data corruption

- stop writes if continuing may worsen corruption;
- hash/preserve damaged state where useful;
- follow `DISASTER_RECOVERY_RUNBOOK.md`;
- compare recovered canonical/finalized hashes with an independent operator.

### Critical dependency vulnerability

- identify exact affected version/component;
- freeze unrelated releases;
- evaluate exploitability against ZORYQ configuration;
- patch or isolate with a reviewable change;
- run focused regression/security tests;
- document residual risk and rollout evidence.

## Communications

Public communications must distinguish:

- observed fact;
- suspected cause;
- confirmed cause;
- current user impact;
- mitigation;
- unresolved risk.

Do not claim resolution until monitoring and independent evidence support it. Never publish secrets, private exploit details that create immediate harm, or personal operator information.

## Recovery closure gate

An incident closes only when:

- immediate threat is contained;
- canonical/finality state is verified where relevant;
- services are stable under observation;
- compromised credentials are rotated/revoked;
- evidence package is stored;
- corrective actions are assigned;
- postmortem owner and date are recorded.

## Postmortem

Every SEV-1 and material SEV-2 incident receives a blameless technical postmortem containing timeline, impact, root cause, contributing factors, detection gaps, recovery evidence, corrective actions and claim-boundary changes.

## Mainnet evidence

Before mainnet promotion, run at least one tabletop exercise covering signer compromise and one recovery exercise covering node loss/corruption. Bind the resulting redacted evidence artifacts into the mainnet launch manifest by SHA-256.
