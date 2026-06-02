/**
 * HTTP wrapper del sync pipeline.
 *   GET  /health → 200 si el proceso vive (+ flag running)
 *   POST /run    → ejecuta el pipeline; 200/500 según resultado, 409 si ya corre
 * Timer interno: dispara el pipeline cada 1h (frescura del espejo Supabase).
 * `POST /run` y el timer comparten la misma guarda anti-solape (scheduler.ts).
 *
 * Seguridad: el service sólo escucha en la overlay interna de Swarm. No hay auth.
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import express from 'express';
import { createGuardedRunner, startSchedule } from './scheduler.js';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = resolve(process.cwd());
const SYNC_ENTRY = resolve(ROOT, 'scripts/sync/index.ts');
const MAX_DURATION_MS = 25 * 60 * 1000;       // 25 min — full sync real ~15min (NocoDB ~7min + Chatwoot ~8min) + FK/MV; margen ante throttle 429 NocoDB y rate-limit Chatwoot
const SYNC_INTERVAL_MS = 60 * 60 * 1000;      // 1h — frescura del espejo

interface RunResult {
  ok: boolean;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  elapsed_ms: number;
  log: string;
}

function runPipeline(): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const chunks: string[] = [];
    const child = spawn('npx', ['tsx', SYNC_ENTRY], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.once('close', () => clearTimeout(killTimer));
    }, MAX_DURATION_MS);

    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolveRun({
        ok: code === 0,
        exit_code: code,
        signal,
        elapsed_ms: Date.now() - started,
        log: chunks.join('').slice(-4000),
      });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolveRun({ ok: false, exit_code: null, signal: null, elapsed_ms: Date.now() - started, log: String(err) });
    });
  });
}

const runner = createGuardedRunner(runPipeline);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, running: runner.isRunning() });
});

app.post('/run', async (_req, res) => {
  const out = await runner.trigger();
  if (out.skipped === true) {
    res.status(409).json({ ok: false, error: 'sync already in progress' });
    return;
  }
  res.status(out.result.ok ? 200 : 500).json(out.result);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync-server] listening on :${PORT}`);
  startSchedule(SYNC_INTERVAL_MS, async () => {
    console.log('[scheduler] disparando sync programado...');
    const out = await runner.trigger();
    if (out.skipped === true) {
      console.warn('[scheduler] sync ya en curso, salteo esta vuelta');
      return;
    }
    if (!out.result.ok) console.error('[scheduler] sync falló:', out.result.log);
    else console.log(`[scheduler] sync ok en ${out.result.elapsed_ms}ms`);
  });
});
