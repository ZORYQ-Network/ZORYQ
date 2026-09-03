# Build and Release

GitHub Actions is the source of truth for Android test APKs.

## Flow
`kyvo-src.tgz` base -> apply `overrides/` -> install dependencies -> Expo dependency alignment -> TypeScript -> Expo Doctor -> prebuild Android -> Gradle debug APK -> artifact + SHA-256.

## Production
Debug APK is not a production release. Production requires protected signing credentials and a separate controlled workflow for AAB/Play Store distribution.
