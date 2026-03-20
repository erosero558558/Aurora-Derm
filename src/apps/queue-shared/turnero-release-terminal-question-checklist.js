import { toArray, toText } from './turnero-release-control-center.js';

const DEFAULT_QUESTIONS = Object.freeze([
    {
        key: 'truth',
        label: 'Truth vs repo real',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'runtime',
        label: 'Runtime vs source',
        owner: 'infra',
        criticality: 'critical',
    },
    {
        key: 'surfaces',
        label: 'Superficies operator/kiosk/display',
        owner: 'ops',
        criticality: 'high',
    },
    {
        key: 'evidence',
        label: 'Evidencia y provenance',
        owner: 'program',
        criticality: 'critical',
    },
    {
        key: 'blockers',
        label: 'Blockers remanentes',
        owner: 'program',
        criticality: 'critical',
    },
]);

function normalizeQuestion(question, index) {
    const item =
        question && typeof question === 'object' && !Array.isArray(question)
            ? question
            : {};

    return {
        id: toText(item.id, `question-${index + 1}`),
        key: toText(item.key, `question-${index + 1}`),
        label: toText(item.label, `Question ${index + 1}`),
        owner: toText(item.owner, 'program'),
        criticality: toText(item.criticality, 'high'),
        state: toText(item.state, 'open'),
    };
}

export function buildTurneroReleaseTerminalQuestionChecklist(input = {}) {
    const questions = toArray(input.questions);
    const rows =
        questions.length > 0
            ? questions.map(normalizeQuestion)
            : DEFAULT_QUESTIONS.map(normalizeQuestion);
    const openRows = rows.filter(
        (row) => toText(row.state, 'open').toLowerCase() !== 'closed'
    );

    return {
        rows,
        summary: {
            all: rows.length,
            open: openRows.length,
            closed: rows.length - openRows.length,
            critical: rows.filter(
                (row) =>
                    toText(row.criticality, '').toLowerCase() === 'critical'
            ).length,
            high: rows.filter(
                (row) => toText(row.criticality, '').toLowerCase() === 'high'
            ).length,
        },
        generatedAt: toText(input.generatedAt, new Date().toISOString()),
    };
}

export default buildTurneroReleaseTerminalQuestionChecklist;
