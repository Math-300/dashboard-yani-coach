/**
 * Tests del núcleo de auth. Uso: npx tsx api/auth/core.test.ts
 */
import assert from 'node:assert/strict';
import {
  createSessionToken, verifyToken, buildCookie, buildClearCookie, parseCookies, COOKIE_NAME,
} from './core.js';

const SECRET = 'test-secret';

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
  console.log('✓ auth core: 7/7 casos pasaron');
})();
