FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
WORKDIR /app
COPY package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./server.mjs
COPY social.mjs ./social.mjs
COPY media.mjs ./media.mjs
COPY communities.mjs ./communities.mjs
COPY messages.mjs ./messages.mjs
COPY gateway.mjs ./gateway.mjs
ENV NODE_ENV=production PORT=8080 SOCIAL_DATA_DIR=/data SOCIAL_MEDIA_DIR=/data/social-media COMMUNITY_DATA_DIR=/data MESSAGE_DATA_DIR=/data
EXPOSE 8080
CMD ["node","/app/gateway.mjs"]
