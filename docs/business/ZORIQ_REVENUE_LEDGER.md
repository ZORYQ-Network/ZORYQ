# ZORIQ Revenue Ledger

Every monetized route/payment must be independently reconcilable.

Minimum record:
- internal revenue event id;
- quote/order id;
- user/account reference only where necessary;
- chain namespace and chain id;
- transaction hash/signature;
- fee asset and decimals;
- gross ZORIQ fee;
- partner/provider share;
- net expected ZORIQ revenue;
- official treasury destination;
- disclosure/policy version;
- status: expected, submitted, confirmed, reconciled, exception;
- timestamps.

The ledger is accounting metadata, not custody. It never contains seed phrases or private keys.
