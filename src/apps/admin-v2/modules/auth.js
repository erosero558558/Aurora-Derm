import { authRequest, setApiCsrfToken } from '../core/api-client.js';
import { getState, patchState } from '../core/store.js';
import { createToast } from '../ui/render.js';

export async function checkAuthStatus() {
    try {
        const payload = await authRequest('status');
        const authenticated = payload.authenticated === true;
        const csrfToken = authenticated ? String(payload.csrfToken || '') : '';
        setApiCsrfToken(csrfToken);

        patchState({
            ...getState(),
            auth: {
                authenticated,
                csrfToken,
                requires2FA: false,
            },
        });

        return authenticated;
    } catch (_error) {
        return false;
    }
}

export async function loginWithPassword(password) {
    const safePassword = String(password || '').trim();
    if (!safePassword) {
        throw new Error('Contrasena requerida');
    }

    const payload = await authRequest('login', {
        method: 'POST',
        body: { password: safePassword },
    });

    const requires2FA = payload.twoFactorRequired === true;
    if (requires2FA) {
        patchState({
            ...getState(),
            auth: {
                ...getState().auth,
                requires2FA: true,
            },
        });
        createToast('Codigo 2FA requerido', 'info');
        return { authenticated: false, requires2FA: true };
    }

    const csrfToken = String(payload.csrfToken || '');
    setApiCsrfToken(csrfToken);

    patchState({
        ...getState(),
        auth: {
            authenticated: true,
            csrfToken,
            requires2FA: false,
        },
    });

    return { authenticated: true, requires2FA: false };
}

export async function loginWith2FA(code) {
    const tokenCode = String(code || '').trim();
    if (!tokenCode) {
        throw new Error('Codigo 2FA requerido');
    }

    const payload = await authRequest('login-2fa', {
        method: 'POST',
        body: { code: tokenCode },
    });

    const csrfToken = String(payload.csrfToken || '');
    setApiCsrfToken(csrfToken);

    patchState({
        ...getState(),
        auth: {
            authenticated: true,
            csrfToken,
            requires2FA: false,
        },
    });

    return { authenticated: true };
}

export async function logoutSession() {
    try {
        await authRequest('logout', { method: 'POST' });
    } catch (_error) {
        // no-op
    }
    setApiCsrfToken('');
    patchState({
        ...getState(),
        auth: {
            authenticated: false,
            csrfToken: '',
            requires2FA: false,
        },
    });
}
