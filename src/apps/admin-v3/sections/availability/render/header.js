import { qs, setText } from '../../../shared/ui/render.js';
import { getState } from '../../../shared/core/store.js';
import {
    describeDay,
    formatDateKeyLabel,
    getCalendarModeSummary,
    isReadOnlyMode,
    readSelectedDateOrDefault,
    sortTimes,
} from '../selectors.js';
import { cloneAvailability } from '../helpers.js';

function toggleReadOnlyControls(readOnly) {
    const addSlotForm = qs('#addSlotForm');
    const presets = qs('#availabilityQuickSlotPresets');
    if (addSlotForm) addSlotForm.classList.toggle('is-hidden', readOnly);
    if (presets) presets.classList.toggle('is-hidden', readOnly);

    const addSlotInput = qs('#newSlotTime');
    if (addSlotInput instanceof HTMLInputElement) {
        addSlotInput.disabled = readOnly;
    }

    const addSlotButton = qs('[data-action="add-time-slot"]');
    if (addSlotButton instanceof HTMLButtonElement) {
        addSlotButton.disabled = readOnly;
    }
}

function updateActionButtons(state, readOnly, clipboardSize) {
    const actionButtons = document.querySelectorAll(
        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
    );
    actionButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.id === 'availabilityDiscardDraftBtn') {
            button.disabled = readOnly || !state.availability.draftDirty;
            return;
        }
        if (button.id === 'availabilitySaveDraftBtn') {
            button.disabled = readOnly || !state.availability.draftDirty;
            return;
        }
        const action = String(button.dataset.action || '');
        if (action === 'paste-availability-day') {
            button.disabled = readOnly || clipboardSize === 0;
            return;
        }
        button.disabled = readOnly;
    });
}

export function refreshAvailabilityHeader() {
    const state = getState();
    const selectedDate = readSelectedDateOrDefault();
    const draft = cloneAvailability(state.availability.draft);
    const slots = Array.isArray(draft[selectedDate])
        ? sortTimes(draft[selectedDate])
        : [];
    const readOnly = isReadOnlyMode();
    const { sourceText, modeText, timezone } = getCalendarModeSummary();

    setText(
        '#availabilityHeading',
        readOnly
            ? 'Calendario de disponibilidad - Solo lectura'
            : 'Calendario de disponibilidad'
    );
    setText('#availabilitySourceBadge', `Fuente: ${sourceText}`);
    setText('#availabilityModeBadge', `Modo: ${modeText}`);
    setText('#availabilityTimezoneBadge', `TZ: ${timezone}`);

    setText(
        '#availabilitySelectionSummary',
        `Fecha: ${selectedDate} | ${formatDateKeyLabel(selectedDate)} | Fuente: ${sourceText} | Modo: ${modeText} | Slots: ${slots.length}`
    );
    setText(
        '#availabilityDraftStatus',
        state.availability.draftDirty
            ? 'cambios pendientes'
            : 'Sin cambios pendientes'
    );
    setText(
        '#availabilitySyncStatus',
        readOnly ? `Google Calendar | ${timezone}` : `Store local | ${timezone}`
    );

    toggleReadOnlyControls(readOnly);

    const clipboardSize = Array.isArray(state.availability.clipboard)
        ? state.availability.clipboard.length
        : 0;
    let dayActionStatus = describeDay(slots, readOnly);
    if (readOnly) {
        dayActionStatus = 'Edicion bloqueada por proveedor Google';
    } else if (state.availability.lastAction) {
        dayActionStatus = String(state.availability.lastAction);
    } else if (clipboardSize) {
        dayActionStatus = `Portapapeles: ${clipboardSize} slots`;
    }
    setText('#availabilityDayActionsStatus', dayActionStatus);

    updateActionButtons(state, readOnly, clipboardSize);
}
