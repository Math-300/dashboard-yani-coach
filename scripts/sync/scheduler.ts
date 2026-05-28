/**
 * Guarda anti-solape para el pipeline de sync + helper de intervalo.
 * `createGuardedRunner` garantiza que nunca corran dos syncs en paralelo
 * (el `POST /run` manual y el timer comparten la misma guarda).
 */
export function createGuardedRunner<T>(runFn: () => Promise<T>) {
  let running = false;
  async function trigger(): Promise<{ skipped: true } | { skipped: false; result: T }> {
    if (running) return { skipped: true };
    running = true;
    try {
      const result = await runFn();
      return { skipped: false, result };
    } finally {
      running = false;
    }
  }
  return { trigger, isRunning: () => running };
}

/** Dispara `trigger` cada `intervalMs`. Errores se loguean, no tumban el proceso. */
export function startSchedule(intervalMs: number, trigger: () => Promise<unknown>): NodeJS.Timeout {
  return setInterval(() => {
    trigger().catch((err) => console.error('[scheduler] run falló:', err));
  }, intervalMs);
}
