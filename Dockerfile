FROM ghcr.io/foundry-rs/foundry:latest AS foundry

FROM foundry AS protocol-builder
WORKDIR /build
COPY zoryq-contracts ./zoryq-contracts
RUN cd zoryq-contracts && \
    (test -f foundry.toml || printf '[profile.default]\nsrc = "src"\ntest = "test"\nout = "out"\nsolc_version = "0.8.24"\n' > foundry.toml) && \
    forge build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil
COPY zoryq-evm-node/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY zoryq-evm-node/server.mjs ./server.mjs
# Suppress Anvil startup account/mnemonic output in production logs.
RUN sed -i "s/const args=\['--host'/const args=['--silent','--host'/" ./server.mjs
COPY zoryq-evm-node/public-gateway.mjs ./public-gateway.mjs
COPY zoryq-evm-node/admin-control.mjs ./admin-control.mjs
COPY zoryq-evm-node/edge-gateway.mjs ./edge-gateway.mjs
COPY zoryq-evm-node/entrypoint.sh ./entrypoint.sh
COPY --from=protocol-builder /build/zoryq-contracts/out ./protocol-out
COPY zoryq-web ./web
RUN chmod +x /app/entrypoint.sh && mkdir -p /data
ENV PORT=8080
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
