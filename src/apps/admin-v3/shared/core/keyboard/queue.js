import { hasFocusedInput } from '../../ui/render.js';
import { getState } from '../store.js';
import {
    getEventKeyData,
    isNumpadEvent,
    matchesCustomCallKey,
} from './helpers.js';

export function handleQueueKeyboardShortcut(event, queueNumpadAction) {
    if (typeof queueNumpadAction !== 'function') {
        return false;
    }

    const queueState = getState().queue;
    const isCaptureMode = Boolean(queueState.captureCallKeyMode);
    const { code } = getEventKeyData(event);
    const shouldHandle =
        isNumpadEvent(event, code) ||
        isCaptureMode ||
        matchesCustomCallKey(queueState, event, code);

    if (!shouldHandle) {
        return false;
    }
    if (hasFocusedInput()) {
        return true;
    }

    Promise.resolve(
        queueNumpadAction({
            key: event.key,
            code: event.code,
            location: event.location,
        })
    ).catch(() => {
        // handled by queue module toasts/activity when relevant
    });

    return true;
}
