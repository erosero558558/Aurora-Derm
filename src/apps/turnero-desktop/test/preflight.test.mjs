import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildConfig } from '../src/config/contracts.mjs';
import { runPreflightChecks } from '../src/runtime/preflight.mjs';

test('preflight marks desktop as ready when surface and health respond', async () => {
    const config = createBuildConfig({
        surface: 'operator',
        stationMode: 'locked',
        stationConsultorio: 2,
        oneTap: true,
    });

    const report = await runPreflightChecks(config, {
        packaged: true,
        fetchImpl: async (url) => {
            if (String(url).includes('resource=health')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        ok: true,
                        data: {
                            status: 'ok',
                        },
                    }),
                };
            }

            return {
                ok: true,
                status: 200,
                headers: new Map(),
            };
        },
    });

    assert.equal(report.state, 'ready');
    assert.equal(report.title, 'Equipo listo');
    assert.equal(
        report.checks.find((check) => check.id === 'profile')?.detail,
        'C2 fijo · 1 tecla ON'
    );
    assert.equal(
        report.checks.find((check) => check.id === 'surface')?.state,
        'ready'
    );
    assert.equal(
        report.checks.find((check) => check.id === 'health')?.state,
        'ready'
    );
});

test('preflight en desarrollo omite probes remotos y deja aviso packaged-only', async () => {
    const config = createBuildConfig({
        surface: 'kiosk',
    });
    let fetchCalls = 0;

    const report = await runPreflightChecks(config, {
        packaged: false,
        fetchImpl: async () => {
            fetchCalls += 1;
            throw new Error('no debería ejecutarse en desarrollo');
        },
    });

    assert.equal(fetchCalls, 0);
    assert.equal(report.state, 'warning');
    assert.equal(
        report.checks.find((check) => check.id === 'runtime')?.state,
        'warning'
    );
    assert.equal(
        report.checks.find((check) => check.id === 'surface')?.state,
        'warning'
    );
    assert.equal(
        report.checks.find((check) => check.id === 'health')?.state,
        'warning'
    );
    assert.match(
        String(
            report.checks.find((check) => check.id === 'surface')?.detail || ''
        ),
        /desktop instalada/i
    );
});
