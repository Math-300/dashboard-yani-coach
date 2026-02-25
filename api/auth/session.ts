import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const COOKIE_NAME = 'yd_auth';

const getSecret = () => process.env.AUTH_SECRET || '';

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

const parseCookies = (cookieHeader?: string) => {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach((part) => {
        const [name, ...rest] = part.trim().split('=');
        cookies[name] = rest.join('=');
    });
    return cookies;
};

const verifyToken = (token: string, secret: string) => {
    const [payloadEncoded, signature] = token.split('.');
    if (!payloadEncoded || !signature) return null;
    const expected = sign(payloadEncoded, secret);
    if (signature !== expected) return null;
    try {
        const json = Buffer.from(payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
        return JSON.parse(json);
    } catch {
        return null;
    }
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
    response.setHeader('Content-Type', 'application/json');

    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Método no permitido' });
    }

    const secret = getSecret();
    if (!secret) {
        return response.status(500).json({ error: 'AUTH_SECRET no configurado' });
    }

    const cookies = parseCookies(request.headers.cookie);
    const token = cookies[COOKIE_NAME];

    if (!token) {
        return response.status(200).json({ authenticated: false });
    }

    const payload = verifyToken(token, secret);
    if (!payload) {
        return response.status(200).json({ authenticated: false });
    }

    return response.status(200).json({
        authenticated: true,
        user: { name: payload?.name || 'Llave Dorada Yani' }
    });
}
