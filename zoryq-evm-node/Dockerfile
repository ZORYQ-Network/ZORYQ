FROM ghcr.io/paradigmxyz/reth:v2.5.2 AS reth
FROM node:22-bookworm-slim AS node
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 libatomic1 && rm -rf /var/lib/apt/lists/*
COPY --from=reth /usr/local/bin/reth /usr/local/bin/reth
COPY --from=node /usr/local /usr/local
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY explorer-indexer.mjs ./
COPY explorer-service.mjs ./
COPY public-gateway.mjs ./
COPY admin-control.mjs ./
COPY edge-gateway.mjs ./
COPY traffic-gateway.mjs ./
COPY prepare-reth-genesis.mjs ./
COPY social-service.mjs ./
COPY product-gateway.mjs ./
COPY zoryq-reth-genesis.json ./
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh && mkdir -p /data/reth /app/web /app/protocol-out
ENV PORT=8080
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
