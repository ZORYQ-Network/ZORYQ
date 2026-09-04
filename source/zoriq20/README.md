# ZORIQ reproducible source bundle

The numbered `part-*.b64` files concatenate into a base64 representation of the ZORIQ mobile source tarball.

Expected tarball SHA-256:
`ad8bdc4486c863b279367845ea26f5412734c02a80a326544f2a50725c1a5973`

This bundle exists to make the Android CI reproducible while the repository is being migrated away from the legacy packaged-source layout. The long-term repository target is normal first-class source files at the repo root.
