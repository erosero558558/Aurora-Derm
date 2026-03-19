import { toArray, toText } from './turnero-release-control-center.js';

function normalizeEvent(input = {}, index = 0) {
    const source = input && typeof input === 'object' ? input : {};

    return {
        key: toText(source.key || source.id || `event-${index + 1}`),
        label: toText(source.label || source.title || 'Governance event'),
        cadence: toText(
            source.cadence || source.frequency || 'weekly',
            'weekly'
        ),
        owner: toText(source.owner || 'board'),
        purpose: toText(
            source.purpose || source.detail || source.summary || ''
        ),
        timing: toText(source.timing || source.when || source.schedule || ''),
        state: toText(source.state || 'ready', 'ready'),
    };
}

export function buildTurneroReleaseGovernanceCalendar(input = {}) {
    const region = toText(
        input.region || input.scope || 'regional',
        'regional'
    );
    const events = toArray(
        input.events || [
            {
                key: 'weekly-ops',
                label: 'Weekly Ops Review',
                cadence: 'weekly',
                owner: 'ops',
                purpose: 'Alinear incidentes, acciones y cambios de la semana.',
            },
            {
                key: 'steering',
                label: 'Steering Committee',
                cadence: 'biweekly',
                owner: 'board',
                purpose: 'Revisar decisiones y bloqueos del programa.',
            },
            {
                key: 'qbr',
                label: 'Quarterly Business Review',
                cadence: 'quarterly',
                owner: 'board',
                purpose: 'Consolidar valor, riesgo y outcomes del rollout.',
            },
            {
                key: 'release-checkpoint',
                label: 'Release Checkpoint',
                cadence: 'daily',
                owner: 'release',
                purpose: 'Mantener la cadence operativa del rollout.',
            },
        ]
    ).map(normalizeEvent);

    return {
        region,
        events,
        nextEvent: events[0] || null,
        summary:
            input.summary ||
            `Cadencia activa para ${region}: ${events.length} evento${events.length === 1 ? '' : 's'} de gobernanza.`,
        generatedAt: new Date().toISOString(),
    };
}

export function governanceCalendarToMarkdown(calendar = {}) {
    const events = toArray(calendar.events);

    return [
        '# Governance Calendar',
        '',
        `- Region: ${toText(calendar.region || 'regional')}`,
        `- Summary: ${toText(calendar.summary || '')}`,
        '',
        '## Events',
        ...(events.length
            ? events.map(
                  (event) =>
                      `- ${toText(event.label)} · ${toText(event.cadence)} · ${toText(
                          event.owner
                      )} · ${toText(event.purpose)}`
              )
            : ['- Sin eventos.']),
        '',
        `Generated at: ${toText(calendar.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

export default buildTurneroReleaseGovernanceCalendar;
