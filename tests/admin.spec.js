// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');
const {
    installLegacyAdminAuthMock,
    installLegacyAdminLoginFlowMock,
    installOpenClawAdminAuthMock,
} = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

async function setupAuthenticatedAdminMocks(page, overrides = {}) {
    const funnelMetrics =
        overrides.funnelMetrics && typeof overrides.funnelMetrics === 'object'
            ? overrides.funnelMetrics
            : null;
    const dataOverrides = {
        ...overrides,
    };
    delete dataOverrides.funnelMetrics;

    await installLegacyAdminAuthMock(page, {
        csrfToken: 'csrf_test_token',
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides,
        funnelMetrics,
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            intendedMethod,
            context,
            fulfillJson,
        }) => {
            const mergedData = context.data;

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
                        if (
                            String(item.status || '').toLowerCase() ===
                            'pending'
                        ) {
                            item.status = String(
                                payload.status || 'contactado'
                            );
                        }
                    });
                    callback = mergedData.callbacks[0] || null;
                }
                await fulfillJson(route, { ok: true, data: callback || {} });
                return true;
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
                await fulfillJson(route, { ok: true, data: appointment || {} });
                return true;
            }

            return false;
        },
    });
}

async function setupLoginAdminMocks(
    page,
    {
        authMode = 'legacy_password',
        twoFactorRequired = false,
        dataOverrides = {},
        funnelMetrics = null,
        loginError = '',
        openClawOptions = {},
    } = {}
) {
    if (authMode === 'openclaw_chatgpt') {
        await installOpenClawAdminAuthMock(page, {
            pollsBeforeTerminal: 1,
            ...openClawOptions,
        });
    } else {
        await installLegacyAdminLoginFlowMock(page, {
            twoFactorRequired,
            loginError,
            csrfToken: 'csrf_login_test',
        });
    }

    await installBasicAdminApiMocks(page, {
        dataOverrides,
        funnelMetrics,
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

    test('login OpenClaw por defecto actualiza el estado de sesion en el chrome', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, {
            authMode: 'openclaw_chatgpt',
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await expect(page.locator('#openclawLoginStage')).toBeVisible();
        await expect(page.locator('#legacyLoginStage')).toBeHidden();
        await expect(page.locator('#adminPassword')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(
            /OpenClaw|Continuar/
        );

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /OpenClaw validado/
        );
    });

    test('login legacy de respaldo con contrasena vacia no funciona', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page);

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('#adminPassword');
        const loginBtn = page.locator('#loginBtn');
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('');
        await loginBtn.click();

        await expect(passwordInput).toBeVisible();
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /No se pudo iniciar sesion/
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            /Contrasena requerida/
        );
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login legacy de respaldo con contrasena incorrecta muestra error', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, {
            loginError: 'Credenciales inválidas',
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('#adminPassword');
        const loginBtn = page.locator('#loginBtn');
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('contrasena_incorrecta_test');
        await loginBtn.click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /No se pudo iniciar sesion/
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            /Credenciales/
        );
        await expect(passwordInput).toBeVisible();
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login legacy de respaldo con 2FA muestra etapa dedicada y permite volver al paso de clave', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, { twoFactorRequired: true });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page.locator('#adminPassword').fill('clave-test');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#group2FA')).toBeVisible();
        await expect(page.locator('#loginBtn')).toHaveText(
            /Verificar y entrar/
        );
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /Codigo 2FA requerido/
        );

        await page.locator('#loginReset2FABtn').click();

        await expect(page.locator('#group2FA')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(/Ingresar/);
        await expect(page.locator('#adminPassword')).toBeEnabled();
    });

    test('login legacy de respaldo exitoso actualiza el estado de sesion en el chrome v2', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, { twoFactorRequired: false });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page.locator('#adminPassword').fill('clave-test');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /Protegida/
        );
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

    test('dashboard resume utilidad historica del asistente de sala', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            funnelMetrics: {
                queueAssistant: {
                    today: {
                        actioned: 5,
                        resolvedWithoutHuman: 3,
                        assistedResolutions: 2,
                        escalated: 1,
                        clinicalBlocked: 1,
                    },
                    last7d: {
                        actioned: 21,
                        resolvedWithoutHuman: 12,
                        assistedResolutions: 6,
                        escalated: 5,
                        clinicalBlocked: 2,
                        usefulSessions: 14,
                        avgLatencyMs: 840,
                    },
                    intentBreakdown: [
                        {
                            label: 'wait_time',
                            count: 6,
                        },
                    ],
                    helpReasonBreakdown: [
                        {
                            label: 'clinical_redirect',
                            count: 2,
                        },
                    ],
                    reviewOutcomeBreakdown: [
                        {
                            label: 'appointment_confirmed',
                            count: 4,
                        },
                    ],
                    topIntent: {
                        label: 'wait_time',
                        count: 6,
                    },
                    topHelpReason: {
                        label: 'clinical_redirect',
                        count: 2,
                    },
                    topReviewOutcome: {
                        label: 'appointment_confirmed',
                        count: 4,
                    },
                },
            },
        });

        await page.goto('/admin.html');
        await expect(page.locator('#dashboardAssistantUtility')).toBeVisible();
        await expect(page.locator('#dashboardAssistantStatus')).toHaveText(
            'Con derivaciones'
        );
        await expect(page.locator('#dashboardAssistantActioned')).toHaveText(
            '5'
        );
        await expect(page.locator('#dashboardAssistantResolved')).toHaveText(
            '3'
        );
        await expect(page.locator('#dashboardAssistantEscalated')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardAssistantBlocked')).toHaveText(
            '1'
        );
        await expect(page.locator('#dashboardAssistantSummary')).toContainText(
            'Hoy acciono 5'
        );
        await expect(page.locator('#dashboardAssistantSummary')).toContainText(
            'recepcion cerro 2'
        );
        await expect(
            page.locator('#dashboardAssistantWindowMeta')
        ).toContainText('14 sesiones utiles');
        await expect(
            page.locator('#dashboardAssistantWindowMeta')
        ).toContainText('6 cierre(s) asistidos');
        await expect(
            page.locator('#dashboardAssistantTopIntent')
        ).toContainText('wait time');
        await expect(
            page.locator('#dashboardAssistantTopReason')
        ).toContainText('clinical redirect');
        await expect(
            page.locator('#dashboardAssistantTopOutcome')
        ).toContainText('appointment confirmed');
    });

    test('inicio operativo simplifica accesos y resuelve tareas en un clic', async ({
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
        await expect(page.locator('#pageTitle')).toHaveText('Inicio');
        await expect(page.locator('#opsTodaySummaryCard')).toBeVisible();
        await expect(page.locator('#opsPendingSummaryCard')).toBeVisible();
        await expect(page.locator('#opsAvailabilitySummaryCard')).toBeVisible();
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(
            page.locator('#dashboardAdvancedAnalytics')
        ).not.toHaveJSProperty('open', true);
        await expect(page.locator('#operationPendingReviewCount')).toHaveText(
            '1'
        );
        await expect(
            page.locator('#operationPendingCallbacksCount')
        ).toHaveText('1');

        await page
            .locator(
                '#opsTodaySummaryCard [data-action="context-open-appointments-overview"]'
            )
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page
            .locator(
                '#opsPendingSummaryCard [data-action="context-open-callbacks-pending"]'
            )
            .click();

        await expect(page.locator('#callbacks')).toHaveClass(/active/);

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page
            .locator(
                '#opsAvailabilitySummaryCard [data-action="context-open-availability"]'
            )
            .click();

        await expect(page.locator('#availability')).toHaveClass(/active/);

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page.locator('#openOperatorAppBtn').click();

        await expect(page).toHaveURL(/\/operador-turnos\.html$/);
    });

    test('dashboard incorpora telemedicina y patient flow en la atencion operativa', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            patientFlowMeta: {
                casesTotal: 3,
                casesOpen: 2,
                pendingApprovals: 1,
                activeHelpRequests: 1,
            },
            telemedicineMeta: {
                summary: {
                    reviewQueueCount: 2,
                },
            },
            internalConsoleMeta: {
                clinicalData: {
                    ready: false,
                },
                overall: {
                    ready: false,
                    summary:
                        'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                },
            },
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        const telemedicineItem = page
            .locator('#dashboardAttentionList .dashboard-attention-item')
            .filter({ hasText: 'Telemedicina' });
        await expect(telemedicineItem).toContainText('2');
        await expect(telemedicineItem).toContainText(/gate clinico/i);

        const patientFlowItem = page
            .locator('#dashboardAttentionList .dashboard-attention-item')
            .filter({ hasText: 'Casos activos' });
        await expect(patientFlowItem).toContainText('2');
        await expect(patientFlowItem).toContainText(/3 caso\(s\) totales/i);
        await expect(patientFlowItem).toContainText(/1 aprobacion\(es\)/i);

        await expect(page.locator('#dashboardFlowStatus')).toContainText(
            '2 intake(s) telemedicina'
        );
        await expect(page.locator('#dashboardFlowStatus')).toContainText(
            '2 caso(s) activos'
        );
    });

    test('dashboard mantiene una accion clinica util cuando solo hay telemedicina o patient flow pendientes', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            clinicalHistoryMeta: {
                summary: {
                    configured: true,
                    reviewQueueCount: 0,
                    drafts: {
                        pendingAiCount: 0,
                        reviewQueueCount: 0,
                    },
                    events: {
                        unreadCount: 0,
                    },
                },
                reviewQueue: [],
                events: [],
            },
            patientFlowMeta: {
                casesTotal: 2,
                casesOpen: 1,
                pendingApprovals: 1,
                activeHelpRequests: 0,
            },
            telemedicineMeta: {
                summary: {
                    reviewQueueCount: 2,
                },
            },
            internalConsoleMeta: {
                clinicalData: {
                    ready: false,
                },
                overall: {
                    ready: false,
                    summary:
                        'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                },
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        await expect(page.locator('#adminDashboard')).toBeVisible();

        const clinicalAction = page
            .locator('#dashboardClinicalHistoryActions .operations-action-item')
            .filter({ hasText: 'Abrir frente clinico' });
        await expect(clinicalAction).toContainText(
            '2 intake(s) telemedicina pausados por gate clinico'
        );

        await clinicalAction.click();

        await expect(page.locator('#clinical-history')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Historia clinica');
    });

    test('acciones secundarias del dashboard siguen llevando a triage util', async ({
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
        await expect(page.locator('.dashboard-card-operations')).toBeVisible();
        await expect(
            page.locator('#operationActionList .operations-action-item')
        ).toHaveCount(3);

        await page
            .locator(
                '.dashboard-card-operations [data-action="context-open-appointments-overview"]'
            )
            .first()
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');
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
                    leadOps: {
                        priorityBand: 'hot',
                    },
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

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsPendingCount')).toHaveText('2');
        await expect(page.locator('#callbacksOpsUrgentCount')).toHaveText('1');
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: prioridad comercial alta'
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
            Date.now() - 150 * 60 * 1000
        ).toISOString();
        const mediumPendingDateB = new Date(
            Date.now() - 130 * 60 * 1000
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

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: atencion requerida'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            'Sin telefono'
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

        await page.locator('.nav-item[data-section="callbacks"]').click();
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
