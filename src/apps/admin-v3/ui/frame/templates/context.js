import { escapeHtml } from '../../../shared/ui/render.js';

export function contextActionItem(action) {
    const extraAttrs = [
        `data-action="${escapeHtml(action.action)}"`,
        action.queueConsultorio
            ? `data-queue-consultorio="${escapeHtml(action.queueConsultorio)}"`
            : '',
        action.filterValue
            ? `data-filter-value="${escapeHtml(action.filterValue)}"`
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    return `
        <button type="button" class="sony-context-action" ${extraAttrs}>
            <span class="sony-context-action-copy">
                <strong>${escapeHtml(action.label)}</strong>
                <small>${escapeHtml(action.meta)}</small>
            </span>
            ${
                action.shortcut
                    ? `<span class="sony-context-action-key">${escapeHtml(action.shortcut)}</span>`
                    : ''
            }
        </button>
    `;
}
