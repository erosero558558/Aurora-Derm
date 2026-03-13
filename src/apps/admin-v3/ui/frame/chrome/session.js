import { qs, setText } from '../../../shared/ui/render.js';

function internalConsoleBlockDetail(internalConsoleMeta) {
    const blockers = Array.isArray(internalConsoleMeta?.overall?.blockers)
        ? internalConsoleMeta.overall.blockers
        : [];
    const primaryBlocker =
        blockers.find((item) => item && typeof item === 'object') || null;
    const detail = String(
        primaryBlocker?.detail || internalConsoleMeta?.overall?.summary || ''
    ).trim();

    return detail || 'El acceso interno sigue bloqueado en este entorno.';
}

function formatAuthMeta(auth, internalConsoleMeta) {
    const authState = auth && typeof auth === 'object' ? auth : {};

    if (authState.authenticated) {
        const methodMap = {
            session: 'sesion restaurada',
            password: 'clave validada',
            '2fa': '2FA validado',
            openclaw: 'OpenClaw validado',
        };
        const authMethod =
            methodMap[String(authState.authMethod || '')] || 'acceso validado';
        const validatedAt = Number(authState.lastAuthAt || 0);
        const operatorEmail = String(authState.operator?.email || '').trim();
        const identityLabel = operatorEmail
            ? `Operador ${operatorEmail}. `
            : '';

        if (!validatedAt) {
            return `${identityLabel}Protegida por ${authMethod}.`;
        }

        return `${identityLabel}Protegida por ${authMethod}. ${new Date(
            validatedAt
        ).toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    }

    if (authState.requires2FA) {
        return 'Esperando codigo de seis digitos para completar el acceso.';
    }

    const pilotBlocked = internalConsoleMeta?.overall?.ready === false;
    if (pilotBlocked) {
        const authError = String(authState.lastError || '').trim();
        if (authError) {
            return authError;
        }

        return internalConsoleBlockDetail(internalConsoleMeta);
    }

    return 'Autenticate para operar el panel.';
}

export function renderChromeSession(auth, internalConsoleMeta) {
    const sessionTile = qs('#adminSessionTile');
    const pilotBlocked = internalConsoleMeta?.overall?.ready === false;
    const sessionLabel = auth.authenticated
        ? 'Sesion activa'
        : auth.requires2FA
          ? 'Verificacion 2FA'
          : pilotBlocked
            ? 'Acceso bloqueado'
            : 'No autenticada';
    const sessionTone = auth.authenticated
        ? 'success'
        : auth.requires2FA
          ? 'warning'
          : pilotBlocked
            ? 'danger'
            : 'neutral';

    sessionTile?.setAttribute('data-state', sessionTone);
    setText('#adminSessionState', sessionLabel);
    setText('#adminSessionMeta', formatAuthMeta(auth, internalConsoleMeta));
}
