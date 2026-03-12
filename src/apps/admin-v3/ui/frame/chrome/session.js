import { qs, setText } from '../../../shared/ui/render.js';

function formatAuthMeta(auth) {
    const authState = auth && typeof auth === 'object' ? auth : {};

    if (authState.authenticated) {
        const methodMap = {
            session: 'sesion restaurada',
            password: 'clave validada',
            '2fa': '2FA validado',
            operator_auth: 'OpenClaw / ChatGPT',
        };
        const authMethod =
            methodMap[String(authState.authMethod || '')] || 'acceso validado';
        const validatedAt = Number(authState.lastAuthAt || 0);

        if (!validatedAt) {
            return `Protegida por ${authMethod}.`;
        }

        return `Protegida por ${authMethod}. ${new Date(
            validatedAt
        ).toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    if (authState.requires2FA) {
        return 'Esperando codigo de seis digitos para completar el acceso.';
    }

    if (
        String(authState.mode || '') === 'openclaw_chatgpt' &&
        String(authState.status || '') === 'pending'
    ) {
        return 'Esperando la confirmacion de OpenClaw para completar el acceso.';
    }

    return 'Autenticate para operar el panel.';
}

export function renderChromeSession(auth) {
    const sessionTile = qs('#adminSessionTile');
    const operatorPending =
        String(auth.mode || '') === 'openclaw_chatgpt' &&
        String(auth.status || '') === 'pending';
    const sessionLabel = auth.authenticated
        ? 'Sesion activa'
        : auth.requires2FA
          ? 'Verificacion 2FA'
          : operatorPending
            ? 'Esperando OpenClaw'
            : 'No autenticada';
    const sessionTone = auth.authenticated
        ? 'success'
        : auth.requires2FA || operatorPending
          ? 'warning'
          : 'neutral';

    sessionTile?.setAttribute('data-state', sessionTone);
    setText('#adminSessionState', sessionLabel);
    setText('#adminSessionMeta', formatAuthMeta(auth));
}
