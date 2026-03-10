import { createToast } from '../../../../shared/ui/render.js';
import {
    addAvailabilitySlot,
    changeAvailabilityMonth,
    clearAvailabilityDay,
    clearAvailabilityWeek,
    copyAvailabilityDay,
    discardAvailabilityDraft,
    duplicateAvailabilityDay,
    jumpAvailabilityNextWithSlots,
    jumpAvailabilityPrevWithSlots,
    jumpAvailabilityToday,
    pasteAvailabilityDay,
    prefillAvailabilityTime,
    removeAvailabilitySlot,
    saveAvailabilityDraft,
    selectAvailabilityDate,
} from '../../../../sections/availability.js';

export async function handleAvailabilityAction(action, element) {
    switch (action) {
        case 'change-month':
            changeAvailabilityMonth(Number(element.dataset.delta || 0));
            return true;
        case 'availability-today':
        case 'context-availability-today':
            jumpAvailabilityToday();
            return true;
        case 'availability-prev-with-slots':
            jumpAvailabilityPrevWithSlots();
            return true;
        case 'availability-next-with-slots':
        case 'context-availability-next':
            jumpAvailabilityNextWithSlots();
            return true;
        case 'select-availability-day':
            selectAvailabilityDate(String(element.dataset.date || ''));
            return true;
        case 'prefill-time-slot':
            prefillAvailabilityTime(String(element.dataset.time || ''));
            return true;
        case 'add-time-slot':
            addAvailabilitySlot();
            return true;
        case 'remove-time-slot':
            removeAvailabilitySlot(
                decodeURIComponent(String(element.dataset.date || '')),
                decodeURIComponent(String(element.dataset.time || ''))
            );
            return true;
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            copyAvailabilityDay();
            return true;
        case 'paste-availability-day':
            pasteAvailabilityDay();
            return true;
        case 'duplicate-availability-day-next':
            duplicateAvailabilityDay(1);
            return true;
        case 'duplicate-availability-next-week':
            duplicateAvailabilityDay(7);
            return true;
        case 'clear-availability-day':
            clearAvailabilityDay();
            return true;
        case 'clear-availability-week':
            clearAvailabilityWeek();
            return true;
        case 'save-availability-draft':
            await saveAvailabilityDraft();
            createToast('Disponibilidad guardada', 'success');
            return true;
        case 'discard-availability-draft':
            discardAvailabilityDraft();
            createToast('Borrador descartado', 'info');
            return true;
        default:
            return false;
    }
}
