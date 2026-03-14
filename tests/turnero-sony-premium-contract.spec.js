// @ts-check
const { test, expect } = require('@playwright/test');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');
const {
    buildOperatorQueueState,
    buildOperatorQueueTicket,
    installLegacyAdminAuthMock,
} = require('./helpers/admin-auth-mocks');
const {
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');

test.use({
    serviceWorkers: 'block',
});

function createScorecard() {
    return {
        total: 0,
        missed: [],
    };
}

function award(scorecard, condition, points, label) {
    if (condition) {
        scorecard.total += points;
        return;
    }

    scorecard.missed.push(`${label} (-${points})`);
}

function buildClinicProfile(overrides = {}) {
    const brandingOverride =
        overrides.branding && typeof overrides.branding === 'object'
            ? overrides.branding
            : {};
    const surfacesOverride =
        overrides.surfaces && typeof overrides.surfaces === 'object'
            ? overrides.surfaces
            : {};

    return {
        schema: 'turnero-clinic-profile/v1',
        clinic_id: 'aurora-derm-demo',
        branding: {
            name: 'Aurora Derm',
            short_name: 'Aurora',
            city: 'Quito',
            ...brandingOverride,
        },
        consultorios: {
            c1: {
                label: 'Dermatología 1',
                short_label: 'D1',
            },
            c2: {
                label: 'Dermatología 2',
                short_label: 'D2',
            },
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
            ...surfacesOverride,
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: false,
        },
    };
}

function buildQueueTickets() {
    return [
        {
            id: 101,
            ticketCode: 'A-101',
            queueType: 'walk_in',
            patientInitials: 'EP',
            priorityClass: 'walk_in',
            status: 'waiting',
            createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        },
        {
            id: 102,
            ticketCode: 'A-102',
            queueType: 'appointment',
            patientInitials: 'JR',
            priorityClass: 'appt_current',
            status: 'called',
            assignedConsultorio: 1,
            calledAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        },
        {
            id: 103,
            ticketCode: 'A-103',
            queueType: 'appointment',
            patientInitials: 'LM',
            priorityClass: 'appt_overdue',
            status: 'waiting',
            createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        },
    ];
}

function buildQueueStateFromTickets(tickets) {
    const waiting = tickets.filter((ticket) => ticket.status === 'waiting');
    const called = tickets.filter((ticket) => ticket.status === 'called');
    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        estimatedWaitMin: 8,
        assistancePendingCount: 1,
        activeHelpRequests: [
            {
                id: 701,
                source: 'assistant',
                reason: 'human_help',
                reasonLabel: 'Ayuda humana',
                status: 'pending',
                patientInitials: 'EP',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ],
        recentResolvedHelpRequests: [
            {
                id: 702,
                source: 'assistant',
                reason: 'reprint_requested',
                reasonLabel: 'Reimpresión solicitada',
                status: 'resolved',
                patientInitials: 'JR',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ],
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: 2,
            no_show: 0,
            cancelled: 0,
        },
        callingNow: called.map((ticket) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            assignedConsultorio: ticket.assignedConsultorio,
            calledAt: ticket.calledAt,
        })),
        nextTickets: waiting.map((ticket, index) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            position: index + 1,
            queueType: ticket.queueType,
            priorityClass: ticket.priorityClass,
        })),
    };
}

function buildQueueMeta(queueState) {
    const byConsultorio = { 1: null, 2: null };
    for (const ticket of queueState.callingNow || []) {
        const room = String(ticket.assignedConsultorio || '');
        if (room === '1' || room === '2') {
            byConsultorio[room] = ticket;
        }
    }

    return {
        updatedAt: queueState.updatedAt,
        waitingCount: queueState.waitingCount,
        calledCount: queueState.calledCount,
        estimatedWaitMin: queueState.estimatedWaitMin,
        assistancePendingCount: queueState.assistancePendingCount,
        activeHelpRequests: queueState.activeHelpRequests,
        recentResolvedHelpRequests: queueState.recentResolvedHelpRequests,
        counts: queueState.counts,
        callingNowByConsultorio: byConsultorio,
        nextTickets: queueState.nextTickets,
    };
}

function buildQueueSurfaceStatus(profile, updatedAt) {
    const clinicId = String(profile.clinic_id || '').trim();
    return {
        operator: {
            surface: 'operator',
            label: 'Operador',
            status: 'ready',
            updatedAt,
            ageSec: 4,
            stale: false,
            summary: 'Operador listo.',
            latest: {
                deviceLabel: 'Operador C1 fijo',
                appMode: 'browser',
                ageSec: 4,
                details: {
                    clinicId,
                    surfaceContractState: 'ready',
                    surfaceRouteExpected: '/operador-turnos.html',
                    surfaceRouteCurrent: '/operador-turnos.html',
                    station: 'c1',
                },
            },
            instances: [],
        },
        kiosk: {
            surface: 'kiosk',
            label: 'Kiosco',
            status: 'ready',
            updatedAt,
            ageSec: 5,
            stale: false,
            summary: 'Kiosco listo.',
            latest: {
                deviceLabel: 'Kiosco principal',
                appMode: 'browser',
                ageSec: 5,
                details: {
                    clinicId,
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
            updatedAt,
            ageSec: 6,
            stale: false,
            summary: 'Sala lista.',
            latest: {
                deviceLabel: 'Sala principal',
                appMode: 'browser',
                ageSec: 6,
                details: {
                    clinicId,
                    surfaceContractState: 'ready',
                    surfaceRouteExpected: '/sala-turnos.html',
                    surfaceRouteCurrent: '/sala-turnos.html',
                },
            },
            instances: [],
        },
    };
}

function parseRgbChannelList(value) {
    const match = String(value || '')
        .trim()
        .match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function getRelativeBrightness(value) {
    const channels = parseRgbChannelList(value);
    if (!channels) {
        return 0;
    }

    const [r, g, b] = channels.map((channel) => channel / 255);
    return (r * 299 + g * 587 + b * 114) / 1000;
}

async function attachScreenshot(page, testInfo, name) {
    await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    });
}

async function hasNoHorizontalOverflow(page) {
    return page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 2
    );
}

async function installAdminPremiumMocks(
    page,
    profile,
    queueState,
    queueTickets
) {
    const updatedAt = queueState.updatedAt;
    await installTurneroClinicProfileMock(page, profile);
    await installLegacyAdminAuthMock(page, {
        authenticated: true,
        csrfToken: 'csrf_premium_admin',
    });
    await installBasicAdminApiMocks(page, {
        featuresPayload: {
            data: {
                admin_sony_ui: true,
                admin_sony_ui_v3: true,
            },
        },
        healthPayload: {
            ok: true,
            status: 'ok',
            checks: {
                publicSync: {
                    configured: true,
                    healthy: true,
                    state: 'ok',
                    deployedCommit: 'premium-turnero-sony150',
                    headDrift: false,
                    ageSeconds: 12,
                    failureReason: '',
                },
            },
        },
        dataOverrides: {
            queue_tickets: queueTickets,
            queueMeta: buildQueueMeta(queueState),
            turneroClinicProfile: profile,
            turneroClinicProfileMeta: {
                clinicId: profile.clinic_id,
                source: 'remote',
                fetchedAt: updatedAt,
            },
            turneroClinicProfileCatalogStatus: {
                catalogAvailable: true,
                catalogCount: 1,
                activePath: '/content/turnero/clinic-profile.json',
                clinicId: profile.clinic_id,
                matchingProfileId: profile.clinic_id,
                matchingCatalogPath: `/content/turnero/clinic-profiles/${profile.clinic_id}.json`,
                matchesCatalog: true,
                ready: true,
            },
            queueSurfaceStatus: buildQueueSurfaceStatus(profile, updatedAt),
        },
        handleRoute: async ({ route, resource, fulfillJson }) => {
            if (resource === 'queue-state') {
                await fulfillJson(route, {
                    ok: true,
                    data: queueState,
                });
                return true;
            }

            return false;
        },
    });
}

async function installOperatorPremiumMocks(page, profile, apiState) {
    await installTurneroClinicProfileMock(page, profile);
    await installLegacyAdminAuthMock(page, {
        authenticated: true,
        csrfToken: 'csrf_premium_operator',
    });
    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'queue-state') {
            if (apiState.failQueueState === true) {
                return route.fulfill({
                    status: 503,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({
                        ok: false,
                        error: 'queue_state_unavailable',
                    }),
                });
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    ok: true,
                    data: apiState.queueState,
                }),
            });
        }

        if (resource === 'data') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {},
                        queue_tickets: apiState.queueTickets,
                        queueMeta: apiState.queueState,
                    },
                }),
            });
        }

        if (
            resource === 'health' ||
            resource === 'funnel-metrics' ||
            resource === 'queue-surface-heartbeat' ||
            resource === 'queue-ticket' ||
            resource === 'queue-call-next'
        ) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json; charset=utf-8',
                body: JSON.stringify({
                    ok: true,
                    data: {},
                }),
            });
        }

        return route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
                ok: true,
                data: {},
            }),
        });
    });
}

async function extractThemeSnapshot(page, headingSelector) {
    return page.evaluate((selector) => {
        const heading = document.querySelector(selector);
        const toneProbe = document.createElement('div');
        toneProbe.style.background = 'var(--bg)';
        toneProbe.style.position = 'fixed';
        toneProbe.style.opacity = '0';
        toneProbe.style.pointerEvents = 'none';
        toneProbe.style.inset = '0 auto auto 0';
        document.body.appendChild(toneProbe);
        const resolvedBg = getComputedStyle(toneProbe).backgroundColor;
        toneProbe.remove();

        return {
            htmlTone: document.documentElement.getAttribute('data-ops-tone'),
            bodyTone: document.body.getAttribute('data-ops-tone'),
            bg: getComputedStyle(document.body).getPropertyValue('--bg').trim(),
            resolvedBg,
            motionFast: getComputedStyle(document.documentElement)
                .getPropertyValue('--ops-motion-fast')
                .trim(),
            motionBase: getComputedStyle(document.documentElement)
                .getPropertyValue('--ops-motion-base')
                .trim(),
            headingFont: heading ? getComputedStyle(heading).fontFamily : '',
            bodyFont: getComputedStyle(document.body).fontFamily,
        };
    }, headingSelector);
}

test('turnero premium contract reaches 150/150', async ({
    browser,
}, testInfo) => {
    test.setTimeout(120000);

    const score = createScorecard();
    const clinicProfile = buildClinicProfile();
    const queueTickets = buildQueueTickets();
    const queueState = buildQueueStateFromTickets(queueTickets);

    const adminDesktopContext = await browser.newContext({
        viewport: { width: 1440, height: 960 },
    });
    const adminDesktop = await adminDesktopContext.newPage();
    await installAdminPremiumMocks(
        adminDesktop,
        clinicProfile,
        queueState,
        queueTickets
    );
    await adminDesktop.goto('/admin.html#queue');
    await expect(adminDesktop.locator('#queueAppsHub')).toBeVisible();
    await attachScreenshot(adminDesktop, testInfo, 'admin-desktop-after');

    const adminTheme = await extractThemeSnapshot(
        adminDesktop,
        '.queue-premium-band__header h5'
    );
    const adminBands = await adminDesktop
        .locator('.queue-premium-band')
        .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('data-band') || '')
        );

    award(
        score,
        adminTheme.htmlTone === 'light' && adminTheme.bodyTone === 'light',
        8,
        'Admin usa contrato light-command'
    );
    award(
        score,
        adminBands.length === 4 &&
            ['control-room', 'live-queue', 'incidents', 'deployment'].every(
                (band) => adminBands.includes(band)
            ),
        12,
        'Admin conserva las 4 bandas fijas del control room'
    );

    const operatorDesktopContext = await browser.newContext({
        viewport: { width: 1440, height: 960 },
    });
    const operatorDesktop = await operatorDesktopContext.newPage();
    const operatorApiState = {
        queueTickets: [
            buildOperatorQueueTicket({
                ticketCode: 'B-2201',
                patientInitials: 'OC',
            }),
        ],
        queueState: buildOperatorQueueState([
            buildOperatorQueueTicket({
                ticketCode: 'B-2201',
                patientInitials: 'OC',
            }),
        ]),
        failQueueState: false,
    };
    await installOperatorPremiumMocks(
        operatorDesktop,
        clinicProfile,
        operatorApiState
    );
    await operatorDesktop.goto(
        '/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    await expect(operatorDesktop.locator('#operatorApp')).toBeVisible();
    await attachScreenshot(operatorDesktop, testInfo, 'operator-desktop-after');

    const operatorTheme = await extractThemeSnapshot(
        operatorDesktop,
        '.queue-operator-topbar__copy h2'
    );
    award(
        score,
        operatorTheme.htmlTone === 'light' &&
            operatorTheme.bodyTone === 'light',
        8,
        'Operador comparte contrato light-command'
    );
    award(
        score,
        (await operatorDesktop.locator('#operatorActionTitle').isVisible()) &&
            (await operatorDesktop
                .locator('#operatorReadinessTitle')
                .isVisible()) &&
            (await operatorDesktop
                .locator('.queue-operations-stream--operator')
                .isVisible()) &&
            (await operatorDesktop
                .locator(
                    '[data-action="queue-call-next"][data-queue-consultorio="1"]'
                )
                .isVisible()),
        10,
        'Operador deja claro siguiente paso, readiness y CTA principal'
    );

    const kioskTouchContext = await browser.newContext({
        viewport: { width: 1366, height: 1024 },
        hasTouch: true,
    });
    const kioskTouch = await kioskTouchContext.newPage();
    await installTurneroClinicProfileMock(kioskTouch, clinicProfile);
    await installTurneroQueueStateMock(kioskTouch, {
        queueState: {
            updatedAt: new Date().toISOString(),
            waitingCount: 2,
            calledCount: 1,
            callingNow: [
                {
                    id: 401,
                    ticketCode: 'A-401',
                    patientInitials: 'EP',
                    assignedConsultorio: 1,
                    calledAt: new Date().toISOString(),
                },
            ],
            nextTickets: [
                {
                    id: 402,
                    ticketCode: 'A-402',
                    patientInitials: 'JR',
                    position: 1,
                },
                {
                    id: 403,
                    ticketCode: 'A-403',
                    patientInitials: 'LM',
                    position: 2,
                },
            ],
        },
    });
    await kioskTouch.goto('/kiosco-turnos.html');
    await expect(kioskTouch.locator('#kioskQuickActions')).toBeVisible();
    await attachScreenshot(kioskTouch, testInfo, 'kiosk-touch-after');

    const kioskTheme = await extractThemeSnapshot(
        kioskTouch,
        '.kiosk-checkin-card h1'
    );
    award(
        score,
        kioskTheme.htmlTone === 'dark' && kioskTheme.bodyTone === 'dark',
        8,
        'Kiosco usa contrato dark-ambient'
    );

    const displayTvContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
    });
    const displayTv = await displayTvContext.newPage();
    await installTurneroClinicProfileMock(displayTv, clinicProfile);
    await installTurneroQueueStateMock(displayTv, {
        queueState: {
            updatedAt: new Date().toISOString(),
            callingNow: [
                {
                    id: 501,
                    ticketCode: 'A-501',
                    patientInitials: 'EP',
                    assignedConsultorio: 1,
                    calledAt: new Date().toISOString(),
                },
                {
                    id: 502,
                    ticketCode: 'A-502',
                    patientInitials: 'JR',
                    assignedConsultorio: 2,
                    calledAt: new Date().toISOString(),
                },
            ],
            nextTickets: [
                {
                    id: 503,
                    ticketCode: 'A-503',
                    patientInitials: 'LM',
                    position: 1,
                },
            ],
        },
    });
    await displayTv.goto('/sala-turnos.html');
    await expect(displayTv.locator('#displayConsultorio1')).toBeVisible();
    await attachScreenshot(displayTv, testInfo, 'display-tv-after');

    const displayTheme = await extractThemeSnapshot(
        displayTv,
        '.display-panel h1'
    );
    award(
        score,
        displayTheme.htmlTone === 'dark' && displayTheme.bodyTone === 'dark',
        8,
        'Sala usa contrato dark-ambient'
    );

    award(
        score,
        adminTheme.bodyFont.includes('PlusJakarta') &&
            operatorTheme.bodyFont.includes('PlusJakarta') &&
            adminTheme.headingFont.includes('FrauncesSoft') &&
            kioskTheme.headingFont.includes('FrauncesSoft') &&
            displayTheme.headingFont.includes('FrauncesSoft') &&
            adminTheme.motionFast === '180ms' &&
            adminTheme.motionBase === '220ms',
        13,
        'Sistema visual comparte tipografías y motion tokens premium'
    );

    award(
        score,
        (await kioskTouch.locator('.kiosk-next-step').isVisible()) &&
            (await kioskTouch.locator('#queueCallingNow').isVisible()) &&
            (await displayTv.locator('.display-panel--hero').isVisible()) &&
            (await displayTv.locator('#displayNextList').isVisible()),
        8,
        'Kiosco y sala priorizan qué hago ahora y a quién llamo ahora'
    );

    award(
        score,
        (await kioskTouch.locator('#kioskStatus').getAttribute('role')) ===
            'status' &&
            (await kioskTouch
                .locator('#queueCallingNow')
                .getAttribute('aria-live')) === 'polite' &&
            (await kioskTouch
                .locator('#queueNextList')
                .getAttribute('aria-live')) === 'polite' &&
            (await displayTv
                .locator('#displayConnectionState')
                .getAttribute('role')) === 'status' &&
            (await displayTv
                .locator('#displayConsultorio1')
                .getAttribute('aria-live')) === 'assertive' &&
            (await displayTv
                .locator('#displayNextList')
                .getAttribute('aria-live')) === 'polite' &&
            (await operatorDesktop
                .locator('#toastContainer')
                .getAttribute('aria-live')) === 'polite',
        10,
        'La legibilidad operativa mantiene regiones y estados A11y'
    );

    award(
        score,
        getRelativeBrightness(adminTheme.resolvedBg) > 0.85 &&
            getRelativeBrightness(operatorTheme.resolvedBg) > 0.85 &&
            getRelativeBrightness(kioskTheme.resolvedBg) < 0.08 &&
            getRelativeBrightness(displayTheme.resolvedBg) < 0.08,
        8,
        'Los tonos light/dark conservan contraste de base coherente'
    );

    const kioskH1Size = parseFloat(
        await kioskTouch
            .locator('.kiosk-checkin-card h1')
            .evaluate((element) =>
                getComputedStyle(element).fontSize.replace('px', '')
            )
    );
    const displayLiveSize = parseFloat(
        await displayTv
            .locator('#displayConsultorio1 strong')
            .evaluate((element) =>
                getComputedStyle(element).fontSize.replace('px', '')
            )
    );
    award(
        score,
        kioskH1Size >= 28 && displayLiveSize >= 40,
        7,
        'Los titulares críticos conservan legibilidad clínica'
    );

    const adminNarrowContext = await browser.newContext({
        viewport: { width: 1024, height: 900 },
    });
    const adminNarrow = await adminNarrowContext.newPage();
    await installAdminPremiumMocks(
        adminNarrow,
        clinicProfile,
        queueState,
        queueTickets
    );
    await adminNarrow.goto('/admin.html#queue');
    await expect(adminNarrow.locator('#queueAppsHub')).toBeVisible();
    await attachScreenshot(adminNarrow, testInfo, 'admin-narrow-after');

    const operatorNarrowContext = await browser.newContext({
        viewport: { width: 1024, height: 900 },
    });
    const operatorNarrow = await operatorNarrowContext.newPage();
    await installOperatorPremiumMocks(operatorNarrow, clinicProfile, {
        queueTickets: operatorApiState.queueTickets,
        queueState: operatorApiState.queueState,
        failQueueState: false,
    });
    await operatorNarrow.goto('/operador-turnos.html?station=c1&lock=1');
    await expect(operatorNarrow.locator('#operatorApp')).toBeVisible();
    await attachScreenshot(operatorNarrow, testInfo, 'operator-narrow-after');

    award(
        score,
        (await hasNoHorizontalOverflow(adminNarrow)) &&
            (await hasNoHorizontalOverflow(operatorNarrow)),
        10,
        'Admin y operador ajustan sin overflow en ancho reducido'
    );

    award(
        score,
        (await hasNoHorizontalOverflow(kioskTouch)) &&
            (await hasNoHorizontalOverflow(displayTv)),
        10,
        'Kiosco táctil y sala TV respetan el fit del viewport'
    );

    award(
        score,
        (await adminDesktop
            .locator('#queueSyncStatus')
            .getAttribute('data-state')) === 'live' &&
            (await kioskTouch
                .locator('#queueConnectionState')
                .getAttribute('data-state')) === 'live' &&
            (await displayTv
                .locator('#displayConnectionState')
                .getAttribute('data-state')) === 'live',
        8,
        'Los estados live siguen visibles y distinguibles'
    );

    const blockedKioskContext = await browser.newContext({
        viewport: { width: 1366, height: 900 },
    });
    const blockedKiosk = await blockedKioskContext.newPage();
    await installTurneroClinicProfileMock(
        blockedKiosk,
        buildClinicProfile({
            surfaces: {
                kiosk: {
                    enabled: true,
                    route: '/kiosco-alt.html',
                },
            },
        })
    );
    await installTurneroQueueStateMock(blockedKiosk);
    await blockedKiosk.goto('/kiosco-turnos.html');
    award(
        score,
        /Bloqueado/.test(
            (await blockedKiosk.locator('#kioskProfileStatus').textContent()) ||
                ''
        ) &&
            /Ruta del piloto incorrecta/i.test(
                (await blockedKiosk
                    .locator('#kioskSetupTitle')
                    .textContent()) || ''
            ),
        4,
        'El estado blocked/alert sigue explícito y accionable'
    );

    await operatorDesktop.evaluate(() => {
        window.dispatchEvent(new Event('offline'));
    });
    await expect(operatorDesktop.locator('#operatorGuardTitle')).toContainText(
        'Modo seguro'
    );
    award(
        score,
        (await operatorDesktop
            .locator('#operatorNetworkCard')
            .getAttribute('data-state')) === 'danger' &&
            (await operatorDesktop
                .locator(
                    '[data-action="queue-call-next"][data-queue-consultorio="2"]'
                )
                .isDisabled()),
        4,
        'El estado offline sigue frenando acciones mutantes'
    );

    const fallbackOperatorContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
    });
    const fallbackOperator = await fallbackOperatorContext.newPage();
    const fallbackApiState = {
        queueTickets: operatorApiState.queueTickets,
        queueState: operatorApiState.queueState,
        failQueueState: false,
    };
    await installOperatorPremiumMocks(
        fallbackOperator,
        clinicProfile,
        fallbackApiState
    );
    await fallbackOperator.goto(
        '/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    await expect(fallbackOperator.locator('#operatorApp')).toBeVisible();
    fallbackApiState.failQueueState = true;
    await fallbackOperator
        .locator('[data-action="queue-refresh-state"]')
        .click();
    await expect(fallbackOperator.locator('#operatorGuardTitle')).toContainText(
        'Cola en fallback local'
    );
    award(
        score,
        /fallback local/i.test(
            [
                await fallbackOperator
                    .locator('#operatorGuardTitle')
                    .textContent(),
                await fallbackOperator
                    .locator('#operatorGuardSummary')
                    .textContent(),
                await fallbackOperator
                    .locator('#operatorReadyNetwork')
                    .textContent(),
                await fallbackOperator
                    .locator('#operatorNetworkSummary')
                    .textContent(),
            ]
                .filter(Boolean)
                .join(' ')
        ),
        4,
        'El estado fallback sigue diferenciado del offline duro'
    );

    const reducedMotionContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
    });
    const reducedMotionPage = await reducedMotionContext.newPage();
    await installOperatorPremiumMocks(reducedMotionPage, clinicProfile, {
        queueTickets: operatorApiState.queueTickets,
        queueState: operatorApiState.queueState,
        failQueueState: false,
    });
    await reducedMotionPage.goto('/operador-turnos.html?station=c1&lock=1');
    await expect(reducedMotionPage.locator('#operatorApp')).toBeVisible();
    const reducedTransition = await reducedMotionPage
        .locator('[data-action="queue-refresh-state"]')
        .evaluate((element) => getComputedStyle(element).transitionDuration);

    award(
        score,
        adminTheme.motionFast === '180ms' && adminTheme.motionBase === '220ms',
        4,
        'Motion premium queda dentro del rango operativo esperado'
    );
    award(
        score,
        /^0s(, 0s)*$/i.test(String(reducedTransition || '').trim()),
        6,
        'Reduced motion desactiva transiciones cuando el sistema lo pide'
    );

    await Promise.all([
        adminDesktopContext.close(),
        operatorDesktopContext.close(),
        kioskTouchContext.close(),
        displayTvContext.close(),
        adminNarrowContext.close(),
        operatorNarrowContext.close(),
        blockedKioskContext.close(),
        fallbackOperatorContext.close(),
        reducedMotionContext.close(),
    ]);

    expect(
        score.total,
        `Sony premium contract incompleto:\n${score.missed.join('\n')}`
    ).toBe(150);
});
