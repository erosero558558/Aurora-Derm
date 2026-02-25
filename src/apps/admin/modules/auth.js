import { authRequest } from './api.js';
import { setCsrfToken } from './state.js';
import { showToast } from './ui.js';

export async function checkAuth() {
    try {
        const payload = await authRequest('status');
        if (payload.csrfToken) setCsrfToken(payload.csrfToken);

        if (payload.authenticated) {
            return true;
        } else {
            return false;
        }
    } catch (_e) {
        showToast('No se pudo verificar la sesion', 'warning');
        return false;
    }
}

export async function logout() {
    try {
        await authRequest('logout', { method: 'POST' });
    } catch (_e) {
        // Continue
    }
    showToast('Sesion cerrada correctamente', 'info');
    setTimeout(() => window.location.reload(), 800);
}

export async function login(password) {
    return authRequest('login', {
        method: 'POST',
        body: { password }
    });
}

export async function login2FA(code) {
    return authRequest('login-2fa', {
        method: 'POST',
        body: { code }
    });
}
