import { setHtml, setText } from '../../../shared/ui/render.js';
import { contextActionItem } from '../templates.js';

function formatSyncMeta(lastRefreshAt) {
    const ts = Number(lastRefreshAt || 0);
    if (!ts) return 'Listo para primera sincronizacion';

    return `Ultima carga ${new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    })}`;
}

function resolveContextSummary(config, internalConsoleMeta) {
    if (internalConsoleMeta?.overall?.ready === false) {
        const summary = String(
            internalConsoleMeta?.overall?.summary || ''
        ).trim();
        if (summary) {
            return summary;
        }
    }

    return config.summary;
}

export function renderChromeContext(state, config, internalConsoleMeta) {
    setText('#adminSectionEyebrow', config.eyebrow);
    setText('#adminContextTitle', config.title);
    setText(
        '#adminContextSummary',
        resolveContextSummary(config, internalConsoleMeta)
    );
    setHtml(
        '#adminContextActions',
        config.actions.map((action) => contextActionItem(action)).join('')
    );
    setText('#adminSyncState', formatSyncMeta(state?.ui?.lastRefreshAt || 0));
}
