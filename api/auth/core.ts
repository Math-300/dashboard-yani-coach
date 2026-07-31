/**
 * Núcleo de autenticación agnóstico al framework (sin tipos de Vercel ni Express).
 * Cookie firmada HMAC-SHA256 'yd_auth'. Mecánica idéntica a los handlers Vercel
 * originales (api/auth/{login,session,logout}.ts), centralizada para DRY.
 */
import crypto from 'node:crypto';

export const COOKIE_NAME = 'yd_auth';
export const COOKIE_TTL_SECONDS = 60 * 60 * 12; // 12 horas

export function base64Url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function sign(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return base64Url(hmac.digest());
}

/**
 * Comparación de strings en tiempo constante (anti timing-attack).
 * El chequeo de longitud previo no filtra nada sensible cuando ambos lados
 * son digests HMAC de longitud fija (el caso de uso real acá).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function createSessionToken(secret: string): string {
  const payload = JSON.stringify({ sub: 'yd-admin', iat: Date.now(), name: 'Llave Dorada Yani' });
  const payloadEncoded = base64Url(payload);
  return `${payloadEncoded}.${sign(payloadEncoded, secret)}`;
}

export function verifyToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): { sub?: string; iat?: number; name?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadEncoded, signature] = parts;
  if (!payloadEncoded || !signature) return null;
  if (!timingSafeEqualStr(sign(payloadEncoded, secret), signature)) return null;
  let payload: { sub?: string; iat?: number; name?: string };
  try {
    const json = Buffer.from(
      payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64',
    ).toString();
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  // Caducidad server-side: la firma HMAC sólo prueba autenticidad, no frescura.
  // Sin este chequeo una cookie capturada valía indefinidamente (el Max-Age de
  // buildCookie sólo lo respeta el navegador; un token replayado directo lo
  // ignora). `iat` es Date.now() en ms al firmar. Fail-closed: si falta o no es
  // numérico, no se puede probar frescura → rechazar.
  const iat = payload?.iat;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null;
  if (nowMs - iat > COOKIE_TTL_SECONDS * 1000) return null;
  return payload;
}

export function buildCookie(value: string, maxAgeSeconds: number, isProduction: boolean): string {
  return [
    `${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`, isProduction ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function buildClearCookie(isProduction: boolean): string {
  return buildCookie('', 0, isProduction);
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((part) => {
    const [name, ...rest] = part.trim().split('=');
    cookies[name] = rest.join('=');
  });
  return cookies;
}
