# NocoDB Pacing Proxy — cura del 429 (pacing global <5/s + backoff 429).
# Build desde la raíz del repo:
#   docker build -f scripts/nocodb-proxy/Dockerfile -t yani-nocodb-proxy:local .

FROM node:20-alpine

WORKDIR /app

# Solo tsx para ejecutar el TS. El proxy NO usa dependencias externas (stdlib pura).
RUN apk add --no-cache tini \
 && npm install --omit=dev --no-audit --no-fund tsx@4.19.2 typescript@5.6.3 \
 && npm cache clean --force

COPY scripts/nocodb-proxy/ ./scripts/nocodb-proxy/
COPY tsconfig.json ./tsconfig.json

EXPOSE 8090
ENV NODE_ENV=production \
    PORT=8090

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "scripts/nocodb-proxy/healthcheck.mjs"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "scripts/nocodb-proxy/proxy.ts"]
