import { handleGlobalKeyboardShortcut } from './keyboard/global.js';
import { handleQueueKeyboardShortcut } from './keyboard/queue.js';

export function attachKeyboardShortcuts(options) {
    window.addEventListener('keydown', (event) => {
        if (handleGlobalKeyboardShortcut(event, options)) {
            return;
        }
        handleQueueKeyboardShortcut(event, options.queueNumpadAction);
    });
}
