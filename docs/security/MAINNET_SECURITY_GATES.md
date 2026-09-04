# Mainnet Security Gates

The following classes block production if unresolved:

- seed/private-key exposure;
- unsigned or unvalidated transaction substitution;
- fee destination ambiguity;
- inability to disable a compromised route/provider;
- missing transaction review for asset changes;
- critical authentication/session bypass;
- production secrets in mobile/repository;
- known critical dependency vulnerability in the signing path.

Mainnet approval requires documented evidence, not only a visual test.
