import { apiRequest } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';
import { escapeHtml, formatDate, setHtml, setText } from '../ui/render.js';

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

function toDateTime(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizePaymentStatus(item) {
    return normalize(item.paymentStatus || item.payment_status || '');
}

function isUpcoming48h(item) {
    const date = String(item.date || '').trim();
    const time = String(item.time || '00:00').trim();
    const stamp = toDateTime(`${date}T${time}:00`);
    if (!stamp) return false;
    const diff = stamp - Date.now();
    return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
}

function isTriageAttention(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const appointmentStatus = normalize(item.status);
    if (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer'
    ) {
        return true;
    }
    if (appointmentStatus === 'no_show' || appointmentStatus === 'cancelled') {
        return true;
    }
    return false;
}

function applyFilter(items, filter) {
    const normalized = normalize(filter);
    if (normalized === 'pending_transfer') {
        return items.filter((item) => {
            const paymentStatus = normalizePaymentStatus(item);
            return (
                paymentStatus === 'pending_transfer_review' ||
                paymentStatus === 'pending_transfer'
            );
        });
    }
    if (normalized === 'upcoming_48h') {
        return items.filter(isUpcoming48h);
    }
    if (normalized === 'no_show') {
        return items.filter((item) => normalize(item.status) === 'no_show');
    }
    if (normalized === 'triage_attention') {
        return items.filter(isTriageAttention);
    }
    return items;
}

function applySearch(items, searchTerm) {
    const term = normalize(searchTerm);
    if (!term) return items;
    return items.filter((item) => {
        const fields = [
            item.name,
            item.email,
            item.phone,
            item.service,
            item.doctor,
            item.paymentStatus,
        ];
        return fields.some((field) => normalize(field).includes(term));
    });
}

function sortItems(items, sort) {
    const normalized = normalize(sort);
    const list = [...items];

    if (normalized === 'patient_az') {
        list.sort((a, b) =>
            normalize(a.name).localeCompare(normalize(b.name), 'es')
        );
        return list;
    }

    if (normalized === 'datetime_asc') {
        list.sort((a, b) => {
            const aStamp = toDateTime(
                `${a.date || ''}T${a.time || '00:00'}:00`
            );
            const bStamp = toDateTime(
                `${b.date || ''}T${b.time || '00:00'}:00`
            );
            return aStamp - bStamp;
        });
        return list;
    }

    list.sort((a, b) => {
        const aStamp = toDateTime(`${a.date || ''}T${a.time || '00:00'}:00`);
        const bStamp = toDateTime(`${b.date || ''}T${b.time || '00:00'}:00`);
        return bStamp - aStamp;
    });
    return list;
}

function paymentLabel(status) {
    const map = {
        pending_transfer_review: 'Validar pago',
        pending_transfer: 'Transferencia',
        pending_cash: 'Pago en consultorio',
        pending_gateway: 'Pago en proceso',
        paid: 'Pagado',
        failed: 'Fallido',
    };
    const key = normalize(status);
    return map[key] || status || 'Pendiente';
}

function statusLabel(status) {
    const map = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        completed: 'Completada',
        cancelled: 'Cancelada',
        no_show: 'No show',
    };
    const key = normalize(status);
    return map[key] || status || 'Pendiente';
}

function rowActions(item) {
    const id = Number(item.id || 0);
    const phone = encodeURIComponent(
        String(item.phone || '').replace(/\s+/g, '')
    );
    return `
        <div class="table-actions">
            <a href="https://wa.me/${phone}" target="_blank" rel="noopener" aria-label="WhatsApp de ${escapeHtml(item.name || 'Paciente')}" title="WhatsApp para validar pago">WhatsApp</a>
            <button type="button" data-action="approve-transfer" data-id="${id}">Aprobar</button>
            <button type="button" data-action="reject-transfer" data-id="${id}">Rechazar</button>
            <button type="button" data-action="mark-no-show" data-id="${id}">No show</button>
            <button type="button" data-action="cancel-appointment" data-id="${id}">Cancelar</button>
            <button type="button" data-action="context-open-appointments-transfer">Triage</button>
        </div>
    `;
}

function renderRows(items) {
    if (!items.length) {
        return '<tr class="table-empty-row"><td colspan="6">No hay resultados</td></tr>';
    }

    return items
        .map((item) => {
            const dateText = `${formatDate(item.date)} ${escapeHtml(item.time || '')}`;
            return `
                <tr class="appointment-row" data-appointment-id="${Number(item.id || 0)}">
                    <td data-label="Paciente">${escapeHtml(item.name || 'Sin nombre')}</td>
                    <td data-label="Servicio">${escapeHtml(item.service || '-')}</td>
                    <td data-label="Fecha">${dateText}</td>
                    <td data-label="Pago">${escapeHtml(paymentLabel(item.paymentStatus || item.payment_status))}</td>
                    <td data-label="Estado">${escapeHtml(statusLabel(item.status))}</td>
                    <td data-label="Acciones">${rowActions(item)}</td>
                </tr>
            `;
        })
        .join('');
}

function updateQuickFilterButtons(filter) {
    const normalized = normalize(filter);
    document
        .querySelectorAll('.appointment-quick-filter-btn[data-filter-value]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.filterValue) === normalized;
            button.classList.toggle('is-active', isActive);
        });
}

function persistPreferences(appointmentsState) {
    try {
        localStorage.setItem(
            'admin-appointments-sort',
            JSON.stringify(appointmentsState.sort)
        );
        localStorage.setItem(
            'admin-appointments-density',
            JSON.stringify(appointmentsState.density)
        );
    } catch (_error) {
        // no-op
    }
}

export function hydrateAppointmentPreferences() {
    let sort = 'datetime_desc';
    let density = 'comfortable';
    try {
        sort = JSON.parse(
            localStorage.getItem('admin-appointments-sort') || '"datetime_desc"'
        );
        density = JSON.parse(
            localStorage.getItem('admin-appointments-density') ||
                '"comfortable"'
        );
    } catch (_error) {
        // no-op
    }

    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            sort: typeof sort === 'string' ? sort : 'datetime_desc',
            density: typeof density === 'string' ? density : 'comfortable',
        },
    }));
}

export function renderAppointmentsSection() {
    const state = getState();
    const source = Array.isArray(state.data.appointments)
        ? state.data.appointments
        : [];

    const filtered = applyFilter(source, state.appointments.filter);
    const searched = applySearch(filtered, state.appointments.search);
    const sorted = sortItems(searched, state.appointments.sort);

    setHtml('#appointmentsTableBody', renderRows(sorted));
    setText(
        '#appointmentsToolbarMeta',
        `Mostrando ${sorted.length} de ${source.length}`
    );

    const stateParts = [];
    if (normalize(state.appointments.filter) !== 'all') {
        if (normalize(state.appointments.filter) === 'pending_transfer') {
            stateParts.push('Transferencias por validar');
        } else if (
            normalize(state.appointments.filter) === 'triage_attention'
        ) {
            stateParts.push('Triage accionable');
        } else if (normalize(state.appointments.filter) === 'upcoming_48h') {
            stateParts.push('Proximas 48h');
        } else if (normalize(state.appointments.filter) === 'no_show') {
            stateParts.push('No show');
        } else {
            stateParts.push(state.appointments.filter);
        }
    }
    if (normalize(state.appointments.search)) {
        stateParts.push(`Busqueda: ${state.appointments.search}`);
    }

    setText(
        '#appointmentsToolbarState',
        stateParts.length ? stateParts.join(' | ') : 'Sin filtros activos'
    );

    const clearButton = document.getElementById('clearAppointmentsFiltersBtn');
    if (clearButton) {
        clearButton.classList.toggle('is-hidden', stateParts.length === 0);
    }

    const filterSelect = document.getElementById('appointmentFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = state.appointments.filter;
    }

    const sortSelect = document.getElementById('appointmentSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = state.appointments.sort;
    }

    const searchInput = document.getElementById('searchAppointments');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== state.appointments.search
    ) {
        searchInput.value = state.appointments.search;
    }

    const section = document.getElementById('appointments');
    if (section) {
        section.classList.toggle(
            'appointments-density-compact',
            normalize(state.appointments.density) === 'compact'
        );
    }

    document
        .querySelectorAll('[data-action="appointment-density"][data-density]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.density) ===
                normalize(state.appointments.density);
            button.classList.toggle('is-active', isActive);
        });

    updateQuickFilterButtons(state.appointments.filter);
    persistPreferences(state.appointments);
}

function updateAppointmentState(patch) {
    updateState((state) => ({
        ...state,
        appointments: {
            ...state.appointments,
            ...patch,
        },
    }));
    renderAppointmentsSection();
}

export function setAppointmentFilter(filter) {
    updateAppointmentState({ filter: normalize(filter) || 'all' });
}

export function setAppointmentSearch(search) {
    updateAppointmentState({ search: String(search || '') });
}

export function clearAppointmentFilters() {
    updateAppointmentState({
        filter: 'all',
        search: '',
    });
}

export function setAppointmentSort(sort) {
    updateAppointmentState({ sort: normalize(sort) || 'datetime_desc' });
}

export function setAppointmentDensity(density) {
    const normalized = normalize(density);
    updateAppointmentState({
        density: normalized === 'compact' ? 'compact' : 'comfortable',
    });
}

function mutateAppointmentInState(id, patch) {
    const targetId = Number(id || 0);
    updateState((state) => {
        const nextAppointments = (state.data.appointments || []).map((item) =>
            Number(item.id || 0) === targetId
                ? {
                      ...item,
                      ...patch,
                  }
                : item
        );
        return {
            ...state,
            data: {
                ...state.data,
                appointments: nextAppointments,
            },
        };
    });
    renderAppointmentsSection();
}

async function patchAppointment(id, body) {
    await apiRequest('appointments', {
        method: 'PATCH',
        body: {
            id: Number(id || 0),
            ...body,
        },
    });
}

export async function approveTransfer(id) {
    await patchAppointment(id, { paymentStatus: 'paid' });
    mutateAppointmentInState(id, { paymentStatus: 'paid' });
}

export async function rejectTransfer(id) {
    await patchAppointment(id, { paymentStatus: 'failed' });
    mutateAppointmentInState(id, { paymentStatus: 'failed' });
}

export async function markNoShow(id) {
    await patchAppointment(id, { status: 'no_show' });
    mutateAppointmentInState(id, { status: 'no_show' });
}

export async function cancelAppointment(id) {
    await patchAppointment(id, { status: 'cancelled' });
    mutateAppointmentInState(id, { status: 'cancelled' });
}

export function exportAppointmentsCsv() {
    const state = getState();
    const rows = (state.data.appointments || []).map((item) => [
        item.id,
        item.name,
        item.service,
        item.date,
        item.time,
        item.status,
        item.paymentStatus || item.payment_status || '',
    ]);
    const csv = [
        ['id', 'name', 'service', 'date', 'time', 'status', 'payment_status'],
        ...rows,
    ]
        .map((line) =>
            line
                .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
                .join(',')
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `appointments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
