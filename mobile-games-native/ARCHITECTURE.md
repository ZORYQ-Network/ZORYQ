# Native games architecture

`demo` is a validation host. `runtime` is the reusable product module.

The host enters through `ZoryqGameBridge` → `ZoryqGamesHubActivity`, which routes to Rush, Arena or Empire. Each game owns its Canvas/update loop and stores only local game state. Wallet signing remains outside this module.
