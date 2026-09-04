# ZORIQ Revenue Security Controls

Revenue is a privileged path and must fail closed.

## Controls
- namespace-specific treasury selection;
- server-authoritative fee policy;
- quote id + expiry;
- visible fee disclosure before authorization;
- immutable revenue-event record after settlement;
- remote fee kill switch;
- no treasury signing secret in mobile/backend source;
- canary before enabling a new chain/provider;
- reconciliation alert when expected and on-chain settlement diverge.

## Treasury change
A production treasury change requires authenticated administration, audit trail, independent address verification, small canary payment, on-chain confirmation and rollback plan before receiving normal revenue.
