import { toIsoDateKey } from '../../../../shared/ui/render.js';
import { currentDraftMap, isReadOnlyMode } from '../../selectors.js';
import { setDraftAndRender, writeSlotsForDate } from '../../state.js';
import { resolveWeekBounds } from '../../helpers.js';
import { getSelectedAvailabilityDate } from '../shared.js';

export function clearAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const selected = getSelectedAvailabilityDate();
    if (!selected) return;

    const confirmed = window.confirm(
        `Se eliminaran los slots del dia ${selected}. Continuar?`
    );
    if (!confirmed) return;

    writeSlotsForDate(selected, [], `Dia ${selected} limpiado`);
}

export function clearAvailabilityWeek() {
    if (isReadOnlyMode()) return;
    const selected = getSelectedAvailabilityDate();
    if (!selected) return;

    const bounds = resolveWeekBounds(selected);
    if (!bounds) return;
    const startKey = toIsoDateKey(bounds.start);
    const endKey = toIsoDateKey(bounds.end);

    const confirmed = window.confirm(
        `Se eliminaran los slots de la semana ${startKey} a ${endKey}. Continuar?`
    );
    if (!confirmed) return;

    const draft = currentDraftMap();
    for (let i = 0; i < 7; i += 1) {
        const date = new Date(bounds.start);
        date.setDate(bounds.start.getDate() + i);
        delete draft[toIsoDateKey(date)];
    }

    setDraftAndRender(draft, {
        selectedDate: selected,
        lastAction: `Semana limpiada (${startKey} - ${endKey})`,
    });
}
