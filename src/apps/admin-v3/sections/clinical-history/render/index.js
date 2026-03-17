import { refreshAdminData } from '../../../shared/modules/data.js';
import { getState, updateState } from '../../../shared/core/store.js';
import { apiRequest } from '../../../shared/core/api-client.js';
import {
    getQueryParam,
    setQueryParam,
} from '../../../shared/core/persistence.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { renderDashboard } from '../../dashboard.js';
import { renderAdminChrome } from '../../../ui/frame.js';
import { renderClinicalMediaFlow } from './media-flow.js';

const CLINICAL_HISTORY_SESSION_QUERY_PARAM = 'clinicalSessionId';

let scheduledAutoSelection = '';

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeStringList(value) {
    return normalizeList(value)
        .map((item) => normalizeString(item))
        .filter(Boolean);
}

function normalizeNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNullableInt(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Math.round(parsed));
}

function normalizeNullableFloat(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.max(0, Number(parsed));
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function emptyPosology() {
    return {
        texto: '',
        baseCalculo: '',
        pesoKg: null,
        edadAnios: null,
        units: '',
        ambiguous: true,
    };
}

function emptyDraft() {
    return {
        sessionId: '',
        caseId: '',
        appointmentId: null,
        reviewStatus: 'pending_review',
        requiresHumanReview: true,
        confidence: 0,
        reviewReasons: [],
        intake: {
            motivoConsulta: '',
            enfermedadActual: '',
            antecedentes: '',
            alergias: '',
            medicacionActual: '',
            rosRedFlags: [],
            adjuntos: [],
            resumenClinico: '',
            cie10Sugeridos: [],
            tratamientoBorrador: '',
            posologiaBorrador: emptyPosology(),
            preguntasFaltantes: [],
            datosPaciente: {
                edadAnios: null,
                pesoKg: null,
                sexoBiologico: '',
                embarazo: null,
            },
        },
        clinicianDraft: {
            resumen: '',
            preguntasFaltantes: [],
            cie10Sugeridos: [],
            tratamientoBorrador: '',
            posologiaBorrador: emptyPosology(),
        },
        pendingAi: {},
        updatedAt: '',
        createdAt: '',
    };
}

function emptyReview() {
    return {
        session: {
            sessionId: '',
            caseId: '',
            appointmentId: null,
            surface: '',
            status: '',
            patient: {
                name: '',
                email: '',
                phone: '',
                ageYears: null,
                weightKg: null,
                sexAtBirth: '',
                pregnant: null,
            },
            transcript: [],
            pendingAi: {},
            metadata: {},
            createdAt: '',
            updatedAt: '',
            lastMessageAt: '',
        },
        draft: emptyDraft(),
        events: [],
    };
}

function normalizePatient(patient) {
    const source = patient && typeof patient === 'object' ? patient : {};
    return {
        name: normalizeString(source.name || source.fullName),
        email: normalizeString(source.email),
        phone: normalizeString(source.phone),
        ageYears: normalizeNullableInt(source.ageYears || source.edadAnios),
        weightKg: normalizeNullableFloat(source.weightKg || source.pesoKg),
        sexAtBirth: normalizeString(source.sexAtBirth || source.sexoBiologico),
        pregnant:
            source.pregnant === null || source.pregnant === undefined
                ? source.embarazo === null || source.embarazo === undefined
                    ? null
                    : source.embarazo === true
                : source.pregnant === true,
    };
}

function normalizeTranscriptMessage(message) {
    const source = message && typeof message === 'object' ? message : {};
    return {
        id: normalizeString(source.id),
        role: normalizeString(source.role || 'user'),
        actor: normalizeString(source.actor || 'patient'),
        content: normalizeString(source.content),
        surface: normalizeString(source.surface),
        createdAt: normalizeString(source.createdAt),
        fieldKey: normalizeString(source.fieldKey),
        meta: source.meta && typeof source.meta === 'object' ? source.meta : {},
    };
}

function normalizeAttachment(attachment) {
    const source =
        attachment && typeof attachment === 'object' ? attachment : {};
    return {
        id: normalizeNullableInt(source.id),
        kind: normalizeString(source.kind),
        originalName: normalizeString(source.originalName || source.name),
        mime: normalizeString(source.mime),
        size: Math.max(0, normalizeNumber(source.size)),
        privatePath: normalizeString(source.privatePath),
        appointmentId: normalizeNullableInt(source.appointmentId),
    };
}

function normalizePosology(posology) {
    const source = posology && typeof posology === 'object' ? posology : {};
    return {
        texto: normalizeString(source.texto),
        baseCalculo: normalizeString(source.baseCalculo),
        pesoKg: normalizeNullableFloat(source.pesoKg),
        edadAnios: normalizeNullableInt(source.edadAnios),
        units: normalizeString(source.units),
        ambiguous:
            source.ambiguous === undefined ? true : source.ambiguous === true,
    };
}

function normalizeDraftSnapshot(draft) {
    const defaults = emptyDraft();
    const source = draft && typeof draft === 'object' ? draft : {};
    const intakeSource =
        source.intake && typeof source.intake === 'object' ? source.intake : {};
    const clinicianSource =
        source.clinicianDraft && typeof source.clinicianDraft === 'object'
            ? source.clinicianDraft
            : {};
    const patientFactsSource =
        intakeSource.datosPaciente &&
        typeof intakeSource.datosPaciente === 'object'
            ? intakeSource.datosPaciente
            : {};

    const reviewStatus =
        normalizeString(source.reviewStatus) || defaults.reviewStatus;
    let requiresHumanReview =
        source.requiresHumanReview === undefined
            ? defaults.requiresHumanReview
            : source.requiresHumanReview === true;

    if (reviewStatus === 'approved') {
        requiresHumanReview = false;
    } else if (reviewStatus === 'review_required') {
        requiresHumanReview = true;
    }

    return {
        ...defaults,
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: normalizeNullableInt(source.appointmentId),
        reviewStatus,
        requiresHumanReview,
        confidence: normalizeNumber(source.confidence),
        reviewReasons: normalizeStringList(source.reviewReasons),
        pendingAi:
            source.pendingAi && typeof source.pendingAi === 'object'
                ? source.pendingAi
                : {},
        intake: {
            ...defaults.intake,
            motivoConsulta: normalizeString(intakeSource.motivoConsulta),
            enfermedadActual: normalizeString(intakeSource.enfermedadActual),
            antecedentes: normalizeString(intakeSource.antecedentes),
            alergias: normalizeString(intakeSource.alergias),
            medicacionActual: normalizeString(intakeSource.medicacionActual),
            rosRedFlags: normalizeStringList(intakeSource.rosRedFlags),
            adjuntos: normalizeList(intakeSource.adjuntos).map(
                normalizeAttachment
            ),
            resumenClinico: normalizeString(intakeSource.resumenClinico),
            cie10Sugeridos: normalizeStringList(intakeSource.cie10Sugeridos),
            tratamientoBorrador: normalizeString(
                intakeSource.tratamientoBorrador
            ),
            posologiaBorrador: normalizePosology(
                intakeSource.posologiaBorrador
            ),
            preguntasFaltantes: normalizeStringList(
                intakeSource.preguntasFaltantes
            ),
            datosPaciente: {
                edadAnios: normalizeNullableInt(patientFactsSource.edadAnios),
                pesoKg: normalizeNullableFloat(patientFactsSource.pesoKg),
                sexoBiologico: normalizeString(
                    patientFactsSource.sexoBiologico
                ),
                embarazo:
                    patientFactsSource.embarazo === null ||
                    patientFactsSource.embarazo === undefined
                        ? null
                        : patientFactsSource.embarazo === true,
            },
        },
        clinicianDraft: {
            ...defaults.clinicianDraft,
            resumen: normalizeString(
                clinicianSource.resumen || clinicianSource.resumenClinico
            ),
            preguntasFaltantes: normalizeStringList(
                clinicianSource.preguntasFaltantes
            ),
            cie10Sugeridos: normalizeStringList(clinicianSource.cie10Sugeridos),
            tratamientoBorrador: normalizeString(
                clinicianSource.tratamientoBorrador
            ),
            posologiaBorrador: normalizePosology(
                clinicianSource.posologiaBorrador
            ),
        },
        updatedAt: normalizeString(source.updatedAt),
        createdAt: normalizeString(source.createdAt),
    };
}

function normalizeEvent(event) {
    const source = event && typeof event === 'object' ? event : {};
    return {
        eventId: normalizeString(source.eventId),
        sessionId: normalizeString(source.sessionId),
        type: normalizeString(source.type),
        severity: normalizeString(source.severity || 'info'),
        status: normalizeString(source.status || 'open'),
        title: normalizeString(source.title),
        message: normalizeString(source.message),
        requiresAction: source.requiresAction === true,
        occurredAt: normalizeString(source.occurredAt || source.createdAt),
        acknowledgedAt: normalizeString(source.acknowledgedAt),
        resolvedAt: normalizeString(source.resolvedAt),
        patient: normalizePatient(source.patient),
    };
}

function normalizeReviewPayload(payload) {
    const review = emptyReview();
    const source = payload && typeof payload === 'object' ? payload : {};
    const sessionSource =
        source.session && typeof source.session === 'object'
            ? source.session
            : {};

    review.session = {
        ...review.session,
        sessionId: normalizeString(sessionSource.sessionId),
        caseId: normalizeString(sessionSource.caseId),
        appointmentId: normalizeNullableInt(sessionSource.appointmentId),
        surface: normalizeString(sessionSource.surface),
        status: normalizeString(sessionSource.status),
        patient: normalizePatient(sessionSource.patient),
        transcript: normalizeList(sessionSource.transcript).map(
            normalizeTranscriptMessage
        ),
        pendingAi:
            sessionSource.pendingAi &&
            typeof sessionSource.pendingAi === 'object'
                ? sessionSource.pendingAi
                : {},
        metadata:
            sessionSource.metadata && typeof sessionSource.metadata === 'object'
                ? sessionSource.metadata
                : {},
        createdAt: normalizeString(sessionSource.createdAt),
        updatedAt: normalizeString(sessionSource.updatedAt),
        lastMessageAt: normalizeString(sessionSource.lastMessageAt),
    };
    review.draft = normalizeDraftSnapshot(source.draft);
    review.events = normalizeList(source.events).map(normalizeEvent);
    return review;
}

function readClinicalHistoryMeta(state = getState()) {
    return state?.data?.clinicalHistoryMeta &&
        typeof state.data.clinicalHistoryMeta === 'object'
        ? state.data.clinicalHistoryMeta
        : {};
}

function getClinicalHistorySlice(state = getState()) {
    return state?.clinicalHistory && typeof state.clinicalHistory === 'object'
        ? state.clinicalHistory
        : {};
}

function setClinicalHistoryState(patch) {
    updateState((state) => ({
        ...state,
        clinicalHistory: {
            ...state.clinicalHistory,
            ...patch,
        },
    }));
}

function formatReviewStatus(status) {
    switch (normalizeString(status).toLowerCase()) {
        case 'approved':
            return 'Aprobada';
        case 'ready_for_review':
            return 'Lista para revisar';
        case 'review_required':
            return 'Revision requerida';
        case 'draft_ready':
            return 'Borrador listo';
        default:
            return 'Pendiente';
    }
}

function formatSeverity(severity) {
    switch (normalizeString(severity).toLowerCase()) {
        case 'critical':
            return 'Critico';
        case 'warning':
            return 'Alerta';
        default:
            return 'Info';
    }
}

function formatPendingAiStatus(status) {
    switch (normalizeString(status).toLowerCase()) {
        case 'queued':
            return 'IA en cola';
        case 'processing':
            return 'IA procesando';
        case 'completed':
            return 'IA conciliada';
        case 'failed':
            return 'IA fallo';
        default:
            return '';
    }
}

function formatConfidence(confidence) {
    const safeConfidence = normalizeNumber(confidence);
    if (safeConfidence <= 0) {
        return 'Sin confianza';
    }

    return `${Math.round(safeConfidence * 100)}% confianza`;
}

function formatTone(status, requiresHumanReview, pendingAiStatus) {
    if (normalizeString(pendingAiStatus) !== '') {
        return 'warning';
    }
    if (normalizeString(status) === 'approved') {
        return 'success';
    }
    if (requiresHumanReview) {
        return 'warning';
    }
    return 'neutral';
}

function transcriptActorLabel(message) {
    switch (normalizeString(message.actor).toLowerCase()) {
        case 'clinical_intake':
            return 'IA';
        case 'clinician_review':
            return 'Medico';
        default:
            return 'Paciente';
    }
}

function transcriptActorTone(message) {
    switch (normalizeString(message.actor).toLowerCase()) {
        case 'clinical_intake':
            return 'assistant';
        case 'clinician_review':
            return 'review';
        default:
            return 'patient';
    }
}

function listToTextarea(value) {
    return normalizeStringList(value).join('\n');
}

function serializeTextareaLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((item) => normalizeString(item))
        .filter(Boolean);
}

function readableTimestamp(value) {
    const text = normalizeString(value);
    return text ? formatDateTime(text) : '-';
}

function currentSelectionLabel(review) {
    const patientName = normalizeString(review.session.patient.name);
    if (patientName) {
        return patientName;
    }

    const caseId = normalizeString(review.session.caseId);
    if (caseId) {
        return `Caso ${caseId}`;
    }

    return 'Sin seleccion';
}

function currentReviewSource(state = getState()) {
    const slice = getClinicalHistorySlice(state);
    if (slice.current && typeof slice.current === 'object') {
        return normalizeReviewPayload(slice.current);
    }

    return emptyReview();
}

function currentDraftSource(state = getState()) {
    const slice = getClinicalHistorySlice(state);
    if (slice.draftForm && typeof slice.draftForm === 'object') {
        return normalizeDraftSnapshot(slice.draftForm);
    }

    return currentReviewSource(state).draft;
}

function truncateText(value, limit = 120) {
    const text = normalizeString(value);
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function formatBytes(value) {
    const size = normalizeNumber(value);
    if (size <= 0) {
        return '0 B';
    }
    if (size < 1024) {
        return `${Math.round(size)} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPregnancy(value) {
    if (value === true) {
        return 'Embarazo reportado';
    }
    if (value === false) {
        return 'Sin embarazo';
    }
    return 'Embarazo no documentado';
}

function pregnancySelectValue(value) {
    if (value === true) {
        return 'yes';
    }
    if (value === false) {
        return 'no';
    }
    return '';
}

function normalizePregnancyValue(value) {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized === 'yes') {
        return true;
    }
    if (normalized === 'no') {
        return false;
    }
    return null;
}

function formatPatientFacts(patient, intake) {
    const age = normalizeNullableInt(
        intake?.datosPaciente?.edadAnios ?? patient.ageYears
    );
    const weight = normalizeNullableFloat(
        intake?.datosPaciente?.pesoKg ?? patient.weightKg
    );
    const sex =
        normalizeString(intake?.datosPaciente?.sexoBiologico) ||
        normalizeString(patient.sexAtBirth) ||
        'Sin sexo biologico';
    const pregnancy =
        intake?.datosPaciente?.embarazo !== undefined
            ? intake.datosPaciente.embarazo
            : patient.pregnant;

    return [
        age !== null ? `${age} anos` : '',
        weight !== null ? `${weight} kg` : '',
        sex,
        formatPregnancy(pregnancy),
    ]
        .filter(Boolean)
        .join(' • ');
}

function formatHtmlMultiline(value) {
    const safe = escapeHtml(normalizeString(value));
    return safe ? safe.replace(/\n/g, '<br>') : '';
}

function summaryStatCard(title, value, meta, tone = 'neutral') {
    return `
        <article class="clinical-history-stat-card" data-tone="${escapeHtml(
            tone
        )}">
            <span>${escapeHtml(title)}</span>
            <strong>${escapeHtml(value)}</strong>
            <small>${escapeHtml(meta)}</small>
        </article>
    `;
}

function buildSummaryCards(review) {
    const patient = review.session.patient;
    const draft = review.draft;
    const pendingAiStatus = formatPendingAiStatus(
        review.session.pendingAi?.status || draft.pendingAi?.status
    );
    const statusTone = formatTone(
        draft.reviewStatus,
        draft.requiresHumanReview,
        pendingAiStatus
    );
    const reviewReasons =
        draft.reviewReasons.length > 0
            ? draft.reviewReasons.join(', ')
            : draft.requiresHumanReview
              ? 'Requiere firma humana'
              : 'Lista para cierre';
    const followUps =
        draft.clinicianDraft.preguntasFaltantes.length ||
        draft.intake.preguntasFaltantes.length;

    return [
        summaryStatCard(
            'Paciente',
            currentSelectionLabel(review),
            patient.email || patient.phone || 'Sin contacto documentado'
        ),
        summaryStatCard(
            'Estado',
            formatReviewStatus(draft.reviewStatus),
            pendingAiStatus || reviewReasons,
            statusTone
        ),
        summaryStatCard(
            'Guardrails',
            draft.requiresHumanReview ? 'Revisar' : 'Listo',
            draft.reviewReasons.length > 0
                ? truncateText(draft.reviewReasons.join(', '), 90)
                : 'Sin bloqueo determinista activo',
            draft.requiresHumanReview ? 'warning' : 'success'
        ),
        summaryStatCard(
            'Paciente facts',
            formatConfidence(draft.confidence),
            formatPatientFacts(patient, draft.intake) ||
                'Sin datos clinicos base'
        ),
        summaryStatCard(
            'Preguntas',
            String(followUps),
            followUps > 0
                ? 'Faltan respuestas para cerrar la anamnesis'
                : 'Sin preguntas abiertas',
            followUps > 0 ? 'warning' : 'success'
        ),
        summaryStatCard(
            'Actividad',
            readableTimestamp(
                review.session.lastMessageAt ||
                    review.session.updatedAt ||
                    draft.updatedAt
            ),
            review.session.surface || 'Sin superficie'
        ),
    ].join('');
}

function buildAttachmentStrip(review) {
    const attachments = normalizeList(review.draft.intake.adjuntos);
    if (attachments.length === 0) {
        return `
            <article class="clinical-history-attachment-card is-empty">
                <strong>Sin adjuntos clinicos</strong>
                <small>Las fotos y documentos privados del caso apareceran aqui.</small>
            </article>
        `;
    }

    return attachments
        .map((attachment) => {
            const details = [
                normalizeString(attachment.kind) || 'archivo',
                normalizeString(attachment.mime),
                formatBytes(attachment.size),
            ]
                .filter(Boolean)
                .join(' • ');

            return `
                <article class="clinical-history-attachment-card">
                    <strong>${escapeHtml(
                        attachment.originalName ||
                            `Adjunto ${attachment.id || ''}`
                    )}</strong>
                    <small>${escapeHtml(details || 'Adjunto privado')}</small>
                    <span>${escapeHtml(
                        attachment.privatePath || 'Disponible solo para staff'
                    )}</span>
                </article>
            `;
        })
        .join('');
}

function queueReasons(item) {
    return [
        ...normalizeStringList(item.missingFields),
        ...normalizeStringList(item.reviewReasons),
        ...normalizeStringList(item.redFlags),
    ];
}

function buildQueueList(meta, selectedSessionId, loading) {
    const reviewQueue = normalizeList(meta.reviewQueue);
    if (reviewQueue.length === 0) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin cola activa</strong>
                <p>No hay historias clinicas esperando revision humana.</p>
            </article>
        `;
    }

    return reviewQueue
        .map((item) => {
            const sessionId = normalizeString(item.sessionId);
            const summary = truncateText(
                item.summary ||
                    queueReasons(item).join(' • ') ||
                    'Caso listo para revision clinica.',
                140
            );
            const status =
                formatPendingAiStatus(item.pendingAiStatus) ||
                formatReviewStatus(item.reviewStatus || item.sessionStatus);
            const tone = formatTone(
                item.reviewStatus || item.sessionStatus,
                item.requiresHumanReview,
                item.pendingAiStatus
            );
            const chips = [
                status,
                formatConfidence(item.confidence),
                item.attachmentCount > 0
                    ? `${item.attachmentCount} adjunto(s)`
                    : '',
            ].filter(Boolean);

            return `
                <button
                    type="button"
                    class="clinical-history-queue-item${
                        sessionId === selectedSessionId ? ' is-selected' : ''
                    }"
                    data-clinical-session-id="${escapeHtml(sessionId)}"
                    ${loading ? 'disabled' : ''}
                >
                    <div class="clinical-history-queue-head">
                        <strong>${escapeHtml(
                            item.patientName || item.caseId || 'Caso clinico'
                        )}</strong>
                        <span class="clinical-history-mini-chip" data-tone="${escapeHtml(
                            tone
                        )}">
                            ${escapeHtml(status)}
                        </span>
                    </div>
                    <p>${escapeHtml(summary)}</p>
                    <div class="clinical-history-mini-chip-row">
                        ${chips
                            .map(
                                (chip) =>
                                    `<span class="clinical-history-mini-chip">${escapeHtml(
                                        chip
                                    )}</span>`
                            )
                            .join('')}
                    </div>
                    <small>${escapeHtml(
                        readableTimestamp(item.updatedAt || item.createdAt)
                    )}</small>
                </button>
            `;
        })
        .join('');
}

function buildTranscript(review, loading, error) {
    if (loading && review.session.transcript.length === 0) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Cargando conversacion</strong>
                <p>Estamos recuperando el transcript y el borrador medico.</p>
            </article>
        `;
    }

    if (error && review.session.transcript.length === 0) {
        return `
            <article class="clinical-history-empty-card" data-tone="warning">
                <strong>No se pudo cargar el caso</strong>
                <p>${escapeHtml(error)}</p>
            </article>
        `;
    }

    if (review.session.transcript.length === 0) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin transcript</strong>
                <p>La conversacion del paciente aparecera aqui cuando exista una sesion cargada.</p>
            </article>
        `;
    }

    return review.session.transcript
        .map((message) => {
            const surface = normalizeString(message.surface);
            const fieldKey = normalizeString(message.fieldKey);
            const meta = [surface, fieldKey].filter(Boolean).join(' • ');
            return `
                <article
                    class="clinical-history-message"
                    data-actor-tone="${escapeHtml(transcriptActorTone(message))}"
                >
                    <header>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            transcriptActorLabel(message)
                        )}</span>
                        <time>${escapeHtml(
                            readableTimestamp(message.createdAt)
                        )}</time>
                    </header>
                    <p>${formatHtmlMultiline(message.content)}</p>
                    <small>${escapeHtml(meta || 'Sin metadata clinica')}</small>
                </article>
            `;
        })
        .join('');
}

function buildEvents(review) {
    if (review.events.length === 0) {
        return `
            <article class="clinical-history-empty-card">
                <strong>Sin eventos abiertos</strong>
                <p>Cuando haya alertas, conciliaciones o acciones pendientes apareceran aqui.</p>
            </article>
        `;
    }

    return review.events
        .map((event) => {
            const tone =
                normalizeString(event.severity).toLowerCase() === 'critical'
                    ? 'danger'
                    : normalizeString(event.severity).toLowerCase() ===
                        'warning'
                      ? 'warning'
                      : event.requiresAction
                        ? 'warning'
                        : 'neutral';
            const meta = [
                event.status ? `Estado ${event.status}` : '',
                readableTimestamp(
                    event.occurredAt || event.acknowledgedAt || event.resolvedAt
                ),
            ]
                .filter(Boolean)
                .join(' • ');

            return `
                <article class="clinical-history-event-card" data-tone="${escapeHtml(
                    tone
                )}">
                    <div class="clinical-history-event-head">
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            formatSeverity(event.severity)
                        )}</span>
                        <span class="clinical-history-mini-chip">${escapeHtml(
                            event.status || 'open'
                        )}</span>
                    </div>
                    <strong>${escapeHtml(
                        event.title || event.type || 'Evento clinico'
                    )}</strong>
                    <p>${escapeHtml(
                        event.message || 'Sin detalle operativo adicional.'
                    )}</p>
                    <small>${escapeHtml(meta || 'Sin timestamp')}</small>
                </article>
            `;
        })
        .join('');
}

function textareaField(id, label, value, options = {}) {
    const { placeholder = '', rows = 4, hint = '', disabled = false } = options;

    return `
        <label class="clinical-history-field" for="${escapeHtml(id)}">
            <span>${escapeHtml(label)}</span>
            <textarea
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                rows="${Number(rows) || 4}"
                placeholder="${escapeHtml(placeholder)}"
                ${disabled ? 'disabled' : ''}
            >${escapeHtml(value)}</textarea>
            ${
                hint
                    ? `<small>${escapeHtml(hint)}</small>`
                    : '<small>&nbsp;</small>'
            }
        </label>
    `;
}

function inputField(id, label, value, options = {}) {
    const {
        type = 'text',
        placeholder = '',
        hint = '',
        step = '',
        min = '',
        disabled = false,
    } = options;

    return `
        <label class="clinical-history-field" for="${escapeHtml(id)}">
            <span>${escapeHtml(label)}</span>
            <input
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                type="${escapeHtml(type)}"
                value="${escapeHtml(value)}"
                placeholder="${escapeHtml(placeholder)}"
                ${step !== '' ? `step="${escapeHtml(step)}"` : ''}
                ${min !== '' ? `min="${escapeHtml(min)}"` : ''}
                ${disabled ? 'disabled' : ''}
            />
            ${
                hint
                    ? `<small>${escapeHtml(hint)}</small>`
                    : '<small>&nbsp;</small>'
            }
        </label>
    `;
}

function checkboxField(id, label, checked, options = {}) {
    const { hint = '', disabled = false } = options;
    return `
        <label class="clinical-history-toggle" for="${escapeHtml(id)}">
            <input
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                type="checkbox"
                ${checked ? 'checked' : ''}
                ${disabled ? 'disabled' : ''}
            />
            <span>
                <strong>${escapeHtml(label)}</strong>
                <small>${escapeHtml(hint || ' ')}</small>
            </span>
        </label>
    `;
}

function selectField(id, label, value, choices, options = {}) {
    const { hint = '', disabled = false } = options;
    return `
        <label class="clinical-history-field" for="${escapeHtml(id)}">
            <span>${escapeHtml(label)}</span>
            <select
                id="${escapeHtml(id)}"
                name="${escapeHtml(id)}"
                ${disabled ? 'disabled' : ''}
            >
                ${choices
                    .map(
                        (choice) => `
                            <option
                                value="${escapeHtml(choice.value)}"
                                ${
                                    normalizeString(choice.value) ===
                                    normalizeString(value)
                                        ? 'selected'
                                        : ''
                                }
                            >
                                ${escapeHtml(choice.label)}
                            </option>
                        `
                    )
                    .join('')}
            </select>
            ${
                hint
                    ? `<small>${escapeHtml(hint)}</small>`
                    : '<small>&nbsp;</small>'
            }
        </label>
    `;
}

function buildDraftForm(draft, saving) {
    const disabled = saving || normalizeString(draft.sessionId) === '';
    const pregnancyValue = pregnancySelectValue(
        draft.intake.datosPaciente.embarazo
    );
    const reviewReasons = draft.reviewReasons.join(', ');

    return `
        <div class="clinical-history-form-grid">
            <section class="clinical-history-form-section">
                <header>
                    <h4>Intake estructurado</h4>
                    <p>Motivo de consulta, evolucion y datos del paciente.</p>
                </header>
                ${inputField(
                    'intake_motivo_consulta',
                    'Motivo de consulta',
                    draft.intake.motivoConsulta,
                    {
                        placeholder: 'Ej. prurito, acne inflamatorio, rash',
                        disabled,
                    }
                )}
                ${textareaField(
                    'intake_enfermedad_actual',
                    'Enfermedad actual',
                    draft.intake.enfermedadActual,
                    {
                        rows: 5,
                        placeholder:
                            'Evolucion temporal, distribucion, desencadenantes.',
                        disabled,
                    }
                )}
                <div class="clinical-history-inline-grid">
                    ${textareaField(
                        'intake_antecedentes',
                        'Antecedentes',
                        draft.intake.antecedentes,
                        {
                            rows: 4,
                            placeholder:
                                'Dermatologicos, familiares, cronicos.',
                            disabled,
                        }
                    )}
                    ${textareaField(
                        'intake_alergias',
                        'Alergias',
                        draft.intake.alergias,
                        {
                            rows: 4,
                            placeholder: 'Medicamentos, alimentos, contacto.',
                            disabled,
                        }
                    )}
                </div>
                <div class="clinical-history-inline-grid">
                    ${textareaField(
                        'intake_medicacion_actual',
                        'Medicacion actual',
                        draft.intake.medicacionActual,
                        {
                            rows: 4,
                            placeholder: 'Nombre, dosis, frecuencia.',
                            disabled,
                        }
                    )}
                    ${textareaField(
                        'intake_ros_red_flags',
                        'ROS / red flags',
                        listToTextarea(draft.intake.rosRedFlags),
                        {
                            rows: 4,
                            placeholder:
                                'Una linea por dato clinico o red flag.',
                            hint: 'Cada linea se guarda como item separado.',
                            disabled,
                        }
                    )}
                </div>
                ${textareaField(
                    'intake_resumen_clinico',
                    'Resumen clinico',
                    draft.intake.resumenClinico,
                    {
                        rows: 4,
                        placeholder: 'Resumen limpio para pasar a la consulta.',
                        disabled,
                    }
                )}
                ${textareaField(
                    'intake_preguntas_faltantes',
                    'Preguntas faltantes del intake',
                    listToTextarea(draft.intake.preguntasFaltantes),
                    {
                        rows: 3,
                        placeholder: 'Una pregunta por linea.',
                        disabled,
                    }
                )}
                <div class="clinical-history-inline-grid">
                    ${inputField(
                        'patient_edad_anios',
                        'Edad (anos)',
                        draft.intake.datosPaciente.edadAnios ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    )}
                    ${inputField(
                        'patient_peso_kg',
                        'Peso (kg)',
                        draft.intake.datosPaciente.pesoKg ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '0.1',
                            disabled,
                        }
                    )}
                    ${selectField(
                        'patient_sexo_biologico',
                        'Sexo biologico',
                        draft.intake.datosPaciente.sexoBiologico,
                        [
                            { value: '', label: 'Sin dato' },
                            { value: 'femenino', label: 'Femenino' },
                            { value: 'masculino', label: 'Masculino' },
                            { value: 'intersexual', label: 'Intersexual' },
                        ],
                        { disabled }
                    )}
                    ${selectField(
                        'patient_embarazo',
                        'Embarazo',
                        pregnancyValue,
                        [
                            { value: '', label: 'Sin dato' },
                            { value: 'no', label: 'No' },
                            { value: 'yes', label: 'Si' },
                        ],
                        { disabled }
                    )}
                </div>
            </section>

            <section class="clinical-history-form-section">
                <header>
                    <h4>Sintesis del medico</h4>
                    <p>Bloque solo interno: resumen, CIE-10, plan y guardrails.</p>
                </header>
                ${textareaField(
                    'clinician_resumen',
                    'Resumen medico',
                    draft.clinicianDraft.resumen,
                    {
                        rows: 4,
                        placeholder: 'Sintesis final para presentar o firmar.',
                        disabled,
                    }
                )}
                <div class="clinical-history-inline-grid">
                    ${textareaField(
                        'clinician_preguntas_faltantes',
                        'Preguntas faltantes',
                        listToTextarea(draft.clinicianDraft.preguntasFaltantes),
                        {
                            rows: 4,
                            placeholder: 'Una linea por pregunta.',
                            disabled,
                        }
                    )}
                    ${textareaField(
                        'clinician_cie10',
                        'CIE-10 sugeridos',
                        listToTextarea(draft.clinicianDraft.cie10Sugeridos),
                        {
                            rows: 4,
                            placeholder: 'Ej. L20.9',
                            disabled,
                        }
                    )}
                </div>
                ${textareaField(
                    'clinician_tratamiento',
                    'Tratamiento borrador',
                    draft.clinicianDraft.tratamientoBorrador,
                    {
                        rows: 4,
                        placeholder:
                            'No se muestra al paciente; requiere firma humana.',
                        disabled,
                    }
                )}
                <div class="clinical-history-inline-grid">
                    ${textareaField(
                        'posologia_texto',
                        'Posologia borrador',
                        draft.clinicianDraft.posologiaBorrador.texto,
                        {
                            rows: 4,
                            placeholder: 'Ej. 1 comp cada 12 h por 7 dias.',
                            disabled,
                        }
                    )}
                    ${textareaField(
                        'posologia_base_calculo',
                        'Base de calculo',
                        draft.clinicianDraft.posologiaBorrador.baseCalculo,
                        {
                            rows: 4,
                            placeholder: 'Regla, mg/kg, fuente o criterio.',
                            disabled,
                        }
                    )}
                </div>
                <div class="clinical-history-inline-grid">
                    ${inputField(
                        'posologia_peso_kg',
                        'Peso usado (kg)',
                        draft.clinicianDraft.posologiaBorrador.pesoKg ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '0.1',
                            disabled,
                        }
                    )}
                    ${inputField(
                        'posologia_edad_anios',
                        'Edad usada (anos)',
                        draft.clinicianDraft.posologiaBorrador.edadAnios ?? '',
                        {
                            type: 'number',
                            min: '0',
                            step: '1',
                            disabled,
                        }
                    )}
                    ${inputField(
                        'posologia_units',
                        'Unidades',
                        draft.clinicianDraft.posologiaBorrador.units,
                        {
                            placeholder: 'mg, mg/kg/dia, ml',
                            disabled,
                        }
                    )}
                </div>
                ${checkboxField(
                    'posologia_ambiguous',
                    'La posologia sigue ambigua',
                    draft.clinicianDraft.posologiaBorrador.ambiguous === true,
                    {
                        hint: 'Mantiene el caso en revisado con cautela.',
                        disabled,
                    }
                )}
                ${checkboxField(
                    'requires_human_review',
                    'Requiere revision humana',
                    draft.requiresHumanReview === true,
                    {
                        hint:
                            reviewReasons ||
                            'Toda aprobacion final sigue siendo humana.',
                        disabled,
                    }
                )}
            </section>
        </div>
    `;
}

function syncDraftStatusMeta() {
    const state = getState();
    const slice = getClinicalHistorySlice(state);
    const review = currentReviewSource(state);
    const draft = currentDraftSource(state);

    let meta = 'Sin cambios';
    if (slice.saving) {
        meta = 'Guardando borrador clinico...';
    } else if (slice.loading) {
        meta = 'Cargando sesion clinica...';
    } else if (slice.error) {
        meta = slice.error;
    } else if (slice.dirty) {
        meta = 'Cambios sin guardar';
    } else if (draft.updatedAt) {
        meta = `Ultima actualizacion ${readableTimestamp(draft.updatedAt)}`;
    }

    setText('#clinicalHistoryDraftMeta', meta);
    setText(
        '#clinicalHistoryDraftSummary',
        review.session.sessionId
            ? `Editando ${currentSelectionLabel(review)} • ${formatReviewStatus(
                  draft.reviewStatus
              )}`
            : 'Selecciona un caso para editar anamnesis, plan y guardrails.'
    );
    setText(
        '#clinicalHistoryFollowUpMeta',
        review.session.sessionId
            ? `La pregunta saldra por el mismo hilo de ${currentSelectionLabel(
                  review
              )}.`
            : 'Envia una pregunta puntual al paciente sin salir del review.'
    );

    const hasSelection = normalizeString(review.session.sessionId) !== '';
    const sharedDisabled = !hasSelection || slice.loading || slice.saving;
    const saveButton = document.getElementById('clinicalHistorySaveBtn');
    const approveButton = document.getElementById('clinicalHistoryApproveBtn');
    const refreshButton = document.getElementById('clinicalHistoryRefreshBtn');
    const reviewButton = document.getElementById(
        'clinicalHistoryReviewRequiredBtn'
    );
    const followUpButton = document.getElementById(
        'clinicalHistorySendFollowUpBtn'
    );

    if (saveButton instanceof HTMLButtonElement) {
        saveButton.disabled = sharedDisabled;
    }
    if (approveButton instanceof HTMLButtonElement) {
        approveButton.disabled = sharedDisabled;
    }
    if (refreshButton instanceof HTMLButtonElement) {
        refreshButton.disabled = sharedDisabled;
    }
    if (reviewButton instanceof HTMLButtonElement) {
        reviewButton.disabled = sharedDisabled;
    }
    if (followUpButton instanceof HTMLButtonElement) {
        followUpButton.disabled =
            sharedDisabled || normalizeString(slice.followUpQuestion) === '';
    }
}

function serializeDraftForm(form, baseDraft) {
    const snapshot = normalizeDraftSnapshot(
        cloneValue(baseDraft || emptyDraft())
    );

    if (!(form instanceof HTMLFormElement)) {
        return snapshot;
    }

    const readValue = (name) => {
        const field = form.elements.namedItem(name);
        if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement ||
            field instanceof HTMLSelectElement
        ) {
            return field.value;
        }
        return '';
    };

    const readChecked = (name) => {
        const field = form.elements.namedItem(name);
        return field instanceof HTMLInputElement ? field.checked : false;
    };

    snapshot.intake.motivoConsulta = normalizeString(
        readValue('intake_motivo_consulta')
    );
    snapshot.intake.enfermedadActual = normalizeString(
        readValue('intake_enfermedad_actual')
    );
    snapshot.intake.antecedentes = normalizeString(
        readValue('intake_antecedentes')
    );
    snapshot.intake.alergias = normalizeString(readValue('intake_alergias'));
    snapshot.intake.medicacionActual = normalizeString(
        readValue('intake_medicacion_actual')
    );
    snapshot.intake.rosRedFlags = serializeTextareaLines(
        readValue('intake_ros_red_flags')
    );
    snapshot.intake.resumenClinico = normalizeString(
        readValue('intake_resumen_clinico')
    );
    snapshot.intake.preguntasFaltantes = serializeTextareaLines(
        readValue('intake_preguntas_faltantes')
    );
    snapshot.intake.datosPaciente = {
        ...snapshot.intake.datosPaciente,
        edadAnios: normalizeNullableInt(readValue('patient_edad_anios')),
        pesoKg: normalizeNullableFloat(readValue('patient_peso_kg')),
        sexoBiologico: normalizeString(readValue('patient_sexo_biologico')),
        embarazo: normalizePregnancyValue(readValue('patient_embarazo')),
    };

    snapshot.clinicianDraft.resumen = normalizeString(
        readValue('clinician_resumen')
    );
    snapshot.clinicianDraft.preguntasFaltantes = serializeTextareaLines(
        readValue('clinician_preguntas_faltantes')
    );
    snapshot.clinicianDraft.cie10Sugeridos = serializeTextareaLines(
        readValue('clinician_cie10')
    );
    snapshot.clinicianDraft.tratamientoBorrador = normalizeString(
        readValue('clinician_tratamiento')
    );
    snapshot.clinicianDraft.posologiaBorrador = normalizePosology({
        texto: readValue('posologia_texto'),
        baseCalculo: readValue('posologia_base_calculo'),
        pesoKg: readValue('posologia_peso_kg'),
        edadAnios: readValue('posologia_edad_anios'),
        units: readValue('posologia_units'),
        ambiguous: readChecked('posologia_ambiguous'),
    });

    snapshot.requiresHumanReview = readChecked('requires_human_review');
    return snapshot;
}

function renderClinicalHeader(review, meta) {
    const selectedLabel = currentSelectionLabel(review);
    const draft = currentDraftSource();
    const pendingAiStatus =
        formatPendingAiStatus(
            review.session.pendingAi?.status || draft.pendingAi?.status
        ) || '';
    const tone = formatTone(
        draft.reviewStatus,
        draft.requiresHumanReview,
        pendingAiStatus
    );
    const statusChip = document.getElementById('clinicalHistoryStatusChip');
    if (statusChip instanceof HTMLElement) {
        statusChip.dataset.tone = tone;
        statusChip.textContent = review.session.sessionId
            ? formatReviewStatus(draft.reviewStatus)
            : 'Sin seleccion';
    }

    const headerMeta = [
        review.session.caseId ? `Caso ${review.session.caseId}` : '',
        review.session.surface || '',
        review.session.appointmentId
            ? `Cita ${review.session.appointmentId}`
            : '',
        selectedLabel,
    ]
        .filter(Boolean)
        .join(' • ');
    setText(
        '#clinicalHistoryHeaderMeta',
        headerMeta ||
            'Selecciona un caso para revisar la conversacion y el borrador medico.'
    );

    const statusMeta = [
        pendingAiStatus,
        draft.requiresHumanReview
            ? 'Firma humana requerida'
            : 'Lista para cierre',
        formatConfidence(draft.confidence),
    ]
        .filter(Boolean)
        .join(' • ');
    setText(
        '#clinicalHistoryStatusMeta',
        statusMeta ||
            `${normalizeList(meta.reviewQueue).length} caso(s) listos para revision`
    );
}

function syncFollowUpInput() {
    const slice = getClinicalHistorySlice();
    const input = document.getElementById('clinicalHistoryFollowUpInput');
    if (input instanceof HTMLTextAreaElement) {
        if (input.value !== String(slice.followUpQuestion || '')) {
            input.value = String(slice.followUpQuestion || '');
        }
        input.disabled = slice.loading || slice.saving;
    }
}

function currentSessionId(state = getState()) {
    const slice = getClinicalHistorySlice(state);
    const selected = normalizeString(slice.selectedSessionId);
    if (selected) {
        return selected;
    }

    return normalizeString(currentReviewSource(state).session.sessionId);
}

async function loadClinicalHistorySession(sessionId, options = {}) {
    const desiredSessionId = normalizeString(sessionId);
    if (!desiredSessionId) {
        setQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM, '');
        setClinicalHistoryState({
            selectedSessionId: '',
            loading: false,
            error: '',
            dirty: false,
            current: null,
            draftForm: null,
        });
        renderClinicalHistorySection();
        return null;
    }

    const slice = getClinicalHistorySlice();
    if (
        options.force !== true &&
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        slice.current
    ) {
        return currentReviewSource();
    }

    setQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM, desiredSessionId);
    setClinicalHistoryState({
        selectedSessionId: desiredSessionId,
        loading: true,
        error: '',
    });
    renderClinicalHistorySection();

    try {
        const response = await apiRequest('clinical-history-review', {
            query: {
                sessionId: desiredSessionId,
            },
        });
        const review = normalizeReviewPayload(response.data);
        setClinicalHistoryState({
            selectedSessionId: review.session.sessionId || desiredSessionId,
            loading: false,
            error: '',
            dirty: false,
            lastLoadedAt: Date.now(),
            current: review,
            draftForm: cloneValue(review.draft),
        });
        renderClinicalHistorySection();
        return review;
    } catch (error) {
        setClinicalHistoryState({
            selectedSessionId: desiredSessionId,
            loading: false,
            error:
                error?.message ||
                'No se pudo cargar la revision clinica de este caso.',
            current: null,
            draftForm: null,
        });
        renderClinicalHistorySection();
        if (options.silent !== true) {
            createToast(
                error?.message ||
                    'No se pudo cargar la revision clinica de este caso.',
                'error'
            );
        }
        return null;
    }
}

function buildReviewPatch(mode, question) {
    const review = currentReviewSource();
    const draft = currentDraftSource();
    const sessionId = normalizeString(
        review.session.sessionId || draft.sessionId
    );
    const payload = {
        sessionId,
        draft: {
            intake: {
                motivoConsulta: draft.intake.motivoConsulta,
                enfermedadActual: draft.intake.enfermedadActual,
                antecedentes: draft.intake.antecedentes,
                alergias: draft.intake.alergias,
                medicacionActual: draft.intake.medicacionActual,
                rosRedFlags: cloneValue(draft.intake.rosRedFlags),
                resumenClinico: draft.intake.resumenClinico,
                preguntasFaltantes: cloneValue(draft.intake.preguntasFaltantes),
                datosPaciente: cloneValue(draft.intake.datosPaciente),
            },
            clinicianDraft: cloneValue(draft.clinicianDraft),
        },
        requiresHumanReview: draft.requiresHumanReview === true,
    };

    if (mode === 'review-required') {
        payload.reviewStatus = 'review_required';
        payload.requiresHumanReview = true;
    }

    if (mode === 'approve') {
        payload.approve = true;
        payload.requiresHumanReview = false;
    }

    if (mode === 'follow-up') {
        payload.requestAdditionalQuestion = normalizeString(question);
    }

    return payload;
}

async function saveClinicalHistoryReview(mode, question) {
    const review = currentReviewSource();
    const sessionId = normalizeString(review.session.sessionId);
    if (!sessionId) {
        createToast('Selecciona un caso clinico antes de guardar.', 'warning');
        return null;
    }

    const rootForm = document.getElementById('clinicalHistoryDraftForm');
    const nextDraft = serializeDraftForm(rootForm, currentDraftSource());
    setClinicalHistoryState({
        draftForm: cloneValue(nextDraft),
        saving: true,
        error: '',
        dirty: true,
    });
    syncDraftStatusMeta();

    try {
        const response = await apiRequest('clinical-history-review', {
            method: 'PATCH',
            body: buildReviewPatch(mode, question),
        });
        const nextReview = normalizeReviewPayload(response.data);
        setClinicalHistoryState({
            saving: false,
            error: '',
            dirty: false,
            current: nextReview,
            draftForm: cloneValue(nextReview.draft),
            selectedSessionId: nextReview.session.sessionId || sessionId,
            followUpQuestion:
                mode === 'follow-up'
                    ? ''
                    : getClinicalHistorySlice().followUpQuestion,
            lastLoadedAt: Date.now(),
        });

        try {
            await refreshAdminData();
        } catch (_error) {
            // If the snapshot refresh fails, keep the local review state usable.
        }

        renderAdminChrome(getState());
        renderDashboard(getState());
        renderClinicalHistorySection();

        if (mode === 'approve') {
            createToast('Historia clinica aprobada.', 'success');
        } else if (mode === 'review-required') {
            createToast('Caso marcado para revision humana.', 'success');
        } else if (mode === 'follow-up') {
            createToast('Pregunta adicional enviada al paciente.', 'success');
        } else {
            createToast('Borrador clinico guardado.', 'success');
        }

        return nextReview;
    } catch (error) {
        setClinicalHistoryState({
            saving: false,
            error:
                error?.message ||
                'No se pudo guardar la revision clinica del caso.',
        });
        syncDraftStatusMeta();
        createToast(
            error?.message ||
                'No se pudo guardar la revision clinica del caso.',
            'error'
        );
        return null;
    }
}

function captureDraftFromDom() {
    const form = document.getElementById('clinicalHistoryDraftForm');
    if (!(form instanceof HTMLFormElement)) {
        return;
    }

    const review = currentReviewSource();
    const nextDraft = serializeDraftForm(form, currentDraftSource());
    const dirty =
        JSON.stringify(nextDraft) !==
        JSON.stringify(normalizeDraftSnapshot(review.draft));

    setClinicalHistoryState({
        draftForm: cloneValue(nextDraft),
        dirty,
    });
    syncDraftStatusMeta();
}

async function maybeSwitchSession(sessionId) {
    const desiredSessionId = normalizeString(sessionId);
    const slice = getClinicalHistorySlice();
    if (!desiredSessionId || slice.loading || slice.saving) {
        return null;
    }

    if (
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        slice.current
    ) {
        return currentReviewSource();
    }

    if (
        slice.dirty &&
        normalizeString(slice.selectedSessionId) !== desiredSessionId
    ) {
        const confirmed = window.confirm(
            'Hay cambios sin guardar en este borrador. ¿Deseas cambiar de caso igualmente?'
        );
        if (!confirmed) {
            return null;
        }
    }

    return loadClinicalHistorySession(desiredSessionId, { force: true });
}

function ensureSessionSelection() {
    const state = getState();
    if (state?.ui?.activeSection !== 'clinical-history') {
        return;
    }

    const slice = getClinicalHistorySlice(state);
    if (slice.loading || slice.saving) {
        return;
    }

    const querySessionId = normalizeString(
        getQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM)
    );
    const fallbackSessionId = normalizeString(
        normalizeList(readClinicalHistoryMeta(state).reviewQueue)[0]?.sessionId
    );
    const desiredSessionId =
        querySessionId ||
        normalizeString(slice.selectedSessionId) ||
        fallbackSessionId;

    if (!desiredSessionId) {
        scheduledAutoSelection = '';
        return;
    }

    if (
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        slice.current
    ) {
        scheduledAutoSelection = '';
        return;
    }

    if (
        desiredSessionId === normalizeString(slice.selectedSessionId) &&
        normalizeString(slice.error) !== ''
    ) {
        scheduledAutoSelection = '';
        return;
    }

    if (scheduledAutoSelection === desiredSessionId) {
        return;
    }

    scheduledAutoSelection = desiredSessionId;
    window.setTimeout(() => {
        const stillActive =
            getState()?.ui?.activeSection === 'clinical-history';
        if (!stillActive) {
            scheduledAutoSelection = '';
            return;
        }
        openClinicalHistorySession(desiredSessionId).finally(() => {
            scheduledAutoSelection = '';
        });
    }, 0);
}

function bindClinicalHistoryEvents() {
    const root = document.getElementById('clinical-history');
    if (!(root instanceof HTMLElement) || root.dataset.bound === 'true') {
        return;
    }

    root.addEventListener('click', async (event) => {
        const actionTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-review-action]')
                : null;
        const queueTarget =
            event.target instanceof Element
                ? event.target.closest('[data-clinical-session-id]')
                : null;

        if (queueTarget instanceof HTMLButtonElement) {
            event.preventDefault();
            await maybeSwitchSession(queueTarget.dataset.clinicalSessionId);
            return;
        }

        if (!(actionTarget instanceof HTMLButtonElement)) {
            return;
        }

        event.preventDefault();
        const action = normalizeString(
            actionTarget.dataset.clinicalReviewAction
        );
        if (action === 'refresh-current') {
            await refreshClinicalHistoryCurrentSession();
            return;
        }

        if (action === 'send-follow-up') {
            const question = normalizeString(
                getClinicalHistorySlice().followUpQuestion
            );
            if (!question) {
                createToast(
                    'Escribe la pregunta adicional antes de enviarla.',
                    'warning'
                );
                return;
            }
            await saveClinicalHistoryReview('follow-up', question);
            return;
        }

        if (action === 'mark-review-required') {
            await saveClinicalHistoryReview('review-required', '');
            return;
        }

        if (action === 'approve-current') {
            await saveClinicalHistoryReview('approve', '');
        }
    });

    root.addEventListener('submit', async (event) => {
        const form = event.target;
        if (
            !(form instanceof HTMLFormElement) ||
            form.id !== 'clinicalHistoryDraftForm'
        ) {
            return;
        }

        event.preventDefault();
        await saveClinicalHistoryReview('save', '');
    });

    root.addEventListener('input', (event) => {
        const target = event.target;
        if (
            target instanceof HTMLTextAreaElement &&
            target.id === 'clinicalHistoryFollowUpInput'
        ) {
            setClinicalHistoryState({
                followUpQuestion: target.value,
            });
            syncDraftStatusMeta();
            return;
        }

        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.form?.id === 'clinicalHistoryDraftForm') {
                captureDraftFromDom();
            }
        }
    });

    root.addEventListener('change', (event) => {
        const target = event.target;
        if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
        ) {
            if (target.form?.id === 'clinicalHistoryDraftForm') {
                captureDraftFromDom();
            }
        }
    });

    root.dataset.bound = 'true';
}

export async function openClinicalHistorySession(sessionId = '') {
    const explicitSessionId = normalizeString(sessionId);
    const selected =
        explicitSessionId ||
        normalizeString(getQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM));
    const fallback = normalizeString(
        normalizeList(readClinicalHistoryMeta().reviewQueue)[0]?.sessionId
    );
    return maybeSwitchSession(selected || fallback);
}

export async function refreshClinicalHistoryCurrentSession() {
    const selected =
        currentSessionId() ||
        normalizeString(getQueryParam(CLINICAL_HISTORY_SESSION_QUERY_PARAM));
    if (!selected) {
        renderClinicalHistorySection();
        return null;
    }
    return loadClinicalHistorySession(selected, { force: true });
}

export function renderClinicalHistorySection() {
    const state = getState();
    const meta = readClinicalHistoryMeta(state);
    const slice = getClinicalHistorySlice(state);
    const review = currentReviewSource(state);
    const draft = currentDraftSource(state);

    renderClinicalHeader(review, meta);
    setText(
        '#clinicalHistoryQueueMeta',
        `${normalizeList(meta.reviewQueue).length} caso(s) listos para revision humana.`
    );
    setText(
        '#clinicalHistoryTranscriptMeta',
        review.session.sessionId
            ? `${currentSelectionLabel(review)} • ${
                  review.session.surface || 'clinical_intake'
              }`
            : 'El transcript del paciente aparece aqui.'
    );
    setText(
        '#clinicalHistoryTranscriptCount',
        `${normalizeList(review.session.transcript).length} mensaje(s)`
    );
    setText(
        '#clinicalHistoryEventsMeta',
        review.events.length > 0
            ? `${review.events.length} evento(s) registrados para este caso.`
            : 'Alertas, conciliacion y acciones pendientes.'
    );

    setHtml('#clinicalHistorySummaryGrid', buildSummaryCards(review));
    setHtml('#clinicalHistoryAttachmentStrip', buildAttachmentStrip(review));
    setHtml(
        '#clinicalHistoryQueueList',
        buildQueueList(
            meta,
            normalizeString(slice.selectedSessionId),
            slice.loading
        )
    );
    setHtml(
        '#clinicalHistoryTranscript',
        buildTranscript(review, slice.loading, slice.error)
    );
    setHtml('#clinicalHistoryDraftForm', buildDraftForm(draft, slice.saving));
    setHtml('#clinicalHistoryEvents', buildEvents(review));

    syncFollowUpInput();
    syncDraftStatusMeta();
    bindClinicalHistoryEvents();
    renderClinicalMediaFlow();
    ensureSessionSelection();
}
