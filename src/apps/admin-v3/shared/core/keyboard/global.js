import { hasFocusedInput } from '../../ui/render.js';
import { getState } from '../store.js';
import {
    DEFAULT_QUICK_ACTIONS,
    QUEUE_QUICK_ACTION_OVERRIDES,
    SECTION_SHORTCUTS,
} from './constants.js';
import {
    getEventKeyData,
    isAltShiftShortcut,
    resolveNormalizedShortcut,
} from './helpers.js';

export function handleGlobalKeyboardShortcut(event, options) {
    const {
        navigateToSection,
        focusQuickCommand,
        focusCurrentSearch,
        runQuickAction,
        closeSidebar,
        toggleMenu,
        dismissQueueSensitiveDialog,
        toggleQueueHelp,
    } = options;

    const { key, code } = getEventKeyData(event);

    if (event.key === 'Escape') {
        if (
            typeof dismissQueueSensitiveDialog === 'function' &&
            dismissQueueSensitiveDialog()
        ) {
            return true;
        }
        closeSidebar();
        return true;
    }

    if (event.ctrlKey && !event.shiftKey && !event.altKey && key === 'k') {
        event.preventDefault();
        focusQuickCommand();
        return true;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey && key === '/') {
        event.preventDefault();
        focusCurrentSearch();
        return true;
    }

    if (!isAltShiftShortcut(event)) {
        return false;
    }

    const normalized = resolveNormalizedShortcut({ key, code });

    if (normalized === 'keym') {
        event.preventDefault();
        toggleMenu();
        return true;
    }

    if (normalized === 'digit0') {
        event.preventDefault();
        toggleQueueHelp();
        return true;
    }

    const section = SECTION_SHORTCUTS[normalized];
    if (section) {
        if (hasFocusedInput()) {
            return true;
        }
        event.preventDefault();
        navigateToSection(section);
        return true;
    }

    const quickActions = resolveQuickActions(getState().ui.activeSection);
    const quickAction = quickActions[normalized];
    if (!quickAction) {
        return false;
    }
    if (hasFocusedInput()) {
        return true;
    }

    event.preventDefault();
    runQuickAction(quickAction);
    return true;
}

function resolveQuickActions(activeSection) {
    if (activeSection !== 'queue') {
        return DEFAULT_QUICK_ACTIONS;
    }

    return {
        ...DEFAULT_QUICK_ACTIONS,
        ...QUEUE_QUICK_ACTION_OVERRIDES,
    };
}
