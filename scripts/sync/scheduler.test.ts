/**
 * Tests de la guarda anti-solape. Uso: npx tsx scripts/sync/scheduler.test.ts
 */
import assert from 'node:assert/strict';
import { createGuardedRunner } from './scheduler.js';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

(async () => {
  // 1) Segundo trigger mientras el primero corre → skipped
  {
    const d = deferred<string>();
    const runner = createGuardedRunner(() => d.promise);
    const p1 = runner.trigger();
    const out2 = await runner.trigger();
    assert.deepEqual(out2, { skipped: true });
    assert.equal(runner.isRunning(), true);
    d.resolve('ok');
    const out1 = await p1;
    assert.deepEqual(out1, { skipped: false, result: 'ok' });
    assert.equal(runner.isRunning(), false);
  }
  // 2) Tras completar, se puede volver a disparar
  {
    const runner = createGuardedRunner(async () => 42);
    assert.deepEqual(await runner.trigger(), { skipped: false, result: 42 });
    assert.deepEqual(await runner.trigger(), { skipped: false, result: 42 });
  }
  // 3) runFn que lanza → el flag running se resetea (finally)
  {
    const runner = createGuardedRunner(async () => { throw new Error('boom'); });
    await assert.rejects(runner.trigger(), /boom/);
    assert.equal(runner.isRunning(), false);
  }
  console.log('✓ scheduler: 3/3 casos pasaron');
})();
