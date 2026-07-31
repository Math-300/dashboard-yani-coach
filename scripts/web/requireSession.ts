/**
 * Middleware Express: exige cookie de sesión `yd_auth` válida antes de dejar
 * pasar a rutas que ahora puede resolver el server con service_role (ver
 * supabaseService.ts). Reusa exactamente la mecánica de las rutas de auth
 * existentes (COOKIE_NAME/parseCookies/verifyToken de api/auth/core.ts).
 */
import { COOKIE_NAME, parseCookies, verifyToken } from '../../api/auth/core.js';

const AUTH_SECRET = process.env.AUTH_SECRET ?? '';

export function requireSession(req: any, res: any, next: any) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const payload = token && AUTH_SECRET ? verifyToken(token, AUTH_SECRET) : null;
  if (!payload) return res.status(401).json({ error: 'no autenticado' });
  next();
}
