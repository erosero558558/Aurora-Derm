import { getState } from '../../../shared/core/store.js';

export function isReadOnlyMode() {
    const state = getState();
    const meta = state.data.availabilityMeta || {};
    return String(meta.source || '').toLowerCase() === 'google';
}

export function getCalendarModeSummary() {
    const meta = getState().data.availabilityMeta || {};
    const readOnly = isReadOnlyMode();
    const sourceText = readOnly ? 'Google Calendar' : 'Local';
    const modeText = readOnly ? 'Solo lectura' : 'Editable';
    const timezone = String(
        meta.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '-'
    );
    return { sourceText, modeText, timezone };
}
