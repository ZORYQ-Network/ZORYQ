# External dependencies still required for real revenue

The repository can prepare the product, but these external accounts/credentials cannot be invented in code:

1. **Swap/bridge integrator account** — register KYVO with the selected routing partner and configure the fee-receiving treasury wallet.
2. **Embedded wallet production project** — create KYVO credentials with the selected self-custody wallet provider.
3. **App-store billing** — Google Play / Apple product setup and subscription provider public SDK keys.
4. **Spotify Developer app** — production Client ID and approved redirect/scopes.
5. **Backend production environment** — secrets, rate limiting, monitoring and admin controls.
6. **Legal/privacy review** — terms, privacy, fee disclosure and jurisdiction-specific launch controls.

Until these exist, KYVO must stay in preview/test mode for money-moving features.
