import { toText } from './turnero-release-control-center.js';

const DEFAULT_OBJECTIVE =
    'Ejecutar un diagnóstico honesto y verificable del repo/panel sobre main.';
const DEFAULT_PRINCIPLES = Object.freeze([
    'No asumir integración sin evidencia',
    'Separar intención de realidad integrada',
    'Priorizar blockers reales sobre UI cosmética',
    'Cerrar con un veredicto humano exportable',
]);
const DEFAULT_FINAL_QUESTIONS = Object.freeze([
    '¿Qué quedó realmente montado en main?',
    '¿Qué drift existe entre source y runtime?',
    '¿Qué blockers siguen abiertos y quién los cierra?',
    '¿El panel está listo para diagnóstico honesto o solo para revisión parcial?',
]);

function normalizeTextList(values, fallback) {
    if (!Array.isArray(values) || values.length === 0) {
        return [...fallback];
    }

    const items = values.map((value) => toText(value)).filter(Boolean);
    return items.length > 0 ? items : [...fallback];
}

export function buildTurneroReleaseFinalDiagnosticCharter(input = {}) {
    const scope = toText(input.scope || input.region || 'regional', 'regional');
    const region = toText(
        input.region || input.scope || 'regional',
        'regional'
    );
    const dossierDecision = toText(
        input.dossierDecision || 'issue-final-verdict',
        'issue-final-verdict'
    );

    return {
        objective: toText(input.objective, DEFAULT_OBJECTIVE),
        scope,
        region,
        dossierDecision,
        principles: normalizeTextList(input.principles, DEFAULT_PRINCIPLES),
        finalQuestions: normalizeTextList(
            input.finalQuestions,
            DEFAULT_FINAL_QUESTIONS
        ),
        generatedAt: toText(input.generatedAt, new Date().toISOString()),
    };
}

export default buildTurneroReleaseFinalDiagnosticCharter;
