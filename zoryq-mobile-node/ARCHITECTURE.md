# Architecture

Android UI -> local witness scheduler -> multi-RPC verifier -> checkpoint agreement -> local participation metrics.

The mobile node does not hold consensus keys in v1 and does not produce blocks. Its security value comes from independent observation and cross-checking. Future relay or light-client proof verification must be added only after protocol-level verification is available.
