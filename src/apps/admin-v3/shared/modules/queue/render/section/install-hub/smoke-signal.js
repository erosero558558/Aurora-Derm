import { hasRecentQueueSmokeSignalForState as hasRecentQueueSmokeSignalForStateShared } from '../../../../../../../queue-shared/turnero-runtime-contract.mjs';

export function hasRecentQueueSmokeSignalForState(
    state,
    activeClinicId,
    maxAgeSec = 21600
) {
    return hasRecentQueueSmokeSignalForStateShared(
        state,
        activeClinicId,
        maxAgeSec
    );
}
