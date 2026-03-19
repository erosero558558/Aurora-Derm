import { toArray, toText } from './turnero-release-control-center.js';

export function buildTurneroReleaseProgramCharter(input = {}) {
    const programName = toText(input.programName || 'Turnero Web por Clínica');
    const region = toText(
        input.region || input.scope || 'regional',
        'regional'
    );

    return {
        programName,
        region,
        mission: toText(
            input.mission ||
                'Operar un rollout clínico controlado, repetible y gobernable desde admin queue.'
        ),
        scope: toArray(
            input.scopeItems || [
                'Admin queue como centro operativo',
                'Superficies operator / kiosk / display',
                'Control por clinic-profile',
                'Readiness, release, governance y portfolio',
            ]
        ),
        principles: toArray(
            input.principles || [
                'No romper la operación clínica',
                'Liberar con evidencia',
                'Escalar por cohortes',
                'Mantener ownership y handoff claros',
            ]
        ),
        governanceRules: toArray(
            input.governanceRules || [
                'Las decisiones se registran por scope.',
                'Los incidentes bloqueantes requieren owner y fecha.',
                'Las acciones abiertas deben tener seguimiento.',
                'El pack debe poder copiarse y descargarse.',
            ]
        ),
        generatedAt: new Date().toISOString(),
    };
}

export function programCharterToMarkdown(charter = {}) {
    const scope = toArray(charter.scope);
    const principles = toArray(charter.principles);
    const governanceRules = toArray(charter.governanceRules);

    return [
        '# Program Charter',
        '',
        `- Programa: ${toText(charter.programName || 'Turnero Web por Clínica')}`,
        `- Región: ${toText(charter.region || 'regional')}`,
        `- Mission: ${toText(charter.mission || '')}`,
        '',
        '## Scope',
        ...(scope.length
            ? scope.map((item) => `- ${toText(item)}`)
            : ['- Sin scope.']),
        '',
        '## Principles',
        ...(principles.length
            ? principles.map((item) => `- ${toText(item)}`)
            : ['- Sin principios.']),
        '',
        '## Governance rules',
        ...(governanceRules.length
            ? governanceRules.map((item) => `- ${toText(item)}`)
            : ['- Sin governance rules.']),
        '',
        `Generated at: ${toText(charter.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

export default buildTurneroReleaseProgramCharter;
