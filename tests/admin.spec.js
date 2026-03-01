// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

async function setupAuthenticatedAdminMocks(page, overrides = {}) {
    const baseData = {
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
            generatedAt: new Date().toISOString(),
        },
    };
    const mergedData = {
        ...baseData,
        ...overrides,
        availabilityMeta: {
            ...baseData.availabilityMeta,
            ...(overrides.availabilityMeta || {}),
        },
    };

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';
        const method = route.request().method().toUpperCase();
        let payload = {};
        if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
            try {
                payload = route.request().postDataJSON() || {};
            } catch (_error) {
                const rawBody = route.request().postData() || '';
                const params = new URLSearchParams(rawBody);
                payload = Object.fromEntries(params.entries());
            }
        }

        const intendedMethod = String(payload._method || method).toUpperCase();

        if (
            resource === 'callbacks' &&
            (method === 'PATCH' ||
                method === 'POST' ||
                intendedMethod === 'PATCH')
        ) {
            const callbackId = Number(payload.id || 0);
            let callback = mergedData.callbacks.find(
                (item) => Number(item.id || 0) === callbackId
            );
            if (callbackId > 0 && callback) {
                callback.status = String(payload.status || callback.status);
            } else {
                mergedData.callbacks.forEach((item) => {
                    if (String(item.status || '').toLowerCase() === 'pending') {
                        item.status = String(payload.status || 'contactado');
                    }
                });
                callback = mergedData.callbacks[0] || null;
            }
            return jsonResponse(route, { ok: true, data: callback || {} });
        }

        if (
            resource === 'appointments' &&
            (method === 'PATCH' ||
                method === 'POST' ||
                intendedMethod === 'PATCH')
        ) {
            const appointmentId = Number(payload.id || 0);
            const appointment = mergedData.appointments.find(
                (item) => Number(item.id || 0) === appointmentId
            );
            if (appointment) {
                Object.assign(appointment, payload);
            }
            return jsonResponse(route, { ok: true, data: appointment || {} });
        }

        if (resource === 'data') {
            return jsonResponse(route, { ok: true, data: mergedData });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 0,
                        startCheckout: 0,
                        bookingConfirmed: 0,
                        checkoutAbandon: 0,
                        startRatePct: 0,
                        confirmedRatePct: 0,
                        abandonRatePct: 0,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: mergedData.availability,
                meta: mergedData.availabilityMeta,
            });
        }

        if (resource === 'monitoring-config') {
            return jsonResponse(route, { ok: true, data: {} });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function waitForAdminReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

test.describe('Panel de administracion', () => {
    test('pagina admin carga correctamente', async ({ page }) => {
        await page.goto('/admin.html');
        await expect(page).toHaveTitle(/Admin|Piel en Armonia/);
    });

    test('formulario de login esta visible', async ({ page }) => {
        await page.goto('/admin.html');
        const loginForm = page
            .locator('#loginForm, form, [class*="login"]')
            .first();
        await expect(loginForm).toBeVisible();
    });

    test('tema claro/oscuro funciona en login y persiste tras recarga', async ({
        page,
    }) => {
        await page.goto('/admin.html');
        await waitForAdminReady(page);

        const darkThemeBtn = page
            .locator(
                '.login-theme-bar .admin-theme-btn[data-theme-mode="dark"]'
            )
            .first();
        await expect(darkThemeBtn).toBeVisible();
        await darkThemeBtn.click();

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }))
            )
            .toEqual({
                mode: 'dark',
                theme: 'dark',
                stored: 'dark',
            });

        await page.reload();
        await expect(page.locator('#loginForm')).toBeVisible();
        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('dark');
    });

    test('login con contrasena vacia no funciona', async ({ page }) => {
        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('input[type="password"]').first();
        const loginBtn = page
            .locator('button[type="submit"], .btn-primary')
            .first();
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('');
        await loginBtn.click();

        await expect(passwordInput).toBeVisible();
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login con contrasena incorrecta muestra error', async ({ page }) => {
        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('input[type="password"]').first();
        const loginBtn = page
            .locator('button[type="submit"], .btn-primary')
            .first();
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('contrasena_incorrecta_test');
        await loginBtn.click();

        const errorMsg = page
            .locator('[class*="error"], [class*="alert"], .toast')
            .first();
        await expect(errorMsg).toBeVisible();
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('dashboard incluye desgloses de embudo extendidos', async ({
        page,
    }) => {
        await page.goto('/admin.html');
        await expect(page.locator('#funnelAbandonList')).toHaveCount(1);
        await expect(page.locator('#funnelEntryList')).toHaveCount(1);
        await expect(page.locator('#funnelSourceList')).toHaveCount(1);
        await expect(page.locator('#funnelPaymentMethodList')).toHaveCount(1);
        await expect(page.locator('#funnelAbandonReasonList')).toHaveCount(1);
        await expect(page.locator('#funnelStepList')).toHaveCount(1);
        await expect(page.locator('#funnelErrorCodeList')).toHaveCount(1);
    });

    test('dashboard centro operativo muestra prioridades y navega a triage', async ({
        page,
    }) => {
        const today = new Date().toISOString().split('T')[0];
        await setupAuthenticatedAdminMocks(page, {
            appointments: [
                {
                    id: 1,
                    name: 'Paciente Test',
                    email: 'paciente@example.com',
                    phone: '+593999111222',
                    service: 'consulta',
                    doctor: 'rosero',
                    date: today,
                    time: '10:00',
                    status: 'confirmed',
                    paymentStatus: 'pending_transfer_review',
                },
            ],
            callbacks: [
                {
                    id: 9,
                    telefono: '+593988776655',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('.dashboard-card-operations')).toBeVisible();
        await expect(page.locator('#operationPendingReviewCount')).toHaveText(
            '1'
        );
        await expect(
            page.locator('#operationPendingCallbacksCount')
        ).toHaveText('1');
        await expect(
            page.locator('#operationActionList .operations-action-item')
        ).toHaveCount(3);

        await page
            .locator(
                '.dashboard-card-operations [data-action="context-open-appointments-transfer"]'
            )
            .first()
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(
            page.locator(
                '.appointment-quick-filter-btn[data-filter-value="pending_transfer"]'
            )
        ).toHaveClass(/is-active/);
    });

    test('callbacks triage prioriza siguiente llamada y enfoca contacto', async ({
        page,
    }) => {
        const oldPendingDate = new Date(
            Date.now() - 3 * 60 * 60 * 1000
        ).toISOString();
        const recentPendingDate = new Date(
            Date.now() - 20 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 101,
                    telefono: '+593988111222',
                    preferencia: 'ahora',
                    fecha: oldPendingDate,
                    status: 'pending',
                },
                {
                    id: 102,
                    telefono: '+593977333444',
                    preferencia: '30min',
                    fecha: recentPendingDate,
                    status: 'pending',
                },
                {
                    id: 103,
                    telefono: '+593966555666',
                    preferencia: '1hora',
                    fecha: new Date().toISOString(),
                    status: 'contacted',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page
            .locator('.admin-quick-nav-item[data-section="callbacks"]')
            .click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsPendingCount')).toHaveText('2');
        await expect(page.locator('#callbacksOpsUrgentCount')).toHaveText('1');
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: prioridad alta'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            '+593988111222'
        );
        await expect(page.locator('#callbacks')).not.toContainText(/[ÃÂ]/);

        await page.locator('#callbacksOpsNextBtn').click();
        await expect(
            page.locator(
                '.callback-quick-filter-btn[data-filter-value="pending"]'
            )
        ).toHaveClass(/is-active/);
        await expect(
            page.locator(
                '#callbacksGrid .callback-card.pendiente:has-text("+593988111222")'
            )
        ).toBeVisible();
        await expect(page.locator('#callbacksOpsNextBtn')).toBeEnabled();
    });

    test('callbacks triage muestra copy UTF-8 correcto en estado de atencion y fallback de telefono', async ({
        page,
    }) => {
        const mediumPendingDateA = new Date(
            Date.now() - 65 * 60 * 1000
        ).toISOString();
        const mediumPendingDateB = new Date(
            Date.now() - 50 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 201,
                    telefono: '',
                    preferencia: 'ahora',
                    fecha: mediumPendingDateA,
                    status: 'pending',
                },
                {
                    id: 202,
                    telefono: '+593977111222',
                    preferencia: '30min',
                    fecha: mediumPendingDateB,
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page
            .locator('.admin-quick-nav-item[data-section="callbacks"]')
            .click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: atención requerida'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            'Sin teléfono'
        );
        await expect(page.locator('#callbacks')).not.toContainText(/[ÃÂ]/);
    });

    test('callbacks permite seleccion visible y marcado masivo', async ({
        page,
    }) => {
        const callbackWriteRequests = [];
        page.on('request', (request) => {
            if (
                request.url().includes('/api.php?resource=callbacks') &&
                request.method() !== 'GET'
            ) {
                callbackWriteRequests.push(request.method());
            }
        });

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 301,
                    telefono: '+593955111222',
                    preferencia: 'ahora',
                    fecha: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
                    status: 'pending',
                },
                {
                    id: 302,
                    telefono: '+593955333444',
                    preferencia: '30min',
                    fecha: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
                    status: 'pending',
                },
                {
                    id: 303,
                    telefono: '+593955555666',
                    preferencia: '1hora',
                    fecha: new Date().toISOString(),
                    status: 'contacted',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page
            .locator('.admin-quick-nav-item[data-section="callbacks"]')
            .click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(
            page.locator(
                '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
            )
        ).toHaveCount(2);

        await page.locator('#callbacksBulkSelectVisibleBtn').click();
        await expect(page.locator('#callbacksSelectionChip')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#callbacksSelectedCount')).toHaveText('2');

        await page.locator('#callbacksBulkMarkBtn').click();
        await expect
            .poll(() => callbackWriteRequests.length)
            .toBeGreaterThan(0);
        await expect(page.locator('#callbacksSelectionChip')).toHaveClass(
            /is-hidden/
        );
    });

    test('tema tambien funciona en dashboard autenticado', async ({ page }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        const headerDarkBtn = page
            .locator(
                '.admin-theme-switcher-header .admin-theme-btn[data-theme-mode="dark"]'
            )
            .first();
        const headerLightBtn = page
            .locator(
                '.admin-theme-switcher-header .admin-theme-btn[data-theme-mode="light"]'
            )
            .first();

        await expect(headerDarkBtn).toBeVisible();
        await headerDarkBtn.click();

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }))
            )
            .toEqual({ mode: 'dark', theme: 'dark' });

        await page.reload();
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 15000,
        });
        await expect(headerDarkBtn).toHaveClass(/is-active/);
        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }))
            )
            .toEqual({ theme: 'dark', stored: 'dark' });

        await headerLightBtn.click();
        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('light');
    });

    test('tema en admin se sincroniza via storage event', async ({ page }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.evaluate(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'themeMode',
                    newValue: 'dark',
                })
            );
        });

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }))
            )
            .toEqual({
                mode: 'dark',
                theme: 'dark',
            });

        await page.evaluate(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'themeMode',
                    newValue: 'light',
                })
            );
        });

        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('light');
    });

    test('reanuda ultima seccion y estado de sidebar colapsado en desktop', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminLastSection', 'callbacks');
            localStorage.setItem('adminSidebarCollapsed', '1');
        });
        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 701,
                    telefono: '+593900000701',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page).toHaveURL(/#callbacks$/);
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('body')).toHaveClass(
            /admin-sidebar-collapsed/
        );
        await expect(page.locator('#adminSidebarCollapse')).toHaveAttribute(
            'aria-pressed',
            'true'
        );

        await page.locator('#adminSidebarCollapse').click();
        await expect(page.locator('body')).not.toHaveClass(
            /admin-sidebar-collapsed/
        );
        await expect(page.locator('#adminSidebarCollapse')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        await expect
            .poll(() =>
                page.evaluate(() =>
                    localStorage.getItem('adminSidebarCollapsed')
                )
            )
            .toBe('0');
    });

    test('atajo Alt+Shift+M colapsa en desktop y abre menu en viewport compacto', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.keyboard.press('Alt+Shift+M');
        await expect(page.locator('body')).toHaveClass(
            /admin-sidebar-collapsed/
        );

        await page.setViewportSize({ width: 900, height: 900 });
        await expect(page.locator('#adminMenuToggle')).toBeVisible();
        await expect(page.locator('body')).not.toHaveClass(
            /admin-sidebar-collapsed/
        );

        await page.keyboard.press('Alt+Shift+M');
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        await page.keyboard.press('Escape');
        await expect(page.locator('#adminSidebar')).not.toHaveClass(/is-open/);
    });

    test.describe('API de administracion (requiere PHP)', () => {
        test('API health check funciona', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=health');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
            expect(body.status).toBe('ok');
        });

        test('API data sin auth devuelve 401', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=data');
            expect(resp.status()).toBe(401);
        });

        test('API availability devuelve datos', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=availability');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
        });

        test('API reviews devuelve datos', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=reviews');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
        });
    });
});
