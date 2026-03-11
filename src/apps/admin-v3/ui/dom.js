import { qs } from '../shared/ui/render.js';

const SECTION_HOOKS = {
    dashboard: {
        hero: '.dashboard-hero-panel',
        priority: '.dashboard-signal-panel',
        workbench: '.dashboard-card-operations',
        detail: '#dashboardAdvancedAnalytics',
    },
    appointments: {
        hero: '.appointments-command-deck',
        priority: '.appointments-focus-panel',
        workbench: '.appointments-workbench',
    },
    callbacks: {
        hero: '.callbacks-command-deck',
        priority: '#callbacksOpsPanel',
        workbench: '.callbacks-workbench',
        detail: '.callbacks-next-panel',
    },
    reviews: {
        hero: '.reviews-summary-panel',
        detail: '.reviews-spotlight-panel',
        workbench: '#reviewsGrid',
    },
    availability: {
        hero: '.availability-header',
        workbench: '.availability-container',
        detail: '#availabilityDetailGrid',
    },
    queue: {
        hero: '#queueAppsHub',
        workbench: '.queue-admin-table',
        detail: '#queueActivityPanel',
    },
};

function setHook(section, selector, attribute) {
    if (!selector) return;
    const root = qs(`#${section}`);
    if (!(root instanceof HTMLElement)) return;
    const target = root.querySelector(selector);
    if (target instanceof HTMLElement) {
        target.setAttribute(attribute, 'true');
    }
}

export function bindFrameHooks() {
    const main = qs('#adminMainContent');
    if (main instanceof HTMLElement) {
        main.setAttribute('data-admin-frame', 'sony_v3');
    }

    Object.entries(SECTION_HOOKS).forEach(([section, hooks]) => {
        setHook(section, hooks.hero, 'data-admin-section-hero');
        setHook(section, hooks.priority, 'data-admin-priority-rail');
        setHook(section, hooks.workbench, 'data-admin-workbench');
        setHook(section, hooks.detail, 'data-admin-detail-rail');
    });
}
