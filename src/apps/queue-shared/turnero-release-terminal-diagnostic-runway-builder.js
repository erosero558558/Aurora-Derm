import { asObject, toArray, toText } from './turnero-release-control-center.js';

function renderBulletList(items, emptyLabel) {
    const rows = toArray(items);
    if (rows.length === 0) {
        return [`- ${toText(emptyLabel, 'Sin elementos')}`];
    }

    return rows.map((item) => `- ${toText(item)}`);
}

export function buildTurneroReleaseTerminalDiagnosticRunway(pack = {}) {
    const charter = asObject(pack.charter);
    const checklist = asObject(pack.checklist);
    const settlements = toArray(pack.settlements);
    const session = asObject(pack.session);
    const integrityScore = asObject(pack.integrityScore);
    const openQuestions = toArray(checklist.rows).filter(
        (row) => toText(row.state, 'open').toLowerCase() !== 'closed'
    );
    const openSettlements = settlements.filter(
        (row) =>
            toText(row.state || row.status, 'open').toLowerCase() !== 'closed'
    );
    const generatedAt = toText(pack.generatedAt, new Date().toISOString());
    const scope = toText(pack.scope || charter.scope || 'regional', 'regional');
    const region = toText(pack.region || charter.region || scope, scope);
    const dossierDecision = toText(
        pack.dossierDecision ||
            charter.dossierDecision ||
            'issue-final-verdict',
        'issue-final-verdict'
    );

    const lines = [
        '# Terminal Diagnostic Runway',
        '',
        `Objective: ${toText(
            charter.objective || pack.objective,
            'Ejecutar un diagnóstico honesto y verificable del repo/panel sobre main.'
        )}`,
        `Scope: ${scope}`,
        `Region: ${region}`,
        `Dossier decision: ${dossierDecision}`,
        '',
        '## Charter principles',
        ...renderBulletList(charter.principles, 'No principles declared'),
        '',
        '## Terminal questions',
        ...renderBulletList(
            openQuestions.map((row) => row.label || row.key || row.id),
            'No open questions'
        ),
        '',
        '## Open settlements',
        ...renderBulletList(
            openSettlements.map(
                (settlement) =>
                    `${settlement.title} (${settlement.owner}, ${settlement.severity})`
            ),
            'No open settlements'
        ),
        '',
        `Session status: ${toText(session.status, 'unprepared')}`,
        `Integrity score: ${Number.isFinite(Number(integrityScore.score)) ? integrityScore.score : 0} (${toText(integrityScore.band, 'n/a')})`,
        `Integrity decision: ${toText(
            integrityScore.decision,
            'hold-terminal-runway'
        )}`,
        `Generated at: ${generatedAt}`,
    ];

    return {
        markdown: lines.join('\n'),
        sections: {
            scope,
            region,
            dossierDecision,
            openQuestions: openQuestions.length,
            openSettlements: openSettlements.length,
            sessionStatus: toText(session.status, 'unprepared'),
            integrityBand: toText(integrityScore.band, 'n/a'),
            integrityDecision: toText(
                integrityScore.decision,
                'hold-terminal-runway'
            ),
        },
        generatedAt,
    };
}

export default buildTurneroReleaseTerminalDiagnosticRunway;
