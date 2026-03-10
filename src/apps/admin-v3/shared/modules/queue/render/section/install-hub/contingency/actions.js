import { escapeHtml } from '../../../../../../ui/render.js';

export function renderContingencyAction(cardId, action, index) {
    const label = escapeHtml(action.label || 'Abrir');
    const className = action.primary
        ? 'queue-contingency-card__action queue-contingency-card__action--primary'
        : 'queue-contingency-card__action';

    if (action.type === 'button') {
        return `
            <button type="button" class="${className}" data-action="${escapeHtml(action.action || '')}" data-queue-contingency-card="${escapeHtml(cardId)}" data-queue-contingency-action-index="${escapeHtml(String(index))}">
                ${label}
            </button>
        `;
    }

    if (action.type === 'copy') {
        return `
            <button type="button" class="${className}" data-action="queue-copy-install-link" data-queue-install-url="${escapeHtml(action.url || '')}" data-queue-contingency-card="${escapeHtml(cardId)}" data-queue-contingency-action-index="${escapeHtml(String(index))}">
                ${label}
            </button>
        `;
    }

    return `
        <a href="${escapeHtml(action.href || '/')}" class="${className}" ${action.external ? 'target="_blank" rel="noopener"' : ''}>
            ${label}
        </a>
    `;
}
