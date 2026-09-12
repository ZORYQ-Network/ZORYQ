# ZORYQ External Reproduction Protocol

The next traction milestone is not a follower count. It is an independent engineer reproducing a useful ZORYQ path without privileged knowledge.

## First target

**Fresh wallet → Faucet → RPC balance → Signed transaction → Receipt**

Use the canonical developer onboarding documentation and Issue #55 for the current P0 status. Do not use a team-controlled pre-funded wallet as evidence of external onboarding.

## What counts as independent

A reproduction counts only when the participant is not operating as the ZORYQ infrastructure owner for the run and does not receive a private key, secret endpoint, private faucet bypass or undocumented privileged instruction.

## Evidence to publish safely

- date/time in UTC;
- public wallet address used for the test;
- faucet request outcome with secrets/tokens redacted;
- balance before and after;
- transaction hash;
- receipt status;
- chain ID observed through RPC;
- public instructions followed;
- tool/runtime versions;
- any failure or undocumented step encountered.

Never publish seed phrases, private keys, authentication tokens, infrastructure secrets or private personal information.

## Success definition

The run succeeds when a fresh wallet obtains test ZQ through the documented public path, signs a real transaction and receives an RPC-verifiable successful receipt on Chain ID 5919065.

A successful run should be linked from Issue #55. Only then should ZORYQ promote this stage from P0 hardening to a supported zero-to-build step.

## Next reproduction gates

After the first transaction gate:

1. deploy a minimal contract with ordinary EVM tooling;
2. call/read the contract and verify receipts/logs;
3. build a minimal external application without privileged setup;
4. accept an external contribution improving the path;
5. record an independent ecosystem project.

## Growth rule

Count verified external developers and applications, not anonymous page impressions, as the primary developer-traction signal.