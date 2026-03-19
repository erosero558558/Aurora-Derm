import { toArray, toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseRollbackCommandPack(input = {}) {
    const region = toText(
        input.region || input.scope || 'regional',
        'regional'
    );
    const incidents = toArray(
        input.releaseIncidents ||
            input.incidents ||
            input.assurancePack?.incidents
    );
    const critical = incidents.filter(
        (item) => String(item.severity || '').toLowerCase() === 'critical'
    ).length;

    const commands = [
        'Revalidar clinic-profile activo',
        'Forzar refresh de health / readiness',
        'Congelar wave actual',
        'Ejecutar fallback operativo por clínica',
        'Preparar rollback coordinado si no hay recuperación',
    ];

    const mode =
        critical > 0
            ? 'rollback_ready'
            : incidents.length > 2
              ? 'guided_recovery'
              : 'observe';

    return {
        region,
        mode,
        incidentCount: incidents.length,
        criticalCount: critical,
        commands,
        generatedAt: new Date().toISOString(),
    };
}

export function rollbackCommandPackToMarkdown(pack = {}) {
    const lines = [
        '# Rollback Command Pack',
        '',
        `Region: ${pack.region || 'regional'}`,
        `Mode: ${pack.mode || 'observe'}`,
        '',
        'Commands:',
        ...(pack.commands || []).map((item) => `- ${item}`),
        '',
        `Generated at: ${pack.generatedAt || new Date().toISOString()}`,
    ];
    return lines.join('\n');
}
