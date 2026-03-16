import { navigateToSection } from '../../core/boot/navigation.js';
import { setAppointmentFilter } from '../../sections/appointments.js';
import { focusNextPendingCallback } from '../../sections/callbacks/actions.js';
import { setCallbacksFilter } from '../../sections/callbacks.js';
import { selectAvailabilityDate } from '../../sections/availability.js';
import {
    applyFilter as filterAppointments,
    applySearch as searchAppointments,
    sortItems as sortAppointments,
} from '../../sections/appointments/selectors.js';
import {
    applyFilter as filterCallbacks,
    applySearch as searchCallbacks,
    sortItems as sortCallbacks,
} from '../../sections/callbacks/selectors.js';
import { setQueueFilter } from './queue.js';
import { queueFilter, queueSearch } from './queue/selectors/filters.js';
import { hideAgentPanel, showAgentPanel } from '../../ui/frame.js';
import { apiRequest } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';
import {
    escapeHtml,
    formatDateTime,
    qs,
    setHtml,
    setText,
} from '../ui/render.js';

const LIVE_SYNC_INTERVAL_MS = 15000;

let liveSyncTimer = 0;
let liveSyncInFlight = false;

function patchAgent(patch) {
    updateState((state) => ({
        ...state,
        agent: {
            ...state.agent,
            ...patch,
        },
    }));
}

function clearAgentSnapshot({ keepOpen = false } = {}) {
    updateState((state) => ({
        ...state,
        agent: {
            ...state.agent,
            open: keepOpen ? state.agent.open : false,
            bootstrapped: false,
            starting: false,
            submitting: false,
            syncing: false,
            syncState: 'idle',
            lastSyncAt: 0,
            session: null,
            context: null,
            messages: [],
            turns: [],
            toolCalls: [],
            approvals: [],
            events: [],
            outbox: [],
            health: null,
            tools: [],
            lastError: '',
        },
    }));
}

function resolveSnapshot(payload) {
    if (payload?.session?.session) {
        return payload.session;
    }
    if (payload?.session && payload?.messages) {
        return payload;
    }
    return null;
}

function syncSnapshot(snapshot, extra = {}) {
    if (!snapshot) return;
    const syncAt = Date.parse(
        String(
            snapshot?.syncAt ||
                snapshot?.session?.updatedAt ||
                snapshot?.health?.relay?.updatedAt ||
                ''
        )
    );
    updateState((state) => ({
        ...state,
        agent: {
            ...state.agent,
            bootstrapped: true,
            starting: false,
            submitting: false,
            syncing: false,
            syncState: snapshot?.session ? 'live' : 'idle',
            lastSyncAt: Number.isFinite(syncAt) ? syncAt : Date.now(),
            session: snapshot.session || null,
            context: snapshot.context || null,
            messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
            turns: Array.isArray(snapshot.turns) ? snapshot.turns : [],
            toolCalls: Array.isArray(snapshot.toolCalls)
                ? snapshot.toolCalls
                : [],
            approvals: Array.isArray(snapshot.approvals)
                ? snapshot.approvals
                : [],
            events: Array.isArray(snapshot.events) ? snapshot.events : [],
            outbox: Array.isArray(snapshot.outbox) ? snapshot.outbox : [],
            health: snapshot.health || null,
            tools: Array.isArray(snapshot.tools) ? snapshot.tools : [],
            lastError: '',
            ...extra,
        },
    }));
}

function normalizeSection(section) {
    const value = String(section || '')
        .trim()
        .toLowerCase();
    return [
        'dashboard',
        'callbacks',
        'appointments',
        'availability',
        'reviews',
        'queue',
        'clinical-history',
    ].includes(value)
        ? value
        : 'dashboard';
}

function normalizeWorkspace(workspace) {
    const value = String(workspace || '')
        .trim()
        .toLowerCase();
    return value === 'media-flow' || value === 'media_flow'
        ? 'media-flow'
        : value === 'review'
          ? 'review'
          : '';
}

function normalizeStringList(value) {
    return Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
}

export function canUseAgent(state = getState()) {
    return (
        state?.auth?.authenticated === true &&
        state?.auth?.capabilities?.adminAgent === true
    );
}

function deriveVisibleCallbacks(state) {
    const workerMode = String(state.data?.leadOpsMeta?.worker?.mode || '');
    const filtered = filterCallbacks(
        state.data.callbacks || [],
        state.callbacks.filter
    );
    const searched = searchCallbacks(
        filtered,
        state.callbacks.search,
        workerMode
    );
    return sortCallbacks(searched, state.callbacks.sort);
}

function deriveVisibleAppointments(state) {
    const filtered = filterAppointments(
        state.data.appointments || [],
        state.appointments.filter
    );
    const searched = searchAppointments(filtered, state.appointments.search);
    return sortAppointments(searched, state.appointments.sort);
}

export function buildAgentContextFromState(state = getState()) {
    const section = normalizeSection(state.ui.activeSection);
    const context = {
        section,
        workspace: '',
        selectedEntity: {
            type: '',
            id: 0,
            ref: '',
            label: '',
        },
        filters: {},
        visibleIds: [],
        caseId: '',
        proposalId: '',
        selectedAssetIds: [],
        domainContext: {},
        operatorCapabilities: {
            read: true,
            ui: true,
            writeInternal: true,
            external: false,
        },
        adminHealth: {
            dataUpdatedAt: Number(state.ui.lastRefreshAt || 0),
            availabilityMode: state.data?.availabilityMeta?.mode || 'unknown',
            leadOpsWorkerMode:
                state.data?.leadOpsMeta?.worker?.mode || 'unknown',
            queueUpdatedAt:
                state.data?.queueMeta?.updatedAt ||
                state.data?.queueMeta?.updated_at ||
                '',
            queueSyncMode: state.queue?.syncMode || 'unknown',
        },
    };

    if (section === 'callbacks') {
        const items = deriveVisibleCallbacks(state);
        const selectedId = Number(
            state.callbacks.selected?.[0] || items[0]?.id || 0
        );
        const selected =
            items.find((item) => Number(item.id || 0) === selectedId) || null;
        context.selectedEntity = selected
            ? {
                  type: 'callback',
                  id: Number(selected.id || 0),
                  label:
                      selected.preferencia ||
                      selected.telefono ||
                      `Callback ${selected.id}`,
              }
            : context.selectedEntity;
        context.filters = {
            filter: state.callbacks.filter,
            search: state.callbacks.search,
            sort: state.callbacks.sort,
        };
        context.visibleIds = items.map((item) => Number(item.id || 0));
    } else if (section === 'appointments') {
        const items = deriveVisibleAppointments(state);
        const selected = items[0] || null;
        context.selectedEntity = selected
            ? {
                  type: 'appointment',
                  id: Number(selected.id || 0),
                  label: selected.name || `Cita ${selected.id}`,
              }
            : context.selectedEntity;
        context.filters = {
            filter: state.appointments.filter,
            search: state.appointments.search,
            sort: state.appointments.sort,
            density: state.appointments.density,
        };
        context.visibleIds = items.map((item) => Number(item.id || 0));
    } else if (section === 'reviews') {
        const items = Array.isArray(state.data.reviews)
            ? state.data.reviews
            : [];
        const selected = items[0] || null;
        context.selectedEntity = selected
            ? {
                  type: 'review',
                  id: Number(selected.id || 0),
                  label: selected.name || `Reseña ${selected.id}`,
              }
            : context.selectedEntity;
        context.visibleIds = items.map((item) => Number(item.id || 0));
    } else if (section === 'availability') {
        const day = String(state.availability.selectedDate || '');
        context.selectedEntity = day
            ? {
                  type: 'availability_day',
                  id: 0,
                  label: day,
              }
            : context.selectedEntity;
        context.filters = {
            selectedDate: day,
            monthAnchor:
                state.availability.monthAnchor instanceof Date
                    ? state.availability.monthAnchor.toISOString()
                    : '',
        };
        context.visibleIds = Object.keys(state.data.availability || {}).map(
            (value) => Number.parseInt(String(value).replaceAll('-', ''), 10)
        );
    } else if (section === 'queue') {
        const filtered = queueFilter(
            state.data.queueTickets || [],
            state.queue.filter
        );
        const visible = queueSearch(filtered, state.queue.search);
        const selectedId = Number(
            state.queue.selected?.[0] || visible[0]?.id || 0
        );
        const selected =
            visible.find((item) => Number(item.id || 0) === selectedId) || null;
        context.selectedEntity = selected
            ? {
                  type: 'queue_ticket',
                  id: Number(selected.id || 0),
                  label:
                      selected.ticketCode ||
                      selected.patientInitials ||
                      `Ticket ${selected.id}`,
              }
            : context.selectedEntity;
        context.filters = {
            filter: state.queue.filter,
            search: state.queue.search,
            syncMode: state.queue.syncMode,
        };
        context.visibleIds = visible.map((item) =>
            Number(item.id || item.ticketId || 0)
        );
    } else if (section === 'clinical-history') {
        const reviewQueue = Array.isArray(
            state.data?.clinicalHistoryMeta?.reviewQueue
        )
            ? state.data.clinicalHistoryMeta.reviewQueue
            : [];
        const mediaQueue = Array.isArray(state.data?.mediaFlowMeta?.queue)
            ? state.data.mediaFlowMeta.queue
            : [];
        const activeWorkspace =
            normalizeWorkspace(state.clinicalHistory?.activeWorkspace) ||
            'review';
        const currentReview =
            state.clinicalHistory?.current &&
            typeof state.clinicalHistory.current === 'object'
                ? state.clinicalHistory.current
                : null;
        const currentDraft =
            state.clinicalHistory?.draftForm &&
            typeof state.clinicalHistory.draftForm === 'object'
                ? state.clinicalHistory.draftForm
                : null;
        const selectedSessionId = String(
            currentReview?.session?.sessionId ||
                state.clinicalHistory?.selectedSessionId ||
                currentDraft?.sessionId ||
                ''
        ).trim();
        const selectedReviewRow =
            reviewQueue.find(
                (item) =>
                    String(item?.sessionId || '').trim() === selectedSessionId
            ) ||
            reviewQueue[0] ||
            null;
        const reviewCaseId = String(
            currentReview?.session?.caseId ||
                currentDraft?.caseId ||
                selectedReviewRow?.caseId ||
                ''
        ).trim();
        const reviewLabel = String(
            currentReview?.session?.patient?.name ||
                selectedReviewRow?.patientName ||
                reviewCaseId ||
                ''
        ).trim();
        const currentCase =
            state.caseMediaFlow?.current &&
            typeof state.caseMediaFlow.current === 'object'
                ? state.caseMediaFlow.current
                : null;
        const caseId = String(
            currentCase?.caseId ||
                state.caseMediaFlow?.selectedCaseId ||
                reviewCaseId ||
                mediaQueue[0]?.caseId ||
                ''
        ).trim();
        const proposal =
            currentCase?.proposal && typeof currentCase.proposal === 'object'
                ? currentCase.proposal
                : null;
        const selectedAssetIds = normalizeStringList(
            proposal?.selectedAssetIds ||
                currentCase?.mediaAssets?.map?.((asset) => asset?.assetId)
        );
        if (activeWorkspace === 'media-flow') {
            context.workspace = caseId ? 'media-flow' : 'review';
            context.caseId = caseId;
            context.proposalId = String(proposal?.proposalId || '').trim();
            context.selectedAssetIds = selectedAssetIds;
            context.selectedEntity = caseId
                ? {
                      type: 'case_media',
                      id: 0,
                      ref: caseId,
                      label:
                          String(currentCase?.summary?.headline || '').trim() ||
                          reviewLabel ||
                          caseId,
                  }
                : context.selectedEntity;
            context.filters = {
                workspace: context.workspace,
                publicationStatus: String(
                    currentCase?.publication?.status || ''
                ).trim(),
                policyStatus: String(currentCase?.policy?.status || '').trim(),
            };
            context.visibleIds = mediaQueue
                .map((item) => String(item?.caseId || '').trim())
                .filter(Boolean);
        } else {
            context.workspace = 'review';
            context.caseId = reviewCaseId || caseId;
            context.proposalId = '';
            context.selectedAssetIds = [];
            context.selectedEntity = selectedSessionId
                ? {
                      type: 'clinical_session',
                      id: 0,
                      ref: selectedSessionId,
                      label: reviewLabel || selectedSessionId,
                  }
                : context.caseId
                  ? {
                        type: 'clinical_case',
                        id: 0,
                        ref: context.caseId,
                        label: reviewLabel || context.caseId,
                    }
                  : context.selectedEntity;
            context.filters = {
                workspace: 'review',
                queueFilter: String(
                    state.clinicalHistory?.queueFilter || 'all'
                ).trim(),
                reviewStatus: String(
                    currentReview?.draft?.reviewStatus ||
                        selectedReviewRow?.reviewStatus ||
                        ''
                ).trim(),
            };
            context.visibleIds = reviewQueue
                .map((item) => String(item?.sessionId || '').trim())
                .filter(Boolean);
        }
        context.domainContext = {
            sessionId: selectedSessionId,
            caseId: context.caseId,
            proposalId: context.proposalId,
            selectedAssetIds: context.selectedAssetIds,
        };
    }

    return context;
}

function mergeAgentContext(baseContext, override = {}) {
    const base =
        baseContext && typeof baseContext === 'object' ? baseContext : {};
    const patch = override && typeof override === 'object' ? override : {};
    const selectedEntity =
        patch.selectedEntity && typeof patch.selectedEntity === 'object'
            ? patch.selectedEntity
            : {};
    const domainContext =
        patch.domainContext && typeof patch.domainContext === 'object'
            ? patch.domainContext
            : {};
    const next = {
        ...base,
        ...patch,
        selectedEntity: {
            ...(base.selectedEntity || {}),
            ...selectedEntity,
        },
        domainContext: {
            ...(base.domainContext || {}),
            ...domainContext,
        },
    };

    next.section = normalizeSection(next.section);
    next.caseId = String(
        next.caseId ||
            next.domainContext?.caseId ||
            next.selectedEntity?.ref ||
            ''
    ).trim();
    next.workspace =
        normalizeWorkspace(
            next.workspace || next.domainContext?.workspace || ''
        ) ||
        (next.section === 'clinical-history' && next.caseId ? 'review' : '');
    next.proposalId = String(
        next.proposalId || next.domainContext?.proposalId || ''
    ).trim();
    next.selectedAssetIds = normalizeStringList(
        next.selectedAssetIds || next.domainContext?.selectedAssetIds || []
    );
    next.visibleIds = Array.isArray(next.visibleIds)
        ? next.visibleIds
              .map((item) => String(item ?? '').trim())
              .filter(Boolean)
        : [];
    next.domainContext = {
        ...next.domainContext,
        caseId: next.caseId,
        proposalId: next.proposalId,
        selectedAssetIds: next.selectedAssetIds,
    };

    return next;
}

function renderMessageList(messages) {
    if (!messages.length) {
        return '<p class="admin-agent-empty">Sin mensajes todavia.</p>';
    }

    return messages
        .slice(-10)
        .map(
            (message) => `
                <article class="admin-agent-log__item" data-role="${escapeHtml(
                    message.role || 'assistant'
                )}">
                    <div class="admin-agent-log__meta">
                        <strong>${escapeHtml(
                            message.role === 'user' ? 'Operador' : 'Agente'
                        )}</strong>
                        <span>${escapeHtml(
                            formatDateTime(message.createdAt || '')
                        )}</span>
                    </div>
                    <p>${escapeHtml(message.content || '')}</p>
                </article>
            `
        )
        .join('');
}

function renderToolCallList(toolCalls) {
    if (!toolCalls.length) {
        return '<p class="admin-agent-empty">Sin tool calls registradas.</p>';
    }

    return toolCalls
        .slice(-8)
        .reverse()
        .map(
            (toolCall) => `
                <article class="admin-agent-list__item">
                    <div class="admin-agent-list__line">
                        <strong>${escapeHtml(toolCall.tool || '')}</strong>
                        <span class="admin-agent-badge" data-state="${escapeHtml(
                            toolCall.status || 'planned'
                        )}">${escapeHtml(toolCall.status || 'planned')}</span>
                    </div>
                    <p>${escapeHtml(toolCall.reason || toolCall.error || '')}</p>
                </article>
            `
        )
        .join('');
}

function renderApprovalList(approvals) {
    const pending = approvals.filter(
        (approval) => String(approval.status || '') === 'pending'
    );
    if (!pending.length) {
        return '<p class="admin-agent-empty">No hay aprobaciones pendientes.</p>';
    }

    return pending
        .map(
            (approval) => `
                <article class="admin-agent-list__item">
                    <div class="admin-agent-list__line">
                        <strong>${escapeHtml(approval.reason || 'Approval')}</strong>
                        <span>${escapeHtml(
                            formatDateTime(approval.expiresAt || '')
                        )}</span>
                    </div>
                    <p>${escapeHtml(
                        [approval.tool, approval.channel, approval.template]
                            .filter(Boolean)
                            .join(' · ')
                    )}</p>
                    <button
                        type="button"
                        data-action="admin-agent-approve"
                        data-approval-id="${escapeHtml(approval.approvalId || '')}"
                    >
                        Aprobar
                    </button>
                </article>
            `
        )
        .join('');
}

function renderOutboxList(outbox) {
    if (!outbox.length) {
        return '<p class="admin-agent-empty">Sin salidas externas registradas.</p>';
    }

    return outbox
        .slice(0, 8)
        .map(
            (entry) => `
                <article class="admin-agent-list__item">
                    <div class="admin-agent-list__line">
                        <strong>${escapeHtml(
                            entry.channel || entry.tool || 'outbox'
                        )}</strong>
                        <span class="admin-agent-badge" data-state="${escapeHtml(
                            entry.status || 'queued'
                        )}">${escapeHtml(entry.status || 'queued')}</span>
                    </div>
                    <p>${escapeHtml(
                        [entry.template, entry.message]
                            .filter(Boolean)
                            .join(' · ')
                    )}</p>
                    <small>${escapeHtml(
                        formatDateTime(entry.createdAt || '')
                    )}</small>
                </article>
            `
        )
        .join('');
}

function renderEventList(events) {
    if (!events.length) {
        return '<p class="admin-agent-empty">Sin eventos auditables.</p>';
    }

    return events
        .slice(-10)
        .reverse()
        .map(
            (event) => `
                <article class="admin-agent-list__item">
                    <div class="admin-agent-list__line">
                        <strong>${escapeHtml(event.event || '')}</strong>
                        <span class="admin-agent-badge" data-state="${escapeHtml(
                            event.status || 'completed'
                        )}">${escapeHtml(event.status || 'completed')}</span>
                    </div>
                    <p>${escapeHtml(formatDateTime(event.createdAt || ''))}</p>
                </article>
            `
        )
        .join('');
}

export function renderAgentPanel() {
    const state = getState();
    const context =
        agentContextFromSnapshot(state.agent?.context) ||
        buildAgentContextFromState(state);
    const agent = state.agent || {};
    const hasAccess = canUseAgent(state);
    const relayMode = String(agent.health?.relay?.mode || 'disabled');
    const sessionStatus = String(agent.session?.status || 'idle');
    const messages = Array.isArray(agent.messages) ? agent.messages : [];
    const toolCalls = Array.isArray(agent.toolCalls) ? agent.toolCalls : [];
    const approvals = Array.isArray(agent.approvals) ? agent.approvals : [];
    const events = Array.isArray(agent.events) ? agent.events : [];
    const outbox = Array.isArray(agent.outbox) ? agent.outbox : [];
    const isAuthenticated = state.auth?.authenticated === true;
    const syncState = String(agent.syncState || 'idle');
    const lastSyncAt =
        Number(agent.lastSyncAt || 0) > 0
            ? formatDateTime(new Date(agent.lastSyncAt).toISOString())
            : 'Sin sincronizacion activa.';

    setText(
        '#adminAgentPanelSummary',
        !hasAccess
            ? 'OpenClaw disponible solo para admin/editorial.'
            : agent.lastError
              ? `Error: ${agent.lastError}`
              : sessionStatus === 'idle'
                ? 'Sesion inactiva. Abre el copiloto para trabajar con contexto del admin.'
                : `Sesion operativa auditada con tools tipadas${relayMode !== 'online' ? ' en modo degradado' : ''}.`
    );
    setText(
        '#adminAgentContextSummary',
        `${context.section}${context.workspace ? ` / ${context.workspace}` : ''} · visibles ${context.visibleIds.length}`
    );
    setText(
        '#adminAgentContextMeta',
        context.caseId
            ? `case ${context.caseId}${context.proposalId ? ` · ${context.proposalId}` : ''}`
            : context.selectedEntity?.id
              ? `${context.selectedEntity.type} ${context.selectedEntity.id} · ${context.selectedEntity.label}`
              : context.selectedEntity?.ref
                ? `${context.selectedEntity.type} ${context.selectedEntity.ref} · ${context.selectedEntity.label}`
                : 'Sin entidad seleccionada; el agente usara el contexto de seccion.'
    );
    setText('#adminAgentSessionState', sessionStatus);
    setText(
        '#adminAgentSessionMeta',
        agent.session?.sessionId
            ? `Sesion ${agent.session.sessionId.slice(0, 12)} · ${agent.session.riskMode || 'autopilot_partial'}`
            : 'Sin hilo operativo abierto.'
    );
    setText('#adminAgentSyncState', syncState);
    setText(
        '#adminAgentLiveMeta',
        syncState === 'error'
            ? 'La sincronizacion live fallo; usa Actualizar para reintentar.'
            : `Ultima sincronizacion: ${lastSyncAt}`
    );
    setText(
        '#adminAgentConversationMeta',
        `${messages.length} mensaje(s) auditados`
    );
    setText(
        '#adminAgentPlanMeta',
        `${toolCalls.length} tool call(s) en timeline`
    );
    setText(
        '#adminAgentApprovalMeta',
        `${approvals.filter((item) => item.status === 'pending').length} pendientes`
    );
    setText('#adminAgentTimelineMeta', `${events.length} evento(s)`);
    setText(
        '#adminAgentOutboxMeta',
        `${outbox.filter((item) => item.status === 'queued').length} queued · ${outbox.length} total`
    );
    setText('#adminAgentRelayBadge', `relay ${relayMode}`);

    const relayBadge = qs('#adminAgentRelayBadge');
    if (relayBadge instanceof HTMLElement) {
        relayBadge.setAttribute('data-state', relayMode);
    }

    const openButton = qs('[data-action="open-agent-panel"]');
    if (openButton instanceof HTMLButtonElement) {
        openButton.hidden = !hasAccess;
        openButton.disabled = !hasAccess;
    }

    setHtml('#adminAgentConversation', renderMessageList(messages));
    setHtml('#adminAgentToolPlan', renderToolCallList(toolCalls));
    setHtml('#adminAgentApprovalQueue', renderApprovalList(approvals));
    setHtml('#adminAgentEventTimeline', renderEventList(events));
    setHtml('#adminAgentOutboxList', renderOutboxList(outbox));

    const prompt = qs('#adminAgentPrompt');
    if (prompt instanceof HTMLTextAreaElement) {
        prompt.disabled =
            !isAuthenticated || !hasAccess || agent.submitting === true;
    }

    const submit = qs('#adminAgentSubmitBtn');
    if (submit instanceof HTMLButtonElement) {
        submit.disabled =
            !isAuthenticated || !hasAccess || agent.submitting === true;
        submit.textContent = agent.submitting ? 'Procesando...' : 'Ejecutar';
    }
}

function agentContextFromSnapshot(context) {
    if (!context || typeof context !== 'object') {
        return null;
    }
    return mergeAgentContext(buildAgentContextFromState(), context);
}

function stopAgentLiveSync() {
    if (liveSyncTimer) {
        window.clearInterval(liveSyncTimer);
        liveSyncTimer = 0;
    }
    liveSyncInFlight = false;
}

function ensureAgentLiveSync() {
    stopAgentLiveSync();
    if (
        !canUseAgent(getState()) ||
        getState().agent?.open !== true ||
        !getState().agent?.session?.sessionId
    ) {
        return;
    }

    liveSyncTimer = window.setInterval(() => {
        refreshAgentLiveState({ silent: true }).catch(() => {});
    }, LIVE_SYNC_INTERVAL_MS);
}

export async function refreshAgentLiveState({ silent = false } = {}) {
    const state = getState();
    const sessionId = String(state.agent?.session?.sessionId || '');
    if (
        !sessionId ||
        !canUseAgent(state) ||
        state.agent?.open !== true ||
        liveSyncInFlight
    ) {
        return null;
    }

    liveSyncInFlight = true;
    if (!silent) {
        patchAgent({ syncing: true, syncState: 'syncing', lastError: '' });
        renderAgentPanel();
    }

    try {
        const response = await apiRequest('admin-agent-events', {
            query: { sessionId },
        });
        const snapshot =
            resolveSnapshot(response?.data) || response?.data || null;
        if (snapshot) {
            syncSnapshot(snapshot, { syncState: 'live' });
        } else {
            patchAgent({
                syncing: false,
                syncState: 'idle',
                lastSyncAt: Date.now(),
            });
        }
        renderAgentPanel();
        return snapshot;
    } catch (error) {
        patchAgent({
            syncing: false,
            syncState: 'error',
            lastSyncAt: Date.now(),
            ...(silent
                ? {}
                : {
                      lastError:
                          error?.message ||
                          'No se pudo sincronizar la sesion del agente',
                  }),
        });
        renderAgentPanel();
        throw error;
    } finally {
        liveSyncInFlight = false;
    }
}

export async function hydrateAgentSession() {
    const state = getState();
    if (!canUseAgent(state)) {
        stopAgentLiveSync();
        clearAgentSnapshot({ keepOpen: state.agent?.open === true });
        renderAgentPanel();
        return null;
    }

    try {
        const response = await apiRequest('admin-agent-status');
        const snapshot =
            resolveSnapshot(response?.data) || response?.data || null;
        if (snapshot?.session || snapshot?.health) {
            syncSnapshot(snapshot);
            ensureAgentLiveSync();
        } else {
            stopAgentLiveSync();
            clearAgentSnapshot({ keepOpen: state.agent?.open === true });
        }
        renderAgentPanel();
        return snapshot;
    } catch (error) {
        stopAgentLiveSync();
        patchAgent({
            bootstrapped: true,
            syncing: false,
            syncState: 'error',
            lastError:
                error?.message || 'No se pudo cargar la sesion del agente',
        });
        renderAgentPanel();
        return null;
    }
}

export async function ensureAgentSession(options = {}) {
    const state = getState();
    if (!canUseAgent(state)) {
        throw new Error('OpenClaw disponible solo para admin/editorial');
    }
    if (state.agent?.session?.sessionId) {
        return state.agent.session.sessionId;
    }

    const initialContext = mergeAgentContext(
        buildAgentContextFromState(state),
        options?.contextOverride || state.agent?.context || {}
    );

    patchAgent({ starting: true, lastError: '' });
    renderAgentPanel();

    try {
        const response = await apiRequest('admin-agent-session-start', {
            method: 'POST',
            body: {
                riskMode: 'autopilot_partial',
                context: initialContext,
            },
        });
        const snapshot =
            resolveSnapshot(response?.data) || response?.data || null;
        syncSnapshot(snapshot);
        ensureAgentLiveSync();
        renderAgentPanel();
        return snapshot?.session?.sessionId || '';
    } catch (error) {
        patchAgent({
            starting: false,
            lastError:
                error?.message || 'No se pudo iniciar la sesion del agente',
        });
        renderAgentPanel();
        throw error;
    }
}

async function applyClientActions(actions) {
    for (const action of actions || []) {
        const tool = String(action?.tool || '');
        const args = action?.args || {};

        if (tool === 'ui.navigate') {
            await navigateToSection(args.section || 'dashboard');
            continue;
        }

        if (tool === 'ui.set_section_filter') {
            const section = String(args.section || 'dashboard');
            const filter = String(args.filter || 'all');
            if (getState().ui.activeSection !== section) {
                await navigateToSection(section);
            }
            if (section === 'callbacks') {
                setCallbacksFilter(filter);
            } else if (section === 'appointments') {
                setAppointmentFilter(filter);
            } else if (section === 'queue') {
                setQueueFilter(filter);
            }
            continue;
        }

        if (tool === 'ui.select_availability_date') {
            if (getState().ui.activeSection !== 'availability') {
                await navigateToSection('availability');
            }
            selectAvailabilityDate(String(args.date || ''));
            continue;
        }

        if (tool === 'ui.focus_next_pending_callback') {
            if (getState().ui.activeSection !== 'callbacks') {
                await navigateToSection('callbacks');
            }
            focusNextPendingCallback();
        }
    }
}

export async function submitAgentPrompt(message, options = {}) {
    const prompt = String(message || '').trim();
    if (!prompt) {
        throw new Error('Escribe una instruccion para el copiloto');
    }

    const state = getState();
    if (!canUseAgent(state)) {
        throw new Error('OpenClaw disponible solo para admin/editorial');
    }

    const sessionId = await ensureAgentSession({
        contextOverride: options?.contextOverride || {},
    });
    if (!sessionId) {
        throw new Error('No se pudo preparar la sesion del agente');
    }

    const context = mergeAgentContext(
        buildAgentContextFromState(),
        options?.contextOverride || {}
    );

    patchAgent({ submitting: true, lastError: '' });
    renderAgentPanel();

    try {
        const response = await apiRequest('admin-agent-turn', {
            method: 'POST',
            body: {
                sessionId,
                message: prompt,
                context,
                workspace: context.workspace,
                domainContext: context.domainContext,
                caseId: context.caseId,
                proposalId: context.proposalId,
                selectedAssetIds: context.selectedAssetIds,
            },
        });
        const payload = response?.data || {};
        const snapshot = resolveSnapshot(payload) || null;
        if (snapshot) {
            syncSnapshot(snapshot);
        }
        await applyClientActions(payload?.clientActions || []);
        ensureAgentLiveSync();
        renderAgentPanel();
        return payload;
    } catch (error) {
        patchAgent({
            submitting: false,
            lastError:
                error?.message || 'No se pudo procesar el turno del agente',
        });
        renderAgentPanel();
        throw error;
    }
}

export async function approveAgentAction(approvalId) {
    const state = getState();
    const sessionId = state.agent?.session?.sessionId || '';
    if (!sessionId) {
        throw new Error('No hay sesion activa para aprobar');
    }

    patchAgent({ submitting: true, lastError: '' });
    renderAgentPanel();

    try {
        const response = await apiRequest('admin-agent-approve', {
            method: 'POST',
            body: {
                sessionId,
                approvalId,
            },
        });
        const payload = response?.data || {};
        const snapshot = resolveSnapshot(payload) || payload?.session || null;
        if (snapshot) {
            syncSnapshot(snapshot);
        }
        ensureAgentLiveSync();
        renderAgentPanel();
        return payload;
    } catch (error) {
        patchAgent({
            submitting: false,
            lastError: error?.message || 'No se pudo aprobar la accion',
        });
        renderAgentPanel();
        throw error;
    }
}

export async function cancelAgentSession() {
    const state = getState();
    const sessionId = state.agent?.session?.sessionId || '';
    if (!sessionId) {
        clearAgentSnapshot({ keepOpen: true });
        renderAgentPanel();
        return null;
    }

    patchAgent({ submitting: true, lastError: '' });
    renderAgentPanel();

    try {
        const response = await apiRequest('admin-agent-cancel', {
            method: 'POST',
            body: {
                sessionId,
            },
        });
        const snapshot =
            resolveSnapshot(response?.data) || response?.data || null;
        syncSnapshot(snapshot);
        stopAgentLiveSync();
        renderAgentPanel();
        return snapshot;
    } catch (error) {
        patchAgent({
            submitting: false,
            lastError: error?.message || 'No se pudo cancelar la sesion',
        });
        renderAgentPanel();
        throw error;
    }
}

export async function openAgentPanelExperience({
    focus = false,
    contextOverride = {},
} = {}) {
    if (!canUseAgent(getState())) {
        renderAgentPanel();
        return null;
    }
    const nextContext = mergeAgentContext(
        buildAgentContextFromState(getState()),
        contextOverride && typeof contextOverride === 'object'
            ? contextOverride
            : {}
    );
    patchAgent({ open: true, context: nextContext });
    showAgentPanel();
    renderAgentPanel();
    await hydrateAgentSession();
    patchAgent({ context: nextContext });
    renderAgentPanel();

    if (focus) {
        const input = qs('#adminAgentPrompt');
        if (input instanceof HTMLTextAreaElement) {
            input.focus();
        }
    }
}

export function closeAgentPanelExperience() {
    stopAgentLiveSync();
    patchAgent({ open: false });
    hideAgentPanel();
    renderAgentPanel();
}

export async function focusAgentPrompt() {
    if (!canUseAgent(getState())) {
        return null;
    }
    await openAgentPanelExperience({ focus: true });
}

export function clearAgentState() {
    stopAgentLiveSync();
    clearAgentSnapshot();
    hideAgentPanel();
    renderAgentPanel();
}
