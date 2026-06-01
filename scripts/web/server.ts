/**
 * Servidor web de producción: sirve el bundle Vite (dist/) como SPA y expone
 * las rutas de auth por contraseña. Reemplaza a las serverless functions de Vercel.
 * Detrás de Traefik en el VPS. NO recibe service_role — solo anon (horneada en el
 * bundle en build-time) + AUTH_SECRET/AUTH_PASSWORD.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  COOKIE_NAME, COOKIE_TTL_SECONDS, createSessionToken, verifyToken,
  buildCookie, buildClearCookie, parseCookies, sign, timingSafeEqualStr,
} from '../../api/auth/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const IS_PROD = process.env.NODE_ENV === 'production';
const AUTH_SECRET = process.env.AUTH_SECRET ?? '';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? '';

// Fallos visibles (regla del proyecto): un deploy mal configurado debe fallar
// fuerte al arrancar, no devolver 500 silenciosos por request.
if (!AUTH_SECRET || !AUTH_PASSWORD) {
  const msg = '[web] FALTA AUTH_SECRET y/o AUTH_PASSWORD — el login no funcionará';
  if (IS_PROD) { console.error(msg); process.exit(1); }
  else console.warn(msg);
}
if (!fs.existsSync(DIST)) {
  console.error(`[web] no existe dist/ en ${DIST} — corré 'npm run build' antes`);
  if (IS_PROD) process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  if (!AUTH_SECRET || !AUTH_PASSWORD) {
    return res.status(500).json({ error: 'Configuración de autenticación incompleta' });
  }
  const provided = req.body?.password;
  // Comparación en tiempo constante sobre el HMAC (longitud fija): no filtra
  // ni el contenido ni el largo de la contraseña ante un timing-attack.
  const ok = typeof provided === 'string' && provided.length > 0 &&
    timingSafeEqualStr(sign(provided, AUTH_SECRET), sign(AUTH_PASSWORD, AUTH_SECRET));
  if (!ok) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  const token = createSessionToken(AUTH_SECRET);
  res.setHeader('Set-Cookie', buildCookie(token, COOKIE_TTL_SECONDS, IS_PROD));
  return res.status(200).json({ authenticated: true, user: { name: 'Llave Dorada Yani' } });
});

app.get('/api/auth/session', (req, res) => {
  if (!AUTH_SECRET) {
    return res.status(500).json({ error: 'AUTH_SECRET no configurado' });
  }
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const payload = token ? verifyToken(token, AUTH_SECRET) : null;
  if (!payload) {
    return res.status(200).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, user: { name: payload.name || 'Llave Dorada Yani' } });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', buildClearCookie(IS_PROD));
  return res.status(200).json({ success: true });
});

// Estáticos + fallback SPA (toda ruta que no empiece con /api/ devuelve index.html)
app.use(express.static(DIST));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[web] listening on :${PORT}`);
});
