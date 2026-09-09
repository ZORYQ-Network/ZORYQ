FROM ghcr.io/foundry-rs/foundry:latest AS foundry
FROM node:22-bookworm-slim
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
COPY public-gateway.mjs ./
COPY admin-control.mjs ./
COPY edge-gateway.mjs ./
COPY traffic-gateway.mjs ./
COPY entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh && mkdir -p /data /app/web /app/protocol-out
ENV PORT=8080
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
