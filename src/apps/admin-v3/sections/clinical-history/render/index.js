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

const CLINICAL_HISTORY_SESSION_QUERY_PARAM = 'clinicalSessionId';

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
        sexAtBirth: normalizeString(
            source.sexAtBirth || source.sexoBiologico
        ),
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
    const source = attachment && typeof attachment === 'object' ? attachment : {};
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
        intakeSource.datosPaciente && typeof intakeSource.datosPaciente === 'object'
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
            adjuntos: normalizeList(intakeSource.adjuntos).map(normalizeAttachment),
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
                sexoBiologico: normalizeString(patientFactsSource.sexoBiologico),
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
            cie10Sugeridos: normalizeStringList(
                clinicianSource.cie10Sugeridos
            ),
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
        source.session && typeof source.session === 'object' ? source.session : {};

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
            sessionSource.pendingAi && typeof sessionSource.pendingAi === 'object'
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
