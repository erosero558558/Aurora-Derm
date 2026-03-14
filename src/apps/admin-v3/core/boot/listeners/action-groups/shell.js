import { createToast } from '../../../../shared/ui/render.js';
import { getState } from '../../../../shared/core/store.js';
import {
    hideCommandPalette,
    showCommandPalette,
    showLoginView,
} from '../../../../ui/frame.js';
import {
    approveAgentAction,
    cancelAgentSession,
    closeAgentPanelExperience,
    openAgentPanelExperience,
    refreshAgentLiveState,
    submitAgentPrompt,
} from '../../../../shared/modules/agent.js';
import { logoutSession } from '../../../../shared/modules/auth.js';
import { syncQueueAutoRefresh } from '../../../../shared/modules/queue.js';
import {
    primeLoginSurface,
    resetTwoFactorStage,
    showLegacyFallbackSurface,
    showPrimaryLoginSurface,
    stopOpenClawPolling,
} from '../../auth.js';
import {
    focusQuickCommand,
    parseQuickCommand,
    runQuickAction,
    toggleSidebarCollapsed,
} from '../../navigation.js';
import { refreshDataAndRender } from '../../rendering.js';
import { setThemeMode } from '../../ui-prefs.js';

function buildOperatorAppUrl() {
    const currentUrl = new URL(window.location.href);
    const operatorUrl = new URL('/operador-turnos.html', currentUrl.origin);

    ['station', 'lock', 'one_tap'].forEach((param) => {
        const value = currentUrl.searchParams.get(param);
        if (value) {
            operatorUrl.searchParams.set(param, value);
        }
    });

    return `${operatorUrl.pathname}${operatorUrl.search}`;
}

export async function handleShellAction(action, element) {
    switch (action) {
        case 'close-toast':
            element.closest('.toast')?.remove();
            return true;
        case 'set-admin-theme':
            setThemeMode(String(element.dataset.themeMode || 'system'), {
                persist: true,
            });
            return true;
        case 'toggle-sidebar-collapse':
            toggleSidebarCollapsed();
            return true;
        case 'refresh-admin-data':
            await refreshDataAndRender(true);
            return true;
        case 'run-admin-command': {
            const input = document.getElementById('adminQuickCommand');
            if (input instanceof HTMLInputElement) {
                const parsed = parseQuickCommand(input.value);
                if (parsed) {
                    await runQuickAction(parsed);
                    input.value = '';
                    hideCommandPalette();
                }
            }
            return true;
        }
        case 'open-command-palette':
            showCommandPalette();
            focusQuickCommand();
            return true;
        case 'open-agent-panel':
            hideCommandPalette();
            await openAgentPanelExperience({ focus: true });
            return true;
        case 'close-agent-panel':
            closeAgentPanelExperience();
            return true;
        case 'admin-agent-refresh':
            if (String(getState().agent?.session?.sessionId || '').trim()) {
                await refreshAgentLiveState();
            } else {
                await openAgentPanelExperience({ focus: false });
            }
            return true;
        case 'admin-agent-submit': {
            const input = document.getElementById('adminAgentPrompt');
            if (input instanceof HTMLTextAreaElement) {
                await submitAgentPrompt(input.value);
                input.value = '';
            }
            return true;
        }
        case 'admin-agent-cancel':
            await cancelAgentSession();
            return true;
        case 'admin-agent-approve':
            await approveAgentAction(String(element.dataset.approvalId || ''));
            return true;
        case 'open-operator-app':
            window.location.assign(buildOperatorAppUrl());
            return true;
        case 'close-command-palette':
            hideCommandPalette();
            return true;
        case 'logout':
            stopOpenClawPolling();
            await logoutSession();
            syncQueueAutoRefresh({ immediate: false, reason: 'logout' });
            showLoginView();
            hideCommandPalette();
            primeLoginSurface();
            createToast('Sesion cerrada', 'info');
            return true;
        case 'reset-login-2fa':
            resetTwoFactorStage();
            return true;
        case 'show-login-fallback':
            stopOpenClawPolling();
            showLegacyFallbackSurface();
            return true;
        case 'show-login-primary':
            stopOpenClawPolling();
            showPrimaryLoginSurface();
            return true;
        default:
            return false;
    }
}
