import { s as showToast, k as currentAvailability, a as apiRequest, m as currentAvailabilityMeta, n as setAvailability, o as setAvailabilityMeta, h as escapeHtml } from '../../admin.js';

let selectedDate = null;
let currentMonth = new Date();
let availabilityReadOnly = false;

function ensureStatusElements() {
    const panel = document.querySelector('#availability .time-slots-config');
    if (!panel)
        return { statusEl: null, detailsEl: null, linksEl: null };

    let statusEl = document.getElementById('availabilitySyncStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'availabilitySyncStatus';
        statusEl.className = 'selected-date';
        if (panel.firstChild) {
            panel.insertBefore(statusEl, panel.firstChild.nextSibling);
        } else {
            panel.appendChild(statusEl);
        }
    }

    let detailsEl = document.getElementById('availabilitySyncDetails');
    if (!detailsEl) {
        detailsEl = document.createElement('div');
        detailsEl.id = 'availabilitySyncDetails';
        detailsEl.className = 'selected-date';
        statusEl.insertAdjacentElement('afterend', detailsEl);
    }

    let linksEl = document.getElementById('availabilitySyncLinks');
    if (!linksEl) {
        linksEl = document.createElement('div');
        linksEl.id = 'availabilitySyncLinks';
        linksEl.className = 'selected-date';
        detailsEl.insertAdjacentElement('afterend', linksEl);
    }

    return { statusEl, detailsEl, linksEl };
}

function formatStatusTime(isoValue) {
    const value = String(isoValue || '').trim();
    if (!value) return 'n/d';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'n/d';
    return parsed.toLocaleString('es-EC');
}

function renderStatus() {
    const { statusEl, detailsEl, linksEl } = ensureStatusElements();
    if (!statusEl) return;

    const source = String(currentAvailabilityMeta.source || 'store');
    const mode = String(currentAvailabilityMeta.mode || 'live');
    const timezone = String(currentAvailabilityMeta.timezone || 'America/Guayaquil');
    const calendarAuth = String(currentAvailabilityMeta.calendarAuth || 'n/d');
    const tokenHealthy = currentAvailabilityMeta.calendarTokenHealthy === false ? 'no' : 'si';
    const configured = currentAvailabilityMeta.calendarConfigured === false ? 'no' : 'si';
    const reachable = currentAvailabilityMeta.calendarReachable === false ? 'no' : 'si';
    const generatedLabel = formatStatusTime(currentAvailabilityMeta.generatedAt);
    const lastSuccessLabel = formatStatusTime(
        currentAvailabilityMeta.calendarLastSuccessAt
    );
    const lastErrorLabel = formatStatusTime(currentAvailabilityMeta.calendarLastErrorAt);
    const lastErrorReason = String(currentAvailabilityMeta.calendarLastErrorReason || '').trim();

    if (source === 'google') {
        const modeLabel = mode === 'blocked' ? 'bloqueado' : 'live';
        statusEl.innerHTML = `Fuente: <strong>Google Calendar</strong> | Modo: <strong>${escapeHtml(modeLabel)}</strong> | TZ: <strong>${escapeHtml(timezone)}</strong>`;
        if (detailsEl) {
            let details = `Auth: <strong>${escapeHtml(calendarAuth)}</strong> | Token OK: <strong>${escapeHtml(tokenHealthy)}</strong> | Configurado: <strong>${escapeHtml(configured)}</strong> | Reachable: <strong>${escapeHtml(reachable)}</strong> | Ultimo exito: <strong>${escapeHtml(lastSuccessLabel)}</strong> | Snapshot: <strong>${escapeHtml(generatedLabel)}</strong>`;
            if (mode === 'blocked' && lastErrorReason) {
                details += ` | Ultimo error: <strong>${escapeHtml(lastErrorLabel)}</strong> (${escapeHtml(lastErrorReason)})`;
            }
            detailsEl.innerHTML = details;
        }
    } else {
        statusEl.innerHTML = `Fuente: <strong>Configuracion local</strong>`;
        if (detailsEl) {
            detailsEl.innerHTML = `Snapshot: <strong>${escapeHtml(generatedLabel)}</strong>`;
        }
    }
    updateSectionHeadings(source);

    if (!linksEl) return;

    const doctorCalendars = currentAvailabilityMeta.doctorCalendars;
    if (!doctorCalendars || typeof doctorCalendars !== 'object') {
        linksEl.innerHTML = '';
        return;
    }

    const renderDoctor = (doctorKey, doctorLabel) => {
        const record = doctorCalendars[doctorKey];
        if (!record || typeof record !== 'object') {
            return `${doctorLabel}: n/d`;
        }
        const masked = escapeHtml(String(record.idMasked || 'n/d'));
        const openUrl = String(record.openUrl || '');
        if (!/^https:\/\/calendar\.google\.com\//.test(openUrl)) {
            return `${doctorLabel}: ${masked}`;
        }
        return `${doctorLabel}: ${masked} <a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">Abrir</a>`;
    };

    linksEl.innerHTML = [
        renderDoctor('rosero', 'Dr. Rosero'),
        renderDoctor('narvaez', 'Dra. Narvaez'),
    ].join(' | ');
}

function updateSectionHeadings(source) {
    const calendarTitle = document.querySelector(
        '#availability .availability-calendar h3'
    );
    if (calendarTitle) {
        calendarTitle.textContent =
            source === 'google'
                ? 'Disponibilidad (Google Calendar - Solo lectura)'
                : 'Configurar Horarios Disponibles';
    }

    const dayTitle = document.querySelector('#availability .time-slots-config h3');
    if (dayTitle) {
        dayTitle.textContent =
            source === 'google'
                ? 'Horarios del Dia (solo lectura)'
                : 'Horarios del Dia';
    }
}

function clearSelectedDateState() {
    const selectedLabel = document.getElementById('selectedDate');
    if (selectedLabel) {
        selectedLabel.textContent = 'Selecciona una fecha';
    }
    const list = document.getElementById('timeSlotsList');
    if (list) {
        list.innerHTML = '<p class="empty-message">Selecciona una fecha para ver los horarios</p>';
    }
}

function toggleReadOnlyUi() {
    const addSlotForm = document.getElementById('addSlotForm');
    if (addSlotForm) {
        addSlotForm.classList.toggle('is-hidden', availabilityReadOnly);
    }
}

async function refreshAvailabilitySnapshot() {
    try {
        const payload = await apiRequest('availability', {
            query: {
                doctor: 'indiferente',
                service: 'consulta',
                days: 45,
            },
        });

        const data =
            payload && payload.data && typeof payload.data === 'object'
                ? payload.data
                : {};
        const snapshotMeta =
            payload && payload.meta && typeof payload.meta === 'object'
                ? payload.meta
                : {};
        const baseMeta =
            currentAvailabilityMeta &&
            typeof currentAvailabilityMeta === 'object'
                ? currentAvailabilityMeta
                : {};
        const mergedMeta = {
            ...baseMeta,
            ...snapshotMeta,
            source: String(snapshotMeta.source || baseMeta.source || 'store'),
            mode: String(snapshotMeta.mode || baseMeta.mode || 'live'),
            timezone: String(
                snapshotMeta.timezone || baseMeta.timezone || 'America/Guayaquil'
            ),
            generatedAt: String(
                snapshotMeta.generatedAt ||
                    baseMeta.generatedAt ||
                    new Date().toISOString()
            ),
        };

        setAvailability(data);
        setAvailabilityMeta(mergedMeta);
        availabilityReadOnly = String(mergedMeta.source || '') === 'google';
        renderStatus();
        toggleReadOnlyUi();
        if (selectedDate && !currentAvailability[selectedDate]) {
            selectedDate = null;
            clearSelectedDateState();
        }
    } catch (error) {
        console.error('Error refreshing availability:', error);
        showToast(
            `Error al actualizar disponibilidad: ${error?.message || 'error desconocido'}`,
            'error'
        );
        availabilityReadOnly = String(currentAvailabilityMeta.source || '') === 'google';
        renderStatus();
        toggleReadOnlyUi();
    }
}

function renderAvailabilityCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    document.getElementById('calendarMonth').textContent = new Date(
        year,
        month
    ).toLocaleDateString('es-EC', {
        month: 'long',
        year: 'numeric',
    });

    const calendar = document.getElementById('availabilityCalendar');
    calendar.innerHTML = '';

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    weekDays.forEach((day) => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day-header';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    });

    for (let i = firstDay - 1; i >= 0; i -= 1) {
        const day = daysInPrevMonth - i;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day other-month';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        if (selectedDate === dateStr) dayEl.classList.add('selected');
        if (
            currentAvailability[dateStr] &&
            currentAvailability[dateStr].length > 0
        )
            dayEl.classList.add('has-slots');

        dayEl.addEventListener('click', () => selectDate(dateStr));
        calendar.appendChild(dayEl);
    }

    const rendered = firstDay + daysInMonth;
    const remaining = 42 - rendered;
    for (let day = 1; day <= remaining; day += 1) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day other-month';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    }
}

async function initAvailabilityCalendar() {
    await refreshAvailabilitySnapshot();
    renderAvailabilityCalendar();
    if (!selectedDate) {
        clearSelectedDateState();
    }
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderAvailabilityCalendar();
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderAvailabilityCalendar();
    const date = new Date(dateStr);
    document.getElementById('selectedDate').textContent = date.toLocaleDateString(
        'es-EC',
        {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }
    );
    document.getElementById('addSlotForm').classList.toggle('is-hidden', availabilityReadOnly);
    loadTimeSlots(dateStr);
}

function loadTimeSlots(dateStr) {
    const slots = currentAvailability[dateStr] || [];
    const list = document.getElementById('timeSlotsList');
    if (slots.length === 0) {
        list.innerHTML = '<p class="empty-message">No hay horarios configurados</p>';
        return;
    }

    const encodedDate = encodeURIComponent(String(dateStr || ''));

    list.innerHTML = slots
        .slice()
        .sort()
        .map(
            (time) => `
        <div class="time-slot-item">
            <span class="time">${escapeHtml(time)}</span>
            <div class="slot-actions">
                ${
                    availabilityReadOnly
                        ? '<span class="selected-date">Solo lectura</span>'
                        : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${encodedDate}" data-time="${encodeURIComponent(String(time || ''))}">
                    <i class="fas fa-trash"></i>
                </button>`
                }
            </div>
        </div>
    `
        )
        .join('');
}

async function saveAvailability() {
    if (availabilityReadOnly) {
        throw new Error('Disponibilidad en solo lectura (Google Calendar).');
    }
    await apiRequest('availability', {
        method: 'POST',
        body: { availability: currentAvailability },
    });
}

async function addTimeSlot() {
    if (availabilityReadOnly) {
        showToast('Disponibilidad en solo lectura: gestionala desde Google Calendar.', 'warning');
        return;
    }
    if (!selectedDate) {
        showToast('Selecciona una fecha primero', 'warning');
        return;
    }
    const time = document.getElementById('newSlotTime').value;
    if (!time) {
        showToast('Ingresa un horario', 'warning');
        return;
    }

    if (!currentAvailability[selectedDate]) {
        currentAvailability[selectedDate] = [];
    }

    if (currentAvailability[selectedDate].includes(time)) {
        showToast('Este horario ya existe', 'warning');
        return;
    }

    try {
        currentAvailability[selectedDate].push(time);
        await saveAvailability();
        loadTimeSlots(selectedDate);
        renderAvailabilityCalendar();
        document.getElementById('newSlotTime').value = '';
        showToast('Horario agregado', 'success');
    } catch (error) {
        showToast(`No se pudo guardar el horario: ${error.message}`, 'error');
    }
}

async function removeTimeSlot(dateStr, time) {
    if (availabilityReadOnly) {
        showToast('Disponibilidad en solo lectura: gestionala desde Google Calendar.', 'warning');
        return;
    }
    try {
        currentAvailability[dateStr] = (currentAvailability[dateStr] || []).filter((t) => t !== time);
        await saveAvailability();
        loadTimeSlots(dateStr);
        renderAvailabilityCalendar();
        showToast('Horario eliminado', 'success');
    } catch (error) {
        showToast(`No se pudo eliminar el horario: ${error.message}`, 'error');
    }
}

export { addTimeSlot, changeMonth, initAvailabilityCalendar, removeTimeSlot, renderAvailabilityCalendar };
