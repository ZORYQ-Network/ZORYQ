FROM ghcr.io/paradigmxyz/reth:v2.5.2@sha256:68e76b32ad9ac1a3de54984d6f15bbce2047a92a771ff4efbcd08ee8f9dbd4d1 AS reth
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS node
FROM ubuntu:24.04@sha256:224a1869083a311ef3f13648a154ba79832fbef6364d31493642ca03082da254

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libstdc++6 libgcc-s1 libatomic1 coreutils gawk bash \
    && rm -rf /var/lib/apt/lists/*

COPY --from=reth /usr/local/bin/reth /usr/local/bin/reth
COPY --from=node /usr/local /usr/local
WORKDIR /app

COPY zoryq-mainnet/backend.mjs ./backend.mjs
COPY zoryq-mainnet/entrypoint.sh ./entrypoint.sh
COPY zoryq-mainnet/genesis-ceremony.mjs ./genesis-ceremony.mjs
COPY zoryq-mainnet/launch-certificate.mjs ./launch-certificate.mjs
COPY zoryq-mainnet/key-custody-evidence.mjs ./key-custody-evidence.mjs
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
