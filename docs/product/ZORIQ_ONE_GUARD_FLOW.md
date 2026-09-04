# ZORIQ ONE + Guard Execution Flow

1. User states an outcome or configures a transaction.
2. ONE normalizes the intent.
3. Route layer gathers eligible route candidates.
4. Guard evaluates destination, token/contract, approvals, route and simulation signals.
5. Policy removes routes that violate safety/compatibility rules.
6. UI shows expected output, provider/network cost, ZORIQ fee and risk explanation.
7. User explicitly authorizes.
8. Wallet signs locally/self-custodially.
9. ZORIQ tracks settlement.
10. Revenue ledger reconciles any disclosed ZORIQ fee.
11. XP engine evaluates only legitimate eligible activity.

No intent may silently bypass the transaction review for financially material actions.
