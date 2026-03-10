import {
    currentAvailability,
    currentAvailabilityMeta,
    setAvailability,
    setAvailabilityMeta,
} from './state.js';
import { apiRequest } from './api.js';
import { escapeHtml, showToast } from './ui.js';

let selectedDate = null;
let currentMonth = new Date();
let availabilityReadOnly = false;
let availabilityDayClipboard = null;
let availabilityPersistedSnapshot = {};
let availabilitySaveInFlight = false;

const AVAILABILITY_DAY_CLIPBOARD_STORAGE_KEY =
    'admin-availability-day-clipboard';
const AVAILABILITY_LAST_SELECTED_DATE_STORAGE_KEY =
    'admin-availability-last-selected-date';

function cloneAvailabilityMap(source) {
    const normalizedSource = source && typeof source === 'object' ? source : {};
    const clone = {};
    Object.keys(normalizedSource)
        .sort()
        .forEach((dateKey) => {
            if (!isValidDateKey(dateKey)) return;
            const slots = normalizeSlotsList(normalizedSource[dateKey] || []);
            if (slots.length > 0) {
                clone[dateKey] = slots;
            }
        });
    return clone;
}

function setAvailabilityPersistedSnapshot(source) {
    availabilityPersistedSnapshot = cloneAvailabilityMap(source);
}

function getAvailabilityDirtyDateKeys() {
    const current = cloneAvailabilityMap(currentAvailability);
    const persisted = cloneAvailabilityMap(availabilityPersistedSnapshot);
    const allDateKeys = Array.from(
        new Set([...Object.keys(current), ...Object.keys(persisted)])
    ).sort();
    return allDateKeys.filter((dateKey) => {
        const currentSlots = current[dateKey] || [];
        const persistedSlots = persisted[dateKey] || [];
        if (currentSlots.length !== persistedSlots.length) return true;
        return currentSlots.some(
            (slot, index) => slot !== persistedSlots[index]
        );
    });
}

function isAvailabilityDirty() {
    return getAvailabilityDirtyDateKeys().length > 0;
}

export function hasAvailabilityDraftChanges() {
    return isAvailabilityDirty();
}

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value) {
    const normalized = String(value || '').trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );
    }
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isValidDateKey(value) {
    return Boolean(parseLocalDateKey(value));
}

function readLastSelectedDateFromStorage() {
    try {
        const stored = localStorage.getItem(
            AVAILABILITY_LAST_SELECTED_DATE_STORAGE_KEY
        );
        return isValidDateKey(stored) ? String(stored).trim() : '';
    } catch (_error) {
        return '';
    }
}

function persistLastSelectedDateToStorage(dateValue) {
    try {
        const normalized = String(dateValue || '').trim();
        if (!isValidDateKey(normalized)) {
            localStorage.removeItem(
                AVAILABILITY_LAST_SELECTED_DATE_STORAGE_KEY
            );
            return;
        }
        localStorage.setItem(
            AVAILABILITY_LAST_SELECTED_DATE_STORAGE_KEY,
            normalized
        );
    } catch (_error) {
        // localStorage unavailable
    }
}

function readAvailabilityClipboardFromStorage() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(AVAILABILITY_DAY_CLIPBOARD_STORAGE_KEY) ||
                'null'
        );
        if (!parsed || typeof parsed !== 'object') return null;
        const sourceDate = String(parsed.sourceDate || '').trim();
        const slots = Array.isArray(parsed.slots)
            ? parsed.slots
                  .map((value) => String(value || '').trim())
                  .filter(Boolean)
            : [];
        if (!sourceDate || slots.length === 0) return null;
        return { sourceDate, slots: Array.from(new Set(slots)).sort() };
    } catch (_error) {
        return null;
    }
}

function ensureAvailabilityClipboardLoaded() {
    if (availabilityDayClipboard) return;
    availabilityDayClipboard = readAvailabilityClipboardFromStorage();
}

function persistAvailabilityClipboardToStorage() {
    try {
        if (
            availabilityDayClipboard &&
            typeof availabilityDayClipboard === 'object' &&
            Array.isArray(availabilityDayClipboard.slots) &&
            availabilityDayClipboard.slots.length > 0
        ) {
            localStorage.setItem(
                AVAILABILITY_DAY_CLIPBOARD_STORAGE_KEY,
                JSON.stringify(availabilityDayClipboard)
            );
            return;
        }
        localStorage.removeItem(AVAILABILITY_DAY_CLIPBOARD_STORAGE_KEY);
    } catch (_error) {
        // localStorage unavailable
    }
}

function normalizeSlotsList(slots) {
    return Array.from(
        new Set(
            (Array.isArray(slots) ? slots : [])
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        )
    ).sort();
}

function setAvailabilityClipboard(sourceDate, slots) {
    const normalizedSourceDate = String(sourceDate || '').trim();
    const normalizedSlots = normalizeSlotsList(slots);
    if (!normalizedSourceDate || normalizedSlots.length === 0) {
        availabilityDayClipboard = null;
        persistAvailabilityClipboardToStorage();
        return;
    }
    availabilityDayClipboard = {
        sourceDate: normalizedSourceDate,
        slots: normalizedSlots,
        copiedAt: new Date().toISOString(),
    };
    persistAvailabilityClipboardToStorage();
}

function formatAvailabilityDayLabel(dateValue) {
    const normalized = String(dateValue || '').trim();
    if (!normalized) return 'n/d';
    const parsedDate = parseLocalDateKey(normalized);
    if (!parsedDate) return normalized;
    return parsedDate.toLocaleDateString('es-EC', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

function getSelectedDaySlots() {
    if (!selectedDate) return [];
    return normalizeSlotsList(currentAvailability[selectedDate] || []);
}

function setSlotsForDate(dateStr, slots) {
    const normalizedDate = String(dateStr || '').trim();
    if (!normalizedDate) return;
    const normalizedSlots = normalizeSlotsList(slots);
    if (normalizedSlots.length === 0) {
        delete currentAvailability[normalizedDate];
        return;
    }
    currentAvailability[normalizedDate] = normalizedSlots;
}

function buildDateKeyRange(startDateKey, dayCount) {
    const parsedStartDate = parseLocalDateKey(startDateKey);
    const normalizedDayCount = Number(dayCount);
    if (!parsedStartDate || !Number.isFinite(normalizedDayCount)) {
        return [];
    }

    const totalDays = Math.max(0, Math.round(normalizedDayCount));
    if (totalDays === 0) return [];

    return Array.from({ length: totalDays }, (_, offset) => {
        const date = new Date(parsedStartDate);
        date.setDate(parsedStartDate.getDate() + offset);
        return toLocalDateKey(date);
    });
}

function getSlotsCountForDateKeys(dateKeys) {
    return (Array.isArray(dateKeys) ? dateKeys : []).reduce(
        (total, dateKey) =>
            total +
            normalizeSlotsList(currentAvailability[dateKey] || []).length,
        0
    );
}

function setCurrentMonthFromDateKey(dateValue) {
    const parsedDate = parseLocalDateKey(dateValue);
    if (!parsedDate) return;
    currentMonth = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
}

function getDatesWithSlotsSorted() {
    return Object.keys(currentAvailability || {})
        .filter((dateKey) => {
            if (!isValidDateKey(dateKey)) return false;
            const slots = currentAvailability[dateKey];
            return Array.isArray(slots) && slots.length > 0;
        })
        .sort();
}

function findNextDateWithSlots({
    referenceDate = '',
    includeReference = false,
} = {}) {
    const datesWithSlots = getDatesWithSlotsSorted();
    if (datesWithSlots.length === 0) return '';

    const reference = isValidDateKey(referenceDate)
        ? String(referenceDate).trim()
        : toLocalDateKey(new Date());

    const comparator = includeReference
        ? (dateKey) => dateKey >= reference
        : (dateKey) => dateKey > reference;
    const nextDate = datesWithSlots.find(comparator);
    return nextDate || datesWithSlots[0];
}

function navigateAvailabilityDateByOffset(dateValue, dayOffset) {
    const baseDate = parseLocalDateKey(dateValue);
    if (!baseDate) return;
    const offset = Number(dayOffset);
    if (!Number.isFinite(offset) || offset === 0) return;

    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + offset);
    const nextDateKey = toLocalDateKey(nextDate);
    setCurrentMonthFromDateKey(nextDateKey);
    selectDate(nextDateKey);
}

function ensureStatusElements() {
    const panel = document.querySelector('#availability .time-slots-config');
    if (!panel) return { statusEl: null, detailsEl: null, linksEl: null };

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

function setAvailabilityHelperText(message) {
    const helperEl = document.getElementById('availabilityHelperText');
    if (!helperEl) return;
    helperEl.textContent = String(message || '').trim();
}

function setTimeSlotsCountBadge(count) {
    const badgeEl = document.getElementById('timeSlotsCountBadge');
    if (!badgeEl) return;
    const normalizedCount =
        Number.isFinite(Number(count)) && Number(count) > 0
            ? Math.round(Number(count))
            : 0;
    badgeEl.textContent = `${normalizedCount} horario${normalizedCount === 1 ? '' : 's'}`;
}

function renderAvailabilitySelectionSummary() {
    const summaryEl = document.getElementById('availabilitySelectionSummary');
    if (!summaryEl) return;

    const source = String(currentAvailabilityMeta.source || 'store');
    const sourceLabel = source === 'google' ? 'Google Calendar' : 'Local';
    const modeLabel = availabilityReadOnly ? 'Solo lectura' : 'Editable';
    const dateValue = String(selectedDate || '').trim();
    const selectedSlots = dateValue
        ? Array.isArray(currentAvailability[dateValue])
            ? currentAvailability[dateValue].length
            : 0
        : null;

    if (!dateValue) {
        summaryEl.innerHTML = [
            `<span class="availability-summary-chip"><strong>Fuente:</strong> ${escapeHtml(sourceLabel)}</span>`,
            `<span class="availability-summary-chip ${availabilityReadOnly ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${escapeHtml(modeLabel)}</span>`,
            '<span class="toolbar-state-empty">Selecciona una fecha para ver el detalle del dia</span>',
        ].join('');
        return;
    }

    const parsedDate = parseLocalDateKey(dateValue);
    const dateLabel = !parsedDate
        ? dateValue
        : parsedDate.toLocaleDateString('es-EC', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
          });

    summaryEl.innerHTML = [
        `<span class="availability-summary-chip"><strong>Fuente:</strong> ${escapeHtml(sourceLabel)}</span>`,
        `<span class="availability-summary-chip ${availabilityReadOnly ? 'is-readonly' : 'is-editable'}"><strong>Modo:</strong> ${escapeHtml(modeLabel)}</span>`,
        `<span class="availability-summary-chip"><strong>Fecha:</strong> ${escapeHtml(dateLabel)}</span>`,
        `<span class="availability-summary-chip"><strong>Slots:</strong> ${escapeHtml(String(selectedSlots ?? 0))}</span>`,
    ].join('');
}

function renderAvailabilityDayActions() {
    ensureAvailabilityClipboardLoaded();
    const panel = document.getElementById('availabilityDayActions');
    const statusEl = document.getElementById('availabilityDayActionsStatus');
    if (!panel || !statusEl) return;

    const hasSelectedDate = Boolean(String(selectedDate || '').trim());
    const selectedSlots = getSelectedDaySlots();
    const hasSelectedSlots = selectedSlots.length > 0;
    const selectedWeekDateKeys = hasSelectedDate
        ? buildDateKeyRange(selectedDate, 7)
        : [];
    const selectedWeekSlotsCount =
        getSlotsCountForDateKeys(selectedWeekDateKeys);
    const selectedWeekActiveDays = selectedWeekDateKeys.filter(
        (dateKey) =>
            normalizeSlotsList(currentAvailability[dateKey] || []).length > 0
    ).length;
    const clipboardSlots = normalizeSlotsList(
        availabilityDayClipboard?.slots || []
    );
    const hasClipboard = clipboardSlots.length > 0;

    const copyBtn = panel.querySelector(
        '[data-action="copy-availability-day"]'
    );
    const pasteBtn = panel.querySelector(
        '[data-action="paste-availability-day"]'
    );
    const duplicateBtn = panel.querySelector(
        '[data-action="duplicate-availability-day-next"]'
    );
    const duplicateWeekBtn = panel.querySelector(
        '[data-action="duplicate-availability-next-week"]'
    );
    const clearBtn = panel.querySelector(
        '[data-action="clear-availability-day"]'
    );
    const clearWeekBtn = panel.querySelector(
        '[data-action="clear-availability-week"]'
    );

    if (copyBtn instanceof HTMLButtonElement) {
        copyBtn.disabled = !hasSelectedDate || !hasSelectedSlots;
    }
    if (pasteBtn instanceof HTMLButtonElement) {
        pasteBtn.disabled =
            !hasSelectedDate || !hasClipboard || availabilityReadOnly;
    }
    if (duplicateBtn instanceof HTMLButtonElement) {
        duplicateBtn.disabled =
            !hasSelectedDate || !hasSelectedSlots || availabilityReadOnly;
    }
    if (duplicateWeekBtn instanceof HTMLButtonElement) {
        duplicateWeekBtn.disabled =
            !hasSelectedDate || !hasSelectedSlots || availabilityReadOnly;
    }
    if (clearBtn instanceof HTMLButtonElement) {
        clearBtn.disabled =
            !hasSelectedDate || !hasSelectedSlots || availabilityReadOnly;
    }
    if (clearWeekBtn instanceof HTMLButtonElement) {
        clearWeekBtn.disabled =
            !hasSelectedDate ||
            selectedWeekSlotsCount === 0 ||
            availabilityReadOnly;
    }

    panel.classList.toggle('is-hidden', !hasSelectedDate && !hasClipboard);

    if (!hasSelectedDate && !hasClipboard) {
        statusEl.innerHTML =
            '<span class="toolbar-state-empty">Selecciona una fecha para usar acciones del dia</span>';
        return;
    }

    const statusMarkup = [];
    if (hasSelectedDate) {
        statusMarkup.push(
            `<span class="toolbar-chip is-info">Fecha activa: ${escapeHtml(
                formatAvailabilityDayLabel(selectedDate)
            )}</span>`
        );
        statusMarkup.push(
            `<span class="toolbar-chip is-muted">Slots: ${escapeHtml(String(selectedSlots.length))}</span>`
        );
        statusMarkup.push(
            `<span class="toolbar-chip is-muted">Semana: ${escapeHtml(
                String(selectedWeekActiveDays)
            )} dia(s), ${escapeHtml(String(selectedWeekSlotsCount))} slot(s)</span>`
        );
    }

    if (hasClipboard) {
        statusMarkup.push(
            `<span class="toolbar-chip">Portapapeles: ${escapeHtml(String(clipboardSlots.length))} (${escapeHtml(
                formatAvailabilityDayLabel(availabilityDayClipboard?.sourceDate)
            )})</span>`
        );
    } else {
        statusMarkup.push(
            '<span class="toolbar-chip is-muted">Portapapeles vacío</span>'
        );
    }

    if (availabilityReadOnly) {
        statusMarkup.push(
            '<span class="toolbar-chip is-danger">Edicion bloqueada por Google Calendar</span>'
        );
    }

    statusEl.innerHTML = statusMarkup.join('');
}

function renderAvailabilityDraftPanel() {
    const panel = document.getElementById('availabilityDraftPanel');
    const statusEl = document.getElementById('availabilityDraftStatus');
    const saveBtn = document.getElementById('availabilitySaveDraftBtn');
    const discardBtn = document.getElementById('availabilityDiscardDraftBtn');
    if (!panel || !statusEl) return;

    const dirtyDateKeys = getAvailabilityDirtyDateKeys();
    const dirtyCount = dirtyDateKeys.length;
    const dirtyPreview = dirtyDateKeys
        .slice(0, 2)
        .map((dateKey) => formatAvailabilityDayLabel(dateKey))
        .join(', ');

    if (availabilityReadOnly) {
        statusEl.innerHTML =
            '<span class="toolbar-chip is-danger">Edición bloqueada por Google Calendar</span>';
    } else if (dirtyCount === 0) {
        statusEl.innerHTML =
            '<span class="toolbar-chip is-muted">Sin cambios pendientes</span>';
    } else {
        const dirtyLabel = `${dirtyCount} día${dirtyCount === 1 ? '' : 's'} con cambios pendientes`;
        const previewSuffix = dirtyPreview
            ? ` (${escapeHtml(dirtyPreview)}${dirtyCount > 2 ? '…' : ''})`
            : '';
        statusEl.innerHTML = `<span class="toolbar-chip is-info">${escapeHtml(dirtyLabel)}${previewSuffix}</span>`;
    }

    if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.disabled =
            availabilityReadOnly ||
            dirtyCount === 0 ||
            availabilitySaveInFlight;
        saveBtn.setAttribute('aria-busy', String(availabilitySaveInFlight));
    }

    if (discardBtn instanceof HTMLButtonElement) {
        discardBtn.disabled = dirtyCount === 0 || availabilitySaveInFlight;
    }
}

function renderStatus() {
    const { statusEl, detailsEl, linksEl } = ensureStatusElements();
    if (!statusEl) return;

    const source = String(currentAvailabilityMeta.source || 'store');
    const mode = String(currentAvailabilityMeta.mode || 'live');
    const timezone = String(
        currentAvailabilityMeta.timezone || 'America/Guayaquil'
    );
    const calendarAuth = String(currentAvailabilityMeta.calendarAuth || 'n/d');
    const tokenHealthy =
        currentAvailabilityMeta.calendarTokenHealthy === false ? 'no' : 'si';
    const configured =
        currentAvailabilityMeta.calendarConfigured === false ? 'no' : 'si';
    const reachable =
        currentAvailabilityMeta.calendarReachable === false ? 'no' : 'si';
    const generatedLabel = formatStatusTime(
        currentAvailabilityMeta.generatedAt
    );
    const lastSuccessLabel = formatStatusTime(
        currentAvailabilityMeta.calendarLastSuccessAt
    );
    const lastErrorLabel = formatStatusTime(
        currentAvailabilityMeta.calendarLastErrorAt
    );
    const lastErrorReason = String(
        currentAvailabilityMeta.calendarLastErrorReason || ''
    ).trim();

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
        setAvailabilityHelperText(
            'Modo solo lectura: gestiona horarios directamente en Google Calendar.'
        );
    } else {
        statusEl.innerHTML = `Fuente: <strong>Configuracion local</strong>`;
        if (detailsEl) {
            detailsEl.innerHTML = `Snapshot: <strong>${escapeHtml(generatedLabel)}</strong>`;
        }
        setAvailabilityHelperText(
            'Selecciona un dia para editar horarios. Guarda o descarta el borrador cuando termines.'
        );
    }
    updateSectionHeadings(source);
    renderAvailabilitySelectionSummary();
    renderAvailabilityDayActions();
    renderAvailabilityDraftPanel();

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
        renderDoctor('narvaez', 'Dra. Narváez'),
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

    const dayTitle = document.querySelector(
        '#availability .time-slots-config h3'
    );
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
    setTimeSlotsCountBadge(0);
    const list = document.getElementById('timeSlotsList');
    if (list) {
        list.innerHTML =
            '<p class="empty-message">Selecciona una fecha para ver los horarios</p>';
    }
    toggleReadOnlyUi();
    renderAvailabilitySelectionSummary();
    renderAvailabilityDayActions();
    renderAvailabilityDraftPanel();
}

function toggleReadOnlyUi() {
    const hasSelectedDate = Boolean(String(selectedDate || '').trim());
    const addSlotForm = document.getElementById('addSlotForm');
    if (addSlotForm) {
        addSlotForm.classList.toggle(
            'is-hidden',
            availabilityReadOnly || !hasSelectedDate
        );
    }
    const presets = document.getElementById('availabilityQuickSlotPresets');
    if (presets) {
        presets.classList.toggle(
            'is-hidden',
            availabilityReadOnly || !hasSelectedDate
        );
        presets.querySelectorAll('.slot-preset-btn').forEach((button) => {
            button.disabled = availabilityReadOnly || !hasSelectedDate;
        });
    }
    renderAvailabilityDayActions();
    renderAvailabilityDraftPanel();
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
                snapshotMeta.timezone ||
                    baseMeta.timezone ||
                    'America/Guayaquil'
            ),
            generatedAt: String(
                snapshotMeta.generatedAt ||
                    baseMeta.generatedAt ||
                    new Date().toISOString()
            ),
        };

        setAvailability(cloneAvailabilityMap(data));
        setAvailabilityMeta(mergedMeta);
        setAvailabilityPersistedSnapshot(currentAvailability);
        availabilityReadOnly = String(mergedMeta.source || '') === 'google';
        renderStatus();
        toggleReadOnlyUi();
        if (selectedDate && !isValidDateKey(selectedDate)) {
            selectedDate = null;
            persistLastSelectedDateToStorage('');
            clearSelectedDateState();
            return;
        }

        if (selectedDate) {
            loadTimeSlots(selectedDate);
        } else {
            clearSelectedDateState();
        }
    } catch (error) {
        console.error('Error refreshing availability:', error);
        showToast(
            `Error al actualizar disponibilidad: ${error?.message || 'error desconocido'}`,
            'error'
        );
        availabilityReadOnly =
            String(currentAvailabilityMeta.source || '') === 'google';
        renderStatus();
        toggleReadOnlyUi();
    }
}

export function renderAvailabilityCalendar() {
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
    const todayKey = toLocalDateKey(new Date());

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
        const dateStr = toLocalDateKey(date);
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;
        dayEl.tabIndex = 0;
        dayEl.setAttribute('role', 'button');
        dayEl.setAttribute('aria-label', `Seleccionar ${dateStr}`);

        if (selectedDate === dateStr) dayEl.classList.add('selected');
        if (todayKey === dateStr) dayEl.classList.add('today');
        if (
            currentAvailability[dateStr] &&
            currentAvailability[dateStr].length > 0
        )
            dayEl.classList.add('has-slots');

        dayEl.addEventListener('click', () => selectDate(dateStr));
        dayEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectDate(dateStr);
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateAvailabilityDateByOffset(dateStr, -1);
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                navigateAvailabilityDateByOffset(dateStr, 1);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                navigateAvailabilityDateByOffset(dateStr, -7);
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                navigateAvailabilityDateByOffset(dateStr, 7);
            }
        });
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

export async function initAvailabilityCalendar() {
    await refreshAvailabilitySnapshot();
    if (!selectedDate) {
        const rememberedDate = readLastSelectedDateFromStorage();
        if (isValidDateKey(rememberedDate)) {
            selectedDate = rememberedDate;
        }
    }

    if (selectedDate && !isValidDateKey(selectedDate)) {
        selectedDate = null;
    }
    if (selectedDate) {
        setCurrentMonthFromDateKey(selectedDate);
    }
    renderAvailabilityCalendar();
    if (!selectedDate) {
        clearSelectedDateState();
    } else {
        selectDate(selectedDate, { persist: false });
    }
}

export function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderAvailabilityCalendar();
}

export function jumpAvailabilityToToday() {
    const today = new Date();
    currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderAvailabilityCalendar();
    selectDate(toLocalDateKey(today));
}

export function jumpAvailabilityToNextWithSlots() {
    const nextDateKey = findNextDateWithSlots({
        referenceDate: selectedDate || toLocalDateKey(new Date()),
        includeReference: false,
    });

    if (!nextDateKey) {
        showToast('No hay fechas con horarios configurados', 'warning');
        return;
    }

    setCurrentMonthFromDateKey(nextDateKey);
    selectDate(nextDateKey);
}

export function focusAvailabilityTimeInput() {
    const input = document.getElementById('newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;
    if (availabilityReadOnly || input.closest('.is-hidden')) {
        return;
    }
    input.focus({ preventScroll: true });
}

export function isAvailabilitySectionActive() {
    return (
        document.getElementById('availability')?.classList.contains('active') ||
        false
    );
}

function selectDate(dateStr, { persist = true } = {}) {
    if (!isValidDateKey(dateStr)) return;
    selectedDate = dateStr;
    if (persist) {
        persistLastSelectedDateToStorage(dateStr);
    }
    renderAvailabilityCalendar();
    const date = parseLocalDateKey(dateStr) || new Date(dateStr);
    document.getElementById('selectedDate').textContent =
        date.toLocaleDateString('es-EC', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    toggleReadOnlyUi();
    renderAvailabilitySelectionSummary();
    loadTimeSlots(dateStr);
}

function loadTimeSlots(dateStr) {
    const slots = currentAvailability[dateStr] || [];
    const list = document.getElementById('timeSlotsList');
    setTimeSlotsCountBadge(slots.length);
    if (slots.length === 0) {
        list.innerHTML =
            '<p class="empty-message">No hay horarios configurados para este dia</p>';
        renderAvailabilitySelectionSummary();
        renderAvailabilityDayActions();
        renderAvailabilityDraftPanel();
        return;
    }

    const encodedDate = encodeURIComponent(String(dateStr || ''));

    list.innerHTML = slots
        .slice()
        .sort()
        .map(
            (time) => `
        <div class="time-slot-item${availabilityReadOnly ? ' is-readonly' : ''}">
            <span class="time">${escapeHtml(time)}</span>
            <div class="slot-actions">
                ${
                    availabilityReadOnly
                        ? '<span class="slot-readonly-tag">Solo lectura</span>'
                        : `<button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${encodedDate}" data-time="${encodeURIComponent(String(time || ''))}">
                    <i class="fas fa-trash"></i>
                </button>`
                }
            </div>
        </div>
    `
        )
        .join('');
    renderAvailabilitySelectionSummary();
    renderAvailabilityDayActions();
    renderAvailabilityDraftPanel();
}

async function saveAvailability() {
    if (availabilityReadOnly) {
        throw new Error('Disponibilidad en solo lectura (Google Calendar).');
    }
    if (availabilitySaveInFlight) {
        return false;
    }
    availabilitySaveInFlight = true;
    renderAvailabilityDraftPanel();
    try {
        const normalizedAvailability =
            cloneAvailabilityMap(currentAvailability);
        setAvailability(normalizedAvailability);
        await apiRequest('availability', {
            method: 'POST',
            body: { availability: normalizedAvailability },
        });
        setAvailabilityPersistedSnapshot(currentAvailability);
        return true;
    } finally {
        availabilitySaveInFlight = false;
        renderAvailabilityDraftPanel();
    }
}

function syncAvailabilityUiAfterMutation() {
    renderAvailabilityCalendar();
    if (selectedDate) {
        loadTimeSlots(selectedDate);
        return;
    }
    clearSelectedDateState();
}

function mutateAvailabilityDraft(mutator) {
    if (typeof mutator === 'function') {
        mutator();
    }
    syncAvailabilityUiAfterMutation();
}

export async function saveAvailabilityDraft() {
    if (availabilityReadOnly) {
        showToast(
            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
            'warning'
        );
        return false;
    }

    if (!isAvailabilityDirty()) {
        showToast('No hay cambios pendientes por guardar', 'info');
        return false;
    }

    try {
        await saveAvailability();
        showToast('Cambios de disponibilidad guardados', 'success');
        return true;
    } catch (error) {
        showToast(`No se pudieron guardar cambios: ${error.message}`, 'error');
        return false;
    }
}

export function discardAvailabilityDraft() {
    if (!isAvailabilityDirty()) {
        showToast('No hay cambios pendientes por descartar', 'info');
        return;
    }

    if (
        !confirm(
            'Descartar todos los cambios pendientes de disponibilidad y volver al estado guardado?'
        )
    ) {
        return;
    }

    setAvailability(cloneAvailabilityMap(availabilityPersistedSnapshot));
    syncAvailabilityUiAfterMutation();
    showToast('Cambios pendientes descartados', 'success');
}

export async function addTimeSlot() {
    if (availabilityReadOnly) {
        showToast(
            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
            'warning'
        );
        return;
    }
    if (!selectedDate) {
        showToast('Selecciona una fecha primero', 'warning');
        return;
    }
    const timeInput = document.getElementById('newSlotTime');
    if (!(timeInput instanceof HTMLInputElement)) return;
    const time = String(timeInput.value || '').trim();
    if (!time) {
        showToast('Ingresa un horario', 'warning');
        return;
    }

    const selectedSlots = normalizeSlotsList(
        currentAvailability[selectedDate] || []
    );
    if (selectedSlots.includes(time)) {
        showToast('Este horario ya existe', 'warning');
        return;
    }

    mutateAvailabilityDraft(() => {
        setSlotsForDate(selectedDate, [...selectedSlots, time]);
    });
    timeInput.value = '';
    showToast('Horario agregado a cambios pendientes', 'success');
}

export async function removeTimeSlot(dateStr, time) {
    if (availabilityReadOnly) {
        showToast(
            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
            'warning'
        );
        return;
    }
    const normalizedDate = String(dateStr || '').trim();
    const normalizedTime = String(time || '').trim();
    if (!isValidDateKey(normalizedDate) || !normalizedTime) {
        showToast('No se pudo identificar el horario a eliminar', 'warning');
        return;
    }
    const currentSlots = normalizeSlotsList(
        currentAvailability[normalizedDate] || []
    );
    const nextSlots = currentSlots.filter((slot) => slot !== normalizedTime);
    if (nextSlots.length === currentSlots.length) {
        showToast('El horario ya no existe en el borrador', 'info');
        return;
    }
    mutateAvailabilityDraft(() => {
        setSlotsForDate(normalizedDate, nextSlots);
    });
    showToast('Horario eliminado de cambios pendientes', 'success');
}

export function prefillTimeSlot(value) {
    if (availabilityReadOnly) {
        showToast(
            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
            'warning'
        );
        return;
    }
    const input = document.getElementById('newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = String(value || '').trim();
    input.focus();
}

function requireEditableSelectedDate() {
    if (availabilityReadOnly) {
        showToast(
            'Disponibilidad en solo lectura: gestionala desde Google Calendar.',
            'warning'
        );
        return false;
    }
    if (!selectedDate) {
        showToast('Selecciona una fecha primero', 'warning');
        return false;
    }
    return true;
}

export function copyAvailabilityDay() {
    if (!selectedDate) {
        showToast('Selecciona una fecha para copiar', 'warning');
        return;
    }
    const selectedSlots = getSelectedDaySlots();
    if (selectedSlots.length === 0) {
        showToast('No hay horarios para copiar en este dia', 'warning');
        return;
    }
    setAvailabilityClipboard(selectedDate, selectedSlots);
    renderAvailabilityDayActions();
    showToast(
        `Día copiado (${selectedSlots.length} horario${selectedSlots.length === 1 ? '' : 's'})`,
        'success'
    );
}

export async function pasteAvailabilityDay() {
    ensureAvailabilityClipboardLoaded();
    if (!requireEditableSelectedDate()) return;
    const clipboardSlots = normalizeSlotsList(
        availabilityDayClipboard?.slots || []
    );
    if (clipboardSlots.length === 0) {
        showToast('Portapapeles vacio', 'warning');
        return;
    }

    const currentSlots = getSelectedDaySlots();
    const isSamePayload =
        currentSlots.length === clipboardSlots.length &&
        currentSlots.every((slot, index) => slot === clipboardSlots[index]);
    if (isSamePayload) {
        showToast('La fecha ya tiene esos mismos horarios', 'warning');
        return;
    }

    if (
        currentSlots.length > 0 &&
        !confirm(
            `Reemplazar ${currentSlots.length} horario${currentSlots.length === 1 ? '' : 's'} en ${formatAvailabilityDayLabel(selectedDate)} con ${clipboardSlots.length}?`
        )
    ) {
        return;
    }

    mutateAvailabilityDraft(() => {
        setSlotsForDate(selectedDate, clipboardSlots);
    });
    showToast('Horarios pegados en cambios pendientes', 'success');
}

export async function duplicateAvailabilityDayToNext() {
    if (!requireEditableSelectedDate()) return;
    const sourceSlots = getSelectedDaySlots();
    if (sourceSlots.length === 0) {
        showToast('No hay horarios para duplicar en este dia', 'warning');
        return;
    }

    const sourceDate = parseLocalDateKey(selectedDate);
    if (!sourceDate) {
        showToast('Fecha seleccionada invalida', 'error');
        return;
    }
    const nextDate = new Date(sourceDate);
    nextDate.setDate(sourceDate.getDate() + 1);
    const nextDateKey = toLocalDateKey(nextDate);
    const nextDateCurrentSlots = normalizeSlotsList(
        currentAvailability[nextDateKey] || []
    );

    if (
        nextDateCurrentSlots.length > 0 &&
        !confirm(
            `${formatAvailabilityDayLabel(nextDateKey)} ya tiene ${nextDateCurrentSlots.length} horario${nextDateCurrentSlots.length === 1 ? '' : 's'}. Deseas reemplazarlos?`
        )
    ) {
        return;
    }

    mutateAvailabilityDraft(() => {
        setSlotsForDate(nextDateKey, sourceSlots);
        setAvailabilityClipboard(selectedDate, sourceSlots);
    });
    setCurrentMonthFromDateKey(nextDateKey);
    selectDate(nextDateKey);
    showToast(
        `Horarios duplicados a ${formatAvailabilityDayLabel(nextDateKey)} (pendiente de guardar)`,
        'success'
    );
}

export async function duplicateAvailabilityDayToNextWeek() {
    if (!requireEditableSelectedDate()) return;
    const sourceSlots = getSelectedDaySlots();
    if (sourceSlots.length === 0) {
        showToast('No hay horarios para duplicar en este dia', 'warning');
        return;
    }

    const targetDateKeys = buildDateKeyRange(selectedDate, 8).slice(1);
    if (targetDateKeys.length === 0) {
        showToast('No se pudieron preparar los siguientes dias', 'error');
        return;
    }

    const replacedDatesCount = targetDateKeys.filter((dateKey) => {
        const daySlots = normalizeSlotsList(currentAvailability[dateKey] || []);
        return (
            daySlots.length > 0 &&
            (daySlots.length !== sourceSlots.length ||
                daySlots.some((slot, index) => slot !== sourceSlots[index]))
        );
    }).length;

    if (
        replacedDatesCount > 0 &&
        !confirm(
            `Se reemplazaran horarios en ${replacedDatesCount} dia(s). Deseas continuar?`
        )
    ) {
        return;
    }

    mutateAvailabilityDraft(() => {
        targetDateKeys.forEach((dateKey) => {
            setSlotsForDate(dateKey, sourceSlots);
        });
        setAvailabilityClipboard(selectedDate, sourceSlots);
    });
    showToast(
        `Horarios duplicados a los proximos ${targetDateKeys.length} dias (pendiente de guardar)`,
        'success'
    );
}

export async function clearAvailabilityDay() {
    if (!requireEditableSelectedDate()) return;
    const selectedSlots = getSelectedDaySlots();
    if (selectedSlots.length === 0) {
        showToast('No hay horarios que limpiar en este dia', 'warning');
        return;
    }

    if (
        !confirm(
            `Eliminar ${selectedSlots.length} horario${selectedSlots.length === 1 ? '' : 's'} de ${formatAvailabilityDayLabel(selectedDate)}?`
        )
    ) {
        return;
    }

    mutateAvailabilityDraft(() => {
        setSlotsForDate(selectedDate, []);
    });
    setCurrentMonthFromDateKey(selectedDate);
    selectDate(selectedDate);
    showToast('Horarios del dia eliminados (pendiente de guardar)', 'success');
}

export async function clearAvailabilityWeek() {
    if (!requireEditableSelectedDate()) return;
    const weekDateKeys = buildDateKeyRange(selectedDate, 7);
    if (weekDateKeys.length === 0) {
        showToast('No se pudo preparar la semana de limpieza', 'error');
        return;
    }

    const datesWithSlots = weekDateKeys.filter(
        (dateKey) =>
            normalizeSlotsList(currentAvailability[dateKey] || []).length > 0
    );
    if (datesWithSlots.length === 0) {
        showToast(
            'No hay horarios para limpiar en los proximos 7 dias',
            'warning'
        );
        return;
    }
    const totalSlots = getSlotsCountForDateKeys(datesWithSlots);

    if (
        !confirm(
            `Eliminar ${totalSlots} horario(s) en ${datesWithSlots.length} dia(s) desde ${formatAvailabilityDayLabel(selectedDate)}?`
        )
    ) {
        return;
    }

    mutateAvailabilityDraft(() => {
        datesWithSlots.forEach((dateKey) => {
            setSlotsForDate(dateKey, []);
        });
    });
    setCurrentMonthFromDateKey(selectedDate);
    selectDate(selectedDate);
    showToast(
        `Semana limpiada (${datesWithSlots.length} dia(s)) pendiente de guardar`,
        'success'
    );
}
