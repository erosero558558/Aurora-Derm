import { apiRequest } from '../../../../shared/core/api-client.js';
import { cloneAvailability } from '../../helpers.js';
import { currentDraftMap, isReadOnlyMode } from '../../selectors.js';
import { updateState } from '../../../../shared/core/store.js';
import { renderAvailabilitySection } from '../../render.js';

function buildSavedActionLabel() {
    return `Cambios guardados ${new Date().toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })}`;
}

export async function saveAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const draft = currentDraftMap();
    const response = await apiRequest('availability', {
        method: 'POST',
        body: {
            availability: draft,
        },
    });

    const serverDraft =
        response?.data && typeof response.data === 'object'
            ? cloneAvailability(response.data)
            : draft;
    const responseMeta =
        response?.meta && typeof response.meta === 'object'
            ? response.meta
            : null;

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            availability: serverDraft,
            availabilityMeta: responseMeta
                ? {
                      ...state.data.availabilityMeta,
                      ...responseMeta,
                  }
                : state.data.availabilityMeta,
        },
        availability: {
            ...state.availability,
            draft: serverDraft,
            draftDirty: false,
            lastAction: buildSavedActionLabel(),
        },
    }));
    renderAvailabilitySection();
}
