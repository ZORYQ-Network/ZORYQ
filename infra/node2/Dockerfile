FROM ghcr.io/paradigmxyz/reth:v2.5.2

LABEL org.opencontainers.image.title="ZORYQ Node 2 Observer" \
      org.opencontainers.image.description="Non-producing ZORYQ Reth peer for redundancy testing" \
      org.opencontainers.image.source="https://github.com/ZORYQ-Network/ZORYQ"

USER root
WORKDIR /app
COPY infra/node2/observer-entrypoint.sh /app/observer-entrypoint.sh
RUN chmod 0755 /app/observer-entrypoint.sh && mkdir -p /data/reth

VOLUME ["/data"]
EXPOSE 30303/tcp 30303/udp 8545/tcp
ENTRYPOINT ["/app/observer-entrypoint.sh"]
