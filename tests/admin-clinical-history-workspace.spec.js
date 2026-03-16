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
    viewport: { width: 1440, height: 960 },
});

async function waitForAdminRuntimeReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

function buildClinicalReviewPayload({
    sessionId,
    caseId,
    patientName,
    clinicianSummary,
}) {
    return {
        session: {
            sessionId,
            caseId,
            appointmentId: 451,
            surface: 'telemedicine_chat',
            status: 'review_required',
            patient: {
                name: patientName,
                email: `${sessionId}@example.test`,
                phone: '0990001111',
            },
            transcript: [
                {
                    id: `${sessionId}-msg-1`,
                    role: 'user',
                    actor: 'patient',
                    content: `Paciente ${patientName}: describe brote facial persistente.`,
                    surface: 'telemedicine_chat',
                    createdAt: '2026-03-15T09:00:00-05:00',
                },
                {
                    id: `${sessionId}-msg-2`,
                    role: 'assistant',
                    actor: 'assistant',
                    content: 'Se solicita documentar factores desencadenantes.',
                    surface: 'telemedicine_chat',
                    createdAt: '2026-03-15T09:03:00-05:00',
                },
            ],
            pendingAi: {},
            metadata: {},
            createdAt: '2026-03-15T08:45:00-05:00',
            updatedAt: '2026-03-15T09:04:00-05:00',
            lastMessageAt: '2026-03-15T09:03:00-05:00',
        },
        draft: {
            sessionId,
            caseId,
            appointmentId: 451,
            reviewStatus: 'review_required',
            requiresHumanReview: true,
            reviewReasons: ['dose_ambiguous'],
            confidence: 0.62,
            intake: {
                motivoConsulta: 'Rosacea facial',
                enfermedadActual: 'Brote recurrente con eritema centrofacial.',
                antecedentes: '',
                alergias: '',
                medicacionActual: '',
                rosRedFlags: ['ardor'],
                adjuntos: [
                    {
                        id: 1,
                        kind: 'photo',
                        originalName: 'ana-ruiz-1.jpg',
                        mime: 'image/jpeg',
                        size: 1024,
                        privatePath: '/private/case-001/a1.jpg',
                    },
                ],
                resumenClinico: 'Caso compatible con rosacea inflamatoria.',
                cie10Sugeridos: [],
                tratamientoBorrador: '',
                posologiaBorrador: {
                    texto: '',
                    baseCalculo: '',
                    pesoKg: null,
                    edadAnios: null,
                    units: '',
                    ambiguous: true,
                },
                preguntasFaltantes: ['Alergias actuales'],
                datosPaciente: {
                    edadAnios: 34,
                    pesoKg: 63,
                    sexoBiologico: 'femenino',
                    embarazo: false,
                },
            },
            clinicianDraft: {
                resumen: clinicianSummary,
                preguntasFaltantes: ['Confirmar alergias'],
                cie10Sugeridos: ['L71.9'],
                tratamientoBorrador: 'Mantener metronidazol topico',
                posologiaBorrador: {
                    texto: 'Aplicacion nocturna',
                    baseCalculo: 'criterio_clinico',
                    pesoKg: 63,
                    edadAnios: 34,
                    units: '',
                    ambiguous: true,
                },
            },
            pendingAi: {},
            updatedAt: '2026-03-15T09:06:00-05:00',
            createdAt: '2026-03-15T08:50:00-05:00',
        },
        events: [
            {
                eventId: `${sessionId}-evt-1`,
                type: 'clinical_alert',
                severity: 'critical',
                status: 'open',
                title: 'Alerta clinica abierta',
                message: 'Persisten hallazgos que requieren revision.',
                createdAt: '2026-03-15T09:05:00-05:00',
            },
        ],
    };
}

test('historia clinica conserva review y media flow en una sola superficie sin perder contexto', async ({
    page,
}) => {
    const reviewBySessionId = {
        'chs-001': buildClinicalReviewPayload({
            sessionId: 'chs-001',
            caseId: 'case-001',
            patientName: 'Ana Ruiz',
            clinicianSummary: 'Rosacea facial en seguimiento clinico.',
        }),
        'chs-002': buildClinicalReviewPayload({
            sessionId: 'chs-002',
            caseId: 'case-002',
            patientName: 'Bruno Paz',
            clinicianSummary: 'Dermatitis en observacion.',
        }),
    };

    const mediaCase = {
        caseId: 'case-001',
        summary: {
            headline: 'Caso Ana Ruiz',
        },
        service: {
            label: 'Teledermatologia',
        },
        consent: {
            status: 'granted',
            privacyAccepted: true,
            publicationExplicit: true,
        },
        policy: {
            status: 'eligible',
            flags: ['consent_ok'],
        },
        publication: {
            status: 'draft',
        },
        mediaAssets: [
            {
                assetId: 'asset-001',
                originalName: 'ana-before.jpg',
                kind: 'before',
                visibility: 'private_only',
                previewUrl:
                    'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=',
                qualityFlags: ['frontal'],
                riskFlags: [],
            },
        ],
        proposal: {
            proposalId: 'prop-001',
            status: 'draft',
            recommendation: 'needs_review',
            selectedAssetIds: ['asset-001'],
            copy: {
                es: {
                    title: 'Caso rosacea controlada',
                    summary: 'Seguimiento de respuesta al tratamiento topico.',
                },
                en: {
                    title: 'Rosacea follow-up case',
                    summary: 'Follow-up on topical treatment response.',
                },
            },
            alt: {
                es: {
                    cover: 'Antes y despues del control de rosacea.',
                },
                en: {
                    cover: 'Rosacea before and after treatment.',
                },
            },
            category: 'rosacea',
            tags: ['rosacea', 'seguimiento'],
            publicationScore: 82,
            comparePairs: [
                {
                    beforeAssetId: 'asset-001',
                    afterAssetId: 'asset-001',
                    reason: 'documentacion clinica privada',
                },
            ],
            disclaimer: 'Material sujeto a revision editorial.',
        },
        timeline: [
            {
                eventId: 'mf-evt-001',
                status: 'queued',
                label: 'Caso editorial creado',
                createdAt: '2026-03-15T10:00:00-05:00',
            },
        ],
    };

    const dataState = {
        clinicalHistoryMeta: {
            summary: {
                drafts: {
                    reviewQueueCount: 2,
                    pendingAiCount: 1,
                },
                events: {
                    openCount: 2,
                    unreadCount: 2,
                },
                diagnostics: {
                    status: 'degraded',
                },
            },
            reviewQueue: [
                {
                    sessionId: 'chs-001',
                    caseId: 'case-001',
                    patientName: 'Ana Ruiz',
                    summary: 'Rosacea facial con brote recurrente',
                    sessionStatus: 'review_required',
                    reviewStatus: 'review_required',
                    requiresHumanReview: true,
                    reviewReasons: ['dose_ambiguous'],
                    pendingAiStatus: 'queued',
                    attachmentCount: 1,
                    openEventCount: 2,
                    highestOpenSeverity: 'critical',
                    latestOpenEventTitle: 'Alerta clinica abierta',
                },
                {
                    sessionId: 'chs-002',
                    caseId: 'case-002',
                    patientName: 'Bruno Paz',
                    summary: 'Dermatitis en observacion',
                    sessionStatus: 'review_required',
                    reviewStatus: 'review_required',
                    requiresHumanReview: true,
                    reviewReasons: ['low_confidence'],
                    pendingAiStatus: '',
                    attachmentCount: 0,
                    openEventCount: 0,
                    highestOpenSeverity: '',
                    latestOpenEventTitle: '',
                },
            ],
            events: [
                {
                    eventId: 'che-001',
                    type: 'clinical_alert',
                    severity: 'critical',
                    status: 'open',
                },
            ],
        },
        mediaFlowMeta: {
            queue: [
                {
                    caseId: 'case-001',
                    patientName: 'Ana Ruiz',
                    summary: 'Caso dermatologico para curacion editorial',
                    serviceLabel: 'Teledermatologia',
                    assetCount: 1,
                    publicationStatus: 'draft',
                    policyStatus: 'eligible',
                    policyFlags: ['consent_ok'],
                },
            ],
        },
    };

    let agentSessionStartPayload = null;

    await installLegacyAdminAuthMock(page, {
        capabilities: {
            adminAgent: true,
        },
    });
    await installBasicAdminApiMocks(page, {
        dataOverrides: dataState,
        handleRoute: async ({
            route,
            resource,
            method,
            payload,
            fulfillJson,
        }) => {
            if (resource === 'clinical-history-review' && method === 'GET') {
                const requestUrl = new URL(route.request().url());
                const sessionId =
                    requestUrl.searchParams.get('sessionId') || 'chs-001';
                await fulfillJson(route, {
                    ok: true,
                    data: reviewBySessionId[sessionId] || reviewBySessionId['chs-001'],
                });
                return true;
            }

            if (resource === 'media-flow-case' && method === 'GET') {
                await fulfillJson(route, {
                    ok: true,
                    data: mediaCase,
                });
                return true;
            }

            if (
                resource === 'media-flow-proposal-review' &&
                method === 'POST'
            ) {
                mediaCase.proposal.status = 'approved';
                mediaCase.proposal.recommendation = 'ready_to_publish';
                mediaCase.publication.status = 'approved';
                dataState.mediaFlowMeta.queue[0].publicationStatus = 'approved';
                await fulfillJson(route, {
                    ok: true,
                    data: {
                        caseId: payload.caseId,
                        proposalId: payload.proposalId,
                        decision: payload.decision,
                    },
                });
                return true;
            }

            if (resource === 'admin-agent-status') {
                await fulfillJson(route, buildAdminAgentStatusPayload());
                return true;
            }

            if (resource === 'admin-agent-session-start') {
                agentSessionStartPayload = payload;
                await fulfillJson(
                    route,
                    {
                        ok: true,
                        data: buildAdminAgentSnapshot({
                            context: payload.context || {},
                        }),
                    },
                    201
                );
                return true;
            }

            if (resource === 'admin-agent-turn') {
                await fulfillJson(route, {
                    ok: true,
                    data: {
                        session: buildAdminAgentSnapshot({
                            context: payload.context || {},
                            messages: [
                                {
                                    role: 'user',
                                    content: payload.message || '',
                                    createdAt: new Date().toISOString(),
                                },
                                {
                                    role: 'assistant',
                                    content:
                                        'Contexto editorial recibido para el caso activo.',
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                        }),
                        clientActions: [],
                    },
                });
                return true;
            }

            return false;
        },
    });

    await page.goto('/admin.html');
    await waitForAdminRuntimeReady(page);

    await page.keyboard.press('Control+K');
    await page.locator('#adminQuickCommand').fill('telemedicina pendiente');
    await page.keyboard.press('Enter');

    await expect(page.locator('#clinical-history')).toHaveClass(/active/);
    await expect(page).toHaveURL(/clinicalWorkspace=review/);
    await expect(
        page.locator('[data-clinical-workspace="review"]')
    ).toHaveClass(/is-active/);
    await expect(page.locator('#clinicalHistoryTranscriptMeta')).toContainText(
        'Ana Ruiz'
    );
    await expect(page.locator('#clinician_resumen')).toHaveValue(
        'Rosacea facial en seguimiento clinico.'
    );

    await page.locator('#clinician_resumen').fill(
        'Rosacea facial ajustada manualmente por el medico.'
    );
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('[data-clinical-session-id="chs-002"]').click();
    await expect(page.locator('#clinicalHistoryTranscriptMeta')).toContainText(
        'Ana Ruiz'
    );
    await expect(page.locator('#clinician_resumen')).toHaveValue(
        'Rosacea facial ajustada manualmente por el medico.'
    );
    await expect(
        page.locator('[data-clinical-session-id="chs-001"]')
    ).toHaveClass(/is-selected/);

    await page.locator('[data-clinical-workspace="media-flow"]').click();
    await expect(page).toHaveURL(/clinicalWorkspace=media-flow/);
    await expect(
        page.locator('[data-clinical-workspace="media-flow"]')
    ).toHaveClass(/is-active/);
    await expect(page.locator('#clinicalMediaFlowCaseMeta')).toContainText(
        'Caso Ana Ruiz'
    );
    await expect(
        page.locator('[data-media-case-id="case-001"]')
    ).toHaveClass(/is-selected/);

    await page.getByRole('button', { name: 'Abrir panel global' }).click();
    await expect(page.locator('#adminAgentPanel')).toBeVisible();
    await expect(page.locator('#adminAgentContextSummary')).toContainText(
        'clinical-history / media-flow'
    );
    await expect(page.locator('#adminAgentContextMeta')).toHaveText(
        'case case-001 · prop-001'
    );

    await page.locator('#adminAgentPrompt').fill(
        'Resume el estado editorial del caso'
    );
    await page.locator('#adminAgentSubmitBtn').click();
    await expect
        .poll(() => agentSessionStartPayload)
        .not.toBeNull();
    expect(agentSessionStartPayload.context.workspace).toBe('media-flow');
    expect(agentSessionStartPayload.context.caseId).toBe('case-001');
    expect(agentSessionStartPayload.context.proposalId).toBe('prop-001');
    expect(agentSessionStartPayload.context.selectedAssetIds).toEqual([
        'asset-001',
    ]);

    await page.getByRole('button', { name: 'Aprobar' }).click();
    await expect(page.locator('#clinicalMediaFlowStatusMeta')).toHaveText(
        'approved · ready_to_publish'
    );
    await expect(
        page.locator('[data-media-case-id="case-001"]')
    ).toHaveClass(/is-selected/);
});
