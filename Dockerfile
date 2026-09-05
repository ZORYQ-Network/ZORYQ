FROM ghcr.io/foundry-rs/foundry:latest AS foundry

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil
COPY zoryq-evm-node/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY zoryq-evm-node/server.mjs ./server.mjs
RUN mkdir -p /data
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.mjs"]
