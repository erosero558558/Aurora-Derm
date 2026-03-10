import {
    beginQueueCallKeyCapture,
    callNextForConsultorio,
    cancelQueueSensitiveAction,
    clearQueueCallKeyBinding,
    clearQueueSearch,
    clearQueueSelection,
    confirmQueueSensitiveAction,
    dismissQueueSensitiveDialog,
    refreshQueueState,
    reprintQueueTicket,
    runQueueBulkAction,
    runQueueBulkReprint,
    runQueueReleaseStation,
    runQueueTicketAction,
    selectVisibleQueueTickets,
    setQueuePracticeMode,
    setQueueStationLock,
    setQueueStationMode,
    toggleQueueHelpPanel,
    toggleQueueOneTap,
    toggleQueueTicketSelection,
} from '../../../../shared/modules/queue.js';

export async function handleQueueAction(action, element) {
    switch (action) {
        case 'queue-refresh-state':
            await refreshQueueState();
            return true;
        case 'queue-call-next':
            await callNextForConsultorio(
                Number(element.dataset.queueConsultorio || 0)
            );
            return true;
        case 'queue-release-station':
            await runQueueReleaseStation(
                Number(element.dataset.queueConsultorio || 0)
            );
            return true;
        case 'queue-toggle-ticket-select':
            toggleQueueTicketSelection(Number(element.dataset.queueId || 0));
            return true;
        case 'queue-select-visible':
            selectVisibleQueueTickets();
            return true;
        case 'queue-clear-selection':
            clearQueueSelection();
            return true;
        case 'queue-ticket-action':
            await runQueueTicketAction(
                Number(element.dataset.queueId || 0),
                String(element.dataset.queueAction || ''),
                Number(element.dataset.queueConsultorio || 0)
            );
            return true;
        case 'queue-reprint-ticket':
            await reprintQueueTicket(Number(element.dataset.queueId || 0));
            return true;
        case 'queue-bulk-action':
            await runQueueBulkAction(
                String(element.dataset.queueAction || 'no_show')
            );
            return true;
        case 'queue-bulk-reprint':
            await runQueueBulkReprint();
            return true;
        case 'queue-clear-search':
            clearQueueSearch();
            return true;
        case 'queue-toggle-shortcuts':
            toggleQueueHelpPanel();
            return true;
        case 'queue-toggle-one-tap':
            toggleQueueOneTap();
            return true;
        case 'queue-start-practice':
            setQueuePracticeMode(true);
            return true;
        case 'queue-stop-practice':
            setQueuePracticeMode(false);
            return true;
        case 'queue-lock-station':
            setQueueStationLock(Number(element.dataset.queueConsultorio || 1));
            return true;
        case 'queue-set-station-mode':
            setQueueStationMode(String(element.dataset.queueMode || 'free'));
            return true;
        case 'queue-sensitive-confirm':
            await confirmQueueSensitiveAction();
            return true;
        case 'queue-sensitive-cancel':
            cancelQueueSensitiveAction();
            return true;
        case 'queue-capture-call-key':
            beginQueueCallKeyCapture();
            return true;
        case 'queue-clear-call-key':
            clearQueueCallKeyBinding();
            return true;
        default:
            return false;
    }
}

export { dismissQueueSensitiveDialog };
