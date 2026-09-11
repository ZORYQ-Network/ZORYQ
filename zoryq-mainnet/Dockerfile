FROM ghcr.io/paradigmxyz/reth:v2.5.2 AS reth
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libstdc++6 libgcc-s1 libatomic1 coreutils gawk bash \
    && rm -rf /var/lib/apt/lists/*

COPY --from=reth /usr/local/bin/reth /usr/local/bin/reth
WORKDIR /app

COPY zoryq-mainnet/backend.mjs ./backend.mjs
COPY zoryq-mainnet/entrypoint.sh ./entrypoint.sh
COPY zoryq-mainnet/genesis-ceremony.mjs ./genesis-ceremony.mjs
COPY zoryq-mainnet/launch-certificate.mjs ./launch-certificate.mjs
COPY zoryq-evm-node/mainnet-guard.mjs ./mainnet-guard.mjs

RUN chmod 0755 /app/entrypoint.sh && mkdir -p /data/reth-mainnet

ENV PORT=8080 \
    ZORYQ_NETWORK_MODE=mainnet

# Only the public gateway is intended for Internet ingress. P2P and Engine API
# require explicit private/network policy at deployment time.
EXPOSE 8080/tcp
EXPOSE 30303/tcp
EXPOSE 30303/udp

ENTRYPOINT ["/app/entrypoint.sh"]
