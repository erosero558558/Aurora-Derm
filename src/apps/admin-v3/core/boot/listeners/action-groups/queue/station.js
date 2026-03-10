import {
    beginQueueCallKeyCapture,
    callNextForConsultorio,
    clearQueueCallKeyBinding,
    refreshQueueState,
    runQueueReleaseStation,
    setQueuePracticeMode,
    setQueueStationLock,
    setQueueStationMode,
    toggleQueueHelpPanel,
    toggleQueueOneTap,
} from '../../../../../shared/modules/queue.js';
import { queueConsultorio } from './shared.js';

export async function handleQueueStationActionGroup(action, element) {
    switch (action) {
        case 'queue-refresh-state':
            await refreshQueueState();
            return true;
        case 'queue-call-next':
            await callNextForConsultorio(queueConsultorio(element));
            return true;
        case 'queue-release-station':
            await runQueueReleaseStation(queueConsultorio(element));
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
            setQueueStationLock(queueConsultorio(element, 1));
            return true;
        case 'queue-set-station-mode':
            setQueueStationMode(String(element.dataset.queueMode || 'free'));
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
