import { apiRequest } from '../../../shared/core/api-client.js';
import { getState, updateState } from '../../../shared/core/store.js';
import {
    buildAgentContextFromState,
    canUseAgent,
    openAgentPanelExperience,
    submitAgentPrompt,
} from '../../../shared/modules/agent.js';
import { refreshAdminData } from '../../../shared/modules/data.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';

let scheduledSelection = '';

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function readMeta(state = getState()) {
    return state?.data?.mediaFlowMeta &&
        typeof state.data.mediaFlowMeta === 'object'
        ? state.data.mediaFlowMeta
        : {};
}

function getSlice(state = getState()) {
    return state?.caseMediaFlow && typeof state.caseMediaFlow === 'object'
        ? state.caseMediaFlow
        : {};
}

function setSlice(patch) {
    updateState((state) => ({
        ...state,
        caseMediaFlow: {
            ...state.caseMediaFlow,
            ...patch,
        },
    }));
}

function currentClinicalCaseId(state = getState()) {
    return normalizeString(
        state?.clinicalHistory?.current?.session?.caseId ||
            state?.clinicalHistory?.draftForm?.caseId
    );
}

function formatPolicyStatus(status) {
    switch (normalizeString(status)) {
        case 'eligible':
            return 'Elegible';
        case 'blocked':
            return 'Bloqueado';
        default:
            return 'Requiere revision';
    }
}

function policyTone(status) {
    switch (normalizeString(status)) {
        case 'eligible':
            return 'success';
        case 'blocked':
            return 'warning';
        default:
            return 'neutral';
    }
}

function buildQueueList(meta, selectedCaseId, loading) {
    const items = normalizeList(meta.queue);
    if (!items.length) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin casos editoriales</strong>
                <small>Los activos privados apareceran aqui cuando exista media clinica con ruta privada.</small>
            </article>
        `;
    }

    return items
        .map((item) => {
            const caseId = normalizeString(item.caseId);
            const selected = caseId === selectedCaseId;
            const flags = normalizeList(item.policyFlags)
                .slice(0, 3)
                .map(
                    (flag) =>
                        `<span class="clinical-history-mini-chip">${escapeHtml(
                            String(flag).replace(/_/g, ' ')
                        )}</span>`
                )
                .join('');

            return `
                <button
                    type="button"
                    class="clinical-history-queue-item clinical-media-flow-queue-item${
                        selected ? ' is-selected' : ''
                    }"
                    data-media-case-id="${escapeHtml(caseId)}"
                    ${loading ? 'disabled' : ''}
                >
                    <div class="clinical-history-queue-head">
                        <strong>${escapeHtml(
                            normalizeString(item.patientName) || caseId
                        )}</strong>
                        <span class="clinical-history-mini-chip" data-tone="${escapeHtml(
                            policyTone(item.policyStatus)
                        )}">
                            ${escapeHtml(formatPolicyStatus(item.policyStatus))}
                        </span>
                    </div>
                    <p>${escapeHtml(
                        normalizeString(item.summary) ||
                            'Caso listo para curacion editorial.'
                    )}</p>
                    <div class="clinical-history-mini-chip-row">
                        <span class="clinical-history-mini-chip">
                            ${escapeHtml(
                                normalizeString(item.serviceLabel) || 'Caso'
                            )}
                        </span>
                        <span class="clinical-history-mini-chip">
                            ${escapeHtml(
                                `${Number(item.assetCount || 0)} asset(s)`
                            )}
                        </span>
                        <span class="clinical-history-mini-chip">
                            ${escapeHtml(
                                normalizeString(item.publicationStatus) || 'draft'
                            )}
                        </span>
                        ${flags}
                    </div>
                </button>
            `;
        })
        .join('');
}

function buildConsentStrip(caseData) {
    if (!caseData) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin seleccion</strong>
                <small>Selecciona un caso para revisar consentimiento, activos y propuesta OpenClaw.</small>
            </article>
        `;
    }

    const consent = caseData.consent || {};
    const policy = caseData.policy || {};
    const flags = normalizeList(policy.flags)
        .map(
            (flag) => `
                <span class="clinical-history-mini-chip">
                    ${escapeHtml(String(flag).replace(/_/g, ' '))}
                </span>
            `
        )
        .join('');

    return `
        <article class="clinical-media-flow-consent-card">
            <strong>Consentimiento</strong>
            <div class="clinical-history-mini-chip-row">
                <span class="clinical-history-mini-chip">${escapeHtml(
                    normalizeString(consent.status) || 'missing'
                )}</span>
                <span class="clinical-history-mini-chip">${escapeHtml(
                    normalizeString(policy.status) || 'needs_review'
                )}</span>
                ${flags}
            </div>
            <small>
                Privacidad: ${escapeHtml(
                    consent.privacyAccepted ? 'aceptada' : 'pendiente'
                )} ·
                Publicacion: ${escapeHtml(
                    consent.publicationExplicit ? 'explicita' : 'no registrada'
                )}
            </small>
        </article>
    `;
}

function buildAssetGrid(caseData) {
    if (!caseData) {
        return '';
    }

    const assets = normalizeList(caseData.mediaAssets);
    if (!assets.length) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin media privada</strong>
                <small>Este caso todavia no tiene activos clinicos privados elegibles.</small>
            </article>
        `;
    }

    return assets
        .map((asset) => {
            const flags = normalizeList(asset.qualityFlags)
                .concat(normalizeList(asset.riskFlags))
                .slice(0, 4)
                .map(
                    (flag) => `
                        <span class="clinical-history-mini-chip">
                            ${escapeHtml(String(flag).replace(/_/g, ' '))}
                        </span>
                    `
                )
                .join('');

            return `
                <article class="clinical-media-flow-asset-card">
                    <figure class="clinical-media-flow-asset-media">
                        <img
                            src="${escapeHtml(normalizeString(asset.previewUrl))}"
                            alt="${escapeHtml(
                                normalizeString(asset.originalName) ||
                                    normalizeString(asset.kind) ||
                                    'Asset clinico'
                            )}"
                            loading="lazy"
                            decoding="async"
                        />
                    </figure>
                    <div class="clinical-media-flow-asset-meta">
                        <strong>${escapeHtml(
                            normalizeString(asset.originalName) ||
                                normalizeString(asset.assetId)
                        )}</strong>
                        <small>
                            ${escapeHtml(normalizeString(asset.kind) || 'progress')}
                            · ${escapeHtml(normalizeString(asset.visibility) || 'private_only')}
                        </small>
                        <div class="clinical-history-mini-chip-row">
                            ${flags}
                        </div>
                    </div>
                </article>
            `;
        })
        .join('');
}

function pairSummary(proposal) {
    const pairs = normalizeList(proposal?.comparePairs);
    if (!pairs.length) {
        return 'OpenClaw no encontro un before/after fuerte; queda en revision editorial.';
    }

    return pairs
        .map(
            (pair, index) =>
                `Par ${index + 1}: ${normalizeString(
                    pair.beforeAssetId
                )} -> ${normalizeString(pair.afterAssetId)}`
        )
        .join('\n');
}

function proposalCopyValue(proposal, locale, key) {
    const copy = proposal?.copy && typeof proposal.copy === 'object'
        ? proposal.copy
        : {};
    const node = copy[locale] && typeof copy[locale] === 'object'
        ? copy[locale]
        : {};
    return normalizeString(node[key]);
}

function proposalAltValue(proposal, locale, key) {
    const alt = proposal?.alt && typeof proposal.alt === 'object'
        ? proposal.alt
        : {};
    const node = alt[locale] && typeof alt[locale] === 'object'
        ? alt[locale]
        : {};
    return normalizeString(node[key]);
}

function buildProposalForm(caseData, slice) {
    if (!caseData) {
        return '';
    }

    const proposal =
        caseData.proposal && typeof caseData.proposal === 'object'
            ? caseData.proposal
            : null;
    const publication =
        caseData.publication && typeof caseData.publication === 'object'
            ? caseData.publication
            : {};
    const disabled = slice.saving || slice.generating;
    const proposalStatus = normalizeString(proposal?.status) || 'draft';
    const publicationStatus =
        normalizeString(publication.status) || 'draft';

    if (!proposal) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin propuesta</strong>
                <small>Genera una propuesta para que OpenClaw prepare selección, copy, alt text y paquete editorial.</small>
            </article>
        `;
    }

    return `
        <div class="clinical-media-flow-form-grid">
            <section class="clinical-history-form-section">
                <header>
                    <h4>Copy editorial</h4>
                    <p>
                        Recomendacion: ${escapeHtml(
                            normalizeString(proposal.recommendation) ||
                                'needs_review'
                        )} ·
                        Publicacion: ${escapeHtml(publicationStatus)}
                    </p>
                </header>
                <div class="clinical-history-inline-grid">
                    <label class="clinical-history-field" for="clinicalMediaFlowTitleEs">
                        <span>Titulo ES</span>
                        <input
                            id="clinicalMediaFlowTitleEs"
                            name="titleEs"
                            type="text"
                            value="${escapeHtml(
                                proposalCopyValue(proposal, 'es', 'title')
                            )}"
                            ${disabled ? 'disabled' : ''}
                        />
                    </label>
                    <label class="clinical-history-field" for="clinicalMediaFlowTitleEn">
                        <span>Title EN</span>
                        <input
                            id="clinicalMediaFlowTitleEn"
                            name="titleEn"
                            type="text"
                            value="${escapeHtml(
                                proposalCopyValue(proposal, 'en', 'title')
                            )}"
                            ${disabled ? 'disabled' : ''}
                        />
                    </label>
                </div>
                <label class="clinical-history-field" for="clinicalMediaFlowSummaryEs">
                    <span>Resumen ES</span>
                    <textarea
                        id="clinicalMediaFlowSummaryEs"
                        name="summaryEs"
                        ${disabled ? 'disabled' : ''}
                    >${escapeHtml(
                        proposalCopyValue(proposal, 'es', 'summary')
                    )}</textarea>
                </label>
                <label class="clinical-history-field" for="clinicalMediaFlowSummaryEn">
                    <span>Summary EN</span>
                    <textarea
                        id="clinicalMediaFlowSummaryEn"
                        name="summaryEn"
                        ${disabled ? 'disabled' : ''}
                    >${escapeHtml(
                        proposalCopyValue(proposal, 'en', 'summary')
                    )}</textarea>
                </label>
                <div class="clinical-history-inline-grid">
                    <label class="clinical-history-field" for="clinicalMediaFlowCategory">
                        <span>Categoria</span>
                        <input
                            id="clinicalMediaFlowCategory"
                            name="category"
                            type="text"
                            value="${escapeHtml(
                                normalizeString(proposal.category)
                            )}"
                            ${disabled ? 'disabled' : ''}
                        />
                    </label>
                    <label class="clinical-history-field" for="clinicalMediaFlowTags">
                        <span>Tags</span>
                        <input
                            id="clinicalMediaFlowTags"
                            name="tags"
                            type="text"
                            value="${escapeHtml(
                                normalizeList(proposal.tags).join(', ')
                            )}"
                            ${disabled ? 'disabled' : ''}
                        />
                    </label>
                </div>
            </section>

            <section class="clinical-history-form-section">
                <header>
                    <h4>Accesibilidad y comparativas</h4>
                    <p>
                        Score: ${escapeHtml(
                            `${Number(proposal.publicationScore || 0)}`
                        )} · Estado: ${escapeHtml(proposalStatus)}
                    </p>
                </header>
                <label class="clinical-history-field" for="clinicalMediaFlowAltCoverEs">
                    <span>Alt cover ES</span>
                    <input
                        id="clinicalMediaFlowAltCoverEs"
                        name="altCoverEs"
                        type="text"
                        value="${escapeHtml(
                            proposalAltValue(proposal, 'es', 'cover')
                        )}"
                        ${disabled ? 'disabled' : ''}
                    />
                </label>
                <label class="clinical-history-field" for="clinicalMediaFlowAltCoverEn">
                    <span>Alt cover EN</span>
                    <input
                        id="clinicalMediaFlowAltCoverEn"
                        name="altCoverEn"
                        type="text"
                        value="${escapeHtml(
                            proposalAltValue(proposal, 'en', 'cover')
                        )}"
                        ${disabled ? 'disabled' : ''}
                    />
                </label>
                <label class="clinical-history-field" for="clinicalMediaFlowCompareSummary">
                    <span>Pares before/after</span>
                    <textarea
                        id="clinicalMediaFlowCompareSummary"
                        name="compareSummary"
                        disabled
                    >${escapeHtml(pairSummary(proposal))}</textarea>
                </label>
                <label class="clinical-history-field" for="clinicalMediaFlowDisclaimer">
                    <span>Disclaimer</span>
                    <textarea
                        id="clinicalMediaFlowDisclaimer"
                        name="disclaimer"
                        ${disabled ? 'disabled' : ''}
                    >${escapeHtml(
                        normalizeString(proposal.disclaimer)
                    )}</textarea>
                </label>
            </section>
        </div>

        <div class="toolbar-row clinical-media-flow-action-row">
            <button
                type="button"
                data-media-flow-action="review"
                data-media-flow-decision="approve"
                ${disabled ? 'disabled' : ''}
            >
                Aprobar
            </button>
            <button
                type="button"
                data-media-flow-action="review"
                data-media-flow-decision="edit_and_publish"
                ${disabled ? 'disabled' : ''}
            >
                Guardar y publicar
            </button>
            <button
                type="button"
                data-media-flow-action="review"
                data-media-flow-decision="reject"
                ${disabled ? 'disabled' : ''}
            >
                Rechazar
            </button>
            <button
                type="button"
                data-media-flow-action="review"
                data-media-flow-decision="archive"
                ${disabled ? 'disabled' : ''}
            >
                Archivar
            </button>
            ${
                publicationStatus === 'approved'
                    ? `
                        <button
                            type="button"
                            data-media-flow-action="publication-state"
                            data-media-publication-state="published"
                            ${disabled ? 'disabled' : ''}
                        >
                            Publicar aprobada
                        </button>
                    `
                    : ''
            }
        </div>
    `;
}

function buildTimeline(caseData) {
    if (!caseData) {
        return '';
    }

    const items = normalizeList(caseData.timeline);
    if (!items.length) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin timeline</strong>
                <small>Las regeneraciones, revisiones y publicaciones apareceran aqui.</small>
            </article>
        `;
    }

    return items
        .map(
            (item) => `
                <article class="clinical-history-event-card">
                    <div class="clinical-history-event-head">
                        <strong>${escapeHtml(
                            normalizeString(item.title) ||
                                normalizeString(item.type)
                        )}</strong>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            formatDateTime(normalizeString(item.createdAt))
                        )}</span>
                    </div>
                    <p>${escapeHtml(
                        normalizeString(item.message) || 'Evento registrado.'
                    )}</p>
                </article>
            `
        )
        .join('');
}

function buildMediaFlowAgentContext(caseData, state = getState()) {
    const base = buildAgentContextFromState(state);
    const proposal =
        caseData?.proposal && typeof caseData.proposal === 'object'
            ? caseData.proposal
            : {};
    const queue = normalizeList(state?.data?.mediaFlowMeta?.queue);
    const selectedAssetIds = normalizeList(
        proposal.selectedAssetIds ||
            normalizeList(caseData?.mediaAssets).map((asset) => asset?.assetId)
    )
        .map((value) => normalizeString(value))
        .filter(Boolean);
    const caseId = normalizeString(caseData?.caseId);

    return {
        ...base,
        section: 'clinical-history',
        workspace: 'media-flow',
        selectedEntity: {
            type: 'case_media',
            id: 0,
            ref: caseId,
            label:
                normalizeString(caseData?.summary?.headline) ||
                normalizeString(caseData?.patient?.name) ||
                caseId,
        },
        filters: {
            ...(base.filters || {}),
            workspace: 'media-flow',
            publicationStatus: normalizeString(caseData?.publication?.status),
            policyStatus: normalizeString(caseData?.policy?.status),
        },
        visibleIds: queue
            .map((item) => normalizeString(item?.caseId))
            .filter(Boolean),
        caseId,
        proposalId: normalizeString(proposal.proposalId),
        selectedAssetIds,
        domainContext: {
            caseId,
            proposalId: normalizeString(proposal.proposalId),
            selectedAssetIds,
        },
    };
}

function buildDefaultAgentSuggestions(caseData) {
    if (!caseData) {
        return [];
    }

    const suggestions = [
        {
            id: 'regenerate',
            label: 'Regenerar',
            prompt: 'Regenera la propuesta editorial de este caso',
            tone: 'neutral',
            description:
                'Vuelve a leer el snapshot clinico y arma una propuesta nueva.',
        },
        {
            id: 'repair',
            label: 'Re-pair',
            prompt: 'Reempareja el before/after de este caso',
            tone: 'neutral',
            description:
                'Recalcula la comparativa before/after con los activos actuales.',
        },
        {
            id: 'rewrite-copy',
            label: 'Rewrite copy',
            prompt: 'Reescribe el copy editorial de este caso',
            tone: 'neutral',
            description:
                'Refresca titulo, resumen y alt text sin publicar automaticamente.',
        },
        {
            id: 'change-cover',
            label: 'Change cover',
            prompt: 'Cambia la cover al mejor after de este caso',
            tone: 'neutral',
            description: 'Propone una portada mas fuerte para la card pública.',
        },
    ];

    if (normalizeString(caseData?.policy?.status) === 'blocked') {
        suggestions.push({
            id: 'blocked-reason',
            label: 'Blocked reason',
            prompt: 'Explica por que este caso esta bloqueado',
            tone: 'warning',
            description:
                'Resume el motivo de policy que impide publicarlo.',
        });
    } else {
        suggestions.push({
            id: 'approve-ready',
            label: 'Approve ready',
            prompt: 'Confirma si este caso esta listo para aprobacion humana',
            tone: 'success',
            description:
                'Valida si el paquete ya puede pasar al gate humano final.',
        });
    }

    return suggestions;
}

function messageCaseId(message) {
    return normalizeString(
        message?.context?.caseId || message?.context?.domainContext?.caseId
    );
}

function latestMediaAgentTurn(caseData, state = getState()) {
    const caseId = normalizeString(caseData?.caseId);
    const turns = normalizeList(state?.agent?.turns);
    for (let index = turns.length - 1; index >= 0; index -= 1) {
        const turn = turns[index];
        const turnCaseId = normalizeString(
            turn?.domainResponse?.caseId ||
                turn?.context?.caseId ||
                turn?.context?.domainContext?.caseId
        );
        if (turnCaseId === caseId) {
            return turn;
        }
    }
    return null;
}

function buildAgentConversation(caseData, state = getState()) {
    const caseId = normalizeString(caseData?.caseId);
    const messages = normalizeList(state?.agent?.messages).filter(
        (message) => messageCaseId(message) === caseId
    );
    if (!messages.length) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin hilo editorial</strong>
                <small>Usa el composer para abrir la misma sesión compartida de OpenClaw sobre este caso.</small>
            </article>
        `;
    }

    return messages
        .slice(-6)
        .map(
            (message) => `
                <article class="clinical-media-flow-agent-message" data-role="${escapeHtml(
                    normalizeString(message.role) || 'assistant'
                )}">
                    <div class="clinical-history-event-head">
                        <strong>${escapeHtml(
                            normalizeString(message.role) === 'user'
                                ? 'Operador'
                                : 'OpenClaw'
                        )}</strong>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            formatDateTime(normalizeString(message.createdAt))
                        )}</span>
                    </div>
                    <p>${escapeHtml(normalizeString(message.content))}</p>
                </article>
            `
        )
        .join('');
}

function buildAgentSuggestions(caseData, state = getState()) {
    const turn = latestMediaAgentTurn(caseData, state);
    const suggestions = normalizeList(turn?.domainResponse?.toolSuggestions);
    return suggestions.length ? suggestions : buildDefaultAgentSuggestions(caseData);
}

function buildAgentSuggestionCards(caseData, state = getState()) {
    const suggestions = buildAgentSuggestions(caseData, state);
    if (!suggestions.length) {
        return '';
    }

    const disabled =
        getSlice(state).loading || getSlice(state).saving || state?.agent?.submitting;

    return suggestions
        .map(
            (item) => `
                <article class="clinical-media-flow-agent-suggestion" data-tone="${escapeHtml(
                    normalizeString(item.tone) || 'neutral'
                )}">
                    <div class="clinical-history-event-head">
                        <strong>${escapeHtml(normalizeString(item.label) || 'Accion')}</strong>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            normalizeString(item.id)
                        )}</span>
                    </div>
                    <p>${escapeHtml(normalizeString(item.description))}</p>
                    <button
                        type="button"
                        data-media-agent-prompt="${escapeHtml(
                            normalizeString(item.prompt)
                        )}"
                        ${disabled ? 'disabled' : ''}
                    >
                        Ejecutar sugerencia
                    </button>
                </article>
            `
        )
        .join('');
}

function buildInlineAgentSurface(caseData, slice, state = getState()) {
    if (!caseData) {
        return `
            <article class="clinical-history-empty-card">
                <strong>OpenClaw por caso</strong>
                <small>Selecciona un caso para hablar con el copiloto editorial desde Media Flow.</small>
            </article>
        `;
    }

    if (!canUseAgent(state)) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Acceso restringido</strong>
                <small>OpenClaw está disponible solo para perfiles admin/editorial en esta fase.</small>
            </article>
        `;
    }

    const relayMode = normalizeString(state?.agent?.health?.relay?.mode) || 'disabled';
    const sessionStatus = normalizeString(state?.agent?.session?.status) || 'idle';
    const turn = latestMediaAgentTurn(caseData, state);
    const domainResponse =
        turn?.domainResponse && typeof turn.domainResponse === 'object'
            ? turn.domainResponse
            : {};
    const disabled = slice.loading || slice.saving || slice.generating || state?.agent?.submitting;
    const assistantSummary =
        normalizeString(domainResponse.assistantMessage) ||
        normalizeString(turn?.finalAnswer) ||
        'Habla con OpenClaw sobre este caso para regenerar propuesta, copy o comparativas.';

    return `
        <article class="clinical-media-flow-agent-card">
            <header class="section-header">
                <div>
                    <h4>OpenClaw por caso</h4>
                    <p>
                        Misma sesión compartida del panel global, pero enfocada en el caso editorial activo.
                    </p>
                </div>
                <div class="clinical-history-header-status">
                    <span class="clinical-history-status-chip" data-tone="${escapeHtml(
                        relayMode === 'online' ? 'success' : relayMode === 'degraded' ? 'warning' : 'neutral'
                    )}">
                        ${escapeHtml(relayMode || 'disabled')}
                    </span>
                    <span class="clinical-history-status-meta">
                        ${escapeHtml(sessionStatus)}
                    </span>
                </div>
            </header>

            <div class="clinical-media-flow-agent-summary">
                <p>${escapeHtml(assistantSummary)}</p>
                <div class="clinical-history-mini-chip-row">
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(normalizeString(caseData?.policy?.status) || 'needs_review')}
                    </span>
                    <span class="clinical-history-mini-chip">
                        ${escapeHtml(
                            normalizeString(caseData?.proposal?.recommendation) ||
                                normalizeString(caseData?.publication?.status) ||
                                'draft'
                        )}
                    </span>
                </div>
            </div>

            <div class="clinical-media-flow-agent-grid">
                <div class="clinical-media-flow-agent-conversation">
                    ${buildAgentConversation(caseData, state)}
                </div>
                <div class="clinical-media-flow-agent-suggestions">
                    ${buildAgentSuggestionCards(caseData, state)}
                </div>
            </div>

            <div class="clinical-media-flow-agent-composer">
                <label class="clinical-history-field" for="clinicalMediaFlowAgentPrompt">
                    <span>Hablar con OpenClaw sobre este caso</span>
                    <textarea
                        id="clinicalMediaFlowAgentPrompt"
                        placeholder="Ej. Reempareja el before/after y reescribe el copy editorial"
                        ${disabled ? 'disabled' : ''}
                    ></textarea>
                </label>
                <div class="toolbar-row clinical-media-flow-agent-actions">
                    <button
                        type="button"
                        data-media-agent-action="open-panel"
                        ${disabled ? 'disabled' : ''}
                    >
                        Abrir panel global
                    </button>
                    <button
                        type="button"
                        data-media-agent-action="submit"
                        ${disabled ? 'disabled' : ''}
                    >
                        Enviar al caso
                    </button>
                </div>
            </div>
        </article>
    `;
}

function collectEditsFromDom() {
    const titleEs =
        document.getElementById('clinicalMediaFlowTitleEs')?.value || '';
    const titleEn =
        document.getElementById('clinicalMediaFlowTitleEn')?.value || '';
    const summaryEs =
        document.getElementById('clinicalMediaFlowSummaryEs')?.value || '';
    const summaryEn =
        document.getElementById('clinicalMediaFlowSummaryEn')?.value || '';
    const category =
        document.getElementById('clinicalMediaFlowCategory')?.value || '';
    const tags = String(
        document.getElementById('clinicalMediaFlowTags')?.value || ''
    )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const altCoverEs =
        document.getElementById('clinicalMediaFlowAltCoverEs')?.value || '';
    const altCoverEn =
        document.getElementById('clinicalMediaFlowAltCoverEn')?.value || '';
    const disclaimer =
        document.getElementById('clinicalMediaFlowDisclaimer')?.value || '';

    return {
        copy: {
            es: {
                title: String(titleEs).trim(),
                summary: String(summaryEs).trim(),
            },
            en: {
                title: String(titleEn).trim(),
                summary: String(summaryEn).trim(),
            },
        },
        alt: {
            es: {
                cover: String(altCoverEs).trim(),
            },
            en: {
                cover: String(altCoverEn).trim(),
            },
        },
        category: String(category).trim(),
        tags,
        disclaimer: String(disclaimer).trim(),
    };
}

async function loadCase(caseId, options = {}) {
    const targetCaseId = normalizeString(caseId);
    if (!targetCaseId) {
        return null;
    }

    const slice = getSlice();
    if (
        !options.force &&
        targetCaseId === normalizeString(slice.selectedCaseId) &&
        slice.current
    ) {
        return slice.current;
    }

    setSlice({
        loading: true,
        selectedCaseId: targetCaseId,
        error: '',
    });
    renderClinicalMediaFlow();

    try {
        const response = await apiRequest('media-flow-case', {
            query: { caseId: targetCaseId },
        });
        const payload =
            response?.data && typeof response.data === 'object'
                ? response.data
                : null;

        setSlice({
            loading: false,
            selectedCaseId: targetCaseId,
            current: payload,
            lastLoadedAt: Date.now(),
            error: '',
        });
        renderClinicalMediaFlow();
        return payload;
    } catch (error) {
        setSlice({
            loading: false,
            error:
                error?.message ||
                'No se pudo cargar el caso de Media Flow.',
        });
        renderClinicalMediaFlow();
        return null;
    }
}

async function refreshCurrentCase() {
    const caseId = normalizeString(getSlice().selectedCaseId);
    if (!caseId) {
        return null;
    }
    return loadCase(caseId, { force: true });
}

async function refreshMetaAndCase(caseId) {
    await refreshAdminData();
    if (normalizeString(caseId)) {
        await loadCase(caseId, { force: true });
        return;
    }
    renderClinicalMediaFlow();
}

async function generateProposal() {
    const caseId = normalizeString(getSlice().selectedCaseId);
    if (!caseId) {
        createToast('Selecciona un caso antes de generar la propuesta.', 'warning');
        return;
    }

    setSlice({ generating: true, error: '' });
    renderClinicalMediaFlow();

    try {
        await apiRequest('media-flow-proposal-generate', {
            method: 'POST',
            body: { caseId },
        });
        setSlice({ generating: false });
        await refreshMetaAndCase(caseId);
        createToast('Propuesta editorial generada.', 'success');
    } catch (error) {
        setSlice({
            generating: false,
            error:
                error?.message ||
                'No se pudo generar la propuesta editorial.',
        });
        renderClinicalMediaFlow();
        createToast(
            error?.message ||
                'No se pudo generar la propuesta editorial.',
            'error'
        );
    }
}

async function reviewProposal(decision) {
    const current = getSlice().current;
    const proposal =
        current?.proposal && typeof current.proposal === 'object'
            ? current.proposal
            : null;
    const caseId = normalizeString(current?.caseId || getSlice().selectedCaseId);

    if (!proposal || !caseId) {
        createToast('Genera o carga una propuesta antes de revisar.', 'warning');
        return;
    }

    setSlice({ saving: true, error: '' });
    renderClinicalMediaFlow();

    try {
        await apiRequest('media-flow-proposal-review', {
            method: 'POST',
            body: {
                caseId,
                proposalId: proposal.proposalId,
                decision,
                edits: collectEditsFromDom(),
            },
        });
        setSlice({ saving: false });
        await refreshMetaAndCase(caseId);
        createToast('Decision editorial registrada.', 'success');
    } catch (error) {
        setSlice({
            saving: false,
            error:
                error?.message ||
                'No se pudo guardar la decision editorial.',
        });
        renderClinicalMediaFlow();
        createToast(
            error?.message || 'No se pudo guardar la decision editorial.',
            'error'
        );
    }
}

async function updatePublicationState(stateId) {
    const current = getSlice().current;
    const caseId = normalizeString(current?.caseId || getSlice().selectedCaseId);
    if (!caseId) {
        return;
    }

    setSlice({ saving: true, error: '' });
    renderClinicalMediaFlow();

    try {
        await apiRequest('media-flow-publication-state', {
            method: 'POST',
            body: {
                caseId,
                state: stateId,
            },
        });
        setSlice({ saving: false });
        await refreshMetaAndCase(caseId);
        createToast('Estado de publicacion actualizado.', 'success');
    } catch (error) {
        setSlice({
            saving: false,
            error:
                error?.message ||
                'No se pudo actualizar el estado de publicacion.',
        });
        renderClinicalMediaFlow();
        createToast(
            error?.message ||
                'No se pudo actualizar el estado de publicacion.',
            'error'
        );
    }
}

async function submitInlineAgentPrompt(promptOverride = '') {
    const state = getState();
    const current = getSlice(state).current;
    if (!current || typeof current !== 'object') {
        createToast('Selecciona un caso antes de hablar con OpenClaw.', 'warning');
        return;
    }

    if (!canUseAgent(state)) {
        createToast(
            'OpenClaw está disponible solo para perfiles admin/editorial.',
            'warning'
        );
        return;
    }

    const composer = document.getElementById('clinicalMediaFlowAgentPrompt');
    const prompt = normalizeString(
        promptOverride ||
            (composer instanceof HTMLTextAreaElement ? composer.value : '')
    );
    if (!prompt) {
        createToast('Escribe una instrucción para OpenClaw.', 'warning');
        return;
    }

    renderClinicalMediaFlow();

    try {
        const response = await submitAgentPrompt(prompt, {
            contextOverride: buildMediaFlowAgentContext(current, state),
        });
        if (composer instanceof HTMLTextAreaElement && !promptOverride) {
            composer.value = '';
        }
        if (response?.refreshRecommended) {
            await refreshMetaAndCase(normalizeString(current.caseId));
        } else {
            renderClinicalMediaFlow();
        }
        createToast('Turno de OpenClaw procesado para este caso.', 'success');
    } catch (error) {
        renderClinicalMediaFlow();
        createToast(
            error?.message || 'No se pudo procesar el turno editorial.',
            'error'
        );
    }
}

function ensureSelection() {
    const state = getState();
    if (state?.ui?.activeSection !== 'clinical-history') {
        return;
    }

    const slice = getSlice(state);
    if (slice.loading || slice.generating || slice.saving) {
        return;
    }

    const queue = normalizeList(readMeta(state).queue);
    const preferredCaseId =
        currentClinicalCaseId(state) ||
        normalizeString(slice.selectedCaseId) ||
        normalizeString(queue[0]?.caseId);

    if (!preferredCaseId) {
        scheduledSelection = '';
        return;
    }

    if (
        preferredCaseId === normalizeString(slice.selectedCaseId) &&
        slice.current
    ) {
        scheduledSelection = '';
        return;
    }

    if (scheduledSelection === preferredCaseId) {
        return;
    }

    scheduledSelection = preferredCaseId;
    window.setTimeout(() => {
        const active = getState()?.ui?.activeSection === 'clinical-history';
        if (!active) {
            scheduledSelection = '';
            return;
        }
        loadCase(preferredCaseId).finally(() => {
            scheduledSelection = '';
        });
    }, 0);
}

function bindEvents() {
    const root = document.getElementById('clinical-history');
    if (!(root instanceof HTMLElement) || root.dataset.mediaFlowBound === 'true') {
        return;
    }

    root.addEventListener('click', async (event) => {
        const queueTarget =
            event.target instanceof Element
                ? event.target.closest('[data-media-case-id]')
                : null;
        if (queueTarget instanceof HTMLButtonElement) {
            event.preventDefault();
            await loadCase(queueTarget.dataset.mediaCaseId);
            return;
        }

        const actionTarget =
            event.target instanceof Element
                ? event.target.closest('[data-media-flow-action]')
                : null;
        if (!(actionTarget instanceof HTMLButtonElement)) {
            const promptTarget =
                event.target instanceof Element
                    ? event.target.closest('[data-media-agent-prompt]')
                    : null;
            if (promptTarget instanceof HTMLButtonElement) {
                event.preventDefault();
                await submitInlineAgentPrompt(
                    promptTarget.dataset.mediaAgentPrompt || ''
                );
                return;
            }
            return;
        }

        event.preventDefault();
        const action = normalizeString(actionTarget.dataset.mediaFlowAction);

        if (action === 'refresh') {
            await refreshCurrentCase();
            return;
        }
        if (action === 'generate-proposal') {
            await generateProposal();
            return;
        }
        if (action === 'review') {
            await reviewProposal(actionTarget.dataset.mediaFlowDecision || '');
            return;
        }
        if (action === 'publication-state') {
            await updatePublicationState(
                actionTarget.dataset.mediaPublicationState || ''
            );
        }
    });

    root.addEventListener('click', async (event) => {
        const agentAction =
            event.target instanceof Element
                ? event.target.closest('[data-media-agent-action]')
                : null;
        if (!(agentAction instanceof HTMLButtonElement)) {
            return;
        }

        event.preventDefault();
        const action = normalizeString(agentAction.dataset.mediaAgentAction);
        if (action === 'open-panel') {
            await openAgentPanelExperience({ focus: true });
            return;
        }
        if (action === 'submit') {
            await submitInlineAgentPrompt();
        }
    });

    root.dataset.mediaFlowBound = 'true';
}

export function renderClinicalMediaFlow() {
    const state = getState();
    const meta = readMeta(state);
    const slice = getSlice(state);
    const current =
        slice.current && typeof slice.current === 'object' ? slice.current : null;
    const queue = normalizeList(meta.queue);

    setText(
        '#clinicalMediaFlowQueueMeta',
        `${queue.length} caso(s) con media privada disponible para curacion editorial.`
    );
    setText(
        '#clinicalMediaFlowStatusChip',
        current
            ? formatPolicyStatus(current?.policy?.status)
            : 'Sin caso'
    );
    document
        .getElementById('clinicalMediaFlowStatusChip')
        ?.setAttribute(
            'data-tone',
            policyTone(current?.policy?.status || 'neutral')
        );
    setText(
        '#clinicalMediaFlowStatusMeta',
        current
            ? `${normalizeString(current?.publication?.status) || 'draft'} · ${
                  normalizeString(current?.proposal?.recommendation) ||
                  'needs_review'
              }`
            : slice.error || 'Esperando seleccion'
    );
    setText(
        '#clinicalMediaFlowCaseMeta',
        current
            ? `${normalizeString(current?.summary?.headline) || current.caseId} · ${
                  normalizeString(current?.service?.label) || 'Caso dermatologico'
              }`
            : 'OpenClaw prepara comparativas, copy y paquete publico antes de publicar.'
    );

    const refreshBtn = document.getElementById('clinicalMediaFlowRefreshBtn');
    const generateBtn = document.getElementById('clinicalMediaFlowGenerateBtn');
    if (refreshBtn instanceof HTMLButtonElement) {
        refreshBtn.disabled = !current || slice.loading || slice.saving;
    }
    if (generateBtn instanceof HTMLButtonElement) {
        generateBtn.disabled = !slice.selectedCaseId || slice.generating || slice.saving;
    }

    setHtml(
        '#clinicalMediaFlowQueueList',
        buildQueueList(meta, normalizeString(slice.selectedCaseId), slice.loading)
    );
    setHtml('#clinicalMediaFlowConsentStrip', buildConsentStrip(current));
    setHtml('#clinicalMediaFlowAssetGrid', buildAssetGrid(current));
    setHtml(
        '#clinicalMediaFlowAgentSurface',
        buildInlineAgentSurface(current, slice, state)
    );
    setHtml('#clinicalMediaFlowProposalForm', buildProposalForm(current, slice));
    setHtml('#clinicalMediaFlowTimeline', buildTimeline(current));

    bindEvents();
    ensureSelection();
}
