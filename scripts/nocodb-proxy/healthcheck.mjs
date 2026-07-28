// Healthcheck del contenedor: sale 0 si el proxy responde 200 en /health, 1 si no.
const port = process.env.PORT || 8090;
const req = await fetch(`http://localhost:${port}/health`).catch(() => null);
process.exit(req && req.ok ? 0 : 1);
