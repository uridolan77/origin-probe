FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY lib ./lib
COPY scripts ./scripts
COPY sql ./sql
ENV PORT=8787
ENV MEASUREMENT_REQUIRE_SECRETS=true
EXPOSE 8787
CMD ["sh", "-c", "node scripts/migrate.mjs && node scripts/server.mjs"]
