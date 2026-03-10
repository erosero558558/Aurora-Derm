import { escapeHtml } from '../../../shared/ui/render.js';

export function attentionItem(title, value, meta, tone = 'neutral') {
    return `
        <li class="dashboard-attention-item" data-tone="${escapeHtml(tone)}">
            <div>
                <span>${escapeHtml(title)}</span>
                <small>${escapeHtml(meta)}</small>
            </div>
            <strong>${escapeHtml(String(value))}</strong>
        </li>
    `;
}
