FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","server.mjs"]
