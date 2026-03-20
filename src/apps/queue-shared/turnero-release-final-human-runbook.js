import { asObject, toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_STEPS = Object.freeze([
    'Abrir el repo en main y contrastar con el panel admin queue.',
    'Verificar qué módulos existen de verdad y cuáles son solo intención.',
    'Revisar runtime/source, provenance y blockers abiertos.',
    'Responder checklist crítico y registrar veredicto humano.',
    'Emitir diagnóstico final con evidencia exportable.',
]);

export function buildTurneroReleaseFinalHumanRunbook(input = {}) {
    const charter = asObject(input.charter);
    const checklist = asObject(input.checklist);
    const settlements = toArray(input.settlements);
    const session = asObject(input.session);
    const integrityScore = asObject(input.integrityScore);
    const steps = toArray(input.steps);
    const openQuestions = toArray(checklist.rows)
        .filter((row) => toText(row.state, 'open').toLowerCase() !== 'closed')
        .map((row) => toText(row.label || row.key || row.id));

    return {
        objective: toText(charter.objective || input.objective, ''),
        steps: steps.length > 0 ? steps : [...DEFAULT_STEPS],
        openQuestions,
        openSettlements: settlements.filter(
            (row) =>
                toText(row.state || row.status, 'open').toLowerCase() !==
                'closed'
        ).length,
        sessionStatus: toText(session.status, 'unprepared'),
        integrityScore: Number(integrityScore.score || 0),
        generatedAt: toText(input.generatedAt, new Date().toISOString()),
    };
}

export default buildTurneroReleaseFinalHumanRunbook;
