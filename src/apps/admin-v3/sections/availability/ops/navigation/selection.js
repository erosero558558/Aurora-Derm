import { normalizeDateKey, normalizeMonthAnchor } from '../../helpers.js';
import { setAvailabilityPatch } from '../../state.js';

export function selectAvailabilityDate(dateKey) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return;
    setAvailabilityPatch(
        {
            selectedDate: normalized,
            monthAnchor: normalizeMonthAnchor(normalized, normalized),
            lastAction: '',
        },
        { render: true }
    );
}
