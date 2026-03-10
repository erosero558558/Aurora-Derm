import { currentAppointments } from './state.js';
import { apiRequest } from './api.js';
import { getLocalData, refreshData } from './data.js';
import { loadDashboardData } from './dashboard.js';
import {
    escapeHtml,
    showToast,
    getServiceName,
    getDoctorName,
    formatDate,
    getPaymentMethodText,
    getPaymentStatusText,
    sanitizePublicHref,
    getStatusText,
} from './ui.js';

const APPOINTMENT_SORT_STORAGE_KEY = 'admin-appointments-sort';
const APPOINTMENT_DENSITY_STORAGE_KEY = 'admin-appointments-density';
const DEFAULT_APPOINTMENT_SORT = 'datetime_desc';
const DEFAULT_APPOINTMENT_DENSITY = 'comfortable';
const DEFAULT_APPOINTMENT_FILTER = 'all';
const TRIAGE_IMMINENT_WINDOW_HOURS = 24;
const TRIAGE_NO_SHOW_WINDOW_DAYS = 7;
const APPOINTMENT_SORT_OPTIONS = new Set([
    'datetime_desc',
    'datetime_asc',
    'triage',
    'patient_az',
]);
const APPOINTMENT_DENSITY_OPTIONS = new Set(['comfortable', 'compact']);
const APPOINTMENT_FILTER_OPTIONS = new Set([
    'all',
    'today',
    'upcoming_48h',
    'week',
    'month',
    'confirmed',
    'cancelled',
    'no_show',
    'pending_transfer',
    'triage_attention',
]);

function toLocalDateKey(date) {
    const target = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(target.getTime())) return '';
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseAppointmentDateTime(appointment) {
    const dateValue = String(appointment?.date || '').trim();
    if (!dateValue) return null;
    const timeValue = String(appointment?.time || '00:00').trim() || '00:00';
    const isoCandidate = `${dateValue}T${timeValue}:00`;
    const parsed = new Date(isoCandidate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function getWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
    };
}

function countAppointmentsForToday(items) {
    const today = new Date().toISOString().split('T')[0];
    return items.filter((item) => item.date === today).length;
}

function countPendingTransfers(items) {
    return items.filter(
        (item) => item.paymentStatus === 'pending_transfer_review'
    ).length;
}

function getAppointmentControls() {
    return {
        filterSelect: document.getElementById('appointmentFilter'),
        sortSelect: document.getElementById('appointmentSort'),
        searchInput: document.getElementById('searchAppointments'),
        stateRow: document.getElementById('appointmentsToolbarState'),
        clearBtn: document.getElementById('clearAppointmentsFiltersBtn'),
        appointmentsSection: document.getElementById('appointments'),
        densityButtons: Array.from(
            document.querySelectorAll(
                '[data-action="appointment-density"][data-density]'
            )
        ),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="appointment-quick-filter"][data-filter-value]'
            )
        ),
    };
}

function ensureAppointmentTriageEnhancements() {
    const filterSelect = document.getElementById('appointmentFilter');
    if (
        filterSelect instanceof HTMLSelectElement &&
        !filterSelect.querySelector('option[value="triage_attention"]')
    ) {
        const option = document.createElement('option');
        option.value = 'triage_attention';
        option.textContent = 'Triage accionable';
        filterSelect.appendChild(option);
    }

    const quickFiltersContainer = document.querySelector(
        '.appointments-quick-filters'
    );
    if (
        quickFiltersContainer &&
        !quickFiltersContainer.querySelector(
            '[data-filter-value="triage_attention"]'
        )
    ) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'appointment-quick-filter-btn';
        button.dataset.action = 'appointment-quick-filter';
        button.dataset.filterValue = 'triage_attention';
        button.setAttribute('aria-pressed', 'false');
        button.title = 'Citas con accion prioritaria';
        button.textContent = 'Triage';
        quickFiltersContainer.appendChild(button);
    }
}

function getAppointmentFilterLabel(value) {
    const labels = {
        all: 'Todas las citas',
        today: 'Hoy',
        upcoming_48h: 'Proximas 48h',
        week: 'Esta semana',
        month: 'Este mes',
        confirmed: 'Confirmadas',
        cancelled: 'Canceladas',
        no_show: 'No asistio',
        pending_transfer: 'Transferencias por validar',
        triage_attention: 'Triage accionable',
    };
    return labels[String(value || DEFAULT_APPOINTMENT_FILTER)] || labels.all;
}

function normalizeAppointmentFilter(value) {
    const normalized = String(value || '').trim();
    return APPOINTMENT_FILTER_OPTIONS.has(normalized)
        ? normalized
        : DEFAULT_APPOINTMENT_FILTER;
}

function normalizeAppointmentSort(value) {
    const normalized = String(value || '').trim();
    return APPOINTMENT_SORT_OPTIONS.has(normalized)
        ? normalized
        : DEFAULT_APPOINTMENT_SORT;
}

function normalizeAppointmentDensity(value) {
    const normalized = String(value || '').trim();
    return APPOINTMENT_DENSITY_OPTIONS.has(normalized)
        ? normalized
        : DEFAULT_APPOINTMENT_DENSITY;
}

function persistAppointmentUiPreference(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {
        // localStorage disabled or unavailable; keep UX functional
    }
}

function readAppointmentUiPreferences() {
    return {
        sort: normalizeAppointmentSort(
            getLocalData(APPOINTMENT_SORT_STORAGE_KEY, DEFAULT_APPOINTMENT_SORT)
        ),
        density: normalizeAppointmentDensity(
            getLocalData(
                APPOINTMENT_DENSITY_STORAGE_KEY,
                DEFAULT_APPOINTMENT_DENSITY
            )
        ),
    };
}

function getAppointmentSortLabel(value) {
    const labels = {
        datetime_desc: 'Mas recientes primero',
        datetime_asc: 'Proximas primero',
        triage: 'Triage operativo',
        patient_az: 'Paciente (A-Z)',
    };
    return labels[normalizeAppointmentSort(value)] || labels.datetime_desc;
}

function getAppointmentDensityLabel(value) {
    const labels = {
        comfortable: 'Comoda',
        compact: 'Compacta',
    };
    return labels[normalizeAppointmentDensity(value)] || labels.comfortable;
}

function getAppointmentDensity() {
    const { appointmentsSection } = getAppointmentControls();
    if (
        appointmentsSection?.classList.contains('appointments-density-compact')
    ) {
        return 'compact';
    }
    return 'comfortable';
}

function setAppointmentDensityButtonState(value) {
    const density = normalizeAppointmentDensity(value);
    const { densityButtons } = getAppointmentControls();
    densityButtons.forEach((button) => {
        const isActive = button.dataset.density === density;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function setAppointmentQuickFilterButtonState(value) {
    const filter = normalizeAppointmentFilter(value);
    const { quickFilterButtons } = getAppointmentControls();
    quickFilterButtons.forEach((button) => {
        const isActive = button.dataset.filterValue === filter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function applyAppointmentDensityClass(value) {
    const density = normalizeAppointmentDensity(value);
    const { appointmentsSection } = getAppointmentControls();
    appointmentsSection?.classList.toggle(
        'appointments-density-compact',
        density === 'compact'
    );
    setAppointmentDensityButtonState(density);
}

function getAppointmentCriteria() {
    const { filterSelect, sortSelect, searchInput } = getAppointmentControls();
    return {
        filter: normalizeAppointmentFilter(
            filterSelect?.value || DEFAULT_APPOINTMENT_FILTER
        ),
        sort: normalizeAppointmentSort(
            sortSelect?.value || DEFAULT_APPOINTMENT_SORT
        ),
        search: String(searchInput?.value || '').trim(),
    };
}

function applyAppointmentFilterCriteria(appointments, filter) {
    const items = Array.isArray(appointments) ? appointments : [];
    const normalizedFilter = normalizeAppointmentFilter(filter);
    let filtered = [...items];

    const now = new Date();
    const today = toLocalDateKey(now);
    const upcomingLimit = new Date(now);
    upcomingLimit.setHours(upcomingLimit.getHours() + 48);
    const currentWeek = getWeekRange();
    const currentMonthNumber = now.getMonth();

    switch (normalizedFilter) {
        case 'today':
            filtered = filtered.filter((a) => a.date === today);
            break;
        case 'upcoming_48h':
            filtered = filtered.filter((a) => {
                const dateTime = parseAppointmentDateTime(a);
                if (!dateTime) return false;
                const status = String(a?.status || 'confirmed');
                if (status === 'cancelled' || status === 'completed') {
                    return false;
                }
                return dateTime >= now && dateTime <= upcomingLimit;
            });
            break;
        case 'week':
            filtered = filtered.filter(
                (a) => a.date >= currentWeek.start && a.date <= currentWeek.end
            );
            break;
        case 'month':
            filtered = filtered.filter(
                (a) => new Date(a.date).getMonth() === currentMonthNumber
            );
            break;
        case 'confirmed':
        case 'cancelled':
        case 'no_show':
            filtered = filtered.filter(
                (a) => (a.status || 'confirmed') === normalizedFilter
            );
            break;
        case 'pending_transfer':
            filtered = filtered.filter(
                (a) => a.paymentStatus === 'pending_transfer_review'
            );
            break;
        case 'triage_attention':
            filtered = filtered.filter((a) => {
                const triage = getAppointmentTriageContext(a, now);
                return (
                    triage.isPendingTransfer ||
                    triage.isOverdue ||
                    triage.isImminent ||
                    triage.requiresNoShowFollowUp
                );
            });
            break;
        default:
            break;
    }

    return filtered;
}

function applyAppointmentSearchCriteria(appointments, search) {
    const items = Array.isArray(appointments) ? appointments : [];
    const normalizedSearch = String(search || '')
        .trim()
        .toLowerCase();

    if (!normalizedSearch) return [...items];

    return items.filter(
        (a) =>
            String(a.name || '')
                .toLowerCase()
                .includes(normalizedSearch) ||
            String(a.email || '')
                .toLowerCase()
                .includes(normalizedSearch) ||
            String(a.phone || '').includes(normalizedSearch)
    );
}

function getAppointmentHoursUntil(appointment, now = new Date()) {
    const dateTime = parseAppointmentDateTime(appointment);
    if (!dateTime) return Number.POSITIVE_INFINITY;
    return (dateTime.getTime() - now.getTime()) / 3600000;
}

function getAppointmentTriageContext(appointment, now = new Date()) {
    const paymentStatus = String(appointment?.paymentStatus || '');
    const status = String(appointment?.status || 'confirmed');
    const normalizedStatus = status === 'noshow' ? 'no_show' : status;
    const hoursUntil = getAppointmentHoursUntil(appointment, now);
    const isPendingTransfer = paymentStatus === 'pending_transfer_review';
    const isNoShow = normalizedStatus === 'no_show';
    const isCompleted = normalizedStatus === 'completed';
    const isCancelled = normalizedStatus === 'cancelled';
    const isActionableStatus = !isCompleted && !isCancelled && !isNoShow;
    const isOverdue =
        isActionableStatus && Number.isFinite(hoursUntil) && hoursUntil < -2;
    const isImminent =
        isActionableStatus &&
        Number.isFinite(hoursUntil) &&
        hoursUntil >= -2 &&
        hoursUntil <= TRIAGE_IMMINENT_WINDOW_HOURS;

    const appointmentDateTime = parseAppointmentDateTime(appointment);
    const daysSinceNoShow =
        isNoShow && appointmentDateTime
            ? (now.getTime() - appointmentDateTime.getTime()) / 86400000
            : Number.POSITIVE_INFINITY;
    const requiresNoShowFollowUp =
        isNoShow &&
        Number.isFinite(daysSinceNoShow) &&
        daysSinceNoShow >= 0 &&
        daysSinceNoShow <= TRIAGE_NO_SHOW_WINDOW_DAYS;

    let priorityScore = 8;
    if (isPendingTransfer) {
        priorityScore = 0;
    } else if (isOverdue) {
        priorityScore = 1;
    } else if (isImminent) {
        priorityScore = 2;
    } else if (requiresNoShowFollowUp) {
        priorityScore = 3;
    } else if (normalizedStatus === 'confirmed') {
        priorityScore = 4;
    } else if (normalizedStatus === 'pending') {
        priorityScore = 5;
    } else if (isNoShow) {
        priorityScore = 6;
    } else if (isCompleted) {
        priorityScore = 7;
    }

    const badges = [];
    if (isPendingTransfer) {
        badges.push({ tone: 'is-warning', label: 'Validar pago' });
    }
    if (isOverdue) {
        badges.push({ tone: 'is-warning', label: 'Atrasada' });
    } else if (isImminent) {
        badges.push({ tone: 'is-accent', label: 'Proxima <24h' });
    }
    if (requiresNoShowFollowUp) {
        badges.push({ tone: 'is-muted', label: 'Reagendar no-show' });
    }

    return {
        status: normalizedStatus,
        isPendingTransfer,
        isOverdue,
        isImminent,
        requiresNoShowFollowUp,
        priorityScore,
        hoursUntil,
        badges,
    };
}

function renderAppointmentsToolbarState(criteria, visibleAppointments) {
    const { stateRow, clearBtn } = getAppointmentControls();
    if (!stateRow) return;

    const filterValue = normalizeAppointmentFilter(
        criteria?.filter || DEFAULT_APPOINTMENT_FILTER
    );
    const sortValue = normalizeAppointmentSort(
        criteria?.sort || DEFAULT_APPOINTMENT_SORT
    );
    const searchValue = String(criteria?.search || '').trim();
    const densityValue = getAppointmentDensity();
    const hasFilter = filterValue !== DEFAULT_APPOINTMENT_FILTER;
    const hasSearch = searchValue.length > 0;
    const hasPreferenceState =
        sortValue !== DEFAULT_APPOINTMENT_SORT ||
        densityValue !== DEFAULT_APPOINTMENT_DENSITY;

    if (clearBtn) {
        clearBtn.classList.toggle('is-hidden', !hasFilter && !hasSearch);
        clearBtn.disabled = !hasFilter && !hasSearch;
    }

    if (!hasFilter && !hasSearch && !hasPreferenceState) {
        stateRow.innerHTML =
            '<span class="toolbar-state-empty">Sin filtros activos</span>';
        return;
    }

    const visibleCount = Array.isArray(visibleAppointments)
        ? visibleAppointments.length
        : 0;
    const criteriaMarkup = [
        `<span class="toolbar-state-label">${hasFilter || hasSearch ? 'Criterios activos:' : 'Vista activa:'}</span>`,
    ];

    if (hasFilter) {
        criteriaMarkup.push(
            `<span class="toolbar-state-value is-filter">Filtro: ${escapeHtml(
                getAppointmentFilterLabel(filterValue)
            )}</span>`
        );
    }

    if (hasSearch) {
        criteriaMarkup.push(
            `<span class="toolbar-state-value is-search">Busqueda: ${escapeHtml(searchValue)}</span>`
        );
    }

    criteriaMarkup.push(
        `<span class="toolbar-state-value">Resultados: ${escapeHtml(String(visibleCount))}</span>`
    );
    criteriaMarkup.push(
        `<span class="toolbar-state-value is-sort">Orden: ${escapeHtml(
            getAppointmentSortLabel(sortValue)
        )}</span>`
    );
    criteriaMarkup.push(
        `<span class="toolbar-state-value is-density">Densidad: ${escapeHtml(
            getAppointmentDensityLabel(densityValue)
        )}</span>`
    );

    stateRow.innerHTML = criteriaMarkup.join('');
}

function getAppointmentTriagePriority(appointment) {
    return getAppointmentTriageContext(appointment).priorityScore;
}

function sortAppointmentsByCriteria(appointments, sortValue) {
    const sort = normalizeAppointmentSort(sortValue);
    const items = Array.isArray(appointments) ? [...appointments] : [];
    const byDateAsc = (a, b) => {
        const dateA = `${String(a?.date || '')} ${String(a?.time || '')}`;
        const dateB = `${String(b?.date || '')} ${String(b?.time || '')}`;
        return dateA.localeCompare(dateB);
    };

    return items.sort((a, b) => {
        if (sort === 'patient_az') {
            const nameA = String(a?.name || '').toLocaleLowerCase('es');
            const nameB = String(b?.name || '').toLocaleLowerCase('es');
            const nameCompare = nameA.localeCompare(nameB, 'es');
            if (nameCompare !== 0) return nameCompare;
            return byDateAsc(a, b);
        }

        if (sort === 'datetime_asc') {
            return byDateAsc(a, b);
        }

        if (sort === 'triage') {
            const priorityDiff =
                getAppointmentTriagePriority(a) -
                getAppointmentTriagePriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            const triageA = getAppointmentTriageContext(a);
            const triageB = getAppointmentTriageContext(b);
            if (triageA.hoursUntil !== triageB.hoursUntil) {
                return triageA.hoursUntil - triageB.hoursUntil;
            }
            return byDateAsc(a, b);
        }

        return -byDateAsc(a, b);
    });
}

function applyAndRenderAppointments() {
    ensureAppointmentTriageEnhancements();
    const criteria = getAppointmentCriteria();
    setAppointmentQuickFilterButtonState(criteria.filter);
    const filteredByFilter = applyAppointmentFilterCriteria(
        currentAppointments,
        criteria.filter
    );
    const filteredBySearch = applyAppointmentSearchCriteria(
        filteredByFilter,
        criteria.search
    );

    renderAppointments(filteredBySearch, { sort: criteria.sort });
    renderAppointmentsToolbarState(criteria, filteredBySearch);
}

function renderAppointmentsToolbarMeta(visibleAppointments) {
    const metaEl = document.getElementById('appointmentsToolbarMeta');
    if (!metaEl) return;

    const visible = Array.isArray(visibleAppointments)
        ? visibleAppointments
        : [];
    const all = Array.isArray(currentAppointments) ? currentAppointments : [];
    const visibleCount = visible.length;
    const allCount = all.length;
    const pendingTransferVisible = countPendingTransfers(visible);
    const todayVisible = countAppointmentsForToday(visible);
    const triageAttentionVisible = visible.filter((item) => {
        const triage = getAppointmentTriageContext(item);
        return (
            triage.isPendingTransfer ||
            triage.isOverdue ||
            triage.isImminent ||
            triage.requiresNoShowFollowUp
        );
    }).length;
    const actionableVisible = visible.filter((item) => {
        const status = String(item?.status || 'confirmed');
        return (
            status !== 'cancelled' &&
            status !== 'completed' &&
            status !== 'no_show' &&
            status !== 'noshow'
        );
    }).length;

    const chips = [
        `<span class="toolbar-chip is-accent">Mostrando ${escapeHtml(String(visibleCount))}${allCount !== visibleCount ? ` de ${escapeHtml(String(allCount))}` : ''}</span>`,
        `<span class="toolbar-chip">Hoy: ${escapeHtml(String(todayVisible))}</span>`,
        `<span class="toolbar-chip">Accionables: ${escapeHtml(String(actionableVisible))}</span>`,
    ];

    if (pendingTransferVisible > 0) {
        chips.push(
            `<span class="toolbar-chip is-warning">Por validar: ${escapeHtml(String(pendingTransferVisible))}</span>`
        );
    }
    if (triageAttentionVisible > 0) {
        chips.push(
            `<span class="toolbar-chip is-accent">Triage: ${escapeHtml(String(triageAttentionVisible))}</span>`
        );
    }

    metaEl.innerHTML = chips.join('');
}

export function renderAppointments(appointments, options = {}) {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;
    renderAppointmentsToolbarMeta(appointments);

    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr class="table-empty-row">
                <td colspan="8">
                    <div class="table-empty-state">
                        <i class="fas fa-calendar-check" aria-hidden="true"></i>
                        <strong>No hay citas registradas</strong>
                        <p>Cuando ingresen reservas nuevas apareceran aqui con acciones rapidas.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const sorted = sortAppointmentsByCriteria(
        appointments,
        options?.sort || DEFAULT_APPOINTMENT_SORT
    );

    tbody.innerHTML = sorted
        .map((appointment) => {
            const status = String(appointment.status || 'confirmed');
            const paymentStatus = String(appointment.paymentStatus || '');
            const isPaymentReview = paymentStatus === 'pending_transfer_review';
            const isCancelled = status === 'cancelled';
            const isNoShow = status === 'no_show' || status === 'noshow';
            const triage = getAppointmentTriageContext(appointment);
            const requiresTriageAttention =
                triage.isPendingTransfer ||
                triage.isOverdue ||
                triage.isImminent ||
                triage.requiresNoShowFollowUp;
            const rowClassName = [
                'appointment-row',
                isPaymentReview ? 'is-payment-review' : '',
                isCancelled ? 'is-cancelled' : '',
                isNoShow ? 'is-noshow' : '',
                requiresTriageAttention ? 'is-triage-attention' : '',
            ]
                .filter(Boolean)
                .join(' ');

            const doctorAssignedLine = appointment.doctorAssigned
                ? `<br><small>Asignado: ${escapeHtml(getDoctorName(appointment.doctorAssigned))}</small>`
                : '';
            const transferReferenceLine = appointment.transferReference
                ? `<br><small>Ref: ${escapeHtml(appointment.transferReference)}</small>`
                : '';
            const transferProofHref = sanitizePublicHref(
                appointment.transferProofUrl
            );
            const transferProofLine = transferProofHref
                ? `<br><a class="appointment-proof-link" href="${escapeHtml(
                      transferProofHref
                  )}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> Ver comprobante</a>`
                : '';
            const normalizedPhone = String(appointment.phone || '').replace(
                /\D/g,
                ''
            );
            const triageBadgesMarkup = triage.badges
                .map(
                    (badge) =>
                        `<span class="toolbar-chip ${escapeHtml(badge.tone)}">${escapeHtml(badge.label)}</span>`
                )
                .join('');
            const whatsappMessage = triage.isPendingTransfer
                ? `Hola ${String(appointment.name || '').trim()}, estamos validando tu comprobante de pago para la cita de ${String(appointment.date || '').trim()} ${String(appointment.time || '').trim()}.`
                : triage.isOverdue
                  ? `Hola ${String(appointment.name || '').trim()}, notamos que tu cita de ${String(appointment.date || '').trim()} ${String(appointment.time || '').trim()} quedo pendiente. Te ayudamos a reprogramar.`
                  : triage.requiresNoShowFollowUp
                    ? `Hola ${String(appointment.name || '').trim()}, podemos ayudarte a reagendar tu consulta cuando te convenga.`
                    : '';
            const whatsappHref = `https://wa.me/${encodeURIComponent(
                normalizedPhone
            )}${whatsappMessage ? `?text=${encodeURIComponent(whatsappMessage)}` : ''}`;

            return `
        <tr class="${rowClassName}">
            <td data-label="Paciente" class="appointment-cell-main">
                <strong>${escapeHtml(appointment.name)}</strong><br>
                <small>${escapeHtml(appointment.email)}</small>
                <div class="appointment-inline-meta">
                    <span class="toolbar-chip">${escapeHtml(
                        String(appointment.phone || 'Sin telefono')
                    )}</span>
                    ${triageBadgesMarkup}
                </div>
            </td>
            <td data-label="Servicio">${escapeHtml(getServiceName(appointment.service))}</td>
            <td data-label="Doctor">${escapeHtml(getDoctorName(appointment.doctor))}${doctorAssignedLine}</td>
            <td data-label="Fecha">${escapeHtml(formatDate(appointment.date))}</td>
            <td data-label="Hora">${escapeHtml(appointment.time)}</td>
            <td data-label="Pago" class="appointment-payment-cell">
                <strong>${escapeHtml(appointment.price || '$0.00')}</strong>
                <small>${escapeHtml(getPaymentMethodText(appointment.paymentMethod))} - ${escapeHtml(getPaymentStatusText(paymentStatus))}</small>
                ${transferReferenceLine}
                ${transferProofLine}
            </td>
            <td data-label="Estado">
                <span class="status-badge status-${escapeHtml(status)}">
                    ${escapeHtml(getStatusText(status))}
                </span>
            </td>
            <td data-label="Acciones">
                <div class="table-actions">
                    ${
                        isPaymentReview
                            ? `
                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(appointment.id) || 0}" title="Aprobar transferencia">
                        <i class="fas fa-check"></i>
                    </button>
                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(appointment.id) || 0}" title="Rechazar transferencia">
                        <i class="fas fa-ban"></i>
                    </button>
                    `
                            : ''
                    }
                    <a href="tel:${escapeHtml(
                        appointment.phone
                    )}" class="btn-icon" title="Llamar" aria-label="Llamar a ${escapeHtml(appointment.name)}">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${escapeHtml(
                        whatsappHref
                    )}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="${escapeHtml(
                        triage.isPendingTransfer
                            ? 'WhatsApp para validar pago'
                            : triage.isOverdue
                              ? 'WhatsApp para reprogramar cita atrasada'
                              : triage.requiresNoShowFollowUp
                                ? 'WhatsApp para seguimiento no-show'
                                : 'WhatsApp'
                    )}" aria-label="Abrir WhatsApp de ${escapeHtml(appointment.name)}">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(appointment.id) || 0}" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                    ${
                        status !== 'cancelled' &&
                        status !== 'completed' &&
                        status !== 'no_show'
                            ? `
                    <button type="button" class="btn-icon warning" data-action="mark-no-show" data-id="${Number(appointment.id) || 0}" title="Marcar no asistio">
                        <i class="fas fa-user-slash"></i>
                    </button>
                    `
                            : ''
                    }
                </div>
            </td>
        </tr>
    `;
        })
        .join('');
}

export function loadAppointments() {
    applyAndRenderAppointments();
}

export function filterAppointments() {
    applyAndRenderAppointments();
}

export function searchAppointments() {
    applyAndRenderAppointments();
}

export function applyAppointmentQuickFilter(value, options = {}) {
    const { filterSelect, searchInput } = getAppointmentControls();
    const normalizedFilter = normalizeAppointmentFilter(value);
    const preserveSearch = options.preserveSearch !== false;
    if (filterSelect) {
        filterSelect.value = normalizedFilter;
    }
    if (!preserveSearch && searchInput) {
        searchInput.value = '';
    }
    applyAndRenderAppointments();
}

export function focusAppointmentSearch() {
    const { searchInput } = getAppointmentControls();
    if (!(searchInput instanceof HTMLInputElement)) return false;
    searchInput.focus({ preventScroll: true });
    searchInput.select();
    return true;
}

export function isAppointmentsSectionActive() {
    return (
        document.getElementById('appointments')?.classList.contains('active') ||
        false
    );
}

export function resetAppointmentFilters() {
    applyAppointmentQuickFilter(DEFAULT_APPOINTMENT_FILTER, {
        preserveSearch: false,
    });
}

export function initAppointmentsToolbarPreferences() {
    const prefs = readAppointmentUiPreferences();
    const { sortSelect } = getAppointmentControls();
    if (sortSelect) {
        sortSelect.value = prefs.sort;
    }
    applyAppointmentDensityClass(prefs.density);
}

export function setAppointmentSort(value) {
    const normalized = normalizeAppointmentSort(value);
    const { sortSelect } = getAppointmentControls();
    if (sortSelect) {
        sortSelect.value = normalized;
    }
    persistAppointmentUiPreference(APPOINTMENT_SORT_STORAGE_KEY, normalized);
    applyAndRenderAppointments();
}

export function setAppointmentDensity(value) {
    const normalized = normalizeAppointmentDensity(value);
    applyAppointmentDensityClass(normalized);
    persistAppointmentUiPreference(APPOINTMENT_DENSITY_STORAGE_KEY, normalized);
    const hasAppointmentsTable = Boolean(
        document.getElementById('appointmentsTableBody')
    );
    if (hasAppointmentsTable) {
        applyAndRenderAppointments();
    }
}

export async function cancelAppointment(id) {
    if (!confirm('¿Estas seguro de cancelar esta cita?')) return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, status: 'cancelled' },
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Cita cancelada correctamente', 'success');
    } catch (error) {
        showToast(`No se pudo cancelar la cita: ${error.message}`, 'error');
    }
}

export async function markNoShow(id) {
    if (!confirm('Marcar esta cita como "No asistio"?')) return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, status: 'no_show' },
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Cita marcada como no asistio', 'success');
    } catch (error) {
        showToast(`No se pudo marcar no-show: ${error.message}`, 'error');
    }
}

export async function approveTransfer(id) {
    if (!confirm('¿Aprobar el comprobante de transferencia de esta cita?'))
        return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: {
                id: id,
                paymentStatus: 'paid',
                paymentPaidAt: new Date().toISOString(),
            },
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia aprobada', 'success');
    } catch (error) {
        showToast(`No se pudo aprobar: ${error.message}`, 'error');
    }
}

export async function rejectTransfer(id) {
    if (
        !confirm(
            '¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.'
        )
    )
        return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'failed' },
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia rechazada', 'warning');
    } catch (error) {
        showToast(`No se pudo rechazar: ${error.message}`, 'error');
    }
}

function csvSafe(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) {
        text = "'" + text;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

export function exportAppointmentsCSV() {
    if (
        !Array.isArray(currentAppointments) ||
        currentAppointments.length === 0
    ) {
        showToast('No hay citas para exportar', 'warning');
        return;
    }

    const headers = [
        'ID',
        'Fecha',
        'Hora',
        'Paciente',
        'Email',
        'Telefono',
        'Servicio',
        'Doctor',
        'Precio',
        'Estado',
        'Estado pago',
        'Metodo pago',
    ];

    const rows = currentAppointments.map((a) => [
        Number(a.id) || 0,
        a.date || '',
        a.time || '',
        csvSafe(a.name || ''),
        csvSafe(a.email || ''),
        csvSafe(a.phone || ''),
        csvSafe(getServiceName(a.service)),
        csvSafe(getDoctorName(a.doctor)),
        a.price || '',
        csvSafe(getStatusText(a.status || 'confirmed')),
        csvSafe(getPaymentStatusText(a.paymentStatus)),
        csvSafe(getPaymentMethodText(a.paymentMethod)),
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `citas-pielarmonia-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('CSV exportado correctamente', 'success');
}
