import { readSectionFromHash } from '../../../shared/core/router.js';
import { getState } from '../../../shared/core/store.js';
import { qs } from '../../../shared/ui/render.js';
import {
    closeSidebar,
    isCompactViewport,
    navigateToSection,
    toggleSidebarCollapsed,
    toggleSidebarOpen,
} from '../navigation.js';
import {
    getCompactSidebarFocusables,
    renderSidebarState,
    setThemeMode,
} from '../ui-prefs.js';

export function attachLayoutListeners() {
    const menuToggle = qs('#adminMenuToggle');
    const menuClose = qs('#adminMenuClose');
    const backdrop = qs('#adminSidebarBackdrop');

    menuToggle?.addEventListener('click', () => {
        if (isCompactViewport()) {
            toggleSidebarOpen();
            return;
        }
        toggleSidebarCollapsed();
    });

    menuClose?.addEventListener('click', () =>
        closeSidebar({ restoreFocus: true })
    );
    backdrop?.addEventListener('click', () =>
        closeSidebar({ restoreFocus: true })
    );

    window.addEventListener('resize', () => {
        if (!isCompactViewport()) {
            closeSidebar();
            return;
        }
        renderSidebarState();
    });

    document.addEventListener('keydown', (event) => {
        if (!isCompactViewport() || !getState().ui.sidebarOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeSidebar({ restoreFocus: true });
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = getCompactSidebarFocusables();
        if (!focusables.length) return;

        const currentIndex = focusables.indexOf(document.activeElement);
        if (event.shiftKey) {
            if (currentIndex === 0) {
                event.preventDefault();
                focusables[focusables.length - 1].focus();
            }
            return;
        }

        if (currentIndex === -1 || currentIndex === focusables.length - 1) {
            event.preventDefault();
            focusables[0].focus();
        }
    });

    window.addEventListener('hashchange', async () => {
        const section = readSectionFromHash(getState().ui.activeSection);
        await navigateToSection(section, { force: true });
    });

    window.addEventListener('storage', (event) => {
        if (event.key === 'themeMode') {
            setThemeMode(String(event.newValue || 'system'));
        }
    });
}
