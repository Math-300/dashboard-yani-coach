import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const COOKIE_NAME = 'yd_auth';
const COOKIE_TTL_SECONDS = 60 * 60 * 12; // 12 horas

const getSecret = () => process.env.AUTH_SECRET || '';
const getPassword = () => process.env.AUTH_PASSWORD || '';

const base64Url = (input: Buffer | string) => {
    const buffer = typeof input === 'string' ? Buffer.from(input) : input;
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};

const sign = (payload: string, secret: string) => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return base64Url(hmac.digest());
};

const buildCookie = (value: string, maxAgeSeconds: number) => {
    const isProduction = process.env.NODE_ENV === 'production';
    return [
        `${COOKIE_NAME}=${value}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Strict`,
        `Max-Age=${maxAgeSeconds}`,
        isProduction ? 'Secure' : ''
    ]
        .filter(Boolean)
        .join('; ');
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
    response.setHeader('Content-Type', 'application/json');

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    const secret = getSecret();
    const password = getPassword();

    if (!secret || !password) {
        return response.status(500).json({
            error: 'Configuración de autenticación incompleta'
        });
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const providedPassword = body?.password;

    if (!providedPassword || providedPassword !== password) {
        return response.status(401).json({ error: 'Credenciales inválidas' });
    }

    const payload = JSON.stringify({
        sub: 'yd-admin',
        iat: Date.now(),
        name: 'Llave Dorada Yani'
    });

    const payloadEncoded = base64Url(payload);
    const signature = sign(payloadEncoded, secret);
    const token = `${payloadEncoded}.${signature}`;

    response.setHeader('Set-Cookie', buildCookie(token, COOKIE_TTL_SECONDS));

    return response.status(200).json({
        authenticated: true,
        user: { name: 'Llave Dorada Yani' }
    });
}
