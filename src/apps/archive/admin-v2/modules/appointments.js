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

function appointmentStamp(item) {
    return toDateTime(`${item?.date || ''}T${item?.time || '00:00'}:00`);
}

function normalizePaymentStatus(item) {
    return normalize(item.paymentStatus || item.payment_status || '');
}

function normalizeAppointmentStatus(status) {
    return normalize(status);
}

function humanizeToken(value, fallback = '-') {
    const source = String(value || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    if (!source) return fallback;
    return source
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function paymentMethodLabel(method) {
    const map = {
        transfer: 'Transferencia',
        cash: 'Consultorio',
        card: 'Tarjeta',
        gateway: 'Pasarela',
    };
    const key = normalize(method);
    return map[key] || humanizeToken(method, 'Metodo no definido');
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
    return map[key] || humanizeToken(status, 'Pendiente');
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
    return map[key] || humanizeToken(status, 'Pendiente');
}

function paymentTone(status) {
    const key = normalize(status);
    if (key === 'paid') return 'success';
    if (key === 'failed') return 'danger';
    if (key === 'pending_cash') return 'neutral';
    return 'warning';
}

function statusTone(status) {
    const key = normalize(status);
    if (key === 'completed') return 'success';
    if (key === 'cancelled' || key === 'no_show') return 'danger';
    if (key === 'pending') return 'warning';
    return 'neutral';
}

function formatRelativeWindow(stamp) {
    if (!stamp) return 'Sin fecha';
    const diffMinutes = Math.round((stamp - Date.now()) / 60000);
    const absoluteMinutes = Math.abs(diffMinutes);

    if (diffMinutes < 0) {
        if (absoluteMinutes < 60) {
            return `Hace ${absoluteMinutes} min`;
        }
        if (absoluteMinutes < 24 * 60) {
            return `Hace ${Math.round(absoluteMinutes / 60)} h`;
        }
        return 'Ya ocurrio';
    }

    if (diffMinutes < 60) {
        return `En ${Math.max(diffMinutes, 0)} min`;
    }
    if (diffMinutes < 24 * 60) {
        return `En ${Math.round(diffMinutes / 60)} h`;
    }
    return `En ${Math.round(diffMinutes / (24 * 60))} d`;
}

function isToday(item) {
    const stamp = appointmentStamp(item);
    if (!stamp) return false;
    const date = new Date(stamp);
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

function isUpcoming48h(item) {
    const stamp = appointmentStamp(item);
    if (!stamp) return false;
    const diff = stamp - Date.now();
    return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
}

function isTriageAttention(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const appointmentStatus = normalizeAppointmentStatus(item.status);
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
        return items.filter(
            (item) => normalizeAppointmentStatus(item.status) === 'no_show'
        );
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
            item.payment_status,
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
        list.sort((a, b) => appointmentStamp(a) - appointmentStamp(b));
        return list;
    }

    list.sort((a, b) => appointmentStamp(b) - appointmentStamp(a));
    return list;
}

function buildFocusAppointment(items) {
    const pendingTransfer = items
        .filter((item) => applyFilter([item], 'pending_transfer').length > 0)
        .sort((a, b) => appointmentStamp(a) - appointmentStamp(b))[0];
    if (pendingTransfer) {
        return {
            item: pendingTransfer,
            label: 'Transferencia prioritaria',
            hint: 'Valida pago y libera la agenda antes del check-in.',
            tags: ['Pago por validar', 'WhatsApp listo'],
        };
    }

    const noShow = items
        .filter((item) => normalizeAppointmentStatus(item.status) === 'no_show')
        .sort((a, b) => appointmentStamp(a) - appointmentStamp(b))[0];
    if (noShow) {
        return {
            item: noShow,
            label: 'Incidencia abierta',
            hint: 'Confirma si requiere seguimiento o reprogramacion.',
            tags: ['No show', 'Seguimiento'],
        };
    }

    const nextAppointment = items
        .filter((item) => appointmentStamp(item) > 0)
        .sort((a, b) => appointmentStamp(a) - appointmentStamp(b))[0];
    if (nextAppointment) {
        return {
            item: nextAppointment,
            label: 'Siguiente ingreso',
            hint: 'Revisa contexto y deja la atencion preparada.',
            tags: ['Agenda viva'],
        };
    }

    return {
        item: null,
        label: 'Sin foco activo',
        hint: 'Cuando entren citas accionables apareceran aqui.',
        tags: [],
    };
}

function computeOps(items) {
    const pendingTransfers = applyFilter(items, 'pending_transfer');
    const upcoming48h = applyFilter(items, 'upcoming_48h');
    const noShows = applyFilter(items, 'no_show');
    const triage = applyFilter(items, 'triage_attention');
    const today = items.filter(isToday);

    return {
        pendingTransferCount: pendingTransfers.length,
        upcomingCount: upcoming48h.length,
        noShowCount: noShows.length,
        todayCount: today.length,
        triageCount: triage.length,
        focus: buildFocusAppointment(items),
    };
}

function paymentCell(item) {
    const paymentStatus = item.paymentStatus || item.payment_status || '';
    const proofUrl = String(
        item.transferProofUrl ||
            item.transferProofURL ||
            item.transfer_proof_url ||
            ''
    ).trim();
    return `
        <div class="appointment-payment-stack">
            <span class="appointment-pill" data-tone="${escapeHtml(paymentTone(paymentStatus))}">${escapeHtml(paymentLabel(paymentStatus))}</span>
            <small>Metodo: ${escapeHtml(paymentMethodLabel(item.paymentMethod || item.payment_method || ''))}</small>
            ${proofUrl ? `<a href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}
        </div>
    `;
}

function statusCell(item) {
    const status = normalizeAppointmentStatus(item.status);
    const paymentStatus = normalizePaymentStatus(item);
    const notes = [];
    if (paymentStatus === 'pending_transfer_review') {
        notes.push('Transferencia en espera');
    }
    if (status === 'no_show') {
        notes.push('Paciente ausente');
    }
    if (status === 'cancelled') {
        notes.push('Bloqueo operativo');
    }

    return `
        <div class="appointment-status-stack">
            <span class="appointment-pill" data-tone="${escapeHtml(statusTone(status))}">${escapeHtml(statusLabel(status))}</span>
            <small>${escapeHtml(notes[0] || 'Sin alertas abiertas')}</small>
        </div>
    `;
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
            const stamp = appointmentStamp(item);
            return `
                <tr class="appointment-row" data-appointment-id="${Number(item.id || 0)}">
                    <td data-label="Paciente">
                        <div class="appointment-person">
                            <strong>${escapeHtml(item.name || 'Sin nombre')}</strong>
                            <span>${escapeHtml(item.email || 'Sin email')}</span>
                            <small>${escapeHtml(item.phone || 'Sin telefono')}</small>
                        </div>
                    </td>
                    <td data-label="Servicio">
                        <div class="appointment-service">
                            <strong>${escapeHtml(humanizeToken(item.service, 'Servicio pendiente'))}</strong>
                            <span>Especialista: ${escapeHtml(humanizeToken(item.doctor, 'Sin asignar'))}</span>
                            <small>${escapeHtml(item.price || 'Sin tarifa')}</small>
                        </div>
                    </td>
                    <td data-label="Fecha">
                        <div class="appointment-date-stack">
                            <strong>${escapeHtml(formatDate(item.date))}</strong>
                            <span>${escapeHtml(item.time || '--:--')}</span>
                            <small>${escapeHtml(formatRelativeWindow(stamp))}</small>
                        </div>
                    </td>
                    <td data-label="Pago">${paymentCell(item)}</td>
                    <td data-label="Estado">${statusCell(item)}</td>
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

function renderOpsDeck(ops, visibleCount, totalCount) {
    setText('#appointmentsOpsPendingTransfer', ops.pendingTransferCount);
    setText(
        '#appointmentsOpsPendingTransferMeta',
        ops.pendingTransferCount > 0
            ? `${ops.pendingTransferCount} pago(s) detenidos`
            : 'Nada por validar'
    );
    setText('#appointmentsOpsUpcomingCount', ops.upcomingCount);
    setText(
        '#appointmentsOpsUpcomingMeta',
        ops.upcomingCount > 0
            ? `${ops.upcomingCount} cita(s) bajo ventana inmediata`
            : 'Sin presion inmediata'
    );
    setText('#appointmentsOpsNoShowCount', ops.noShowCount);
    setText(
        '#appointmentsOpsNoShowMeta',
        ops.noShowCount > 0
            ? `${ops.noShowCount} caso(s) requieren seguimiento`
            : 'Sin incidencias'
    );
    setText('#appointmentsOpsTodayCount', ops.todayCount);
    setText(
        '#appointmentsOpsTodayMeta',
        ops.todayCount > 0
            ? `${ops.todayCount} cita(s) en agenda de hoy`
            : 'Carga diaria limpia'
    );

    const summary =
        totalCount > 0
            ? `${ops.pendingTransferCount} transferencias, ${ops.triageCount} frentes accionables y ${visibleCount} cita(s) visibles.`
            : 'Sin citas cargadas.';
    setText('#appointmentsDeckSummary', summary);
    setText(
        '#appointmentsWorkbenchHint',
        ops.pendingTransferCount > 0
            ? 'Hay pagos por validar antes de liberar la agenda.'
            : 'Triage, pagos y seguimiento sin salir de la mesa.'
    );

    const chip = document.getElementById('appointmentsDeckChip');
    if (chip) {
        chip.textContent =
            ops.pendingTransferCount > 0 || ops.noShowCount > 0
                ? 'Atencion operativa'
                : 'Agenda estable';
        chip.setAttribute(
            'data-state',
            ops.pendingTransferCount > 0 || ops.noShowCount > 0
                ? 'warning'
                : 'success'
        );
    }

    const focus = ops.focus;
    setText('#appointmentsFocusLabel', focus.label);
    if (!focus.item) {
        setText('#appointmentsFocusPatient', 'Sin citas activas');
        setText(
            '#appointmentsFocusMeta',
            'Cuando entren citas accionables apareceran aqui.'
        );
        setText('#appointmentsFocusWindow', '-');
        setText('#appointmentsFocusPayment', '-');
        setText('#appointmentsFocusStatus', '-');
        setText('#appointmentsFocusContact', '-');
        setHtml('#appointmentsFocusTags', '');
        setText('#appointmentsFocusHint', focus.hint);
        return;
    }

    const item = focus.item;
    setText('#appointmentsFocusPatient', item.name || 'Sin nombre');
    setText(
        '#appointmentsFocusMeta',
        `${humanizeToken(item.service, 'Servicio pendiente')} | ${formatDate(item.date)} ${item.time || '--:--'}`
    );
    setText(
        '#appointmentsFocusWindow',
        formatRelativeWindow(appointmentStamp(item))
    );
    setText(
        '#appointmentsFocusPayment',
        paymentLabel(item.paymentStatus || item.payment_status)
    );
    setText('#appointmentsFocusStatus', statusLabel(item.status));
    setText('#appointmentsFocusContact', item.phone || 'Sin telefono');
    setHtml(
        '#appointmentsFocusTags',
        focus.tags
            .map(
                (tag) =>
                    `<span class="appointments-focus-tag">${escapeHtml(tag)}</span>`
            )
            .join('')
    );
    setText('#appointmentsFocusHint', focus.hint);
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
    if (normalize(state.appointments.sort) === 'patient_az') {
        stateParts.push('Paciente (A-Z)');
    } else if (normalize(state.appointments.sort) === 'datetime_asc') {
        stateParts.push('Fecha ascendente');
    }
    if (
        sorted.length === 0 &&
        (normalize(state.appointments.filter) !== 'all' ||
            normalize(state.appointments.search))
    ) {
        stateParts.push('Resultados: 0');
    }

    setText(
        '#appointmentsToolbarState',
        stateParts.length ? stateParts.join(' | ') : 'Sin filtros activos'
    );

    const clearButton = document.getElementById('clearAppointmentsFiltersBtn');
    if (clearButton) {
        const hasResettableFilters =
            normalize(state.appointments.filter) !== 'all' ||
            normalize(state.appointments.search);
        clearButton.classList.toggle('is-hidden', !hasResettableFilters);
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
    renderOpsDeck(computeOps(source), sorted.length, source.length);
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
