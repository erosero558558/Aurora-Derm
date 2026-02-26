import { currentAppointments } from './state.js';
import { apiRequest } from './api.js';
import { refreshData } from './data.js';
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
        searchInput: document.getElementById('searchAppointments'),
        stateRow: document.getElementById('appointmentsToolbarState'),
        clearBtn: document.getElementById('clearAppointmentsFiltersBtn'),
    };
}

function getAppointmentFilterLabel(value) {
    const labels = {
        all: 'Todas las citas',
        today: 'Hoy',
        week: 'Esta semana',
        month: 'Este mes',
        confirmed: 'Confirmadas',
        cancelled: 'Canceladas',
        no_show: 'No asistio',
        pending_transfer: 'Transferencias por validar',
    };
    return labels[String(value || 'all')] || 'Todas las citas';
}

function getAppointmentCriteria() {
    const { filterSelect, searchInput } = getAppointmentControls();
    return {
        filter: String(filterSelect?.value || 'all'),
        search: String(searchInput?.value || '').trim(),
    };
}

function applyAppointmentFilterCriteria(appointments, filter) {
    const items = Array.isArray(appointments) ? appointments : [];
    const normalizedFilter = String(filter || 'all');
    let filtered = [...items];

    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRange();
    const currentMonthNumber = new Date().getMonth();

    switch (normalizedFilter) {
        case 'today':
            filtered = filtered.filter((a) => a.date === today);
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

function renderAppointmentsToolbarState(criteria, visibleAppointments) {
    const { stateRow, clearBtn } = getAppointmentControls();
    if (!stateRow) return;

    const filterValue = String(criteria?.filter || 'all');
    const searchValue = String(criteria?.search || '').trim();
    const hasFilter = filterValue !== 'all';
    const hasSearch = searchValue.length > 0;

    if (clearBtn) {
        clearBtn.classList.toggle('is-hidden', !hasFilter && !hasSearch);
        clearBtn.disabled = !hasFilter && !hasSearch;
    }

    if (!hasFilter && !hasSearch) {
        stateRow.innerHTML =
            '<span class="toolbar-state-empty">Sin filtros activos</span>';
        return;
    }

    const visibleCount = Array.isArray(visibleAppointments)
        ? visibleAppointments.length
        : 0;
    const criteriaMarkup = [
        `<span class="toolbar-state-label">Criterios activos:</span>`,
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

    stateRow.innerHTML = criteriaMarkup.join('');
}

function applyAndRenderAppointments() {
    const criteria = getAppointmentCriteria();
    const filteredByFilter = applyAppointmentFilterCriteria(
        currentAppointments,
        criteria.filter
    );
    const filteredBySearch = applyAppointmentSearchCriteria(
        filteredByFilter,
        criteria.search
    );

    renderAppointments(filteredBySearch);
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

    const chips = [
        `<span class="toolbar-chip is-accent">Mostrando ${escapeHtml(String(visibleCount))}${allCount !== visibleCount ? ` de ${escapeHtml(String(allCount))}` : ''}</span>`,
        `<span class="toolbar-chip">Hoy: ${escapeHtml(String(todayVisible))}</span>`,
    ];

    if (pendingTransferVisible > 0) {
        chips.push(
            `<span class="toolbar-chip is-warning">Por validar: ${escapeHtml(String(pendingTransferVisible))}</span>`
        );
    }

    metaEl.innerHTML = chips.join('');
}

export function renderAppointments(appointments) {
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

    const sorted = [...appointments].sort((a, b) => {
        const dateA = (a.date || '') + ' ' + (a.time || '');
        const dateB = (b.date || '') + ' ' + (b.time || '');
        return dateB.localeCompare(dateA);
    });

    tbody.innerHTML = sorted
        .map((appointment) => {
            const status = String(appointment.status || 'confirmed');
            const paymentStatus = String(appointment.paymentStatus || '');
            const isPaymentReview = paymentStatus === 'pending_transfer_review';
            const isCancelled = status === 'cancelled';
            const isNoShow = status === 'no_show' || status === 'noshow';
            const rowClassName = [
                'appointment-row',
                isPaymentReview ? 'is-payment-review' : '',
                isCancelled ? 'is-cancelled' : '',
                isNoShow ? 'is-noshow' : '',
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

            return `
        <tr class="${rowClassName}">
            <td data-label="Paciente" class="appointment-cell-main">
                <strong>${escapeHtml(appointment.name)}</strong><br>
                <small>${escapeHtml(appointment.email)}</small>
                <div class="appointment-inline-meta">
                    <span class="toolbar-chip">${escapeHtml(
                        String(appointment.phone || 'Sin telefono')
                    )}</span>
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
                        normalizedPhone
                    )}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="WhatsApp" aria-label="Abrir WhatsApp de ${escapeHtml(appointment.name)}">
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

export function resetAppointmentFilters() {
    const { filterSelect, searchInput } = getAppointmentControls();
    if (filterSelect) filterSelect.value = 'all';
    if (searchInput) searchInput.value = '';
    applyAndRenderAppointments();
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
