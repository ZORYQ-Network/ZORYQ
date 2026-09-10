FROM ghcr.io/foundry-rs/foundry:latest AS foundry
FROM foundry AS protocol-builder
USER root
WORKDIR /build
COPY zoryq-contracts ./zoryq-contracts
RUN cd zoryq-contracts && \
    (test -f foundry.toml || printf '[profile.default]\nsrc = "src"\ntest = "test"\nout = "out"\nsolc_version = "0.8.24"\n' > foundry.toml) && \
    forge build

FROM rust:1.94-bookworm AS rust-gateway-builder
WORKDIR /build/zoryq-gateway
COPY zoryq-evm-node/rust-gateway/Cargo.toml ./Cargo.toml
COPY zoryq-evm-node/rust-gateway/src ./src
RUN cargo build --release

FROM ghcr.io/paradigmxyz/reth:v2.5.2 AS reth
FROM node:22-bookworm-slim AS node
FROM ubuntu:24.04
LABEL org.opencontainers.image.title="ZORYQ EVM Testnet" \
      org.opencontainers.image.description="ZORYQ public testnet node, gateway and developer surfaces" \
      org.opencontainers.image.source="https://github.com/ZORYQ-Network/ZORYQ"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libgcc-s1 libatomic1 && rm -rf /var/lib/apt/lists/*
COPY --from=reth /usr/local/bin/reth /usr/local/bin/reth
COPY --from=node /usr/local /usr/local
COPY --from=rust-gateway-builder /build/zoryq-gateway/target/release/zoryq-gateway /usr/local/bin/zoryq-gateway
WORKDIR /app
COPY zoryq-evm-node/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY zoryq-evm-node/server.mjs ./server.mjs
COPY zoryq-evm-node/ai-ceo.mjs ./ai-ceo.mjs
COPY zoryq-evm-node/prepare-reth-genesis.mjs ./prepare-reth-genesis.mjs
COPY zoryq-evm-node/deploy-autonomous-economy.mjs ./deploy-autonomous-economy.mjs
COPY zoryq-evm-node/deploy-one-prompt-company.mjs ./deploy-one-prompt-company.mjs
COPY zoryq-evm-node/deploy-autonomous-company-v2.mjs ./deploy-autonomous-company-v2.mjs
COPY zoryq-evm-node/deploy-autonomous-company-v3.mjs ./deploy-autonomous-company-v3.mjs
COPY zoryq-evm-node/zoryq-reth-genesis.json ./zoryq-reth-genesis.json
COPY zoryq-evm-node/entrypoint.sh ./entrypoint.sh
COPY --from=protocol-builder /build/zoryq-contracts/out ./protocol-out
COPY zoryq-web ./web
RUN chmod +x /app/entrypoint.sh /usr/local/bin/zoryq-gateway && mkdir -p /data/reth /app/web /app/protocol-out
ENV PORT=8080
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
