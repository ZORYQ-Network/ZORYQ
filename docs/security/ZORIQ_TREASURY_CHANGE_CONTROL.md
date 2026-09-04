# ZORIQ Treasury Change Control

Official treasury addresses are high-impact configuration.

A change must require:
1. authenticated owner/admin request;
2. independent copy/address verification;
3. network-format validation;
4. audit-log entry with old/new address and policy version;
5. small canary transfer;
6. on-chain confirmation;
7. reconciliation confirmation;
8. delayed full activation/rollback capability.

Never store or request the private key or seed corresponding to a treasury address.
