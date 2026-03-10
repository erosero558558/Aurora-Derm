import { setHtml, setText, toIsoDateKey } from '../../../shared/ui/render.js';
import { getState } from '../../../shared/core/store.js';
import {
    buildMonthDays,
    monthLabel,
    normalizeMonthAnchor,
    readSelectedDateOrDefault,
} from '../selectors.js';
import { cloneAvailability } from '../helpers.js';

export function renderAvailabilityCalendar() {
    const state = getState();
    const anchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        state.availability.selectedDate
    );
    const selectedDate = readSelectedDateOrDefault();
    const currentMonth = anchor.getMonth();
    const draft = cloneAvailability(state.availability.draft);
    const today = toIsoDateKey(new Date());

    setText('#calendarMonth', monthLabel(anchor));

    const markup = buildMonthDays(anchor)
        .map((date) => {
            const dateKey = toIsoDateKey(date);
            const slots = Array.isArray(draft[dateKey]) ? draft[dateKey] : [];
            const hasSlots = slots.length > 0;
            const inMonth = date.getMonth() === currentMonth;
            const classes = [
                'calendar-day',
                inMonth ? '' : 'other-month',
                hasSlots ? 'has-slots' : '',
                dateKey === selectedDate ? 'is-selected' : '',
                dateKey === today ? 'is-today' : '',
            ]
                .filter(Boolean)
                .join(' ');

            return `
                <button type="button" class="${classes}" data-action="select-availability-day" data-date="${dateKey}">
                    <span>${date.getDate()}</span>
                    <small>${hasSlots ? `${slots.length} slot${slots.length === 1 ? '' : 's'}` : inMonth ? 'Sin slots' : ''}</small>
                </button>
            `;
        })
        .join('');

    setHtml('#availabilityCalendar', markup);
}
