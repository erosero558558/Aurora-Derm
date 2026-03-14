import { getState } from '../../../shared/core/store.js';
import { refreshAdminData } from '../../../shared/modules/data.js';
import { runWhatsappOpenclawOpsAction } from '../../../shared/modules/data/remote.js';
import { createToast, setHtml } from '../../../shared/ui/render.js';
import { buildAttentionItems, buildOperations } from '../markup.js';
import {
    buildClinicalHistoryActions,
    buildClinicalHistoryEventItems,
    buildClinicalHistoryQueueItems,
    buildWhatsappOpsActions,
    buildWhatsappOpsItems,
} from '../markup/actions.js';
import { getDashboardDerivedState } from '../state.js';
import { setFlowMetrics } from './flow.js';
import { setFunnelMetrics } from './funnel.js';
import { setLiveStatus } from './live.js';
import { setOverviewMetrics } from './overview.js';

let whatsappOpsActionBusy = false;

function normalizeNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeStringList(value) {
    return normalizeList(value)
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function normalizeMap(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(
        Object.entries(source).map(([key, entryValue]) => [
            String(key),
            normalizeNumber(entryValue),
        ])
    );
}

function normalizeWhatsappOpenclawOps(rawSnapshot) {
    const snapshot =
        rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const available =
        snapshot.available !== undefined
            ? snapshot.available === true
            : Object.keys(snapshot).length > 0;

    return {
        available,
        statusCode: Number(snapshot.statusCode || 0),
        error: String(snapshot.error || '').trim(),
        configured: snapshot.configured === true,
        configuredMode: String(snapshot.configuredMode || 'disabled'),
        bridgeConfigured: snapshot.bridgeConfigured === true,
        bridgeMode: String(
            snapshot.bridgeMode || (available ? 'pending' : 'offline')
        ),
        bridgeStatus:
            snapshot.bridgeStatus && typeof snapshot.bridgeStatus === 'object'
                ? snapshot.bridgeStatus
                : {},
        pendingOutbox: normalizeNumber(snapshot.pendingOutbox),
        activeConversations: normalizeNumber(snapshot.activeConversations),
        aliveHolds: normalizeNumber(snapshot.aliveHolds),
        bookingsClosed: normalizeNumber(snapshot.bookingsClosed),
        paymentsStarted: normalizeNumber(snapshot.paymentsStarted),
        paymentsCompleted: normalizeNumber(snapshot.paymentsCompleted),
        deliveryFailures: normalizeNumber(snapshot.deliveryFailures),
        automationSuccessRate: Number.isFinite(
            Number(snapshot.automationSuccessRate)
        )
            ? Number(snapshot.automationSuccessRate)
            : 0,
        lastInboundAt: String(snapshot.lastInboundAt || ''),
        lastOutboundAt: String(snapshot.lastOutboundAt || ''),
        pendingOutboxItems: normalizeList(snapshot.pendingOutboxItems),
        failedOutboxItems: normalizeList(snapshot.failedOutboxItems),
        activeHolds: normalizeList(snapshot.activeHolds),
        pendingCheckouts: normalizeList(snapshot.pendingCheckouts),
        conversations: normalizeList(snapshot.conversations),
    };
}

function normalizeClinicalHistoryReviewItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: source.appointmentId ?? null,
        surface: normalizeString(source.surface),
        sessionStatus: normalizeString(source.sessionStatus),
        reviewStatus: normalizeString(source.reviewStatus),
        requiresHumanReview: source.requiresHumanReview === true,
        confidence: Number.isFinite(Number(source.confidence))
            ? Number(source.confidence)
            : 0,
        reviewReasons: normalizeStringList(source.reviewReasons),
        missingFields: normalizeStringList(source.missingFields),
        redFlags: normalizeStringList(source.redFlags),
        pendingAiStatus: normalizeString(source.pendingAiStatus),
        pendingAiJobId: normalizeString(source.pendingAiJobId),
        patientName: normalizeString(source.patientName),
        patientEmail: normalizeString(source.patientEmail),
        patientPhone: normalizeString(source.patientPhone),
        attachmentCount: normalizeNumber(source.attachmentCount),
        summary: normalizeString(source.summary),
        createdAt: normalizeString(source.createdAt),
        updatedAt: normalizeString(source.updatedAt),
    };
}

function normalizeClinicalHistoryEventItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        eventId: normalizeString(source.eventId),
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: source.appointmentId ?? null,
        type: normalizeString(source.type),
        severity: normalizeString(source.severity),
        status: normalizeString(source.status),
        title: normalizeString(source.title),
        message: normalizeString(source.message),
        requiresAction: source.requiresAction === true,
        jobId: normalizeString(source.jobId),
        patientName: normalizeString(source.patientName),
        patientEmail: normalizeString(source.patientEmail),
        patientPhone: normalizeString(source.patientPhone),
        reviewStatus: normalizeString(source.reviewStatus),
        requiresHumanReview: source.requiresHumanReview === true,
        confidence: Number.isFinite(Number(source.confidence))
            ? Number(source.confidence)
            : 0,
        reviewReasons: normalizeStringList(source.reviewReasons),
        createdAt: normalizeString(source.createdAt),
        occurredAt: normalizeString(source.occurredAt),
        acknowledgedAt: normalizeString(source.acknowledgedAt),
        resolvedAt: normalizeString(source.resolvedAt),
    };
}

function normalizeClinicalHistoryMeta(rawSnapshot) {
    const snapshot =
        rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const summarySource =
        snapshot.summary && typeof snapshot.summary === 'object'
            ? snapshot.summary
            : {};
    const sessionsSource =
        summarySource.sessions && typeof summarySource.sessions === 'object'
            ? summarySource.sessions
            : {};
    const draftsSource =
        summarySource.drafts && typeof summarySource.drafts === 'object'
            ? summarySource.drafts
            : {};
    const eventsSource =
        summarySource.events && typeof summarySource.events === 'object'
            ? summarySource.events
            : {};
    const diagnosticsSource =
        summarySource.diagnostics &&
        typeof summarySource.diagnostics === 'object'
            ? summarySource.diagnostics
            : snapshot.diagnostics && typeof snapshot.diagnostics === 'object'
              ? snapshot.diagnostics
              : {};
    const diagnosticsSummarySource =
        diagnosticsSource.summary &&
        typeof diagnosticsSource.summary === 'object'
            ? diagnosticsSource.summary
            : {};

    return {
        summary: {
            configured: summarySource.configured === true,
            sessions: {
                total: normalizeNumber(sessionsSource.total),
                byStatus: normalizeMap(sessionsSource.byStatus),
            },
            drafts: {
                total: normalizeNumber(draftsSource.total),
                byReviewStatus: normalizeMap(draftsSource.byReviewStatus),
                pendingAiCount: normalizeNumber(draftsSource.pendingAiCount),
                reviewQueueCount: normalizeNumber(
                    draftsSource.reviewQueueCount
                ),
            },
            events: {
                total: normalizeNumber(eventsSource.total),
                openCount: normalizeNumber(eventsSource.openCount),
                unreadCount: normalizeNumber(eventsSource.unreadCount),
                byStatus: normalizeMap(eventsSource.byStatus),
                bySeverity: normalizeMap(eventsSource.bySeverity),
                openBySeverity: normalizeMap(eventsSource.openBySeverity),
                byType: normalizeMap(eventsSource.byType),
            },
            reviewQueueCount: normalizeNumber(summarySource.reviewQueueCount),
            latestActivityAt: normalizeString(summarySource.latestActivityAt),
            diagnostics: {
                status: normalizeString(diagnosticsSource.status || 'unknown'),
                healthy: diagnosticsSource.healthy === true,
                summary: {
                    critical: normalizeNumber(
                        diagnosticsSummarySource.critical
                    ),
                    warning: normalizeNumber(diagnosticsSummarySource.warning),
                    info: normalizeNumber(diagnosticsSummarySource.info),
                    totalChecks: normalizeNumber(
                        diagnosticsSummarySource.totalChecks
                    ),
                    totalIssues: normalizeNumber(
                        diagnosticsSummarySource.totalIssues
                    ),
                },
            },
        },
        reviewQueue: normalizeList(snapshot.reviewQueue).map(
            normalizeClinicalHistoryReviewItem
        ),
        events: normalizeList(snapshot.events).map(
            normalizeClinicalHistoryEventItem
        ),
        diagnostics: {
            status: normalizeString(diagnosticsSource.status || 'unknown'),
            healthy: diagnosticsSource.healthy === true,
            summary: {
                critical: normalizeNumber(diagnosticsSummarySource.critical),
                warning: normalizeNumber(diagnosticsSummarySource.warning),
                info: normalizeNumber(diagnosticsSummarySource.info),
                totalChecks: normalizeNumber(
                    diagnosticsSummarySource.totalChecks
                ),
                totalIssues: normalizeNumber(
                    diagnosticsSummarySource.totalIssues
                ),
            },
        },
    };
}

function buildWhatsappOpsActionPayload(button) {
    const payload = {};
    const mappings = [
        ['id', 'whatsappOpsId'],
        ['holdId', 'whatsappOpsHoldId'],
        ['paymentSessionId', 'whatsappOpsPaymentSessionId'],
        ['conversationId', 'whatsappOpsConversationId'],
        ['reason', 'whatsappOpsReason'],
        ['notify', 'whatsappOpsNotify'],
        ['limit', 'whatsappOpsLimit'],
    ];

    mappings.forEach(([targetKey, datasetKey]) => {
        const value = button.dataset[datasetKey];
        if (value !== undefined && value !== '') {
            payload[targetKey] = value;
        }
    });

    return payload;
}

function buildWhatsappOpsToast(action, result) {
    switch (action) {
        case 'requeue_outbox':
            return 'Outbox reencolado para reintento';
        case 'expire_checkout':
            return 'Checkout expirado y slot liberado';
        case 'release_hold':
            return 'Hold liberado desde el panel';
        case 'sweep_stale':
            return `Sweep completado: ${Number(result?.expiredCount || 0)} checkout(s) y ${Number(result?.expiredHolds || 0)} hold(s)`;
        default:
            return 'Operacion OpenClaw completada';
    }
}

async function executeWhatsappOpsAction(button) {
    const action = String(button.dataset.whatsappOpsAction || '').trim();
    if (!action || whatsappOpsActionBusy) {
        return;
    }

    whatsappOpsActionBusy = true;
    if (button instanceof HTMLButtonElement) {
        button.disabled = true;
    }

    try {
        const result = await runWhatsappOpenclawOpsAction(
            action,
            buildWhatsappOpsActionPayload(button)
        );
        await refreshAdminData();
        renderDashboard(getState());
        createToast(buildWhatsappOpsToast(action, result), 'success');
    } catch (error) {
        createToast(
            error?.message || 'No se pudo ejecutar la accion OpenClaw',
            'error'
        );
    } finally {
        whatsappOpsActionBusy = false;
        if (button.isConnected && button instanceof HTMLButtonElement) {
            button.disabled = false;
        }
    }
}

function bindWhatsappOpsActions() {
    const root = document.getElementById('dashboard');
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.whatsappOpsBound === 'true'
    ) {
        return;
    }

    root.addEventListener('click', (event) => {
        const target =
            event.target instanceof Element
                ? event.target.closest('[data-whatsapp-ops-action]')
                : null;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }

        event.preventDefault();
        executeWhatsappOpsAction(target);
    });

    root.dataset.whatsappOpsBound = 'true';
}

export function renderDashboard(state) {
    const dashboardState = {
        ...getDashboardDerivedState(state),
        clinicalHistoryMeta: normalizeClinicalHistoryMeta(
            state?.data?.clinicalHistoryMeta
        ),
        whatsappOpenclawOps: normalizeWhatsappOpenclawOps(
            state?.data?.whatsappOpenclawOps
        ),
    };

    setOverviewMetrics(dashboardState);
    setLiveStatus(dashboardState);
    setFlowMetrics(dashboardState);
    setHtml('#operationActionList', buildOperations(dashboardState));
    setHtml(
        '#dashboardOpenclawOpsActions',
        buildWhatsappOpsActions(dashboardState.whatsappOpenclawOps)
    );
    setHtml(
        '#dashboardOpenclawOpsItems',
        buildWhatsappOpsItems(dashboardState.whatsappOpenclawOps)
    );
    setHtml(
        '#dashboardClinicalHistoryActions',
        buildClinicalHistoryActions(dashboardState)
    );
    setHtml(
        '#dashboardClinicalReviewQueue',
        buildClinicalHistoryQueueItems(dashboardState.clinicalHistoryMeta)
    );
    setHtml(
        '#dashboardClinicalEventFeed',
        buildClinicalHistoryEventItems(dashboardState.clinicalHistoryMeta)
    );
    setHtml('#dashboardAttentionList', buildAttentionItems(dashboardState));
    setFunnelMetrics(dashboardState.funnel);
    bindWhatsappOpsActions();
}
