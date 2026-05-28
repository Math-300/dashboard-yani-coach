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

export function createSessionToken(secret: string): string {
  const payload = JSON.stringify({ sub: 'yd-admin', iat: Date.now(), name: 'Llave Dorada Yani' });
  const payloadEncoded = base64Url(payload);
  return `${payloadEncoded}.${sign(payloadEncoded, secret)}`;
}

export function verifyToken(
  token: string,
  secret: string,
): { sub?: string; iat?: number; name?: string } | null {
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) return null;
  if (sign(payloadEncoded, secret) !== signature) return null;
  try {
    const json = Buffer.from(
      payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64',
    ).toString();
    return JSON.parse(json);
  } catch {
    return null;
  }
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
