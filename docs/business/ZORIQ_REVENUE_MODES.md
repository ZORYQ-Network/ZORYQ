# ZORIQ Revenue Modes

## `preview`
Default. UI may estimate/display a potential ZORIQ fee for testing, but the application must not instruct a provider to collect or settle that fee.

## `live`
Allowed only after provider/integrator, namespace treasury, disclosure, canary, reconciliation and kill-switch gates pass.

## Fail-closed behavior
If the chain namespace is unsupported, the treasury is absent/invalid, the quote policy is stale or partner fee support is unknown, ZORIQ does not charge the application fee.
