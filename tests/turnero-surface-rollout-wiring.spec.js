// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const {
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');

const CLINIC_PROFILE = {
    clinic_id: 'clinica-norte-demo',
    branding: {
        name: 'Clinica Norte',
        short_name: 'Norte',
        city: 'Quito',
    },
    consultorios: {
        c1: { label: 'Dermatología 1', short_label: 'D1' },
        c2: { label: 'Dermatología 2', short_label: 'D2' },
    },
    surfaces: {
        admin: {
            enabled: true,
            route: '/admin.html#queue',
        },
        operator: {
            enabled: true,
            route: '/operador-turnos.html',
        },
        kiosk: {
            enabled: true,
            route: '/kiosco-turnos.html',
        },
        display: {
            enabled: true,
            route: '/sala-turnos.html',
        },
    },
};

async function installRolloutWiringMocks(page, { authenticated = false } = {}) {
    await installTurneroClinicProfileMock(page, CLINIC_PROFILE);
    await installTurneroQueueStateMock(page);
    if (authenticated) {
        await installLegacyAdminAuthMock(page, {
            authenticated: true,
            mode: 'local',
            status: 'authenticated',
        });
    }
}

test.describe('Turnero surface rollout wiring', () => {
    test('mounts rollout banner and checkpoint chips on operador', async ({
        page,
    }) => {
        await installRolloutWiringMocks(page, { authenticated: true });
        await page.goto('/operador-turnos.html');

        await expect(
            page.locator(
                '#operatorSurfaceRecoveryHost .turnero-surface-rollout-banner'
            )
        ).toContainText('Operator surface rollout');
        await expect(
            page.locator(
                '#operatorSurfaceRecoveryHost .turnero-surface-rollout-stack .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
    });

    test('mounts rollout banner and checkpoint chips on kiosco', async ({
        page,
    }) => {
        await installRolloutWiringMocks(page);
        await page.goto('/kiosco-turnos.html');

        await expect(page.locator('#kioskProfileStatus')).toContainText(
            /Perfil remoto verificado|Readiness bloqueada/
        );
        await expect(
            page.locator(
                '#kioskSurfaceRecoveryHost .turnero-surface-rollout-banner'
            )
        ).toContainText('Kiosk surface rollout');
        await expect(
            page.locator(
                '#kioskSurfaceRecoveryHost .turnero-surface-rollout-stack .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
    });

    test('mounts rollout banner and checkpoint chips on sala TV', async ({
        page,
    }) => {
        await installRolloutWiringMocks(page);
        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayProfileStatus')).toContainText(
            /Perfil remoto verificado|Readiness bloqueada/
        );
        await expect(
            page.locator(
                '#displaySurfaceRecoveryHost .turnero-surface-rollout-banner'
            )
        ).toContainText('Display surface rollout');
        await expect(
            page.locator(
                '#displaySurfaceRecoveryHost .turnero-surface-rollout-stack .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
    });
});
