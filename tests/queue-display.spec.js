// @ts-check
const { test, expect } = require('@playwright/test');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

test.describe('Sala turnos display', () => {
    test('renderiza llamados activos y siguientes turnos', async ({ page }) => {
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
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
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, {
                ok: true,
                data: {
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
                },
            });
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
        let queueStateCalls = 0;
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            queueStateCalls += 1;
            if (queueStateCalls === 1) {
                return json(route, {
                    ok: true,
                    data: {
                        updatedAt: new Date(
                            Date.now() - 95 * 1000
                        ).toISOString(),
                        callingNow: [],
                        nextTickets: [],
                    },
                });
            }

            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
                    callingNow: [],
                    nextTickets: [],
                },
            });
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
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
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
            localStorage.getItem('queueDisplayBellMuted')
        );
        expect(storedMuted).toBe('1');

        await page.reload();
        await expect(page.locator('#displayBellToggleBtn')).toContainText(
            'Off'
        );

        await page.keyboard.press('Alt+Shift+KeyM');
        await expect(page.locator('#displayBellToggleBtn')).toContainText('On');
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

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
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

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }
            return route.abort('failed');
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
                })
            );
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }
            return route.abort('failed');
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
        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const url = new URL(route.request().url());
            const resource = url.searchParams.get('resource') || '';
            if (resource !== 'queue-state') {
                return json(route, { ok: true, data: {} });
            }
            return json(route, {
                ok: true,
                data: {
                    updatedAt: new Date().toISOString(),
                    callingNow: [],
                    nextTickets: [],
                },
            });
        });

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
});
