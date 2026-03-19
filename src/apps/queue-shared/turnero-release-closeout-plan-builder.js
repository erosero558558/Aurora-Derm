import { asObject, toArray, toText } from './turnero-release-control-center.js';

const NEXT_ACTION_BY_DOMAIN = Object.freeze({
    deployment: 'Reconciliar superficies instaladas y volver a validar el pack',
    operations: 'Reconciliar superficies instaladas y volver a validar el pack',
    integration: 'Verificar contratos, freshness y wiring',
    privacy: 'Revisar obligaciones, accesos y guardrails',
    reliability: 'Actualizar drills, checkpoints y rollback plan',
    service: 'Mejorar adopción, entrenamiento y calidad operativa',
    governance: 'Validar control y trazabilidad del release',
    telemetry: 'Ajustar monitoreo y evidencia de métricas',
    strategy: 'Alinear criterios y aprobar el plan',
    orchestration: 'Alinear flujo y coordinación del cierre',
});

function normalizeRows(value, fallbackPrefix = 'row') {
    if (Array.isArray(value)) {
        return value.filter(Boolean).map((item, index) => {
            const row = asObject(item);
            const fallbackId = `${fallbackPrefix}-${index + 1}`;
            const id = toText(row.id || row.key, fallbackId);

            return {
                ...row,
                id,
                key: toText(row.key, id),
            };
        });
    }

    if (value && typeof value === 'object') {
        return Object.entries(value)
            .filter(([, entry]) => Boolean(entry))
            .map(([key, entry], index) => {
                const row = asObject(entry);
                const fallbackId = `${fallbackPrefix}-${index + 1}`;
                const id = toText(row.id || row.key || key, fallbackId);

                return {
                    ...row,
                    id,
                    key: toText(row.key, id),
                };
            });
    }

    return [];
}

function priorityRank(priority) {
    return priority === 'P1' ? 0 : 1;
}

export function buildTurneroReleaseCloseoutPlanBuilder(input = {}) {
    const gaps = normalizeRows(input.gaps, 'gap').filter((gap) => {
        const status = toText(gap.status, 'open').trim().toLowerCase();
        return status !== 'closed';
    });

    const rows = gaps
        .map((gap, index) => ({
            id: `closeout-${index + 1}`,
            title: toText(gap.title, `Gap ${index + 1}`),
            domain: toText(gap.domain, 'general'),
            owner: toText(gap.owner, 'ops'),
            surface: toText(gap.surface, 'admin'),
            priority: gap.severity === 'high' ? 'P1' : 'P2',
            severity: toText(gap.severity, 'medium'),
            status: toText(gap.status, 'open'),
            source: toText(gap.source, 'manual'),
            note: toText(gap.note, ''),
            nextAction:
                NEXT_ACTION_BY_DOMAIN[
                    toText(gap.domain, '').trim().toLowerCase()
                ] || 'Resolver wiring y revalidar el dominio',
        }))
        .sort((a, b) => {
            const rankDelta =
                priorityRank(a.priority) - priorityRank(b.priority);
            if (rankDelta !== 0) {
                return rankDelta;
            }

            return a.title.localeCompare(b.title, 'en');
        });

    const byOwner = rows.reduce((accumulator, row) => {
        const ownerKey = row.owner || 'ops';
        if (!accumulator[ownerKey]) {
            accumulator[ownerKey] = [];
        }

        accumulator[ownerKey].push(row);
        return accumulator;
    }, {});

    return {
        rows,
        byOwner,
        summary: {
            all: rows.length,
            p1: rows.filter((row) => row.priority === 'P1').length,
            p2: rows.filter((row) => row.priority === 'P2').length,
        },
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseCloseoutPlanBuilder;
