import { toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseDomainRegistry(input = {}) {
    const domains = Array.isArray(input.domains) ? input.domains : [];
    const rows = domains.map((domain, index) => ({
        id: toText(domain.id || `domain-${index + 1}`),
        key: toText(domain.key || `domain-${index + 1}`),
        label: toText(domain.label || `Domain ${index + 1}`),
        owner: toText(domain.owner || 'ops'),
        mounted: Boolean(domain.mounted ?? true),
        surface: toText(domain.surface || 'admin-queue'),
        maturity: toText(domain.maturity || 'active'),
    }));

    const summary = {
        all: rows.length,
        mounted: rows.filter((row) => row.mounted).length,
        active: rows.filter((row) => row.maturity === 'active').length,
        draft: rows.filter((row) => row.maturity === 'draft').length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
