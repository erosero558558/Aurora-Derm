import { createSurfaceUrl } from '../config/contracts.mjs';

function withTimeout(timeoutMs) {
    const controller = new AbortController();
    const timerId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return {
        signal: controller.signal,
        clear() {
            clearTimeout(timerId);
        },
    };
}

function createCheck(id, label, state, detail) {
    return {
        id,
        label,
        state,
        detail,
    };
}

function createProfileDetail(config) {
    if (String(config.surface || '') === 'kiosk') {
        return config.launchMode === 'windowed'
            ? 'Kiosco en ventana'
            : 'Kiosco en pantalla completa';
    }

    const stationLabel =
        Number(config.stationConsultorio || 1) === 2 ? 'C2' : 'C1';
    const modeLabel =
        String(config.stationMode || 'free') === 'locked'
            ? `${stationLabel} fijo`
            : 'Modo libre';
    const oneTapLabel = config.oneTap ? '1 tecla ON' : '1 tecla OFF';

    return `${modeLabel} · ${oneTapLabel}`;
}

async function probeUrl(url, fetchImpl, timeoutMs) {
    const timeout = withTimeout(timeoutMs);
    try {
        let response = await fetchImpl(url, {
            method: 'HEAD',
            cache: 'no-store',
            redirect: 'follow',
            signal: timeout.signal,
        });

        if (response.status === 405 || response.status === 501) {
            timeout.clear();
            const retryTimeout = withTimeout(timeoutMs);
            response = await fetchImpl(url, {
                method: 'GET',
                cache: 'no-store',
                redirect: 'follow',
                signal: retryTimeout.signal,
            });
            retryTimeout.clear();
        }

        return {
            ok: response.ok,
            status: response.status,
            contentType: String(response.headers.get('content-type') || ''),
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            error: error instanceof Error ? error.message : String(error),
        };
    } finally {
        timeout.clear();
    }
}

async function probeHealth(url, fetchImpl, timeoutMs) {
    const timeout = withTimeout(timeoutMs);
    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            cache: 'no-store',
            redirect: 'follow',
            signal: timeout.signal,
        });

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                detail: `HTTP ${response.status}`,
            };
        }

        const payload = await response.json();
        const healthData =
            payload && typeof payload === 'object' && payload.data
                ? payload.data
                : {};
        const healthStatus = String(healthData.status || '')
            .trim()
            .toLowerCase();
        const detail =
            healthStatus === 'ok' || healthStatus === 'healthy'
                ? 'Health OK'
                : payload && payload.ok
                  ? 'API responde'
                  : 'API responde con warning';

        return {
            ok: Boolean(payload && payload.ok),
            status: response.status,
            detail,
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            detail: error instanceof Error ? error.message : String(error),
        };
    } finally {
        timeout.clear();
    }
}

function summarizeChecks(checks) {
    if (checks.some((check) => check.state === 'danger')) {
        return {
            state: 'danger',
            title: 'Equipo no listo',
            summary:
                'Corrige primero los checks en rojo antes de abrir la superficie operativa.',
        };
    }

    if (checks.some((check) => check.state === 'warning')) {
        return {
            state: 'warning',
            title: 'Equipo casi listo',
            summary:
                'La app ya puede abrir, pero conviene resolver los puntos pendientes antes del uso diario.',
        };
    }

    return {
        state: 'ready',
        title: 'Equipo listo',
        summary:
            'Servidor, superficie y perfil del equipo responden correctamente.',
    };
}

export async function runPreflightChecks(
    config,
    { fetchImpl = globalThis.fetch, packaged = false, timeoutMs = 4500 } = {}
) {
    const surfaceUrl = createSurfaceUrl(config);
    const healthUrl = new URL(
        '/api.php?resource=health',
        `${config.baseUrl}/`
    ).toString();
    const checks = [
        createCheck(
            'profile',
            'Perfil del equipo',
            'ready',
            createProfileDetail(config)
        ),
        createCheck(
            'runtime',
            'Modo de la app',
            packaged ? 'ready' : 'warning',
            packaged
                ? 'Shell empaquetado listo para clínica'
                : 'Modo desarrollo o fallback local; el preflight remoto completo se activa solo en desktop instalada'
        ),
    ];

    if (!packaged) {
        checks.push(
            createCheck(
                'surface',
                'Superficie remota',
                'warning',
                `Se valida solo en desktop instalada: ${surfaceUrl}`
            ),
            createCheck(
                'health',
                'API de salud',
                'warning',
                `Se valida solo en desktop instalada: ${healthUrl}`
            )
        );

        return {
            checkedAt: new Date().toISOString(),
            surfaceUrl,
            healthUrl,
            checks,
            ...summarizeChecks(checks),
        };
    }

    if (typeof fetchImpl !== 'function') {
        checks.push(
            createCheck(
                'surface',
                'Superficie remota',
                'warning',
                `No se pudo ejecutar verificación remota: ${surfaceUrl}`
            ),
            createCheck(
                'health',
                'API de salud',
                'warning',
                `No se pudo ejecutar verificación remota: ${healthUrl}`
            )
        );
        return {
            checkedAt: new Date().toISOString(),
            surfaceUrl,
            healthUrl,
            checks,
            ...summarizeChecks(checks),
        };
    }

    const [surfaceProbe, healthProbe] = await Promise.all([
        probeUrl(surfaceUrl, fetchImpl, timeoutMs),
        probeHealth(healthUrl, fetchImpl, timeoutMs),
    ]);

    checks.push(
        createCheck(
            'surface',
            'Superficie remota',
            surfaceProbe.ok ? 'ready' : 'danger',
            surfaceProbe.ok
                ? `Disponible (${surfaceProbe.status})`
                : `No responde (${surfaceProbe.error || `HTTP ${surfaceProbe.status}`})`
        ),
        createCheck(
            'health',
            'API de salud',
            healthProbe.ok ? 'ready' : 'warning',
            healthProbe.ok
                ? `${healthProbe.detail} (${healthProbe.status})`
                : `Sin confirmación de salud (${healthProbe.detail})`
        )
    );

    return {
        checkedAt: new Date().toISOString(),
        surfaceUrl,
        healthUrl,
        checks,
        ...summarizeChecks(checks),
    };
}
