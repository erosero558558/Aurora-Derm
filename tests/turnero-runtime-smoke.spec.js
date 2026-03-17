// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const {
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildClinicProfile(overrides = {}) {
    const clinicId = String(overrides.clinicId || 'piel-armonia-quito').trim();
    const surfaces = overrides.surfaces || {};

    return {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: clinicId,
        branding: {
            name: 'Aurora Derm',
            short_name: 'Aurora',
            city: 'Quito',
            base_url: 'https://pielarmonia.com',
            ...(overrides.branding || {}),
        },
        consultorios: {
            c1: { label: 'Dermatología 1', short_label: 'D1' },
            c2: { label: 'Dermatología 2', short_label: 'D2' },
            ...(overrides.consultorios || {}),
        },
        surfaces: {
            admin: {
                enabled: true,
                label: 'Admin web',
                route: '/admin.html#queue',
                ...(surfaces.admin || {}),
            },
            operator: {
                enabled: true,
                label: 'Operador web',
                route: '/operador-turnos.html',
                ...(surfaces.operator || {}),
            },
            kiosk: {
                enabled: true,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
                ...(surfaces.kiosk || {}),
            },
            display: {
                enabled: true,
                label: 'Sala web',
                route: '/sala-turnos.html',
                ...(surfaces.display || {}),
            },
        },
        release: {
            mode: 'suite_v2',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: true,
            notes: [
                'Suite V2 por clínica con apps nativas bloqueantes.',
                'Admin queda como fallback operativo y soporte.',
            ],
            ...(overrides.release || {}),
        },
    };
}

function buildQueueMeta(nowIso) {
    return {
        updatedAt: nowIso,
        waitingCount: 0,
        calledCount: 0,
        estimatedWaitMin: 0,
        assistancePendingCount: 0,
        counts: {
            waiting: 0,
            called: 0,
            completed: 0,
            no_show: 0,
            cancelled: 0,
        },
        callingNowByConsultorio: { 1: null, 2: null },
        nextTickets: [],
        activeHelpRequests: [],
        recentResolvedHelpRequests: [],
    };
}

function buildSurfaceStatus(nowIso, clinicId, profileFingerprint) {
    return {
        operator: {
            surface: 'operator',
            label: 'Operador',
            status: 'ready',
            updatedAt: nowIso,
            ageSec: 6,
            stale: false,
            summary: 'Operador listo para D1.',
            latest: {
                deviceLabel: 'Operador D1',
                appMode: 'desktop',
                ageSec: 6,
                details: {
                    station: 'c1',
                    stationMode: 'locked',
                    oneTap: false,
                    numpadSeen: true,
                    clinicId,
                    profileFingerprint,
                    profileSource: 'remote',
                    surfaceContractState: 'ready',
                    surfaceRouteExpected: '/operador-turnos.html',
                    surfaceRouteCurrent: '/operador-turnos.html',
                },
            },
            instances: [],
        },
        kiosk: {
            surface: 'kiosk',
            label: 'Kiosco',
            status: 'ready',
            updatedAt: nowIso,
            ageSec: 8,
            stale: false,
            summary: 'Kiosco listo con impresora activa.',
            latest: {
                deviceLabel: 'Kiosco principal',
                appMode: 'desktop',
                ageSec: 8,
                details: {
                    connection: 'live',
                    pendingOffline: 0,
                    printerPrinted: true,
                    clinicId,
                    profileFingerprint,
                    profileSource: 'remote',
                    surfaceContractState: 'ready',
                    surfaceRouteExpected: '/kiosco-turnos.html',
                    surfaceRouteCurrent: '/kiosco-turnos.html',
                },
            },
            instances: [],
        },
        display: {
            surface: 'display',
            label: 'Sala',
            status: 'ready',
            updatedAt: nowIso,
            ageSec: 10,
            stale: false,
            summary: 'Sala lista con audio activo.',
            latest: {
                deviceLabel: 'Sala principal',
                appMode: 'android_tv',
                ageSec: 10,
                details: {
                    connection: 'live',
                    bellMuted: false,
                    bellPrimed: true,
                    clinicId,
                    profileFingerprint,
                    profileSource: 'remote',
                    surfaceContractState: 'ready',
                    surfaceRouteExpected: '/sala-turnos.html',
                    surfaceRouteCurrent: '/sala-turnos.html',
                },
            },
            instances: [],
        },
    };
}

async function installAdminTurneroRuntimeMocks(page) {
    const nowIso = new Date().toISOString();
    const clinicId = 'piel-armonia-quito';
    const profileFingerprint = 'aurora-v2-runtime-smoke';

    await installLegacyAdminAuthMock(page, {
        authenticated: true,
        csrfToken: 'csrf_turnero_runtime_smoke',
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'features') {
            return json(route, {
                ok: true,
                data: {
                    admin_sony_ui: false,
                },
            });
        }

        if (resource === 'data') {
            return json(route, {
                ok: true,
                data: {
                    appointments: [],
                    callbacks: [],
                    reviews: [],
                    availability: {},
                    availabilityMeta: {
                        source: 'store',
                        mode: 'live',
                        timezone: 'America/Guayaquil',
                        calendarConfigured: true,
                        calendarReachable: true,
                        generatedAt: nowIso,
                    },
                    turneroClinicProfile: buildClinicProfile({
                        clinicId,
                    }),
                    turneroClinicProfileMeta: {
                        source: 'remote',
                        cached: false,
                        clinicId,
                        profileFingerprint,
                        fetchedAt: nowIso,
                    },
                    turneroClinicProfileCatalogStatus: {
                        catalogAvailable: true,
                        catalogCount: 1,
                        activePath: '/content/turnero/clinic-profile.json',
                        clinicId,
                        matchingProfileId: clinicId,
                        matchingCatalogPath: `/content/turnero/clinic-profiles/${clinicId}.json`,
                        matchesCatalog: true,
                        ready: true,
                    },
                    turneroOperatorAccessMeta: {
                        configured: true,
                        maskedPinLabel: '****-4821',
                        sessionTtlHours: 8,
                    },
                    turneroV2Readiness: {
                        enabled: true,
                        operatorAccess: {
                            configured: true,
                            detail: 'PIN operativo listo.',
                        },
                        surfaces: {
                            operator: {
                                ready: true,
                                summary: 'Operator desktop listo.',
                            },
                            kiosk: {
                                ready: true,
                                summary: 'Kiosk desktop listo.',
                            },
                            display: {
                                ready: true,
                                summary: 'Sala TV Android lista.',
                            },
                        },
                        hardware: {
                            assistant: {
                                ready: true,
                                summary: 'Asistente listo.',
                            },
                            printer: {
                                ready: true,
                                summary: 'Impresora lista.',
                            },
                            numpad: {
                                ready: true,
                                summary: 'Numpad listo.',
                            },
                            desktopShell: {
                                ready: true,
                                summary: 'Shell desktop listo.',
                            },
                            tvAudio: {
                                ready: true,
                                summary: 'Audio TV listo.',
                            },
                            syncMode: {
                                ready: true,
                                summary: 'Sync clínico listo.',
                            },
                        },
                    },
                    queue_tickets: [],
                    queueMeta: buildQueueMeta(nowIso),
                    queueSurfaceStatus: buildSurfaceStatus(
                        nowIso,
                        clinicId,
                        profileFingerprint
                    ),
                },
            });
        }

        if (resource === 'health') {
            return json(route, {
                ok: true,
                status: 'ok',
                checks: {
                    publicSync: {
                        configured: true,
                        healthy: true,
                        state: 'ok',
                        deployedCommit:
                            '3de287e27f2f5034f6f471234567890abcdef12',
                        headDrift: false,
                        ageSeconds: 24,
                        failureReason: '',
                    },
                    turneroPilot: {
                        configured: true,
                        ready: true,
                        profileSource: 'file',
                        clinicId,
                        profileFingerprint,
                        catalogReady: true,
                        catalogMatched: true,
                        catalogEntryId: clinicId,
                        releaseMode: 'suite_v2',
                        adminModeDefault: 'basic',
                        separateDeploy: true,
                        nativeAppsBlocking: true,
                        operatorPinMode: 'operator_pin',
                        operatorPinConfigured: true,
                        operatorPinSessionTtlHours: 8,
                        surfaces: buildSurfaceStatus(
                            nowIso,
                            clinicId,
                            profileFingerprint
                        ),
                    },
                },
            });
        }

        if (resource === 'queue-state') {
            return json(route, {
                ok: true,
                data: {
                    updatedAt: nowIso,
                    waitingCount: 0,
                    calledCount: 0,
                    callingNow: [],
                    nextTickets: [],
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return json(route, { ok: true, data: {} });
        }

        return json(route, { ok: true, data: {} });
    });
}

test.describe('Turnero runtime smoke', () => {
    test('admin carga admin.js canónico y abre la cola V2', async ({
        page,
    }) => {
        let canonicalBundleRequested = false;
        let legacyBridgeRequested = false;

        page.on('request', (request) => {
            const url = request.url();
            if (/\/admin\.js\?v=/i.test(url)) {
                canonicalBundleRequested = true;
            }
            if (/\/js\/admin-runtime\.js(\?|$)/i.test(url)) {
                legacyBridgeRequested = true;
            }
        });

        await installAdminTurneroRuntimeMocks(page);

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ready',
            'true'
        );
        await page.locator('.nav-item[data-section="queue"]').click();

        await expect(page.locator('#queueOpsPilot')).toBeVisible();
        await expect(
            page.locator('#queueOpsPilotReadinessTitle')
        ).toContainText('Turnero V2');
        await expect(
            page.locator('#queueOpsPilotReadinessItem_profile')
        ).toContainText('Listo');
        await expect.poll(() => canonicalBundleRequested).toBe(true);
        expect(legacyBridgeRequested).toBe(false);
    });

    test('kiosco carga el bundle canónico e hidrata branding remoto', async ({
        page,
    }) => {
        let kioskBundleRequested = false;

        page.on('request', (request) => {
            if (/\/js\/queue-kiosk\.js\?v=/i.test(request.url())) {
                kioskBundleRequested = true;
            }
        });

        await installTurneroClinicProfileMock(
            page,
            buildClinicProfile({
                surfaces: {
                    kiosk: {
                        enabled: true,
                        route: '/kiosco-turnos.html',
                    },
                },
            })
        );
        await installTurneroQueueStateMock(page);

        await page.goto('/kiosco-turnos.html');

        await expect(page).toHaveTitle(/Aurora Derm/i);
        await expect(page.locator('.kiosk-brand strong')).toContainText(
            'Aurora Derm'
        );
        await expect(page.locator('#kioskClinicMeta')).toContainText(
            'piel-armonia-quito · Quito'
        );
        await expect(page.locator('#kioskProfileStatus')).toContainText(
            'Perfil remoto verificado'
        );
        await expect(page.locator('#kioskProfileStatus')).not.toContainText(
            /cargando/i
        );
        await expect.poll(() => kioskBundleRequested).toBe(true);
    });

    test('sala carga el bundle canónico e hidrata branding remoto', async ({
        page,
    }) => {
        let displayBundleRequested = false;

        page.on('request', (request) => {
            if (/\/js\/queue-display\.js\?v=/i.test(request.url())) {
                displayBundleRequested = true;
            }
        });

        await installTurneroClinicProfileMock(
            page,
            buildClinicProfile({
                surfaces: {
                    display: {
                        enabled: true,
                        route: '/sala-turnos.html',
                    },
                },
            })
        );
        await installTurneroQueueStateMock(page);

        await page.goto('/sala-turnos.html');

        await expect(page).toHaveTitle(/Aurora Derm/i);
        await expect(page.locator('.display-brand strong')).toContainText(
            'Aurora Derm'
        );
        await expect(page.locator('#displayClinicMeta')).toContainText(
            'piel-armonia-quito · Quito'
        );
        await expect(page.locator('#displayProfileStatus')).toContainText(
            'Perfil remoto verificado'
        );
        await expect(page.locator('#displayProfileStatus')).not.toContainText(
            /cargando/i
        );
        await expect.poll(() => displayBundleRequested).toBe(true);
    });
});
