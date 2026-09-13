# Host integration

For an Android host that already includes `:runtime`, launch the native Games Hub through the bounded bridge:

```kotlin
ZoryqGameBridge.openHub(
    activity = this,
    publicAddress = publicWalletAddress,
    profileId = publicProfileId,
    sessionCapability = shortLivedCapability
)
```

Do not pass a seed phrase, mnemonic or raw private key. Signing remains a host/wallet responsibility.

The hub currently routes to:

- `ZoryqRushActivity`
- `ZoryqArenaActivity`
- `ZoryqEmpireActivity`

The `demo` application exists only to validate the runtime independently from the legacy Wallet source-recovery problem.
