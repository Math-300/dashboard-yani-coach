/**
 * HTTP wrapper del sync pipeline. Lo dispara n8n via POST /run cada 6h.
 *
 * Endpoints:
 *   GET  /health → 200 si el proceso vive
 *   POST /run    → ejecuta `tsx scripts/sync/index.ts` como child process;
 *                  responde 200 + JSON on success, 500 on failure.
 *
 * Seguridad: el service sólo escucha en la overlay interna de Swarm.
 * No hay auth — si llegás al puerto, ya estás dentro de la red.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import express from 'express';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = resolve(process.cwd());
const SYNC_ENTRY = resolve(ROOT, 'scripts/sync/index.ts');
const MAX_DURATION_MS = 10 * 60 * 1000; // 10 min — el sync real tarda ~90s

let running = false;

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, running });
});

app.post('/run', async (_req, res) => {
  if (running) {
    return res.status(409).json({ ok: false, error: 'sync already in progress' });
  }
  running = true;
  const started = Date.now();
  const chunks: string[] = [];

  const child = spawn('npx', ['tsx', SYNC_ENTRY], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5000);
  }, MAX_DURATION_MS);

  child.stdout.on('data', (d) => chunks.push(d.toString()));
  child.stderr.on('data', (d) => chunks.push(d.toString()));

  child.on('close', (code, signal) => {
    clearTimeout(timer);
    running = false;
    const elapsed = Date.now() - started;
    const log = chunks.join('').slice(-4000); // últimos 4KB
    if (code === 0) {
      res.status(200).json({ ok: true, elapsed_ms: elapsed, log });
    } else {
      res.status(500).json({ ok: false, exit_code: code, signal, elapsed_ms: elapsed, log });
    }
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    running = false;
    res.status(500).json({ ok: false, error: err.message });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync-server] listening on :${PORT}`);
});
