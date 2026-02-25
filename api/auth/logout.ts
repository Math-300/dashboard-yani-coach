import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE_NAME = 'yd_auth';

const buildClearCookie = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return [
        `${COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        'Max-Age=0',
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

    response.setHeader('Set-Cookie', buildClearCookie());
    return response.status(200).json({ success: true });
}
