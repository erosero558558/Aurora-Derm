import {
    getStorageItem,
    setStorageItem,
} from '../../../shared/core/persistence.js';
import {
    normalizeSection,
    readSectionFromHash,
    setSectionHash,
} from '../../../shared/core/router.js';
import { getState, updateState } from '../../../shared/core/store.js';
import { setActiveSection } from '../../../ui/frame.js';
import {
    ADMIN_LAST_SECTION_STORAGE_KEY,
    ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
} from './constants.js';
import { renderSidebarState } from './sidebar.js';

export function restoreUiPrefs() {
    const storedSection = normalizeSection(
        getStorageItem(ADMIN_LAST_SECTION_STORAGE_KEY, 'queue')
    );
    const lastSection = readSectionFromHash(storedSection);
    const collapsed =
        getStorageItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, '0') === '1';

    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: lastSection,
            sidebarCollapsed: collapsed,
            sidebarOpen: false,
        },
    }));

    setActiveSection(lastSection);
    setSectionHash(lastSection);
    renderSidebarState();
}

export function persistUiPrefs() {
    const state = getState();
    setStorageItem(ADMIN_LAST_SECTION_STORAGE_KEY, state.ui.activeSection);
    setStorageItem(
        ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
        state.ui.sidebarCollapsed ? '1' : '0'
    );
}
