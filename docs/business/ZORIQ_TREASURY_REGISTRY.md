# ZORIQ Treasury Registry

These addresses were designated by the project owner as public receiving treasuries.

| Namespace | Network family | Official public treasury |
|---|---|---|
| `eip155` | EVM-compatible networks | `0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33` |
| `solana` | Solana | `53uWrDJCiGtFHZPFiCzuRGPbSxEYaep2JC5mCQqZV3jG` |
| `bitcoin` | Bitcoin Native SegWit | `bc1q55tt9sphzstjvs3tzylxsltxvvwsv8l69dydmg` |

## Safety rules
- Never fall back from one namespace to another.
- Reject fee settlement when the route namespace has no configured compatible treasury.
- These are public destinations, never signing credentials.
- Seeds/private keys must never be committed, logged or stored by the ZORIQ application/backend.
- Treasury changes require authenticated administration, audit trail, canary transfer and reconciliation before activation.
