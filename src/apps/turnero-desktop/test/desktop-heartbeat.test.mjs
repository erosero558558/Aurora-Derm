import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDesktopHeartbeatEndpoint,
    buildDesktopHeartbeatPayload,
    shouldRunDesktopHeartbeat,
} from '../src/runtime/desktop-heartbeat.mjs';

function createSnapshot(overrides = {}) {
    return {
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            stationMode: 'locked',
            stationConsultorio: 2,
            oneTap: true,
            updateChannel: 'stable',
            ...overrides.config,
        },
        status: {
            level: 'info',
            phase: 'settings',
            message: 'Configuracion del equipo abierta (manual).',
            ...overrides.status,
        },
        surfaceUrl:
            'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
        packaged: true,
        platform: 'win32',
        version: '0.1.0',
        name: 'Turnero Operador',
        updateFeedUrl:
            'https://pielarmonia.com/desktop-updates/stable/operator/win/',
        firstRun: false,
        settingsMode: true,
        ...overrides,
    };
}

test('desktop heartbeat expone operador en configuracion local', () => {
    const snapshot = createSnapshot();
    assert.equal(shouldRunDesktopHeartbeat(snapshot), true);
    assert.equal(
        buildDesktopHeartbeatEndpoint(snapshot),
        'https://pielarmonia.com/api.php?resource=queue-surface-heartbeat'
    );

    const payload = buildDesktopHeartbeatPayload(snapshot, {
        reason: 'settings_open',
        now: '2026-03-11T20:00:00.000Z',
    });

    assert.ok(payload);
    assert.equal(payload.surface, 'operator');
    assert.equal(payload.instance, 'c2');
    assert.equal(payload.deviceLabel, 'Operador C2 fijo');
    assert.equal(payload.status, 'warning');
    assert.equal(payload.lastEvent, 'settings_open');
    assert.equal(payload.lastEventAt, '2026-03-11T20:00:00.000Z');
    assert.equal(payload.details.shellContext, 'boot');
    assert.equal(payload.details.shellPhase, 'settings');
    assert.equal(payload.details.numpadRequired, 4);
    assert.equal(payload.details.numpadReady, false);
    assert.equal(payload.details.station, 'c2');
    assert.equal(payload.details.oneTap, true);
});

test('desktop heartbeat marca retry como alerta y deja de correr cuando operador ya esta listo', () => {
    const retrySnapshot = createSnapshot({
        settingsMode: false,
        status: {
            level: 'warn',
            phase: 'retry',
            message:
                'No se pudo abrir la superficie operator. Reintentando en 5s.',
        },
    });

    const retryPayload = buildDesktopHeartbeatPayload(retrySnapshot, {
        reason: 'retry_loop',
    });
    assert.ok(retryPayload);
    assert.equal(retryPayload.status, 'alert');
    assert.equal(retryPayload.networkOnline, false);
    assert.match(retryPayload.summary, /Reintentando|reintentando/i);

    const readySnapshot = createSnapshot({
        settingsMode: false,
        firstRun: false,
        status: {
            level: 'info',
            phase: 'ready',
            message: 'operator conectado correctamente.',
        },
    });
    assert.equal(shouldRunDesktopHeartbeat(readySnapshot), false);
    assert.equal(buildDesktopHeartbeatPayload(readySnapshot), null);
});
