import { escapeHtml } from '../../../shared/ui/render.js';

export function breakdownList(entries, keyLabel, keyValue) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '<li><span>Sin datos</span><strong>0</strong></li>';
    }

    return entries
        .slice(0, 5)
        .map((entry) => {
            const label = String(entry[keyLabel] || entry.label || '-');
            const value = String(entry[keyValue] ?? entry.count ?? 0);
            return `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;
        })
        .join('');
}
