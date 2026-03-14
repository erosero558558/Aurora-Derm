// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const {
    buildAdminAgentSnapshot,
    buildAdminAgentStatusPayload,
    installBasicAdminApiMocks,
} = require('./helpers/admin-api-mocks');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
});

async function setupAdminApiMocks(page, options = {}) {
    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });

    await installBasicAdminApiMocks(page, {
        dataOverrides: options.dataOverrides || {},
        handleRoute: async ({ route, url, resource, method, fulfillJson }) => {
            if (typeof options.handleApiRoute === 'function') {
                return (
                    (await options.handleApiRoute({
                        route,
                        url,
                        resource,
                        method,
                        fulfillJson,
                    })) || false
                );
            }

            return false;
        },
    });
}

async function waitForAdminRuntimeReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

test.describe('Admin navigation desktop', () => {
    test('sidebar keeps section and hash in sync', async ({ page }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        const primaryNav = page.locator('#adminPrimaryNav');
        await expect(primaryNav).toBeVisible();

        const availabilityNavItem = primaryNav.locator(
            '.nav-item[data-section="availability"]'
        );
        await availabilityNavItem.click();

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
        await expect(availabilityNavItem).toHaveClass(/active/);
        await expect(availabilityNavItem).toHaveAttribute(
            'aria-current',
            'page'
        );
        await expect(page.locator('#pageTitle')).toHaveText('Horarios');
    });

    test('keyboard shortcuts navigate sections but ignore focused inputs', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await page.keyboard.press('Alt+Shift+Digit2');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#appointments$/);

        await page.locator('#searchAppointments').click();
        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#appointments')).toHaveClass(/active/);

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
    });

    test('quick command se abre con Ctrl+K y ejecuta acciones contextuales', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');
        await waitForAdminRuntimeReady(page);

        await expect(page.locator('#adminCommandPalette')).toHaveClass(
            /is-hidden/
        );
        const commandInput = page.locator('#adminQuickCommand');

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );
        await expect(commandInput).toBeFocused();

        await commandInput.fill('callbacks pendientes');
        await page.keyboard.press('Enter');

        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(
            page.locator(
                '.callback-quick-filter-btn[data-filter-value="pending"]'
            )
        ).toHaveClass(/is-active/);
        await expect(page.locator('#adminContextTitle')).toContainText(
            'Pendientes de contacto'
        );
        await expect(page.locator('#adminRefreshStatus')).toContainText(
            /Datos:/
        );
    });

    test('quick command tambien abre historia clinica con aliases de telemedicina', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');
        await waitForAdminRuntimeReady(page);

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );

        const commandInput = page.locator('#adminQuickCommand');
        await expect(commandInput).toHaveAttribute(
            'placeholder',
            /historia clinica, telemedicina/
        );

        await commandInput.fill('telemedicina pendiente');
        await page.keyboard.press('Enter');

        await expect(page.locator('#clinical-history')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#clinical-history$/);
        await expect(page.locator('#pageTitle')).toHaveText('Historia clinica');
        await expect(page.locator('#adminContextTitle')).toContainText(
            'Historia clinica conversacional'
        );
    });

    test('quick command expone queue piloto pero mantiene resenas fuera del shell', async ({
        page,
    }) => {
        await setupAdminApiMocks(page, {
            dataOverrides: {
                queue_tickets: [
                    {
                        id: 900,
                        ticketCode: 'A-900',
                        patientInitials: 'AR',
                        status: 'waiting',
                        queueType: 'general',
                        createdAt: new Date(
                            Date.now() - 25 * 60 * 1000
                        ).toISOString(),
                    },
                    {
                        id: 901,
                        ticketCode: 'A-901',
                        patientInitials: 'BL',
                        status: 'waiting',
                        queueType: 'general',
                        createdAt: new Date(
                            Date.now() - 5 * 60 * 1000
                        ).toISOString(),
                    },
                ],
            },
        });
        await page.goto('/admin.html');
        await waitForAdminRuntimeReady(page);

        await expect(
            page.locator('.nav-item[data-section="reviews"]')
        ).toHaveCount(0);
        await expect(
            page.locator('.nav-item[data-section="queue"]')
        ).toHaveCount(1);

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );

        const commandInput = page.locator('#adminQuickCommand');
        await commandInput.fill('turnero');
        await page.keyboard.press('Enter');

        await expect(page.locator('#queue')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#queue$/);
        await expect(page.locator('#queueTableBody')).toContainText('A-900');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'A-901'
        );
        await expect(page).not.toHaveURL(/#reviews$/);
    });

    test('panel del copiloto permite enviar un prompt y cancelar la sesion', async ({
        page,
    }) => {
        let turnCount = 0;

        await setupAdminApiMocks(page, {
            handleApiRoute: async ({ route, resource, fulfillJson }) => {
                if (resource === 'admin-agent-status') {
                    await fulfillJson(route, buildAdminAgentStatusPayload());
                    return true;
                }

                if (resource === 'admin-agent-session-start') {
                    await fulfillJson(
                        route,
                        {
                            ok: true,
                            data: buildAdminAgentSnapshot(),
                        },
                        201
                    );
                    return true;
                }

                if (resource === 'admin-agent-turn') {
                    turnCount += 1;
                    await fulfillJson(route, {
                        ok: true,
                        data: {
                            session: buildAdminAgentSnapshot({
                                messages: [
                                    {
                                        role: 'user',
                                        content:
                                            'Resume los callbacks pendientes',
                                        createdAt: new Date().toISOString(),
                                    },
                                    {
                                        role: 'assistant',
                                        content:
                                            'Hay 2 callbacks pendientes y uno esta fuera de SLA.',
                                        createdAt: new Date().toISOString(),
                                    },
                                ],
                                turns: [
                                    {
                                        turnId: 'agt_turn_001',
                                        status: 'completed',
                                        finalAnswer:
                                            'Hay 2 callbacks pendientes y uno esta fuera de SLA.',
                                    },
                                ],
                                toolCalls: [
                                    {
                                        toolCallId: 'tool_001',
                                        tool: 'callbacks.list',
                                        status: 'completed',
                                        reason: 'Leer la cola operativa de callbacks',
                                    },
                                ],
                                events: [
                                    {
                                        event: 'agent.turn_completed',
                                        status: 'completed',
                                        createdAt: new Date().toISOString(),
                                    },
                                ],
                            }),
                            turn: {
                                turnId: 'agt_turn_001',
                                status: 'completed',
                                finalAnswer:
                                    'Hay 2 callbacks pendientes y uno esta fuera de SLA.',
                                toolPlan: [
                                    {
                                        tool: 'callbacks.list',
                                        status: 'completed',
                                    },
                                ],
                            },
                            clientActions: [],
                            refreshRecommended: false,
                        },
                    });
                    return true;
                }

                if (resource === 'admin-agent-cancel') {
                    await fulfillJson(route, {
                        ok: true,
                        data: buildAdminAgentSnapshot({
                            session: {
                                status: 'cancelled',
                            },
                            events: [
                                {
                                    event: 'agent.session_cancelled',
                                    status: 'cancelled',
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                        }),
                    });
                    return true;
                }

                return false;
            },
        });
        await page.goto('/admin.html');
        await waitForAdminRuntimeReady(page);

        await page.locator('[data-action="open-agent-panel"]').click();
        await expect(page.locator('#adminAgentPanel')).not.toHaveClass(
            /is-hidden/
        );

        await page
            .locator('#adminAgentPrompt')
            .fill('Resume los callbacks pendientes');
        await page.locator('#adminAgentSubmitBtn').click();

        await expect(page.locator('#adminAgentSessionState')).toHaveText(
            'active'
        );
        await expect(page.locator('#adminAgentConversationMeta')).toContainText(
            '2 mensaje(s) auditados'
        );
        await expect(page.locator('#adminAgentPlanMeta')).toContainText(
            '1 tool call(s) en timeline'
        );
        await expect(page.locator('#adminAgentConversation')).toContainText(
            'Resume los callbacks pendientes'
        );
        await expect(page.locator('#adminAgentConversation')).toContainText(
            'Hay 2 callbacks pendientes y uno esta fuera de SLA.'
        );
        await expect(page.locator('#adminAgentPanelSummary')).toContainText(
            'Sesion operativa auditada'
        );

        await page.locator('[data-action="admin-agent-cancel"]').click();
        await expect(page.locator('#adminAgentSessionState')).toHaveText(
            'cancelled'
        );
        await expect(page.locator('#adminAgentTimelineMeta')).toContainText(
            '1 evento(s)'
        );

        expect(turnCount).toBe(1);
    });

    test('boton de copiloto y quick command OpenClaw abren el mismo panel operativo', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');
        await waitForAdminRuntimeReady(page);

        const agentPanel = page.locator('#adminAgentPanel');
        const agentPrompt = page.locator('#adminAgentPrompt');

        await expect(agentPanel).toHaveClass(/is-hidden/);

        await page.locator('[data-action="open-agent-panel"]').click();
        await expect(agentPanel).not.toHaveClass(/is-hidden/);
        await expect(agentPrompt).toBeFocused();
        await expect(page.locator('#adminAgentPanelSummary')).toContainText(
            'Sesion inactiva'
        );

        await page.locator('[data-action="close-agent-panel"]').click();
        await expect(agentPanel).toHaveClass(/is-hidden/);

        await page.keyboard.press('Control+K');
        await page.locator('#adminQuickCommand').fill('OpenClaw');
        await page.keyboard.press('Enter');

        await expect(page.locator('#adminCommandPalette')).toHaveClass(
            /is-hidden/
        );
        await expect(agentPanel).not.toHaveClass(/is-hidden/);
        await expect(agentPrompt).toBeFocused();
    });

    test('Alt+Shift+I abre el copiloto operativo', async ({ page }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');
        await waitForAdminRuntimeReady(page);

        await expect(
            page.locator('[data-action="open-agent-panel"]')
        ).toBeVisible();
        await expect(page.locator('#adminAgentPanel')).toHaveClass(/is-hidden/);

        await page.keyboard.press('Alt+Shift+KeyI');

        await expect(page.locator('#adminAgentPanel')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminAgentPrompt')).toBeFocused();
        await expect(page.locator('#adminAgentPanelSummary')).toContainText(
            'Sesion inactiva'
        );
    });
});
