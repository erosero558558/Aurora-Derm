// @ts-check
const { test, expect } = require('@playwright/test');
const {
    installTurneroClinicProfileFailure,
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');

test.describe('Sala turnos display', () => {
    test('aplica branding del perfil clinico en la cabecera de sala', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
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
        });

        await installTurneroQueueStateMock(page);

        await page.goto('/sala-turnos.html');

        await expect(page).toHaveTitle(/Clinica Norte/i);
        await expect(page.locator('#displayBrandName')).toContainText(
            'Clinica Norte'
        );
        await expect(page.locator('#displayBrandMeta')).toContainText(
            'Vista pacientes · D1 / D2'
        );
        await expect(page.locator('#displayClinicMeta')).toContainText(
            'clinica-norte-demo · Quito'
        );
        await expect(page.locator('#displayProfileStatus')).toContainText(
            /Perfil remoto verificado|Readiness bloqueada/
        );
    });

    test('degrada sala si la ruta del perfil no coincide con la superficie activa', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                display: {
                    enabled: true,
                    route: '/sala-alt.html',
                },
            },
        });

        const queueState = await installTurneroQueueStateMock(page, {
            queueState: {
                callingNow: [
                    {
                        id: 91,
                        ticketCode: 'A-091',
                        patientInitials: 'JR',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                ],
                nextTickets: [
                    {
                        id: 92,
                        ticketCode: 'A-092',
                        patientInitials: 'LM',
                        position: 1,
                    },
                ],
            },
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displaySetupTitle')).toContainText(
            'Ruta del piloto incorrecta'
        );
        await expect(page.locator('#displayProfileStatus')).toContainText(
            'Bloqueado · ruta fuera de canon'
        );
        await expect(page.locator('#displaySetupChecks')).toContainText(
            '/sala-alt.html'
        );
        await expect(page.locator('#displayAnnouncement')).toContainText(
            'Pantalla bloqueada'
        );
        await expect(page.locator('#displayConsultorio1')).toContainText(
            'Sin llamado activo'
        );
        await expect(page.locator('#displayNextList')).toContainText(
            'Pantalla bloqueada'
        );
        expect(queueState.getQueueStateCalls()).toBe(0);
    });

    test('degrada sala si clinic-profile.json no carga y queda en perfil de respaldo', async ({
        page,
    }) => {
        await installTurneroClinicProfileFailure(page);

        const queueState = await installTurneroQueueStateMock(page, {
            queueState: {
                callingNow: [
                    {
                        id: 93,
                        ticketCode: 'A-093',
                        patientInitials: 'EP',
                        assignedConsultorio: 2,
                        calledAt: new Date().toISOString(),
                    },
                ],
                nextTickets: [
                    {
                        id: 94,
                        ticketCode: 'A-094',
                        patientInitials: 'QV',
                        position: 1,
                    },
                ],
            },
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displaySetupTitle')).toContainText(
            'Perfil de clínica no cargado'
        );
        await expect(page.locator('#displayProfileStatus')).toContainText(
            'Bloqueado · perfil de respaldo'
        );
        await expect(page.locator('#displaySetupChecks')).toContainText(
            'perfil de respaldo'
        );
        await expect(page.locator('#displayAnnouncement')).toContainText(
            'Pantalla bloqueada'
        );
        await expect(page.locator('#displayConsultorio2')).toContainText(
            'Sin llamado activo'
        );
        await expect(page.locator('#displayNextList')).toContainText(
            'Pantalla bloqueada'
        );
        expect(queueState.getQueueStateCalls()).toBe(0);
    });

    test('renderiza llamados activos y siguientes turnos', async ({ page }) => {
        await installTurneroQueueStateMock(page, {
            queueState: {
                callingNow: [
                    {
                        id: 1,
                        ticketCode: 'A-051',
                        patientInitials: 'JP',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                    {
                        id: 2,
                        ticketCode: 'A-052',
                        patientInitials: 'MC',
                        assignedConsultorio: 2,
                        calledAt: new Date().toISOString(),
                    },
                ],
                nextTickets: [
                    {
                        id: 3,
                        ticketCode: 'A-053',
                        patientInitials: 'EP',
                        position: 1,
                    },
                    {
                        id: 4,
                        ticketCode: 'A-054',
                        patientInitials: 'LR',
                        position: 2,
                    },
                ],
            },
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConsultorio1')).toContainText(
            'A-051'
        );
        await expect(page.locator('#displayConsultorio2')).toContainText(
            'A-052'
        );
        await expect(page.locator('#displayNextList li')).toHaveCount(2);
        await expect(page.locator('#displayNextList')).toContainText('A-053');
        await expect(page.locator('#displayConnectionState')).toContainText(
            'Conectado'
        );
    });

    test('acepta queue-state snake_case para llamados y siguientes', async ({
        page,
    }) => {
        await installTurneroQueueStateMock(page, {
            queueState: () => ({
                updated_at: new Date().toISOString(),
                calling_now: [
                    {
                        id: 11,
                        ticket_code: 'A-411',
                        patient_initials: 'JK',
                        assigned_consultorio: 1,
                        called_at: new Date().toISOString(),
                    },
                    {
                        id: 12,
                        ticket_code: 'A-412',
                        patient_initials: 'LM',
                        assigned_consultorio: 2,
                        called_at: new Date().toISOString(),
                    },
                ],
                next_tickets: [
                    {
                        id: 13,
                        ticket_code: 'A-413',
                        patient_initials: 'PQ',
                    },
                ],
            }),
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConsultorio1')).toContainText(
            'A-411'
        );
        await expect(page.locator('#displayConsultorio2')).toContainText(
            'A-412'
        );
        await expect(page.locator('#displayNextList')).toContainText('A-413');
    });

    test('muestra watchdog degradado y recupera con refresh manual', async ({
        page,
    }) => {
        await installTurneroQueueStateMock(page, {
            queueState: ({ callCount }) => ({
                updatedAt: new Date(
                    Date.now() - (callCount === 1 ? 95 * 1000 : 0)
                ).toISOString(),
                callingNow: [],
                nextTickets: [],
            }),
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayManualRefreshBtn')).toHaveCount(1, {
            timeout: 15000,
        });
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#displayConnectionState')
                    .textContent();
                return text || '';
            })
            .toContain('Watchdog');
        await expect(page.locator('#displayOpsHint')).toContainText(
            'estancados'
        );

        await page.locator('#displayManualRefreshBtn').click();

        await expect
            .poll(async () => {
                const text = await page
                    .locator('#displayConnectionState')
                    .textContent();
                return text || '';
            })
            .toContain('Conectado');
        await expect
            .poll(async () => {
                const text = await page
                    .locator('#displayOpsHint')
                    .textContent();
                return text || '';
            })
            .toMatch(/Sincronizacion manual exitosa|Panel estable/i);
    });

    test('permite silenciar campanilla y mantiene preferencia local', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                display: {
                    enabled: true,
                    route: '/sala-turnos.html',
                },
            },
        });
        await installTurneroQueueStateMock(page, {
            queueState: {
                callingNow: [
                    {
                        id: 1,
                        ticketCode: 'A-301',
                        patientInitials: 'EP',
                        assignedConsultorio: 1,
                        calledAt: new Date().toISOString(),
                    },
                ],
                nextTickets: [],
            },
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayBellToggleBtn')).toHaveCount(1, {
            timeout: 15000,
        });
        await expect(page.locator('#displayBellToggleBtn')).toContainText('On');

        await page.locator('#displayBellToggleBtn').click();
        await expect(page.locator('#displayBellToggleBtn')).toContainText(
            'Off'
        );

        const storedMuted = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('queueDisplayBellMuted') || '{}')
        );
        expect(storedMuted.values?.['clinica-norte-demo']).toBe('1');

        await page.reload();
        await expect(page.locator('#displayBellToggleBtn')).toContainText(
            'Off'
        );

        await page.keyboard.press('Alt+Shift+KeyM');
        await expect(page.locator('#displayBellToggleBtn')).toContainText('On');
    });

    test('ignora snapshot y mute heredados de otra clinica', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'queueDisplayBellMuted',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-sur-demo': '1',
                    },
                })
            );
            localStorage.setItem(
                'queueDisplayLastSnapshot',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-sur-demo': {
                            savedAt: new Date().toISOString(),
                            data: {
                                updatedAt: new Date().toISOString(),
                                callingNow: [
                                    {
                                        id: 9,
                                        ticketCode: 'A-909',
                                        patientInitials: 'LR',
                                        assignedConsultorio: 2,
                                        calledAt: new Date().toISOString(),
                                    },
                                ],
                                nextTickets: [],
                            },
                        },
                    },
                })
            );
        });

        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                display: {
                    enabled: true,
                    route: '/sala-turnos.html',
                },
            },
        });

        await installTurneroQueueStateMock(page, {
            queueStateAbortReason: 'failed',
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayBellToggleBtn')).toContainText('On');
        await expect(page.locator('#displayConsultorio2')).not.toContainText(
            'A-909'
        );
        await expect(page.locator('#displaySnapshotHint')).toContainText(
            'sin datos locales'
        );
    });

    test('guia puesta en marcha de TV y valida campanilla manual', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            class FakeAudioContext {
                constructor() {
                    this.state = 'running';
                    this.currentTime = 0;
                    this.destination = {};
                }

                async resume() {
                    this.state = 'running';
                }

                createOscillator() {
                    return {
                        type: 'sine',
                        frequency: { setValueAtTime() {} },
                        connect() {},
                        start() {},
                        stop() {},
                    };
                }

                createGain() {
                    return {
                        gain: {
                            setValueAtTime() {},
                            exponentialRampToValueAtTime() {},
                        },
                        connect() {},
                    };
                }
            }

            window.AudioContext = FakeAudioContext;
            window.webkitAudioContext = FakeAudioContext;
        });

        await installTurneroQueueStateMock(page, {
            queueState: {
                waitingCount: 1,
                calledCount: 0,
                callingNow: [],
                nextTickets: [
                    {
                        id: 91,
                        ticketCode: 'A-091',
                        patientInitials: 'TV',
                        position: 1,
                    },
                ],
            },
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displaySetupTitle')).toContainText(
            'Falta habilitar audio'
        );
        await expect(page.locator('#displaySetupChecks')).toContainText(
            'Toca "Probar campanilla" una vez para habilitar audio'
        );
        await page.locator('#displayBellTestBtn').click();
        await expect(page.locator('#displaySetupTitle')).toContainText(
            'Sala TV lista para llamados'
        );
        await expect(page.locator('#displaySetupChecks')).toContainText(
            'Audio desbloqueado'
        );
        await expect(page.locator('#displaySetupChecks')).toContainText(
            'Prueba sonora confirmada'
        );
    });

    test('usa snapshot local cuando backend no responde', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'queueDisplayLastSnapshot',
                JSON.stringify({
                    savedAt: new Date().toISOString(),
                    data: {
                        updatedAt: new Date().toISOString(),
                        callingNow: [
                            {
                                id: 1,
                                ticketCode: 'A-777',
                                patientInitials: 'EP',
                                assignedConsultorio: 1,
                                calledAt: new Date().toISOString(),
                            },
                        ],
                        nextTickets: [
                            {
                                id: 2,
                                ticketCode: 'A-778',
                                patientInitials: 'MC',
                                position: 1,
                            },
                        ],
                    },
                })
            );
        });

        await installTurneroQueueStateMock(page, {
            queueStateAbortReason: 'failed',
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConsultorio1')).toContainText(
            'A-777'
        );
        await expect(page.locator('#displayNextList')).toContainText('A-778');
        await expect(page.locator('#displayConnectionState')).toContainText(
            'Respaldo local'
        );
        await expect(page.locator('#displayOpsHint')).toContainText(
            'estado local'
        );
    });

    test('permite limpiar snapshot local desde controles de contingencia', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'queueDisplayLastSnapshot',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-norte-demo': {
                            savedAt: new Date().toISOString(),
                            data: {
                                updatedAt: new Date().toISOString(),
                                callingNow: [
                                    {
                                        id: 9,
                                        ticketCode: 'A-909',
                                        patientInitials: 'LR',
                                        assignedConsultorio: 2,
                                        calledAt: new Date().toISOString(),
                                    },
                                ],
                                nextTickets: [],
                            },
                        },
                    },
                })
            );
        });

        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            surfaces: {
                display: {
                    enabled: true,
                    route: '/sala-turnos.html',
                },
            },
        });

        await installTurneroQueueStateMock(page, {
            queueStateAbortReason: 'failed',
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConsultorio2')).toContainText(
            'A-909',
            {
                timeout: 10000,
            }
        );
        await expect(page.locator('#displaySnapshotClearBtn')).toBeVisible();

        await page.locator('#displaySnapshotClearBtn').click();

        const storedSnapshot = await page.evaluate(() =>
            localStorage.getItem('queueDisplayLastSnapshot')
        );
        expect(storedSnapshot).toBeNull();
        await expect(page.locator('#displayConnectionState')).toContainText(
            'Sin respaldo local'
        );
        await expect(page.locator('#displayNextList')).toContainText(
            'Sin respaldo local disponible.'
        );
    });

    test('expone controles y regiones con atributos A11y esperados', async ({
        page,
    }) => {
        await installTurneroQueueStateMock(page);

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displayConnectionState')).toHaveAttribute(
            'role',
            'status'
        );
        await expect(page.locator('#displayConsultorio1')).toHaveAttribute(
            'aria-live',
            'assertive'
        );
        await expect(page.locator('#displayNextList')).toHaveAttribute(
            'aria-live',
            'polite'
        );
        await expect(page.locator('#displayManualRefreshBtn')).toHaveAttribute(
            'aria-label',
            /Refrescar estado/
        );
        await expect(page.locator('#displayBellToggleBtn')).toHaveAttribute(
            'aria-label',
            /campanilla/i
        );
        await expect(page.locator('#displaySnapshotClearBtn')).toHaveAttribute(
            'aria-label',
            /respaldo/i
        );
    });

    test('monta el strip de sync bajo el header y sigue el ticket principal', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem(
                'turneroSurfaceSyncHandoffLedgerV1',
                JSON.stringify({
                    schema: 'turnero-clinic-storage/v1',
                    values: {
                        'clinica-norte-demo': {
                            scopes: {
                                'clinica-norte-demo': [
                                    {
                                        id: 'handoff_display_1',
                                        scope: 'clinica-norte-demo',
                                        surfaceKey: 'display',
                                        title: 'Revisar campanilla',
                                        note: 'Validar audio antes de abrir sala.',
                                        owner: 'ops',
                                        source: 'local',
                                        status: 'open',
                                        createdAt: '2026-03-20T10:00:00.000Z',
                                        updatedAt: '2026-03-20T10:00:00.000Z',
                                    },
                                ],
                            },
                        },
                    },
                })
            );
        });

        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
        });
        await installTurneroQueueStateMock(page, {
            queueState: {
                updatedAt: '2026-03-20T10:00:00.000Z',
                waitingCount: 1,
                calledCount: 1,
                callingNow: [
                    {
                        id: 1,
                        ticketCode: 'A-061',
                        patientInitials: 'JP',
                        assignedConsultorio: 1,
                        calledAt: '2026-03-20T10:00:00.000Z',
                    },
                ],
                nextTickets: [
                    {
                        id: 2,
                        ticketCode: 'A-062',
                        patientInitials: 'EP',
                        position: 1,
                    },
                ],
            },
        });

        await page.goto('/sala-turnos.html');

        await expect(page.locator('#displaySurfaceSyncHost')).toContainText(
            'Display surface sync'
        );
        await expect(page.locator('#displaySurfaceSyncHost')).toContainText(
            'A-061'
        );
        await expect(page.locator('#displaySurfaceSyncHost')).toContainText(
            'Handoffs'
        );
        await expect(page.locator('#displaySurfaceSyncHost')).toContainText(
            '1'
        );
        await expect(
            page.locator('[data-turnero-display-surface-replication="true"]')
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-display-surface-replication="true"] [data-role="banner"]'
            )
        ).toContainText('Display surface replication');
        await expect(
            page.locator(
                '[data-turnero-display-surface-replication="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator('[data-turnero-display-surface-replication="true"]')
        ).toContainText('template');
        await expect(
            page.locator('[data-turnero-display-surface-replication="true"]')
        ).toContainText('replication');
        await expect(
            page.locator('[data-turnero-display-surface-replication="true"]')
        ).toContainText('score');

        await expect(
            page.locator('[data-turnero-display-surface-go-live="true"]')
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-display-surface-go-live="true"] [data-role="banner"]'
            )
        ).toContainText('Go-live');
        await expect(
            page.locator(
                '[data-turnero-display-surface-go-live="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(6);
        await expect(
            page.locator('[data-turnero-display-surface-fleet="true"]')
        ).toBeVisible();
        await expect(
            page.locator('[data-turnero-display-surface-fleet="true"]')
        ).toContainText('Surface Fleet Readiness');
        await expect(
            page.locator('[data-turnero-display-surface-fleet="true"]')
        ).toContainText('Fleet readiness visible');
        await expect(
            page.locator(
                '[data-turnero-display-surface-fleet="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator('[data-turnero-display-surface-fleet="true"]')
        ).toContainText('Wave');
        await expect(
            page.locator('[data-turnero-display-surface-fleet="true"]')
        ).toContainText('Fleet');
        await expect(
            page.locator('[data-turnero-display-surface-fleet="true"]')
        ).toContainText('Score');
        await expect(
            page.locator('[data-turnero-display-surface-service-handover="true"]')
        ).toBeVisible();
        await expect(
            page.locator(
                '[data-turnero-display-surface-service-handover="true"] [data-role="banner"]'
            )
        ).toContainText('Display surface service handover');
        await expect(
            page.locator(
                '[data-turnero-display-surface-service-handover="true"] .turnero-surface-ops__chip'
            )
        ).toHaveCount(3);
        await expect(
            page.locator('[data-turnero-display-surface-service-handover="true"]')
        ).toHaveAttribute('data-state', 'ready');
    });
});
