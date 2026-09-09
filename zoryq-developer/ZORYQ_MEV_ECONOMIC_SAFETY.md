# ZORYQ MEV and Economic Safety Gates

ZORYQ must not claim "MEV protected" until concrete execution-path protections and evidence exist.

## Threats in scope

- front-running and sandwiching;
- stale or manipulated oracle data;
- stale quotes;
- excessive price impact;
- liquidation manipulation;
- sequencer/operator censorship or reordering;
- agent permission abuse;
- simulation/execution mismatch;
- gas-sponsorship draining;
- replay and cross-domain authorization;
- bridge/cross-domain message replay;
- DEX reserve manipulation;
- PerpDEX mark/index divergence.

## Immediate fail-closed policy

Automated financial execution should be rejected when any required invariant fails: deadline, slippage, price impact, oracle freshness, quote freshness, minimum output, oracle deviation, required private orderflow, required sandwich protection, or simulation binding.

The policy module in `economic-safety/economic-safety-policy.mjs` is a prototype safety gate. It is not evidence that the current public testnet has private orderflow or sandwich protection. Those flags deliberately fail closed when a product requires those properties but infrastructure cannot prove them.

## Promotion gates

### Designed
Threat documented with owner and mitigation.

### Implemented
Mitigation sits in the real execution path, not only UI.

### CI verified
Negative tests prove the mitigation rejects unsafe actions.

### Publicly verified
Dedicated testnet evidence proves behavior under realistic transactions.

### Externally reproduced
Independent builder/operator reproduces the result.

### Audited
Independent security review covers implementation and assumptions.

## DEX/Perps production requirements

Before production-grade financial claims, ZORYQ needs independent oracle sources, staleness/deviation guards, liquidation bounds, circuit breakers, maximum price-impact controls, documented ordering policy, replay protection, sponsorship quotas, invariant testing/fuzzing, and incident pause/recovery procedures.

## Claim boundary

Until those gates pass, use `economic-safety prototype`, `MEV mitigation target`, or `under validation`; do not say `MEV protected` as an unconditional property of the network.
