import { escapeHtml } from '../../../../../../ui/render.js';

export function renderQueueOpsPilotAction(action, variant = 'secondary') {
    if (!action) return '';
    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button ${action.id ? `id="${escapeHtml(action.id)}"` : ''} type="button" class="${className}" ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}>
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a ${action.id ? `id="${escapeHtml(action.id)}"` : ''} href="${escapeHtml(action.href || '/')}" class="${className}" target="_blank" rel="noopener">
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}
