# ZORIQ Monetization Activation Checklist

## Route revenue
- [ ] production quote/routing partner approved
- [ ] integrator identity configured server-side
- [ ] EVM treasury canary received and reconciled
- [ ] Solana treasury canary received and reconciled
- [ ] Bitcoin treasury tested only for BTC-native payment flows
- [ ] ZORIQ fee shown separately from provider/network costs
- [ ] fee policy version included in every quote
- [ ] remote fee kill switch tested
- [ ] transaction/revenue ledger reconciles on-chain

## ZORIQ Pro
- [ ] Google Play product created
- [ ] Apple product created before iOS launch
- [ ] entitlement provider configured
- [ ] restore purchases flow tested
- [ ] localized prices come from store, not hardcoded checkout values
- [ ] premium benefits do not imply token/airdrop guarantee

## Guard / ONE B2B
- [ ] authenticated API keys
- [ ] quotas/rate limits
- [ ] metering
- [ ] billing/usage reconciliation
- [ ] partner SLA and incident channel
- [ ] sensitive payload minimization

## Release gate
Live monetization stays disabled until the applicable section above is complete. ZORIQ must never collect a fee that was not disclosed before the user authorizes the transaction.
