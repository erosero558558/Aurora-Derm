import { getState } from '../../../../shared/core/store.js';
import {
    cloneAvailability,
    normalizeMonthAnchor,
    resolveSelectedDate,
} from '../../helpers.js';
import { isReadOnlyMode } from '../../selectors.js';
import { setAvailabilityPatch } from '../../state.js';

export function discardAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const state = getState();
    if (state.availability.draftDirty) {
        const confirmed = window.confirm(
            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
        );
        if (!confirmed) return;
    }

    const base = cloneAvailability(state.data.availability || {});
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        base
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );
    setAvailabilityPatch(
        {
            draft: base,
            selectedDate,
            monthAnchor,
            draftDirty: false,
            lastAction: 'Borrador descartado',
        },
        { render: true }
    );
}
