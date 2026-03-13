import { apiRequest } from '../../core/api-client.js';
import { getState, updateState } from '../../core/store.js';
import { loadLocalAdminFallback, persistLocalAdminData } from './local.js';
import { normalizeAdminDataPayload } from './normalizers.js';
import { writeAdminDataInStore } from './store.js';

async function fetchFunnelMetrics(data) {
    if (data.funnelMetrics) return data.funnelMetrics;
    const funnelPayload = await apiRequest('funnel-metrics').catch(() => null);
    return funnelPayload?.data || null;
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function normalizeWhatsappOpenclawOpsSnapshot(payload, meta = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const hasSourceData = Object.keys(source).length > 0;
    const available =
        meta.available !== undefined ? meta.available === true : hasSourceData;

    return {
        available,
        statusCode: Number(meta.statusCode || 0),
        error: String(meta.error || '').trim(),
        configured: source.configured === true,
        configuredMode: String(source.configuredMode || 'disabled'),
        bridgeConfigured: source.bridgeConfigured === true,
        bridgeMode: String(source.bridgeMode || (available ? 'pending' : 'offline')),
        bridgeStatus:
            source.bridgeStatus && typeof source.bridgeStatus === 'object'
                ? source.bridgeStatus
                : {},
        pendingOutbox: normalizeNumber(source.pendingOutbox),
        activeConversations: normalizeNumber(source.activeConversations),
        aliveHolds: normalizeNumber(source.aliveHolds),
        bookingsClosed: normalizeNumber(source.bookingsClosed),
        paymentsStarted: normalizeNumber(source.paymentsStarted),
        paymentsCompleted: normalizeNumber(source.paymentsCompleted),
        deliveryFailures: normalizeNumber(source.deliveryFailures),
        automationSuccessRate: Number.isFinite(Number(source.automationSuccessRate))
            ? Number(source.automationSuccessRate)
            : 0,
        lastInboundAt: String(source.lastInboundAt || ''),
        lastOutboundAt: String(source.lastOutboundAt || ''),
        pendingOutboxItems: normalizeList(source.pendingOutboxItems),
        failedOutboxItems: normalizeList(source.failedOutboxItems),
        activeHolds: normalizeList(source.activeHolds),
        pendingCheckouts: normalizeList(source.pendingCheckouts),
        conversations: normalizeList(source.conversations),
    };
}

function writeWhatsappOpenclawOpsSnapshot(snapshot) {
    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            whatsappOpenclawOps: snapshot,
        },
    }));
}

async function fetchWhatsappOpenclawOpsSnapshot() {
    try {
        const opsPayload = await apiRequest('whatsapp-openclaw-ops');
        return normalizeWhatsappOpenclawOpsSnapshot(opsPayload?.data || {}, {
            available: true,
            statusCode: 200,
        });
    } catch (error) {
        return normalizeWhatsappOpenclawOpsSnapshot(null, {
            available: false,
            statusCode: Number(error?.status || 0),
            error:
                error?.message || 'No se pudo cargar el snapshot de WhatsApp/OpenClaw',
        });
    }
}

export async function runWhatsappOpenclawOpsAction(action, payload = {}) {
    const safeAction = String(action || '').trim();
    if (!safeAction) {
        throw new Error('Accion OpenClaw requerida');
    }

    const response = await apiRequest('whatsapp-openclaw-ops', {
        method: 'POST',
        body: {
            action: safeAction,
            ...payload,
        },
    });

    return response?.data || {};
}

export async function refreshAdminData() {
    const queueRuntimeRevision = Number(getState().queue?.runtimeRevision || 0);
    try {
        const [dataPayload, healthPayload, whatsappOpenclawOps] = await Promise.all([
            apiRequest('data'),
            apiRequest('health').catch(() => null),
            fetchWhatsappOpenclawOpsSnapshot(),
        ]);

        const data = dataPayload.data || {};
        const fallbackState = loadLocalAdminFallback();
        const normalized = normalizeAdminDataPayload(
            {
                ...data,
                funnelMetrics: await fetchFunnelMetrics(data),
            },
            healthPayload,
            fallbackState
        );

        const { preservedQueueData } = writeAdminDataInStore(normalized, {
            queueRuntimeRevision,
        });
        persistLocalAdminData(normalized);
        writeWhatsappOpenclawOpsSnapshot(whatsappOpenclawOps);
        return {
            ok: true,
            preservedQueueData,
        };
    } catch (_error) {
        const fallback = loadLocalAdminFallback();
        writeAdminDataInStore({
            ...fallback,
            turneroClinicProfileMeta: fallback.turneroClinicProfile
                ? {
                      source: 'fallback_local',
                      cached: true,
                      clinicId: String(
                          fallback.turneroClinicProfile?.clinic_id || ''
                      ).trim(),
                      profileFingerprint: String(
                          fallback.turneroClinicProfileMeta?.profileFingerprint ||
                              ''
                      ).trim(),
                      fetchedAt: String(
                          fallback.turneroClinicProfileMeta?.fetchedAt || ''
                      ).trim(),
                  }
                : null,
        });
        writeWhatsappOpenclawOpsSnapshot(
            normalizeWhatsappOpenclawOpsSnapshot(
                getState().data?.whatsappOpenclawOps || null,
                {
                    available: Boolean(getState().data?.whatsappOpenclawOps),
                }
            )
        );
        return {
            ok: false,
            preservedQueueData: false,
        };
    }
}
