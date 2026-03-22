// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');
const {
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test.use({
    serviceWorkers: 'block',
});

const CLINIC_PROFILE = {
    clinic_id: 'clinica-smoke',
    branding: {
        name: 'Clinica Smoke',
        short_name: 'Smoke',
        city: 'Quito',
    },
    region: 'sierra',
    consultorios: {
        c1: {
            label: 'Consultorio 1',
            short_label: 'C1',
        },
        c2: {
            label: 'Consultorio 2',
            short_label: 'C2',
        },
    },
    release: {
        admin_mode_default: 'basic',
        separate_deploy: true,
        native_apps_blocking: false,
    },
    surfaces: {
        admin: {
            enabled: true,
            route: '/admin.html#queue',
        },
        operator: {
            enabled: true,
            route: '/operador-turnos.html',
            label: 'Turnero Operador',
        },
        kiosk: {
            enabled: true,
            route: '/kiosco-turnos.html',
            label: 'Turnero Kiosco',
        },
        display: {
            enabled: true,
            route: '/sala-turnos.html',
            label: 'Turnero Sala TV',
        },
    },
};

function buildQueueState() {
    const updatedAt = new Date().toISOString();
    return {
        updatedAt,
        waitingCount: 1,
        calledCount: 1,
        counts: {
            waiting: 1,
            called: 1,
            completed: 0,
            no_show: 0,
            cancelled: 0,
        },
        callingNow: [
            {
                id: 401,
                ticketCode: 'A-401',
                patientInitials: 'EP',
                assignedConsultorio: 1,
                calledAt: updatedAt,
            },
        ],
        nextTickets: [
            {
                id: 402,
                ticketCode: 'A-402',
                patientInitials: 'JR',
                position: 1,
            },
        ],
    };
}

function buildQueueMeta(queueState) {
    return {
        updatedAt: queueState.updatedAt,
        waitingCount: queueState.waitingCount,
        calledCount: queueState.calledCount,
        counts: queueState.counts,
        callingNowByConsultorio: {
            1: queueState.callingNow?.[0] || null,
            2: null,
        },
        nextTickets: queueState.nextTickets,
    };
}

function buildQueueSurfaceStatus(profile, updatedAt) {
    const clinicId = String(profile.clinic_id || '').trim();
    const makeSurface = (surface, route) => ({
        surface,
        label: surface === 'display' ? 'Sala' : surface === 'kiosk' ? 'Kiosco' : 'Operador',
        status: 'ready',
        updatedAt,
        ageSec: 5,
        stale: false,
        summary: `${surface} listo.`,
        latest: {
            deviceLabel: `${surface} smoke`,
            appMode: 'browser',
            ageSec: 5,
            details: {
                clinicId,
                surfaceContractState: 'ready',
                surfaceRouteExpected: route,
                surfaceRouteCurrent: route,
            },
        },
        instances: [],
    });

    return {
        operator: makeSurface('operator', '/operador-turnos.html'),
        kiosk: makeSurface('kiosk', '/kiosco-turnos.html'),
        display: makeSurface('display', '/sala-turnos.html'),
    };
}

async function installTurneroSmokeMocks(page, { authenticatedAdmin = false } = {}) {
    const queueState = buildQueueState();

    await installTurneroClinicProfileMock(page, CLINIC_PROFILE);
    await installLegacyAdminAuthMock(page, {
        authenticated: true,
        mode: 'local',
        status: 'authenticated',
    });
    await installTurneroQueueStateMock(page, {
        queueState,
    });

    if (authenticatedAdmin) {
        await installLegacyAdminAuthMock(page, {
            authenticated: true,
            mode: 'local',
            status: 'authenticated',
        });

        await installBasicAdminApiMocks(page, {
            featuresPayload: {
                data: {
                    admin_sony_ui: true,
                    admin_sony_ui_v3: true,
                },
            },
            dataOverrides: {
                turneroClinicProfile: CLINIC_PROFILE,
                turneroClinicProfileMeta: {
                    clinicId: CLINIC_PROFILE.clinic_id,
                    source: 'smoke',
                    fetchedAt: queueState.updatedAt,
                },
                turneroClinicProfileCatalogStatus: {
                    catalogAvailable: true,
                    catalogCount: 1,
                    activePath: '/content/turnero/clinic-profile.json',
                    clinicId: CLINIC_PROFILE.clinic_id,
                    matchingProfileId: CLINIC_PROFILE.clinic_id,
                    matchingCatalogPath:
                        '/content/turnero/clinic-profiles/clinica-smoke.json',
                    matchesCatalog: true,
                    ready: true,
                },
                queueMeta: buildQueueMeta(queueState),
                queueSurfaceStatus: buildQueueSurfaceStatus(
                    CLINIC_PROFILE,
                    queueState.updatedAt
                ),
            },
            healthPayload: {
                ok: true,
                status: 'ok',
                checks: {},
            },
        });
    }
}

test.describe('Turnero runtime smoke', () => {
    test('operator renders the integrity banner and checkpoint chips', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await installTurneroSmokeMocks(page);

        await page.goto('/operador-turnos.html');

        await expect(page.locator('#operatorProfileStatus')).toContainText(
            /Perfil remoto verificado|Readiness bloqueada/
        );
        await expect(
            page.locator(
                '[data-turnero-operator-surface-integrity="true"] .turnero-surface-integrity-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-operator-surface-integrity="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '[data-turnero-operator-surface-success="true"] .turnero-surface-success-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-operator-surface-success="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '[data-turnero-operator-surface-package="true"] > .turnero-surface-package-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-operator-surface-package="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
    });

    test('kiosk renders the integrity banner and checkpoint chips', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await installTurneroSmokeMocks(page);

        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#kioskProfileStatus')).toContainText(
            /Perfil remoto verificado|Readiness bloqueada/
        );
        await expect(
            page.locator(
                '[data-turnero-kiosk-surface-integrity="true"] .turnero-surface-integrity-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-kiosk-surface-integrity="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '[data-turnero-kiosk-surface-success="true"] .turnero-surface-success-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-kiosk-surface-success="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '[data-turnero-kiosk-surface-package="true"] > .turnero-surface-package-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-kiosk-surface-package="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
    });

    test('display renders the integrity banner and checkpoint chips', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await installTurneroSmokeMocks(page);

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayProfileStatus')).toContainText(
            /Perfil remoto verificado|Readiness bloqueada/
        );
        await expect(
            page.locator(
                '[data-turnero-display-surface-integrity="true"] .turnero-surface-integrity-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-display-surface-integrity="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '[data-turnero-display-surface-success="true"] .turnero-surface-success-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-display-surface-success="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator(
                '[data-turnero-display-surface-package="true"] > .turnero-surface-package-banner'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-display-surface-package="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
    });

    test('admin queue renders the integrity console inside the queue hub', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await installTurneroSmokeMocks(page, { authenticatedAdmin: true });

        await page.goto('/admin.html#queue');

        await expect(page.locator('#queueAppsHub')).toBeVisible();
        await expect(page.locator('#queueSurfaceIntegrityConsoleHost')).toBeVisible();
        await expect(
            page.locator('#queueSurfaceIntegrityConsoleHost .turnero-admin-queue-surface-integrity-console')
        ).toBeVisible();
        await expect(
            page.locator(
                '#queueSurfaceIntegrityConsoleHost .turnero-admin-queue-surface-integrity-console'
            )
        ).toContainText('Surface Queue Integrity Console');
        await expect(page.locator('#queueSurfaceSuccessConsoleHost')).toBeVisible();
        await expect(
            page.locator(
                '#queueSurfaceSuccessConsoleHost .turnero-admin-queue-surface-success-console'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '#queueSurfaceSuccessConsoleHost .turnero-admin-queue-surface-success-console'
            )
        ).toContainText('Surface Customer Success Console');
        await expect(page.locator('#queueSurfacePackageConsoleHost')).toBeVisible();
        await expect(
            page.locator(
                '#queueSurfacePackageConsoleHost > .turnero-admin-queue-surface-package-console'
            )
        ).toBeVisible();
        await expect(
            page.locator(
                '#queueSurfacePackageConsoleHost > .turnero-admin-queue-surface-package-console'
            )
        ).toContainText('Surface Package Standardization');
    });
});
