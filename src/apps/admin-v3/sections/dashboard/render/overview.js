import { formatDateTime, setText } from '../../../shared/ui/render.js';
import { heroSummary } from '../markup.js';

function resolveBridgeChipTone(ops) {
    if (!ops.available) return 'warning';
    if (ops.bridgeMode === 'online') return 'success';
    if (ops.bridgeMode === 'degraded') return 'warning';
    if (ops.bridgeMode === 'offline') return 'danger';
    return 'neutral';
}

function resolveBridgeChipLabel(ops) {
    switch (ops.bridgeMode) {
        case 'online':
            return 'En linea';
        case 'degraded':
            return 'Degradado';
        case 'offline':
            return 'Offline';
        case 'disabled':
            return 'Deshabilitado';
        default:
            return ops.available ? 'Pendiente' : 'Sin señal';
    }
}

function resolveBridgeMeta(ops) {
    if (!ops.available) {
        return ops.error || 'No se pudo leer el bridge operativo.';
    }

    const marks = [];
    if (ops.lastInboundAt) {
        marks.push(`Inbound ${formatDateTime(ops.lastInboundAt)}`);
    }
    if (ops.lastOutboundAt) {
        marks.push(`Outbound ${formatDateTime(ops.lastOutboundAt)}`);
    }
    if (marks.length > 0) {
        return marks.join(' | ');
    }

    return ops.bridgeConfigured
        ? 'Bridge configurado, esperando actividad reciente.'
        : 'Bridge sin token o aun pendiente de configuracion.';
}

function resolveBridgeSummary(ops) {
    if (!ops.available) {
        return 'La lectura de WhatsApp/OpenClaw no esta disponible todavia en este panel.';
    }
    if (ops.bridgeMode === 'disabled') {
        return 'WhatsApp/OpenClaw esta deshabilitado en este entorno.';
    }
    if (ops.bridgeMode === 'offline') {
        return 'El bridge dejo de reportar señal y conviene revisar helper, token o worker.';
    }
    if (ops.deliveryFailures > 0) {
        return `${ops.deliveryFailures} entrega(s) fallida(s) requieren requeue o revision manual.`;
    }
    if (ops.pendingCheckouts.length > 0) {
        return `${ops.pendingCheckouts.length} checkout(s) mantienen slots retenidos.`;
    }
    if (ops.aliveHolds > 0) {
        return `${ops.aliveHolds} hold(s) siguen activos sin cierre de pago.`;
    }
    return 'Bridge estable, sin fallos de entrega ni checkouts atascados en este momento.';
}

function resolveClinicalChipTone(snapshot) {
    const status = String(snapshot?.summary?.diagnostics?.status || '').trim();
    if (status === 'critical') return 'danger';
    if (status === 'degraded') return 'warning';
    if (status === 'healthy') return 'success';
    return 'neutral';
}

function resolveClinicalChipLabel(snapshot) {
    const status = String(snapshot?.summary?.diagnostics?.status || '').trim();
    switch (status) {
        case 'critical':
            return 'Critico';
        case 'degraded':
            return 'Seguimiento';
        case 'healthy':
            return 'Estable';
        default:
            return 'Pendiente';
    }
}

function resolveClinicalMeta(snapshot) {
    if (!snapshot?.summary?.configured) {
        return 'El snapshot clinico todavia no esta disponible en este panel.';
    }

    const latestActivityAt = String(snapshot?.summary?.latestActivityAt || '').trim();
    const unreadEvents = Number(snapshot?.summary?.events?.unreadCount || 0);
    if (latestActivityAt) {
        return unreadEvents > 0
            ? `Ultima actividad ${formatDateTime(latestActivityAt)} • ${unreadEvents} evento(s) sin leer`
            : `Ultima actividad ${formatDateTime(latestActivityAt)}`;
    }

    return unreadEvents > 0
        ? `${unreadEvents} evento(s) clinicos sin leer.`
        : 'Sin actividad clinica reciente.';
}

function resolveClinicalSummary(snapshot) {
    if (!snapshot?.summary?.configured) {
        return 'La historia clinica conversacional aparecera aqui cuando el backend canonico empiece a emitir sesiones y drafts.';
    }

    const reviewQueueCount = Number(
        snapshot?.summary?.reviewQueueCount ||
            snapshot?.summary?.drafts?.reviewQueueCount ||
            0
    );
    const pendingAiCount = Number(snapshot?.summary?.drafts?.pendingAiCount || 0);
    const openEventsCount = Number(snapshot?.summary?.events?.openCount || 0);
    const criticalEvents = Number(
        snapshot?.summary?.events?.openBySeverity?.critical || 0
    );

    if (criticalEvents > 0) {
        return `${criticalEvents} evento(s) critico(s) siguen abiertos y requieren validacion medica inmediata.`;
    }
    if (reviewQueueCount > 0) {
        return `${reviewQueueCount} historia(s) clinica(s) quedaron listas para revision humana desde la misma consola operativa.`;
    }
    if (pendingAiCount > 0) {
        return `${pendingAiCount} borrador(es) siguen esperando reconciliacion asincrona de OpenClaw.`;
    }
    if (openEventsCount > 0) {
        return `${openEventsCount} evento(s) siguen visibles para seguimiento del staff, aunque no haya cola de revision abierta.`;
    }

    return 'Sin cola clinica pendiente: las sesiones recientes ya quedaron estables o aprobadas.';
}

function resolveClinicalQueueHeadline(snapshot) {
    const reviewQueue = Array.isArray(snapshot?.reviewQueue) ? snapshot.reviewQueue : [];
    const first = reviewQueue[0] || null;
    if (!first) {
        return 'Sin casos pendientes';
    }

    return String(first.patientName || first.caseId || 'Caso clinico').trim();
}

function resolveClinicalQueueMeta(snapshot) {
    const reviewQueue = Array.isArray(snapshot?.reviewQueue) ? snapshot.reviewQueue : [];
    const first = reviewQueue[0] || null;
    if (!first) {
        return 'Cuando OpenClaw deje historias en review_required apareceran aqui.';
    }

    const reviewQueueCount = Number(
        snapshot?.summary?.reviewQueueCount ||
            snapshot?.summary?.drafts?.reviewQueueCount ||
            reviewQueue.length
    );
    const missingFields = Array.isArray(first?.missingFields)
        ? first.missingFields.length
        : 0;
    const confidence = Number(first?.confidence || 0);
    const confidenceLabel =
        Number.isFinite(confidence) && confidence > 0
            ? `${Math.round(confidence * 100)}% de confianza`
            : 'sin score de confianza';

    return reviewQueueCount > 1
        ? `${reviewQueueCount} caso(s) en cola • ${missingFields} dato(s) faltante(s) • ${confidenceLabel}`
        : `${missingFields} dato(s) faltante(s) • ${confidenceLabel}`;
}

function resolveClinicalEventHeadline(snapshot) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const first = events[0] || null;
    if (!first) {
        return 'Sin actividad reciente';
    }

    return String(first.title || first.patientName || 'Evento clinico').trim();
}

function resolveClinicalEventMeta(snapshot) {
    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    const first = events[0] || null;
    if (!first) {
        return 'El feed operativo resumira conciliaciones, alertas y lecturas pendientes.';
    }

    const unreadEvents = Number(snapshot?.summary?.events?.unreadCount || 0);
    const openEvents = Number(snapshot?.summary?.events?.openCount || 0);
    const occurredAt = String(first?.occurredAt || first?.createdAt || '').trim();

    return [
        occurredAt ? formatDateTime(occurredAt) : '',
        openEvents > 0 ? `${openEvents} abierto(s)` : '',
        unreadEvents > 0 ? `${unreadEvents} sin leer` : '',
    ]
        .filter(Boolean)
        .join(' • ');
}

export function setOverviewMetrics(state) {
    const {
        appointments,
        nextAppointment,
        pendingTasks,
        pendingTransfers,
        todayAppointments,
        availabilityDays,
        calledTickets,
        clinicalHistoryMeta,
        pendingCallbacks,
        waitingTickets,
        whatsappOpenclawOps,
    } = state;
    const ops = whatsappOpenclawOps || {
        available: false,
        bridgeMode: 'pending',
        bridgeConfigured: false,
        deliveryFailures: 0,
        pendingOutbox: 0,
        aliveHolds: 0,
        pendingCheckouts: [],
        error: '',
        lastInboundAt: '',
        lastOutboundAt: '',
    };
    const clinical = clinicalHistoryMeta || {
        summary: {
            configured: false,
            sessions: { total: 0 },
            drafts: { pendingAiCount: 0, reviewQueueCount: 0 },
            events: { openCount: 0, unreadCount: 0, openBySeverity: {} },
            reviewQueueCount: 0,
            latestActivityAt: '',
            diagnostics: { status: 'unknown' },
        },
        reviewQueue: [],
        events: [],
    };

    setText(
        '#dashboardHeroSummary',
        heroSummary({
            pendingCallbacks,
            pendingTransfers,
            nextAppointment,
            urgentCallbacks: state.urgentCallbacks,
            noShows: state.noShows,
        })
    );
    setText('#opsTodayCount', todayAppointments);
    setText(
        '#opsTodayMeta',
        nextAppointment?.item
            ? `${nextAppointment.item.name || 'Paciente'} a las ${nextAppointment.item.time || '--:--'}`
            : appointments.length > 0
              ? `${appointments.length} cita(s) registradas`
              : 'Sin citas cargadas'
    );
    setText('#opsPendingCount', pendingTasks);
    setText(
        '#opsPendingMeta',
        pendingTasks > 0
            ? `${pendingTransfers} pago(s) y ${pendingCallbacks} llamada(s)`
            : 'Sin pagos ni llamadas pendientes'
    );
    setText('#opsAvailabilityCount', availabilityDays);
    setText(
        '#opsAvailabilityMeta',
        availabilityDays > 0
            ? `${availabilityDays} dia(s) con horarios activos`
            : 'Aun no hay horarios cargados'
    );
    setText(
        '#opsQueueStatus',
        waitingTickets > 0
            ? `${waitingTickets} en espera`
            : calledTickets > 0
              ? `${calledTickets} en atencion`
              : 'Listo para abrir'
    );
    setText(
        '#opsQueueMeta',
        waitingTickets > 0 || calledTickets > 0
            ? `Turnero listo para atender ${waitingTickets + calledTickets} ticket(s)`
            : 'Abre la app solo cuando vayas a llamar pacientes'
    );
    setText('#openclawBridgeChip', resolveBridgeChipLabel(ops));
    document
        .getElementById('openclawBridgeChip')
        ?.setAttribute('data-state', resolveBridgeChipTone(ops));
    setText('#openclawBridgeMeta', resolveBridgeMeta(ops));
    setText('#dashboardOpenclawOpsSummary', resolveBridgeSummary(ops));
    setText('#openclawOpsOutboxCount', ops.pendingOutbox);
    setText('#openclawOpsFailCount', ops.deliveryFailures);
    setText('#openclawOpsHoldCount', ops.aliveHolds);
    setText('#openclawOpsCheckoutCount', ops.pendingCheckouts.length);
    setText(
        '#dashboardClinicalHistoryChip',
        resolveClinicalChipLabel(clinical)
    );
    document
        .getElementById('dashboardClinicalHistoryChip')
        ?.setAttribute('data-state', resolveClinicalChipTone(clinical));
    setText('#dashboardClinicalHistoryMeta', resolveClinicalMeta(clinical));
    setText('#dashboardClinicalHistorySummary', resolveClinicalSummary(clinical));
    setText(
        '#clinicalHistorySessionCount',
        Number(clinical?.summary?.sessions?.total || 0)
    );
    setText(
        '#clinicalHistoryReviewCount',
        Number(
            clinical?.summary?.reviewQueueCount ||
                clinical?.summary?.drafts?.reviewQueueCount ||
                0
        )
    );
    setText(
        '#clinicalHistoryPendingAiCount',
        Number(clinical?.summary?.drafts?.pendingAiCount || 0)
    );
    setText(
        '#clinicalHistoryEventCount',
        Number(clinical?.summary?.events?.openCount || 0)
    );
    setText('#clinicalHistoryQueueHeadline', resolveClinicalQueueHeadline(clinical));
    setText('#clinicalHistoryQueueMeta', resolveClinicalQueueMeta(clinical));
    setText('#clinicalHistoryEventHeadline', resolveClinicalEventHeadline(clinical));
    setText('#clinicalHistoryEventMeta', resolveClinicalEventMeta(clinical));
}
