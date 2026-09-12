# APK distribution requirements

Before enabling the production download button:
- generate a signed release APK through reproducible CI;
- publish SHA-256 checksum;
- record version and build commit;
- host the artifact on an official ZORYQ-controlled release URL;
- show experimental-testnet notice;
- do not silently sideload or auto-update outside an explicit user action.
