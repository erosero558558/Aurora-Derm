import { getState } from '../../../core/store.js';
import {
    getBulkTargetTickets,
    getCalledTicketForConsultorio,
    getQueueSource,
    getSelectedQueueIds,
    getVisibleTickets,
} from '../selectors.js';
import { renderQueueActivity } from './activity.js';
import { setQueueNowMeta } from './meta.js';
import {
    renderQueueNextAdminList,
    renderQueueTableBody,
} from './section/content.js';
import { renderQueueInstallHub } from './section/install-hub/index.js';
import {
    syncQueueSelectionControls,
    syncQueueStationControls,
    syncQueueToggleControls,
} from './section/controls.js';
import { updateQueueTriageSummary } from './section/triage.js';

export function renderQueueSection(appendActivity = () => {}) {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const visible = getVisibleTickets();
    const selectedIds = getSelectedQueueIds();
    const bulkTargets = getBulkTargetTickets();
    const activeStationTicket = getCalledTicketForConsultorio(
        state.queue.stationConsultorio
    );

    renderQueueInstallHub();
    setQueueNowMeta(queueMeta, appendActivity);
    renderQueueTableBody(visible);
    renderQueueNextAdminList(queueMeta, state.queue.fallbackPartial);
    updateQueueTriageSummary({
        state,
        visible,
        selectedCount: selectedIds.length,
        activeStationTicket,
    });
    syncQueueSelectionControls({
        visibleCount: visible.length,
        selectedCount: selectedIds.length,
        bulkTargetCount: bulkTargets.length,
    });
    syncQueueStationControls(state, activeStationTicket);
    syncQueueToggleControls(state);
    renderQueueActivity();
}
