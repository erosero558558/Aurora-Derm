import { escapeHtml, setHtml, setText } from '../../../shared/ui/render.js';
import {
    describeDay,
    getSelectedDaySlots,
    isReadOnlyMode,
} from '../selectors.js';

export function renderAvailabilitySlotList() {
    const { selectedDate, slots } = getSelectedDaySlots();
    const readOnly = isReadOnlyMode();

    setText('#selectedDate', selectedDate || '-');

    if (!slots.length) {
        setHtml(
            '#timeSlotsList',
            `<p class="empty-message" data-admin-empty-state="availability-slots">${escapeHtml(
                describeDay([], readOnly)
            )}</p>`
        );
        return;
    }

    setHtml(
        '#timeSlotsList',
        slots
            .map(
                (time) => `
            <div class="time-slot-item">
                <div>
                    <strong>${escapeHtml(time)}</strong>
                    <small>${escapeHtml(readOnly ? 'Slot publicado' : 'Disponible para consulta')}</small>
                </div>
                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(
                    selectedDate
                )}" data-time="${encodeURIComponent(time)}" ${
                    readOnly ? 'disabled' : ''
                }>Quitar</button>
            </div>
        `
            )
            .join('')
    );
}
