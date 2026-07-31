/**
 * Suite de integración de SEGURIDAD del guard de sesión.
 *
 * Levanta un Express real montando el middleware REAL `requireSession` delante
 * de una ruta protegida de prueba (stand-in de `/api/metrics/*`) y le pega por
 * HTTP con distintas cookies. Cierra la brecha que quedaba probada sólo por
 * razonamiento: que el guard responde 401/200 de verdad sobre la red, no sólo
 * que `verifyToken` devuelve null en un unit test.
 *
 * NO toca Supabase: se prueba la FRONTERA DE AUTORIZACIÓN (el único defensor de
 * los endpoints de datos), no la capa de datos. `service_role` y las filas
 * quedan fuera de alcance a propósito.
 *
 * Uso: npx tsx scripts/web/security.test.ts
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

const SECRET = 'integration-secret';

// requireSession captura AUTH_SECRET en tiempo de import → fijarlo ANTES del import dinámico.
process.env.AUTH_SECRET = SECRET;

const { requireSession } = await import('./requireSession.js');
const { createSessionToken, buildCookie, sign, base64Url, COOKIE_NAME, COOKIE_TTL_SECONDS } =
  await import('../../api/auth/core.js');

/** Forja un token firmado correctamente con SECRET a partir de un payload arbitrario. */
const mkToken = (obj: unknown): string => {
  const p = base64Url(JSON.stringify(obj));
  return `${p}.${sign(p, SECRET)}`;
};

/** Arranca el app con el guard real montado; devuelve baseURL + close(). */
function startApp(guard: express.RequestHandler): Promise<{ base: string; close: () => Promise<void> }> {
  const app = express();
  // Mismo patrón que server.ts:85 — guard delante de la ruta de datos.
  app.get('/api/metrics/protegido', guard, (_req, res) => res.status(200).json({ ok: true }));
  return new Promise((resolve) => {
    const server = http.createServer(app).listen(0, '127.0.0.1', () => {
      const { port } = server.address() as import('node:net').AddressInfo;
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

/** GET a la ruta protegida con un header Cookie opcional; devuelve el status. */
async function getStatus(base: string, cookie?: string): Promise<number> {
  const res = await fetch(`${base}/api/metrics/protegido`, {
    headers: cookie ? { cookie } : {},
  });
  await res.text();
  return res.status;
}

const cookieOf = (token: string) => buildCookie(token, COOKIE_TTL_SECONDS, false).split(';')[0];

(async () => {
  const { base, close } = await startApp(requireSession);
  try {
    // A) sin cookie → 401 (el guard cierra por defecto)
    assert.equal(await getStatus(base), 401, 'A: sin cookie debe dar 401');

    // B) cookie válida y fresca → 200 (deja pasar)
    {
      const token = createSessionToken(SECRET);
      assert.equal(await getStatus(base, cookieOf(token)), 200, 'B: cookie válida debe pasar');
    }

    // C) cookie VENCIDA (iat viejo, firma correcta) → 401
    //    Es el corazón del fix: un token capturado no vale pasada la ventana.
    {
      const expired = mkToken({
        sub: 'yd-admin',
        iat: Date.now() - (COOKIE_TTL_SECONDS + 60) * 1000,
        name: 'Llave Dorada Yani',
      });
      assert.equal(await getStatus(base, cookieOf(expired)), 401, 'C: cookie vencida debe dar 401');
    }

    // D) payload manipulado con firma vieja → 401
    {
      const token = createSessionToken(SECRET);
      const oldSig = token.split('.')[1];
      const forgedPayload = base64Url(JSON.stringify({ sub: 'hacker', iat: Date.now() }));
      assert.equal(
        await getStatus(base, cookieOf(`${forgedPayload}.${oldSig}`)),
        401, 'D: payload manipulado debe dar 401',
      );
    }

    // E) token firmado con OTRO secret → 401
    {
      const p = base64Url(JSON.stringify({ sub: 'yd-admin', iat: Date.now(), name: 'x' }));
      const wrong = `${p}.${sign(p, 'secret-del-atacante')}`;
      assert.equal(await getStatus(base, cookieOf(wrong)), 401, 'E: firma con otro secret debe dar 401');
    }

    // F) firma correcta pero SIN iat → 401 (fail-closed: no se puede probar frescura)
    {
      const noIat = mkToken({ sub: 'yd-admin', name: 'x' });
      assert.equal(await getStatus(base, cookieOf(noIat)), 401, 'F: sin iat debe dar 401');
    }

    // G) cookie malformada (sin punto) → 401
    {
      assert.equal(await getStatus(base, `${COOKIE_NAME}=basura-sin-punto`), 401, 'G: token malformado debe dar 401');
    }

    // H) token válido pero bajo OTRO nombre de cookie → 401 (el guard sólo mira yd_auth)
    {
      const token = createSessionToken(SECRET);
      assert.equal(await getStatus(base, `otra_cookie=${token}`), 401, 'H: nombre de cookie equivocado debe dar 401');
    }
  } finally {
    await close();
  }

  // I) fail-closed cuando el server arranca SIN AUTH_SECRET.
  //    Instancia fresca del middleware con env vacío (query distinta → módulo nuevo en ESM).
  {
    process.env.AUTH_SECRET = '';
    // Specifier computado (no literal): fuerza una instancia fresca del módulo en
    // ESM (query distinta) y evita que tsc intente resolver la ruta con querystring.
    const freshSpecifier = './requireSession.js?variant=nosecret';
    const { requireSession: guardSinSecret } = await import(freshSpecifier);
    const { base: b2, close: c2 } = await startApp(guardSinSecret);
    try {
      const token = createSessionToken(SECRET); // token válido, pero el guard no tiene secret
      assert.equal(await getStatus(b2, cookieOf(token)), 401, 'I: sin AUTH_SECRET el guard debe dar 401 (fail-closed)');
    } finally {
      await c2();
      process.env.AUTH_SECRET = SECRET;
    }
  }

  console.log('✓ seguridad guard sesión: 9/9 casos (A–I) pasaron sobre HTTP real');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
