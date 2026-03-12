// @ts-check
const { test, expect } = require('@playwright/test');

function bootUrl() {
    return '/src/apps/turnero-desktop/src/renderer/boot.html';
}

async function mockBootBridge(page, snapshotOverrides = {}, options = {}) {
    const snapshot = {
        config: {
            surface: 'operator',
            baseUrl: 'https://pielarmonia.com',
            launchMode: 'fullscreen',
            stationMode: 'locked',
            stationConsultorio: 1,
            oneTap: false,
            autoStart: true,
            updateChannel: 'stable',
        },
        status: {
            phase: 'settings',
            message: 'Configura este equipo',
        },
        surfaceLabel: 'Operador',
        surfaceDesktopLabel: 'Turnero Operador',
        packaged: true,
        platform: 'win32',
        version: '0.1.0',
        firstRun: true,
        settingsMode: true,
        ...snapshotOverrides,
    };

    await page.addInitScript(
        ({ initialSnapshot, delayMs }) => {
            const state = {
                runCalls: [],
                saveCalls: [],
                openCalls: 0,
            };

            function buildReport(snapshot, payload) {
                if (!snapshot.packaged) {
                    return {
                        state: 'warning',
                        title: 'Equipo casi listo',
                        summary:
                            'La app ya puede abrir, pero el checklist remoto completo se valida solo en desktop instalada.',
                        checks: [
                            {
                                id: 'runtime',
                                label: 'Modo de la app',
                                state: 'warning',
                                detail: 'Modo desarrollo o fallback local; el preflight remoto completo se activa solo en desktop instalada',
                            },
                            {
                                id: 'surface',
                                label: 'Superficie remota',
                                state: 'warning',
                                detail: 'Se valida solo en desktop instalada: https://pielarmonia.com/operador-turnos.html',
                            },
                            {
                                id: 'health',
                                label: 'API de salud',
                                state: 'warning',
                                detail: 'Se valida solo en desktop instalada: https://pielarmonia.com/api.php?resource=health',
                            },
                        ],
                    };
                }

                if (String(payload?.baseUrl || '').includes('offline')) {
                    return {
                        state: 'danger',
                        title: 'Equipo no listo',
                        summary:
                            'Corrige primero los checks en rojo antes de abrir la superficie operativa.',
                        checks: [
                            {
                                id: 'surface',
                                label: 'Superficie remota',
                                state: 'danger',
                                detail: 'No responde (HTTP 503)',
                            },
                        ],
                    };
                }

                return {
                    state: 'ready',
                    title: 'Equipo listo',
                    summary:
                        'Servidor, superficie y perfil del equipo responden correctamente.',
                    checks: [
                        {
                            id: 'profile',
                            label: 'Perfil del equipo',
                            state: 'ready',
                            detail: 'C1 fijo · 1 tecla OFF',
                        },
                        {
                            id: 'surface',
                            label: 'Superficie remota',
                            state: 'ready',
                            detail: 'Disponible (200)',
                        },
                        {
                            id: 'health',
                            label: 'API de salud',
                            state: 'ready',
                            detail: 'Health OK (200)',
                        },
                    ],
                };
            }

            window.__turneroBootBridgeState = state;
            window.turneroDesktop = {
                getRuntimeSnapshot: () => Promise.resolve(initialSnapshot),
                onBootStatus: () => () => {},
                retryLoad: () => Promise.resolve(true),
                runPreflight: (payload) =>
                    new Promise((resolve) => {
                        state.runCalls.push(payload);
                        window.setTimeout(() => {
                            resolve(buildReport(initialSnapshot, payload));
                        }, delayMs);
                    }),
                saveRuntimeConfig: (payload) => {
                    state.saveCalls.push(payload);
                    return Promise.resolve({
                        ...initialSnapshot,
                        config: {
                            ...initialSnapshot.config,
                            ...payload,
                        },
                    });
                },
                openSurface: () => {
                    state.openCalls += 1;
                    return Promise.resolve(true);
                },
            };
        },
        {
            initialSnapshot: snapshot,
            delayMs: Number(options.delayMs || 90),
        }
    );
}

test.describe('Turnero Desktop boot', () => {
    test('desktop empaquetado exige preflight vigente antes de guardar y abrir', async ({
        page,
    }) => {
        await mockBootBridge(page, {
            packaged: true,
            firstRun: true,
            settingsMode: true,
        });

        await page.goto(bootUrl());
        await expect(page.locator('#bootSaveBtn')).toBeDisabled();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'Checklist vigente'
        );
        await expect(page.locator('#bootSaveBtn')).toBeEnabled();

        await page.locator('#bootConfigBaseUrl').fill('https://offline.test');
        await page.locator('#bootConfigProfile').focus();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'Corrige los checks en rojo'
        );
        await expect(page.locator('#bootSaveBtn')).toBeDisabled();
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__turneroBootBridgeState.saveCalls.length
                )
            )
            .toBe(0);
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.openCalls)
            )
            .toBe(0);

        await page
            .locator('#bootConfigBaseUrl')
            .fill('https://pielarmonia.com');
        await page.locator('#bootConfigProfile').focus();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'Checklist vigente'
        );
        await expect(page.locator('#bootSaveBtn')).toBeEnabled();

        await page.locator('#bootSaveBtn').click();
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__turneroBootBridgeState.saveCalls.length
                )
            )
            .toBe(1);
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.openCalls)
            )
            .toBe(1);
    });

    test('modo desarrollo no bloquea abrir la superficie', async ({ page }) => {
        await mockBootBridge(
            page,
            {
                packaged: false,
                firstRun: false,
                settingsMode: false,
            },
            { delayMs: 20 }
        );

        await page.goto(bootUrl());
        await expect(page.locator('#bootOpenSurfaceBtn')).toBeVisible();
        await expect(page.locator('#bootOpenSurfaceBtn')).toBeEnabled();
        await expect(page.locator('#bootPreflightGateHint')).toContainText(
            'desktop instalada'
        );

        await page.locator('#bootOpenSurfaceBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroBootBridgeState.openCalls)
            )
            .toBe(1);
    });
});
