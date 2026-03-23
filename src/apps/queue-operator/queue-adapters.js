import { apiRequest } from '../admin-v3/shared/core/api-client.js';
import { getState } from '../admin-v3/shared/core/store.js';
import { createToast } from '../admin-v3/shared/ui/render.js';
import { normalizeQueueAction } from '../admin-v3/shared/modules/queue/helpers.js';
import {
    getQueueTicketById,
    getWaitingForConsultorio,
} from '../admin-v3/shared/modules/queue/selectors.js';
import {
    appendActivity,
    setQueueStateWithTickets,
} from '../admin-v3/shared/modules/queue/state.js';
import { applyQueueStateResponse } from '../admin-v3/shared/modules/queue/sync.js';
import {
    setTicketCalledLocal,
    setTicketStatusLocal,
} from '../admin-v3/shared/modules/queue/actions/shared.js';
import { buildOperatorSurfaceState } from '../queue-shared/turnero-runtime-contract.mjs';

function createDefaultShellStatus() {
    return {
        connectivity: 'online',
        mode: 'live',
        offlineEnabled: false,
        snapshotAgeSec: null,
        outboxSize: 0,
        reconciliationSize: 0,
        lastSuccessfulSyncAt: '',
        updateChannel: 'stable',
        reason: 'connected',
    };
}

function createDefaultShellSnapshot() {
    return {
        snapshot: null,
        outbox: [],
        reconciliation: [],
        hasAuthenticatedSession: false,
        lastAuthenticatedAt: '',
    };
}

function normalizeShellStatus(payload = {}) {
    const mode = String(payload?.mode || 'live')
        .trim()
        .toLowerCase();
    const connectivity = String(payload?.connectivity || 'online')
        .trim()
        .toLowerCase();
    return {
        connectivity: connectivity === 'offline' ? 'offline' : 'online',
        mode:
            mode === 'offline' || mode === 'safe'
                ? mode
                : createDefaultShellStatus().mode,
        offlineEnabled: payload?.offlineEnabled === true,
        snapshotAgeSec: Number.isFinite(Number(payload?.snapshotAgeSec))
            ? Number(payload.snapshotAgeSec)
            : null,
        outboxSize: Math.max(0, Number(payload?.outboxSize || 0) || 0),
        reconciliationSize: Math.max(
            0,
            Number(payload?.reconciliationSize || 0) || 0
        ),
        lastSuccessfulSyncAt: String(payload?.lastSuccessfulSyncAt || ''),
        updateChannel:
            String(payload?.updateChannel || '')
                .trim()
                .toLowerCase() === 'pilot'
                ? 'pilot'
                : 'stable',
        reason: String(payload?.reason || 'connected'),
    };
}

function normalizeShellSnapshot(payload = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const snapshot =
        source.snapshot && typeof source.snapshot === 'object'
            ? source.snapshot
            : null;
    return {
        snapshot,
        outbox: Array.isArray(source.outbox) ? source.outbox : [],
        reconciliation: Array.isArray(source.reconciliation)
            ? source.reconciliation
            : [],
        hasAuthenticatedSession: source.hasAuthenticatedSession === true,
        lastAuthenticatedAt: String(source.lastAuthenticatedAt || ''),
    };
}

function buildStationKey(consultorio) {
    return Number(consultorio || 0) === 2 ? 'c2' : 'c1';
}

function getCurrentStationKey(state = getState()) {
    return buildOperatorSurfaceState(state.queue).stationKey;
}

function createIdempotencyKey(type, ticketId) {
    const suffix =
        typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    return `${String(type || 'queue')}:${Number(ticketId || 0)}:${suffix}`;
}

function isRecoverableOfflineError(error) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return true;
    }

    const message = String(error?.message || error || '')
        .trim()
        .toLowerCase();
    if (!message) {
        return false;
    }

    return (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('load failed') ||
        message.includes('timeout') ||
        message.includes('gateway') ||
        message.includes('temporarily') ||
        message.includes('respuesta no valida') ||
        /^http 5\d\d$/i.test(String(error?.message || '').trim())
    );
}

function mapQueueActionToOfflineType(action) {
    const normalized = normalizeQueueAction(action);
    if (normalized === 're-llamar') {
        return 'recall';
    }
    if (normalized === 'completar') {
        return 'complete';
    }
    if (normalized === 'no_show') {
        return 'no_show';
    }
    return '';
}

function resolveReplayAction(action) {
    switch (String(action?.type || '')) {
        case 'call_next':
        case 'recall':
            return 're-llamar';
        case 'complete':
            return 'completar';
        case 'no_show':
            return 'no_show';
        default:
            return '';
    }
}

function buildSnapshotPayload(
    shellStatus,
    shellSnapshot,
    { healthy = true } = {}
) {
    const state = getState();
    const queueTickets = Array.isArray(state.data?.queueTickets)
        ? state.data.queueTickets
        : [];
    const queueMeta =
        state.data?.queueMeta && typeof state.data.queueMeta === 'object'
            ? state.data.queueMeta
            : null;

    if (!queueTickets.length && !queueMeta) {
        return null;
    }

    const preservedSavedAt =
        shellSnapshot?.snapshot?.savedAt ||
        shellStatus?.lastSuccessfulSyncAt ||
        '';
    if (!healthy && !preservedSavedAt) {
        return null;
    }

    return {
        snapshot: {
            queueTickets,
            queueMeta,
            station: getCurrentStationKey(state),
            savedAt: healthy
                ? new Date().toISOString()
                : String(preservedSavedAt || new Date().toISOString()),
        },
        healthy,
    };
}

function applyLocalShellSnapshot(shellSnapshot, activityMessage) {
    const snapshot =
        shellSnapshot?.snapshot && typeof shellSnapshot.snapshot === 'object'
            ? shellSnapshot.snapshot
            : null;
    if (!snapshot) {
        return false;
    }

    setQueueStateWithTickets(snapshot.queueTickets || [], snapshot.queueMeta, {
        fallbackPartial: true,
        syncMode: 'fallback',
    });
    if (activityMessage) {
        appendActivity(activityMessage);
    }
    return true;
}

function noteOfflineMode(status) {
    if (status.mode === 'offline') {
        createToast(
            'Modo offline operativo. Los cambios quedarán en cola hasta recuperar red.',
            'warning'
        );
        return;
    }

    createToast(
        'Modo seguro activo. Solo lectura hasta recuperar red o una sesión válida.',
        'warning'
    );
}

function noteTicketActionLocally(type, ticketId, consultorio) {
    switch (type) {
        case 'call_next':
        case 'recall':
            setTicketCalledLocal(
                ticketId,
                Number(consultorio || 0) === 2 ? 2 : 1
            );
            return;
        case 'complete':
            setTicketStatusLocal(ticketId, 'completed');
            return;
        case 'no_show':
            setTicketStatusLocal(ticketId, 'no_show');
            return;
        default:
            return;
    }
}

function buildActionMessages(type, ticketCode, consultorio) {
    switch (type) {
        case 'call_next':
            return {
                activity: `Contingencia: llamado ${ticketCode} en C${consultorio}`,
                toast: `Offline operativo: ${ticketCode} quedó llamado en C${consultorio}.`,
            };
        case 'recall':
            return {
                activity: `Contingencia: re-llamar ${ticketCode}`,
                toast: `Offline operativo: ${ticketCode} quedó re-llamado.`,
            };
        case 'complete':
            return {
                activity: `Contingencia: completar ${ticketCode}`,
                toast: `Offline operativo: ${ticketCode} quedó completado.`,
            };
        case 'no_show':
            return {
                activity: `Contingencia: no show ${ticketCode}`,
                toast: `Offline operativo: ${ticketCode} quedó marcado no show.`,
            };
        default:
            return {
                activity: 'Contingencia local',
                toast: 'Acción guardada para replay.',
            };
    }
}

export function createRemoteQueueAdapter(_turneroDesktop, hooks = {}) {
    const runtime = {
        currentShellStatus: createDefaultShellStatus(),
        currentShellSnapshot: createDefaultShellSnapshot(),
    };
    let postMutationRefreshTimerId = 0;

    function schedulePostMutationRefresh(adapter, delayMs = 1200) {
        if (typeof window === 'undefined') {
            return;
        }
        if (postMutationRefreshTimerId) {
            window.clearTimeout(postMutationRefreshTimerId);
        }
        postMutationRefreshTimerId = window.setTimeout(() => {
            postMutationRefreshTimerId = 0;
            void adapter.refreshQueueState();
        }, delayMs);
    }

    const adapter = {
        kind: 'remote',
        getShellStatus() {
            return runtime.currentShellStatus;
        },
        getShellSnapshot() {
            return runtime.currentShellSnapshot;
        },
        async init() {
            hooks.onShellState?.(
                runtime.currentShellStatus,
                runtime.currentShellSnapshot
            );
            return runtime.currentShellStatus;
        },
        handleShellEvent() {},
        async markSessionAuthenticated() {},
        async reportConnectivity() {},
        async syncStateSnapshot() {
            return runtime.currentShellSnapshot;
        },
        async flushPendingOutbox() {
            return {
                processedIds: [],
                conflicts: [],
                networkFailure: false,
            };
        },
    };

    return adapter;
}

export function createDesktopOfflineAdapter(turneroDesktop, hooks = {}) {
    const bridge =
        turneroDesktop && typeof turneroDesktop === 'object'
            ? turneroDesktop
            : null;
    const runtime = {
        bridge,
        currentShellStatus: createDefaultShellStatus(),
        currentShellSnapshot: createDefaultShellSnapshot(),
    };
    let postMutationRefreshTimerId = 0;

    function schedulePostMutationRefresh(adapter, delayMs = 1200) {
        if (typeof window === 'undefined') {
            return;
        }
        if (postMutationRefreshTimerId) {
            window.clearTimeout(postMutationRefreshTimerId);
        }
        postMutationRefreshTimerId = window.setTimeout(() => {
            postMutationRefreshTimerId = 0;
            void adapter.refreshQueueState();
        }, delayMs);
    }

    function emitShellState() {
        hooks.onShellState?.(
            runtime.currentShellStatus,
            runtime.currentShellSnapshot
        );
    }

    async function refreshShellState() {
        if (!bridge) {
            emitShellState();
            return runtime.currentShellStatus;
        }

        const [statusPayload, snapshotPayload] = await Promise.all([
            typeof bridge.getShellStatus === 'function'
                ? bridge.getShellStatus().catch(() => null)
                : Promise.resolve(null),
            typeof bridge.getOfflineSnapshot === 'function'
                ? bridge.getOfflineSnapshot().catch(() => null)
                : Promise.resolve(null),
        ]);

        runtime.currentShellStatus = normalizeShellStatus(statusPayload);
        runtime.currentShellSnapshot = normalizeShellSnapshot(snapshotPayload);
        emitShellState();
        return runtime.currentShellStatus;
    }

    async function reportConnectivity(connectivity) {
        if (bridge && typeof bridge.reportShellState === 'function') {
            await bridge.reportShellState({ connectivity });
        }
        return refreshShellState().catch(() => runtime.currentShellStatus);
    }

    async function markSessionAuthenticated(authenticated = true) {
        if (bridge && typeof bridge.markSessionAuthenticated === 'function') {
            await bridge.markSessionAuthenticated({
                authenticated,
                at: new Date().toISOString(),
            });
        }
        return refreshShellState().catch(() => runtime.currentShellStatus);
    }

    async function syncStateSnapshot({ healthy = true } = {}) {
        if (!bridge || typeof bridge.saveOfflineSnapshot !== 'function') {
            return runtime.currentShellSnapshot;
        }

        const payload = buildSnapshotPayload(
            runtime.currentShellStatus,
            runtime.currentShellSnapshot,
            { healthy }
        );
        if (!payload) {
            return runtime.currentShellSnapshot;
        }

        await bridge.saveOfflineSnapshot(payload);
        return refreshShellState().catch(() => runtime.currentShellSnapshot);
    }

    async function queueOfflineAction(type, ticket, consultorio) {
        if (!bridge || typeof bridge.enqueueQueueAction !== 'function') {
            throw new Error('El shell desktop no soporta cola offline');
        }

        const targetTicket =
            ticket && typeof ticket === 'object' ? ticket : null;
        if (!targetTicket?.id) {
            throw new Error(
                'No hay ticket local para guardar la acción offline'
            );
        }

        const station = buildStationKey(consultorio);
        const createdAt = new Date().toISOString();
        const { activity, toast } = buildActionMessages(
            type,
            targetTicket.ticketCode || `#${targetTicket.id}`,
            Number(consultorio || 0) === 2 ? 2 : 1
        );

        await bridge.enqueueQueueAction({
            idempotencyKey: createIdempotencyKey(type, targetTicket.id),
            type,
            ticketId: targetTicket.id,
            station,
            createdAt,
        });
        noteTicketActionLocally(type, targetTicket.id, consultorio);
        await syncStateSnapshot({ healthy: false });
        appendActivity(activity);
        createToast(toast, 'warning');
        return true;
    }

    async function activateContingency(activityMessage) {
        await reportConnectivity('offline');
        const applied = applyLocalShellSnapshot(
            runtime.currentShellSnapshot,
            activityMessage
        );
        noteOfflineMode(runtime.currentShellStatus);
        return {
            applied,
            shellStatus: runtime.currentShellStatus,
        };
    }

    async function replayQueueAction(action) {
        const ticketAction = resolveReplayAction(action);
        if (!ticketAction) {
            throw new Error('Acción offline fuera de scope');
        }

        const consultorio =
            String(action?.station || '').toLowerCase() === 'c2' ? 2 : 1;
        const payload = await apiRequest('queue-ticket', {
            method: 'PATCH',
            body: {
                id: Number(action?.ticketId || 0),
                action: ticketAction,
                consultorio,
            },
        });
        applyQueueStateResponse(payload, {
            syncMode: 'live',
            bumpRuntimeRevision: true,
        });
        appendActivity(
            `Replay ${ticketAction} ticket ${Number(action?.ticketId || 0)}`
        );
        return payload;
    }

    const adapter = {
        kind: 'desktop',
        getShellStatus() {
            return runtime.currentShellStatus;
        },
        getShellSnapshot() {
            return runtime.currentShellSnapshot;
        },
        async init() {
            await refreshShellState();
            if (typeof navigator !== 'undefined') {
                await reportConnectivity(
                    navigator.onLine === false ? 'offline' : 'online'
                );
            }
            return runtime.currentShellStatus;
        },
        handleShellEvent(payload = {}) {
            runtime.currentShellStatus = normalizeShellStatus(payload?.status);
            runtime.currentShellSnapshot = normalizeShellSnapshot(payload);
            emitShellState();
        },
        markSessionAuthenticated,
        reportConnectivity,
        syncStateSnapshot,
        async flushPendingOutbox() {
            const outbox = Array.isArray(runtime.currentShellSnapshot.outbox)
                ? runtime.currentShellSnapshot.outbox
                : [];
            if (
                !bridge ||
                typeof bridge.flushQueueOutbox !== 'function' ||
                outbox.length === 0
            ) {
                return {
                    processedIds: [],
                    conflicts: [],
                    networkFailure: false,
                };
            }

            const processedIds = [];
            const conflicts = [];

            for (const action of outbox) {
                try {
                    await replayQueueAction(action);
                    processedIds.push(String(action?.idempotencyKey || ''));
                } catch (error) {
                    if (isRecoverableOfflineError(error)) {
                        await reportConnectivity('offline');
                        return {
                            processedIds,
                            conflicts,
                            networkFailure: true,
                            error,
                        };
                    }

                    conflicts.push({
                        ...action,
                        reason:
                            error?.message ||
                            'No se pudo conciliar la acción remota',
                        failedAt: new Date().toISOString(),
                    });
                    break;
                }
            }

            await bridge.flushQueueOutbox({
                processedIds,
                conflicts,
                connectivity: 'online',
                lastSuccessfulSyncAt: new Date().toISOString(),
            });
            await refreshShellState();

            if (conflicts.length > 0) {
                createToast(
                    'Hay acciones en conciliación. El equipo puede seguir en línea, pero no volver a contingencia hasta resolverlas.',
                    'warning'
                );
            }

            return {
                processedIds,
                conflicts,
                networkFailure: false,
            };
        },
        async refreshQueueState() {
            try {
                await reportConnectivity('online');
                const flushResult = await this.flushPendingOutbox();
                if (flushResult.networkFailure) {
                    throw (
                        flushResult.error ||
                        new Error('No se pudo reprocesar el outbox')
                    );
                }

                const payload = await apiRequest('queue-state');
                applyQueueStateResponse(payload, { syncMode: 'live' });
                appendActivity('Queue refresh realizado');
                await reportConnectivity('online');
                await syncStateSnapshot({ healthy: true });
                return {
                    ok: true,
                    fallback: false,
                    shellStatus: runtime.currentShellStatus,
                };
            } catch (error) {
                appendActivity('Queue refresh con error');
                if (!isRecoverableOfflineError(error)) {
                    createToast(
                        error?.message || 'No se pudo refrescar la cola',
                        'error'
                    );
                    return {
                        ok: false,
                        fallback: false,
                        error,
                    };
                }

                const contingency = await activateContingency(
                    'Queue refresh con respaldo local'
                );
                return {
                    ok: false,
                    fallback: contingency.applied,
                    shellStatus: contingency.shellStatus,
                };
            }
        },
        async callNextForConsultorio(consultorio) {
            const target = Number(consultorio || 0) === 2 ? 2 : 1;
            try {
                const payload = await apiRequest('queue-call-next', {
                    method: 'POST',
                    body: { consultorio: target },
                });
                applyQueueStateResponse(payload, {
                    syncMode: 'live',
                    bumpRuntimeRevision: true,
                });
                appendActivity(`Llamado C${target} ejecutado`);
                await reportConnectivity('online');
                await syncStateSnapshot({ healthy: true });
                schedulePostMutationRefresh(adapter);
                return payload;
            } catch (error) {
                if (!isRecoverableOfflineError(error)) {
                    appendActivity(`Error llamando siguiente en C${target}`);
                    createToast(
                        error?.message ||
                            `Error llamando siguiente en C${target}`,
                        'error'
                    );
                    return null;
                }

                const candidate = getWaitingForConsultorio(target);
                const contingency = await activateContingency(
                    'Contingencia local activada para llamados'
                );
                if (
                    runtime.currentShellStatus.mode !== 'offline' ||
                    !candidate
                ) {
                    return contingency;
                }

                await queueOfflineAction('call_next', candidate, target);
                return {
                    ok: false,
                    offline: true,
                };
            }
        },
        async executeTicketAction({ ticketId, action, consultorio }) {
            const targetId = Number(ticketId || 0);
            const targetAction = normalizeQueueAction(action);
            const targetConsultorio =
                Number(consultorio || 0) ||
                Number(
                    getQueueTicketById(targetId)?.assignedConsultorio || 0
                ) ||
                Number(getState().queue.stationConsultorio || 1);

            try {
                const payload = await apiRequest('queue-ticket', {
                    method: 'PATCH',
                    body: {
                        id: targetId,
                        action: targetAction,
                        consultorio: targetConsultorio,
                    },
                });

                applyQueueStateResponse(payload, {
                    syncMode: 'live',
                    bumpRuntimeRevision: true,
                });
                appendActivity(`Accion ${targetAction} ticket ${targetId}`);
                await reportConnectivity('online');
                await syncStateSnapshot({ healthy: true });
                schedulePostMutationRefresh(adapter);
                return payload;
            } catch (error) {
                const offlineType = mapQueueActionToOfflineType(targetAction);
                if (!offlineType || !isRecoverableOfflineError(error)) {
                    appendActivity(
                        `Error accion ${targetAction} en ticket ${targetId}`
                    );
                    createToast(
                        error?.message ||
                            `No se pudo ejecutar ${targetAction} en el ticket ${targetId}`,
                        'error'
                    );
                    return null;
                }

                const ticket = getQueueTicketById(targetId);
                await activateContingency(
                    `Contingencia local para ticket ${targetId}`
                );
                if (runtime.currentShellStatus.mode !== 'offline' || !ticket) {
                    return null;
                }

                await queueOfflineAction(
                    offlineType,
                    ticket,
                    targetConsultorio
                );
                return {
                    ok: false,
                    offline: true,
                };
            }
        },
    };

    return adapter;
}

export function resolveOperatorQueueAdapter(turneroDesktop, hooks = {}) {
    if (
        turneroDesktop &&
        typeof turneroDesktop === 'object' &&
        typeof turneroDesktop.getRuntimeSnapshot === 'function'
    ) {
        return createDesktopOfflineAdapter(turneroDesktop, hooks);
    }

    return createRemoteQueueAdapter(turneroDesktop, hooks);
}
