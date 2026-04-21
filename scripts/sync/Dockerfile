# Sync service: NocoDB -> Supabase
# Build desde la raíz del repo: docker build -f scripts/sync/Dockerfile -t yani-dashboard-sync:local .

FROM node:20-alpine

WORKDIR /app

# Deps mínimas para el sync + HTTP server.
# No bajamos todo el package.json del Dashboard — sólo lo que sync necesita.
RUN apk add --no-cache tini \
 && npm install --omit=dev --no-audit --no-fund \
      tsx@4.19.2 \
      typescript@5.6.3 \
      dotenv@16.4.7 \
      @supabase/supabase-js@2.46.1 \
      express@4.21.2 \
 && npm cache clean --force

# Código del sync
COPY scripts/sync/ ./scripts/sync/

# Tipos mínimos de TS compartidos
COPY tsconfig.json ./tsconfig.json

# Entrypoint HTTP
EXPOSE 3000
ENV NODE_ENV=production \
    PORT=3000

# tini reapea zombies y maneja SIGTERM correctamente
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "scripts/sync/server.ts"]
