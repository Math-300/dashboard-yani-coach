export type AuthUser = {
    name: string;
};

export type AuthSession = {
    authenticated: boolean;
    user?: AuthUser;
    isLocal?: boolean;
};

const JSON_HEADERS = {
    'Content-Type': 'application/json'
};

const LOCAL_SESSION_KEY = 'yd_local_auth';

const getLocalAuthKey = () => {
    // @ts-ignore - Vite injects import.meta.env
    const key = import.meta.env?.VITE_LOCAL_AUTH_KEY;
    return key ? String(key).trim() : '';
};

const isLocalBypassEnabled = () => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    return isLocalhost && Boolean(getLocalAuthKey());
};

export async function getSession(): Promise<AuthSession> {
    if (isLocalBypassEnabled()) {
        const isAuthenticated = localStorage.getItem(LOCAL_SESSION_KEY) === 'true';
        return isAuthenticated
            ? { authenticated: true, user: { name: 'Llave Dorada Local' }, isLocal: true }
            : { authenticated: false, isLocal: true };
    }

    const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
    });

    if (!response.ok) {
        return { authenticated: false };
    }

    return response.json();
}

export async function login(password: string): Promise<AuthSession> {
    if (isLocalBypassEnabled()) {
        const expected = getLocalAuthKey();
        if (!expected || password !== expected) {
            throw new Error('Credenciales inválidas');
        }
        localStorage.setItem(LOCAL_SESSION_KEY, 'true');
        return { authenticated: true, user: { name: 'Llave Dorada Local' }, isLocal: true };
    }

    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: JSON_HEADERS,
        credentials: 'include',
        body: JSON.stringify({ password })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login fallido' }));
        throw new Error(error.error || 'Login fallido');
    }

    return response.json();
}

export async function logout(): Promise<void> {
    if (isLocalBypassEnabled()) {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        return;
    }

    await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });
}
