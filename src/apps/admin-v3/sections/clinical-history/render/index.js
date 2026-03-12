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
