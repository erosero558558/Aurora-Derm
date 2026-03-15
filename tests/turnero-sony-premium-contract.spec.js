// @ts-check
const fs = require('fs');
const path = require('path');
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

const AFTER_EVIDENCE_DIR = path.join(
    process.cwd(),
    'verification',
    'turnero-sony-premium-evidence',
    'after'
);

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
                label: 'Dermatologia 1',
                short_label: 'D1',
            },
            c2: {
                label: 'Dermatologia 2',
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
                reasonLabel: 'Reimpresion solicitada',
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
    const body = await page.screenshot({ fullPage: true });
    fs.mkdirSync(AFTER_EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(AFTER_EVIDENCE_DIR, `${name}.png`), body);
    await testInfo.attach(name, {
        body,
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
            themeMode: document.documentElement.getAttribute('data-theme-mode'),
            theme: document.documentElement.getAttribute('data-theme'),
            family: document.documentElement.getAttribute('data-ops-family'),
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

async function expectResolvedTone(page, tone) {
    await expect
        .poll(async () =>
            page.evaluate(() => ({
                htmlTone:
                    document.documentElement.getAttribute('data-ops-tone'),
                bodyTone: document.body.getAttribute('data-ops-tone'),
                theme: document.documentElement.getAttribute('data-theme'),
            }))
        )
        .toEqual({
            htmlTone: tone,
            bodyTone: tone,
            theme: tone,
        });
}

async function extractSurfaceMaterial(page, selector) {
    return page
        .locator(selector)
        .first()
        .evaluate((element) => {
            const styles = getComputedStyle(element);
            return {
                backgroundImage: styles.backgroundImage,
                boxShadow: styles.boxShadow,
                borderRadius: parseFloat(styles.borderRadius || '0') || 0,
                minHeight: parseFloat(styles.minHeight || '0') || 0,
            };
        });
}

function createOperatorApiState() {
    const queueTickets = [
        buildOperatorQueueTicket({
            ticketCode: 'B-2201',
            patientInitials: 'OC',
        }),
    ];

    return {
        queueTickets,
        queueState: buildOperatorQueueState(queueTickets),
        failQueueState: false,
    };
}

test('turnero premium contract reaches 150/150 in auto day/night', async ({
    browser,
}, testInfo) => {
    test.setTimeout(300000);

    const score = createScorecard();
    const clinicProfile = buildClinicProfile();
    const queueTickets = buildQueueTickets();
    const queueState = buildQueueStateFromTickets(queueTickets);

    const adminDayContext = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        colorScheme: 'light',
    });
    const adminDay = await adminDayContext.newPage();
    await installAdminPremiumMocks(
        adminDay,
        clinicProfile,
        queueState,
        queueTickets
    );
    await adminDay.goto('/admin.html#queue');
    await expect(adminDay.locator('#queueAppsHub')).toBeVisible();
    await attachScreenshot(adminDay, testInfo, 'admin-desktop-day-after');
    const adminDayTheme = await extractThemeSnapshot(
        adminDay,
        '.queue-premium-band__header h5'
    );
    const adminBands = await adminDay
        .locator('.queue-premium-band')
        .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('data-band') || '')
        );

    const adminNightContext = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        colorScheme: 'dark',
    });
    const adminNight = await adminNightContext.newPage();
    await installAdminPremiumMocks(
        adminNight,
        clinicProfile,
        queueState,
        queueTickets
    );
    await adminNight.goto('/admin.html#queue');
    await expect(adminNight.locator('#queueAppsHub')).toBeVisible();
    await attachScreenshot(adminNight, testInfo, 'admin-desktop-night-after');
    const adminNightTheme = await extractThemeSnapshot(
        adminNight,
        '.queue-premium-band__header h5'
    );

    const operatorDayContext = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        colorScheme: 'light',
    });
    const operatorDay = await operatorDayContext.newPage();
    await installOperatorPremiumMocks(
        operatorDay,
        clinicProfile,
        createOperatorApiState()
    );
    await operatorDay.goto('/operador-turnos.html?station=c2&lock=1&one_tap=1');
    await expect(operatorDay.locator('#operatorApp')).toBeVisible();
    await attachScreenshot(operatorDay, testInfo, 'operator-desktop-day-after');
    const operatorDayTheme = await extractThemeSnapshot(
        operatorDay,
        '.queue-operator-topbar__copy h2'
    );

    const operatorNightContext = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        colorScheme: 'dark',
    });
    const operatorNight = await operatorNightContext.newPage();
    await installOperatorPremiumMocks(
        operatorNight,
        clinicProfile,
        createOperatorApiState()
    );
    await operatorNight.goto(
        '/operador-turnos.html?station=c2&lock=1&one_tap=1'
    );
    await expect(operatorNight.locator('#operatorApp')).toBeVisible();
    await attachScreenshot(
        operatorNight,
        testInfo,
        'operator-desktop-night-after'
    );
    const operatorNightTheme = await extractThemeSnapshot(
        operatorNight,
        '.queue-operator-topbar__copy h2'
    );

    const kioskDayContext = await browser.newContext({
        viewport: { width: 1366, height: 1024 },
        hasTouch: true,
        colorScheme: 'light',
    });
    const kioskDay = await kioskDayContext.newPage();
    await installTurneroClinicProfileMock(kioskDay, clinicProfile);
    await installTurneroQueueStateMock(kioskDay, {
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
    await kioskDay.goto('/kiosco-turnos.html');
    await expect(kioskDay.locator('#kioskQuickActions')).toBeVisible();
    await attachScreenshot(kioskDay, testInfo, 'kiosk-touch-day-after');
    const kioskDayTheme = await extractThemeSnapshot(
        kioskDay,
        '.kiosk-checkin-card h1'
    );

    const kioskNightContext = await browser.newContext({
        viewport: { width: 1366, height: 1024 },
        hasTouch: true,
        colorScheme: 'dark',
    });
    const kioskNight = await kioskNightContext.newPage();
    await installTurneroClinicProfileMock(kioskNight, clinicProfile);
    await installTurneroQueueStateMock(kioskNight, {
        queueState: {
            updatedAt: new Date().toISOString(),
            waitingCount: 2,
            calledCount: 1,
            callingNow: [
                {
                    id: 404,
                    ticketCode: 'A-404',
                    patientInitials: 'MR',
                    assignedConsultorio: 2,
                    calledAt: new Date().toISOString(),
                },
            ],
            nextTickets: [
                {
                    id: 405,
                    ticketCode: 'A-405',
                    patientInitials: 'IV',
                    position: 1,
                },
            ],
        },
    });
    await kioskNight.goto('/kiosco-turnos.html');
    await expect(kioskNight.locator('#kioskQuickActions')).toBeVisible();
    await attachScreenshot(kioskNight, testInfo, 'kiosk-touch-night-after');
    const kioskNightTheme = await extractThemeSnapshot(
        kioskNight,
        '.kiosk-checkin-card h1'
    );

    const displayDayContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'light',
    });
    const displayDay = await displayDayContext.newPage();
    await installTurneroClinicProfileMock(displayDay, clinicProfile);
    await installTurneroQueueStateMock(displayDay, {
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
    await displayDay.goto('/sala-turnos.html');
    await expect(displayDay.locator('#displayConsultorio1')).toBeVisible();
    await attachScreenshot(displayDay, testInfo, 'display-tv-day-after');
    const displayDayTheme = await extractThemeSnapshot(
        displayDay,
        '.display-panel h1'
    );

    const displayNightContext = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
    });
    const displayNight = await displayNightContext.newPage();
    await installTurneroClinicProfileMock(displayNight, clinicProfile);
    await installTurneroQueueStateMock(displayNight, {
        queueState: {
            updatedAt: new Date().toISOString(),
            callingNow: [
                {
                    id: 504,
                    ticketCode: 'A-504',
                    patientInitials: 'MA',
                    assignedConsultorio: 1,
                    calledAt: new Date().toISOString(),
                },
            ],
            nextTickets: [
                {
                    id: 505,
                    ticketCode: 'A-505',
                    patientInitials: 'PL',
                    position: 1,
                },
                {
                    id: 506,
                    ticketCode: 'A-506',
                    patientInitials: 'CT',
                    position: 2,
                },
            ],
        },
    });
    await displayNight.goto('/sala-turnos.html');
    await expect(displayNight.locator('#displayConsultorio1')).toBeVisible();
    await attachScreenshot(displayNight, testInfo, 'display-tv-night-after');
    const displayNightTheme = await extractThemeSnapshot(
        displayNight,
        '.display-panel h1'
    );
    const adminDayMaterial = await extractSurfaceMaterial(
        adminDay,
        '.queue-premium-band[data-band="control-room"]'
    );
    const operatorDayMaterial = await extractSurfaceMaterial(
        operatorDay,
        '.queue-operator-topbar'
    );
    const kioskDayMaterial = await extractSurfaceMaterial(
        kioskDay,
        '.kiosk-checkin-card'
    );
    const displayDayMaterial = await extractSurfaceMaterial(
        displayDay,
        '.display-panel--hero'
    );
    const kioskEmptyMaterial = await extractSurfaceMaterial(
        kioskDay,
        '.ticket-empty'
    );
    const displayCalledMaterial = await extractSurfaceMaterial(
        displayDay,
        '#displayConsultorio1 .display-called-card'
    );

    const adminNarrowDayContext = await browser.newContext({
        viewport: { width: 1024, height: 900 },
        colorScheme: 'light',
    });
    const adminNarrowDay = await adminNarrowDayContext.newPage();
    await installAdminPremiumMocks(
        adminNarrowDay,
        clinicProfile,
        queueState,
        queueTickets
    );
    await adminNarrowDay.goto('/admin.html#queue');
    await expect(adminNarrowDay.locator('#queueAppsHub')).toBeVisible();
    await attachScreenshot(adminNarrowDay, testInfo, 'admin-narrow-day-after');

    const adminNarrowNightContext = await browser.newContext({
        viewport: { width: 1024, height: 900 },
        colorScheme: 'dark',
    });
    const adminNarrowNight = await adminNarrowNightContext.newPage();
    await installAdminPremiumMocks(
        adminNarrowNight,
        clinicProfile,
        queueState,
        queueTickets
    );
    await adminNarrowNight.goto('/admin.html#queue');
    await expect(adminNarrowNight.locator('#queueAppsHub')).toBeVisible();
    await attachScreenshot(
        adminNarrowNight,
        testInfo,
        'admin-narrow-night-after'
    );

    const operatorNarrowDayContext = await browser.newContext({
        viewport: { width: 1024, height: 900 },
        colorScheme: 'light',
    });
    const operatorNarrowDay = await operatorNarrowDayContext.newPage();
    await installOperatorPremiumMocks(
        operatorNarrowDay,
        clinicProfile,
        createOperatorApiState()
    );
    await operatorNarrowDay.goto('/operador-turnos.html?station=c1&lock=1');
    await expect(operatorNarrowDay.locator('#operatorApp')).toBeVisible();
    await attachScreenshot(
        operatorNarrowDay,
        testInfo,
        'operator-narrow-day-after'
    );

    const operatorNarrowNightContext = await browser.newContext({
        viewport: { width: 1024, height: 900 },
        colorScheme: 'dark',
    });
    const operatorNarrowNight = await operatorNarrowNightContext.newPage();
    await installOperatorPremiumMocks(
        operatorNarrowNight,
        clinicProfile,
        createOperatorApiState()
    );
    await operatorNarrowNight.goto('/operador-turnos.html?station=c1&lock=1');
    await expect(operatorNarrowNight.locator('#operatorApp')).toBeVisible();
    await attachScreenshot(
        operatorNarrowNight,
        testInfo,
        'operator-narrow-night-after'
    );

    award(
        score,
        adminDayTheme.themeMode === 'system' &&
            adminNightTheme.themeMode === 'system' &&
            adminDayTheme.family === 'command' &&
            adminNightTheme.family === 'command' &&
            adminDayTheme.htmlTone === 'light' &&
            adminNightTheme.htmlTone === 'dark' &&
            adminDayTheme.bodyTone === 'light' &&
            adminNightTheme.bodyTone === 'dark' &&
            (await adminDay
                .locator(
                    '.admin-theme-switcher-header:visible, .login-theme-bar:visible'
                )
                .count()) === 0,
        10,
        'Admin queue usa auto day/night command y sin toggle visible'
    );

    award(
        score,
        operatorDayTheme.themeMode === 'system' &&
            operatorNightTheme.themeMode === 'system' &&
            operatorDayTheme.family === 'command' &&
            operatorNightTheme.family === 'command' &&
            operatorDayTheme.htmlTone === 'light' &&
            operatorNightTheme.htmlTone === 'dark' &&
            operatorDayTheme.bodyTone === 'light' &&
            operatorNightTheme.bodyTone === 'dark',
        10,
        'Operador comparte el contrato auto command en dia y noche'
    );

    award(
        score,
        kioskDayTheme.themeMode === 'system' &&
            kioskNightTheme.themeMode === 'system' &&
            kioskDayTheme.family === 'ambient' &&
            kioskNightTheme.family === 'ambient' &&
            kioskDayTheme.htmlTone === 'light' &&
            kioskNightTheme.htmlTone === 'dark' &&
            kioskDayTheme.bodyTone === 'light' &&
            kioskNightTheme.bodyTone === 'dark',
        10,
        'Kiosco resuelve ambient claro y oscuro segun el sistema'
    );

    award(
        score,
        displayDayTheme.themeMode === 'system' &&
            displayNightTheme.themeMode === 'system' &&
            displayDayTheme.family === 'ambient' &&
            displayNightTheme.family === 'ambient' &&
            displayDayTheme.htmlTone === 'light' &&
            displayNightTheme.htmlTone === 'dark' &&
            displayDayTheme.bodyTone === 'light' &&
            displayNightTheme.bodyTone === 'dark',
        10,
        'Sala resuelve ambient claro y oscuro segun el sistema'
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

    award(
        score,
        (await operatorDay.locator('#operatorActionTitle').isVisible()) &&
            (await operatorDay
                .locator('#operatorReadinessTitle')
                .isVisible()) &&
            (await operatorDay
                .locator('.queue-operations-stream--operator')
                .isVisible()) &&
            (await operatorDay
                .locator(
                    '[data-action="queue-call-next"][data-queue-consultorio="1"]'
                )
                .isVisible()) &&
            (await operatorNight
                .locator(
                    '[data-action="queue-call-next"][data-queue-consultorio="1"]'
                )
                .isVisible()),
        10,
        'Operador mantiene CTA primario, readiness y stream operable en ambos tonos'
    );

    award(
        score,
        adminDayTheme.bodyFont.includes('PlusJakarta') &&
            adminNightTheme.bodyFont.includes('PlusJakarta') &&
            kioskDayTheme.bodyFont.includes('PlusJakarta') &&
            displayNightTheme.bodyFont.includes('PlusJakarta') &&
            adminDayTheme.headingFont.includes('FrauncesSoft') &&
            kioskDayTheme.headingFont.includes('FrauncesSoft') &&
            displayNightTheme.headingFont.includes('FrauncesSoft') &&
            adminDayTheme.motionFast === '180ms' &&
            adminDayTheme.motionBase === '220ms',
        8,
        'Sistema visual comparte tipografias y motion tokens premium'
    );

    award(
        score,
        (await kioskDay.locator('.kiosk-next-step').isVisible()) &&
            (await kioskNight.locator('#queueCallingNow').isVisible()) &&
            (await displayDay.locator('.display-panel--hero').isVisible()) &&
            (await displayNight.locator('#displayNextList').isVisible()) &&
            kioskEmptyMaterial.minHeight >= 180 &&
            displayCalledMaterial.minHeight >= 220,
        8,
        'Kiosco y sala priorizan que hago ahora y a quien llamo ahora'
    );

    award(
        score,
        (await kioskDay.locator('#kioskStatus').getAttribute('role')) ===
            'status' &&
            (await kioskNight
                .locator('#queueCallingNow')
                .getAttribute('aria-live')) === 'polite' &&
            (await kioskDay
                .locator('#queueNextList')
                .getAttribute('aria-live')) === 'polite' &&
            (await displayNight
                .locator('#displayConnectionState')
                .getAttribute('role')) === 'status' &&
            (await displayNight
                .locator('#displayConsultorio1')
                .getAttribute('aria-live')) === 'assertive' &&
            (await displayDay
                .locator('#displayNextList')
                .getAttribute('aria-live')) === 'polite' &&
            (await operatorDay
                .locator('#toastContainer')
                .getAttribute('aria-live')) === 'polite',
        10,
        'La legibilidad operativa mantiene regiones y estados A11y'
    );

    award(
        score,
        getRelativeBrightness(adminDayTheme.resolvedBg) > 0.85 &&
            getRelativeBrightness(operatorDayTheme.resolvedBg) > 0.85 &&
            getRelativeBrightness(kioskDayTheme.resolvedBg) > 0.87 &&
            getRelativeBrightness(displayDayTheme.resolvedBg) > 0.87 &&
            getRelativeBrightness(adminNightTheme.resolvedBg) < 0.16 &&
            getRelativeBrightness(operatorNightTheme.resolvedBg) < 0.16 &&
            getRelativeBrightness(kioskNightTheme.resolvedBg) < 0.1 &&
            getRelativeBrightness(displayNightTheme.resolvedBg) < 0.1 &&
            adminDayMaterial.backgroundImage !== 'none' &&
            operatorDayMaterial.backgroundImage !== 'none' &&
            kioskDayMaterial.backgroundImage !== 'none' &&
            displayDayMaterial.backgroundImage !== 'none' &&
            adminDayMaterial.boxShadow !== 'none' &&
            operatorDayMaterial.boxShadow !== 'none' &&
            kioskDayMaterial.boxShadow !== 'none' &&
            displayDayMaterial.boxShadow !== 'none' &&
            adminDayMaterial.borderRadius >= 24 &&
            operatorDayMaterial.borderRadius >= 24 &&
            kioskDayMaterial.borderRadius >= 24 &&
            displayDayMaterial.borderRadius >= 24,
        10,
        'Los tonos claros y oscuros conservan contraste de base coherente'
    );

    const kioskH1Size = parseFloat(
        await kioskDay
            .locator('.kiosk-checkin-card h1')
            .evaluate((element) =>
                getComputedStyle(element).fontSize.replace('px', '')
            )
    );
    const displayLiveSize = parseFloat(
        await displayDay
            .locator('#displayConsultorio1 strong')
            .evaluate((element) =>
                getComputedStyle(element).fontSize.replace('px', '')
            )
    );
    award(
        score,
        kioskH1Size >= 28 && displayLiveSize >= 40,
        6,
        'Los titulares criticos conservan legibilidad clinica'
    );

    award(
        score,
        (await hasNoHorizontalOverflow(adminNarrowDay)) &&
            (await hasNoHorizontalOverflow(adminNarrowNight)) &&
            (await hasNoHorizontalOverflow(operatorNarrowDay)) &&
            (await hasNoHorizontalOverflow(operatorNarrowNight)),
        10,
        'Admin y operador ajustan sin overflow en ancho reducido en ambos tonos'
    );

    award(
        score,
        (await hasNoHorizontalOverflow(kioskDay)) &&
            (await hasNoHorizontalOverflow(kioskNight)) &&
            (await hasNoHorizontalOverflow(displayDay)) &&
            (await hasNoHorizontalOverflow(displayNight)),
        8,
        'Kiosco tactil y sala TV respetan el fit del viewport en ambos tonos'
    );

    award(
        score,
        (await adminDay
            .locator('#queueSyncStatus')
            .getAttribute('data-state')) === 'live' &&
            (await kioskNight
                .locator('#queueConnectionState')
                .getAttribute('data-state')) === 'live' &&
            (await displayDay
                .locator('#displayConnectionState')
                .getAttribute('data-state')) === 'live',
        8,
        'Los estados live siguen visibles y distinguibles'
    );

    const blockedKioskContext = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        colorScheme: 'light',
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
        'El estado blocked y alert sigue explicito y accionable'
    );

    await operatorDay.evaluate(() => {
        window.dispatchEvent(new Event('offline'));
    });
    await expect(operatorDay.locator('#operatorGuardTitle')).toContainText(
        'Modo seguro'
    );
    award(
        score,
        (await operatorDay
            .locator('#operatorNetworkCard')
            .getAttribute('data-state')) === 'danger' &&
            (await operatorDay
                .locator(
                    '[data-action="queue-call-next"][data-queue-consultorio="2"]'
                )
                .isDisabled()),
        4,
        'El estado offline sigue frenando acciones mutantes'
    );

    const fallbackOperatorContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'dark',
    });
    const fallbackOperator = await fallbackOperatorContext.newPage();
    const fallbackApiState = createOperatorApiState();
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

    await kioskDay.emulateMedia({ colorScheme: 'dark' });
    await expectResolvedTone(kioskDay, 'dark');
    await adminNight.emulateMedia({ colorScheme: 'light' });
    await expectResolvedTone(adminNight, 'light');
    award(
        score,
        true,
        4,
        'El tono resuelto reacciona al cambio del sistema en runtime'
    );

    const reducedMotionContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
        colorScheme: 'dark',
    });
    const reducedMotionPage = await reducedMotionContext.newPage();
    await installOperatorPremiumMocks(
        reducedMotionPage,
        clinicProfile,
        createOperatorApiState()
    );
    await reducedMotionPage.goto('/operador-turnos.html?station=c1&lock=1');
    await expect(reducedMotionPage.locator('#operatorApp')).toBeVisible();
    const reducedTransition = await reducedMotionPage
        .locator('[data-action="queue-refresh-state"]')
        .evaluate((element) => getComputedStyle(element).transitionDuration);
    award(
        score,
        /^0s(, 0s)*$/i.test(String(reducedTransition || '').trim()),
        4,
        'Reduced motion desactiva transiciones cuando el sistema lo pide'
    );

    await Promise.all([
        adminDayContext.close(),
        adminNightContext.close(),
        operatorDayContext.close(),
        operatorNightContext.close(),
        kioskDayContext.close(),
        kioskNightContext.close(),
        displayDayContext.close(),
        displayNightContext.close(),
        adminNarrowDayContext.close(),
        adminNarrowNightContext.close(),
        operatorNarrowDayContext.close(),
        operatorNarrowNightContext.close(),
        blockedKioskContext.close(),
        fallbackOperatorContext.close(),
        reducedMotionContext.close(),
    ]);

    expect(
        score.total,
        `Sony premium contract incompleto:\n${score.missed.join('\n')}`
    ).toBe(150);
});
