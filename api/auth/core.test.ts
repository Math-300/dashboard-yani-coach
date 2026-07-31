/**
 * Tests del núcleo de auth. Uso: npx tsx api/auth/core.test.ts
 */
import assert from 'node:assert/strict';
import {
  createSessionToken, verifyToken, buildCookie, buildClearCookie, parseCookies, COOKIE_NAME,
  sign, base64Url, COOKIE_TTL_SECONDS,
} from './core.js';

const SECRET = 'test-secret';

/** Firma un payload arbitrario con SECRET (para forjar tokens de prueba válidos en firma). */
const mkToken = (obj: unknown): string => {
  const p = base64Url(JSON.stringify(obj));
  return `${p}.${sign(p, SECRET)}`;
};

(async () => {
  // 1) round-trip firma/verificación
  {
    const token = createSessionToken(SECRET);
    const payload = verifyToken(token, SECRET);
    assert.ok(payload, 'token válido debe verificar');
    assert.equal(payload?.sub, 'yd-admin');
    assert.equal(payload?.name, 'Llave Dorada Yani');
  }
  // 2) secreto equivocado → rechazado
  {
    const token = createSessionToken(SECRET);
    assert.equal(verifyToken(token, 'otro-secret'), null);
  }
  // 3) token malformado → rechazado
  {
    assert.equal(verifyToken('sin-punto', SECRET), null);
  }
  // 3b) token con demasiados puntos → rechazado (formato es exactamente payload.signature)
  {
    assert.equal(verifyToken('a.b.c', SECRET), null);
  }
  // 4) payload manipulado con firma vieja → rechazado
  {
    const token = createSessionToken(SECRET);
    const sig = token.split('.')[1];
    const fake = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    assert.equal(verifyToken(`${fake}.${sig}`, SECRET), null);
  }
  // 5) cookie en prod lleva Secure; fuera de prod no
  {
    const c = buildCookie('TOK', 100, true);
    assert.ok(c.startsWith(`${COOKIE_NAME}=TOK`));
    assert.ok(c.includes('HttpOnly'));
    assert.ok(c.includes('SameSite=Strict'));
    assert.ok(c.includes('Max-Age=100'));
    assert.ok(c.includes('Secure'));
    assert.ok(!buildCookie('TOK', 100, false).includes('Secure'));
  }
  // 6) clear cookie expira (Max-Age=0)
  {
    assert.ok(buildClearCookie(true).includes('Max-Age=0'));
  }
  // 7) parseCookies
  {
    const parsed = parseCookies('a=1; yd_auth=xyz; b=2');
    assert.equal(parsed['yd_auth'], 'xyz');
    assert.equal(parsed['a'], '1');
    assert.deepEqual(parseCookies(undefined), {});
  }
  // 8) TTL: token fresco válido; el MISMO token evaluado pasada la ventana → null
  //    (una cookie capturada no debe valer indefinidamente: caduca por iat, no
  //     sólo por el Max-Age del navegador).
  {
    const token = createSessionToken(SECRET);
    assert.ok(verifyToken(token, SECRET), 'token fresco debe verificar');
    const iat = verifyToken(token, SECRET)?.iat as number;
    const justInside = iat + COOKIE_TTL_SECONDS * 1000 - 1000; // 1s antes de vencer
    assert.ok(verifyToken(token, SECRET, justInside), 'dentro de la ventana debe verificar');
    const justExpired = iat + COOKIE_TTL_SECONDS * 1000 + 1000; // 1s después de vencer
    assert.equal(verifyToken(token, SECRET, justExpired), null, 'vencido debe rechazarse');
  }
  // 9) iat ausente → rechazado (fail-closed: sin iat no se puede probar frescura)
  {
    const noIat = mkToken({ sub: 'yd-admin', name: 'Llave Dorada Yani' });
    assert.equal(verifyToken(noIat, SECRET), null, 'sin iat debe rechazarse');
  }
  // 10) iat no numérico → rechazado
  {
    const badIat = mkToken({ sub: 'yd-admin', iat: 'ayer', name: 'x' });
    assert.equal(verifyToken(badIat, SECRET), null, 'iat no numérico debe rechazarse');
  }
  console.log('✓ auth core: 11/11 casos pasaron');
})();
