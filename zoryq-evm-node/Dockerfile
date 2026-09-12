FROM rust:1.94-bookworm AS rust-gateway-builder
WORKDIR /build/zoryq-gateway
COPY rust-gateway/Cargo.toml ./Cargo.toml
COPY rust-gateway/src ./src
RUN cargo build --release

FROM ghcr.io/paradigmxyz/reth:v2.5.2 AS reth
FROM node:22-bookworm-slim AS node
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 libatomic1 && rm -rf /var/lib/apt/lists/*
COPY --from=reth /usr/local/bin/reth /usr/local/bin/reth
COPY --from=node /usr/local /usr/local
COPY --from=rust-gateway-builder /build/zoryq-gateway/target/release/zoryq-gateway /usr/local/bin/zoryq-gateway
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY ai-ceo.mjs ./
COPY mainnet-guard.mjs ./
COPY prepare-reth-genesis.mjs ./
COPY publish-canonical-chain-spec.mjs ./
COPY zoryq-reth-genesis.json ./
RUN mkdir -p /data/reth /app/web /app/protocol-out
COPY network-maturity.json /app/web/network-maturity.json
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh /usr/local/bin/zoryq-gateway
ENV PORT=8080
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
